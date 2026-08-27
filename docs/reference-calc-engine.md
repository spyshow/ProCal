# Calculation engine reference

Pure-TypeScript electrical engineering core. No React, no DB. Everything under
`src/lib/calculations/` is a pure function over plain TS types — the UI pages,
API routes, and report aggregators all import from here so the numbers never
drift between surfaces. Every module has a paired `*.test.ts` Vitest self-check.

> **Standards referenced throughout.** IEC 60364-5-52 (cable ampacity,
> installation methods, voltage drop, neutral/earth sizing per -5-54),
> IEC 60909 (short-circuit currents), IEC 60076 (transformers), ANSI/IEEE
> C57.12 (transformer impedance), IEC/EN 50160 and NEMA (unbalance framing),
> IEC 60439 (apartment diversity).

## Module map

```
src/lib/calculations/
  loads.ts            — connected/demand current, transformer & generator sizing
  cables.ts           — cable + breaker sizing, voltage drop (IEC 60364-5-52)
  cablesData.ts       — CABLE_CATALOG (R/X Ω/km), TEMP_DERATING, GROUP_DERATING
  installationMethods.ts — per-method ampacity TABLES (A1–D2, IEC Table B.52.x)
  phaseBalance.ts     — per-phase L1/L2/L3 accounting, neutral, unbalance
  feeders.ts          — shared phase rules + computeFeeders + breaker-finding
  shortCircuit.ts     — IEC 60909 transformer-impedance fault currents
  selectivity.ts      — TCC curves + coordination verdict (+ adiabatic withstand)
  riser.ts            — per-floor riser voltage-drop profile
  trace-engine.ts     — step-by-step "show your work" traces derived FROM the engine
  validate.ts         — assertPositive/assertOneOf/etc. (CalculationError → HTTP 400)
  version.ts          — ENGINE_VERSION stamped on projects at recalculate time
  golden-values.test.ts — hand-computed IEC worked examples pinning every constant
```

## loads.ts — currents, transformer, generator

`src/lib/calculations/loads.ts`

```ts
declare function getApartmentDiversityFactor(count: number): number;       // IEC 60439 residential diversity
declare function calculateThreePhaseCurrent(powerKva: number, voltageLineToLine?: number): number;   // default 400V
declare function calculateSinglePhaseCurrent(powerKva: number, voltageLineToNeutral?: number): number; // default 230V
declare function sizeTransformer(demandKva: number, safetyMargin?: number, perPhaseKva?: [number,number,number]): number;
declare function sizeGenerator(essentialDemandKva: number, largestMotorKva: number, startingFactor?: number, safetyMargin?: number): number;
```

- **`getApartmentDiversityFactor`** — `1.0 / 0.8 / 0.7 / 0.6 / 0.55 / 0.5` for
  `1 / ≤4 / ≤9 / ≤14 / ≤19 / ≥20` apartments (IEC 60439).
- **`calculateThreePhaseCurrent`** — `I = S / (√3 · V_L-L)`. Power in **kVA**
  (caller converts kW→kVA by dividing by PF). Returns A, 2-decimal.
- **`calculateSinglePhaseCurrent`** — `I = S / V_L-N`, default 230 V.
- **`sizeTransformer`** — rounds up to the next standard rating
  (`STANDARD_TRANSFORMERS = [100,160,250,400,630,800,1000,1250,1600,2000,2500,3150]`).
  When `perPhaseKva` is provided, sizes off `max(perPhaseKva) × 3` — a
  3-phase transformer rated S kVA delivers S/3 per winding, so the most-loaded
  winding is the limit. `safetyMargin` default `1.2`.
- **`sizeGenerator`** — handles motor starting surge: `S_gen ≥ (S_essential −
  S_largest_motor) + (S_largest_motor × startingFactor)`, `startingFactor`
  default `6.0`, margin `1.1`. Ratings `STANDARD_GENERATORS = [50,80,…,2000]`.

## cables.ts — cable + breaker sizing, voltage drop

`src/lib/calculations/cables.ts`. The core sizing function everything else routes through.

```ts
export const STANDARD_BREAKERS = [6,10,13,16,20,25,32,40,50,63,80,100,125,160,200,250,320,400,500,630,800,1000,1250,1600,2000,2500];
// (= codes.ts IEC_BREAKER_RATINGS; kept as a compat re-export)

export interface VoltageDropConstraint {
  lengthMeters: number;
  powerFactor: number;
  systemVoltage: number;
  maxPercent: number;               // project maxVoltageDropLighting/Power
}

export interface SizingResult {
  cableSize: number;        // mm²
  breakerSize: number;      // A
  nominalAmpacity: number;  // A, from the table
  deratedAmpacity: number;  // A, after temp/group/install derating
  tempFactor: number;
  groupFactor: number;
  neutralSize: number;      // mm², IEC 60364-5-54
  earthSize: number;        // mm², IEC 60364-5-54
  dropPercent?: number;     // % ΔV of the selected arrangement (when voltageDrop given)
  dropVolts?: number;       // V
}

export function sizeCableAndBreaker(
  ib: number,                          // design current (A)
  isThreePhase: boolean,
  options: {
    material: "copper" | "aluminum";
    insulation: "PVC" | "XLPE";
    ambientTemp: number;              // °C
    groupingCount: number;            // cables in group
    neutralCurrent?: number;          // A — drives neutral upsize
    installMethod?: string;           // "A1"|"A2"|"B1"|"B2"|"C"|"D1"|"D2"|"E"|"F"|"G"
    targetRuns?: number;              // parallel runs requested (e.g. existing install)
    maxCableSize?: number;            // cap the cross-section search
    voltageDrop?: VoltageDropConstraint;  // enforce %ΔU as well as ampacity
  }
): SizingResult;

export function calculateVoltageDrop(
  current: number, lengthMeters: number, cableSizeSqMm: number,
  powerFactor: number, isThreePhase: boolean, systemVoltage: number,
  parallelRuns?: number,              // default 1; n runs divide impedance by n
  material?: "copper" | "aluminum"    // default copper; Al scales R × 0.0283/0.0172
): { dropVolts: number; dropPercent: number };
```

`sizeCableAndBreaker` enforces the full **Ib ≤ In ≤ Iz** coordination **and**, when a
`voltageDrop` constraint is passed, **%ΔU ≤ limit** — it is the single compliance
authority for sizing (the SLD cable editor and trace engine delegate to it rather
than re-implementing):

1. **Breaker** — smallest standard rating ≥ ib, clamps to the largest. The catalog
   comes from the project's code: `nextBreakerRating(ib, code)` (see codes.ts below);
   IEC projects use `STANDARD_BREAKERS`, NEC/NEMA projects use the NEC 240.6(A) list.
   A `manualBreakerRating` option overrides the catalog entirely.
2. **Derating** — per-method ampacity tables already carry the installation-method
   effect; remaining multipliers are `TEMP_DERATING[insulation][ambientTemp]`
   × `GROUP_DERATING[groupingCount]` (both default 1.0 / from tables).
3. **Cable** — smallest cross-section whose `getAmpacity(size, method, insulation,
   phase, material) × tempFactor × groupFactor × runs ≥ breakerSize` AND (when a
   constraint is given) `calculateVoltageDrop(...) ≤ maxPercent`. Parallel runs
   are grouped under the IEC B.52.17 touching-set rule (`groupingCount − 1 +
   runs`). Falls back to the best-available arrangement at `maxCableSize`, adding
   a warning when even that exceeds the ΔU limit.
4. **Neutral** (IEC 60364-5-54) — for copper phase cables > 16 mm² 3-phase, neutral can reduce to `max(16, round(phaseSize/2))`; if `neutralCurrent` exceeds the reduced neutral's derated ampacity, neutral upsizes to full phase size.
5. **Earth (PE)** — `≤16: =phase; ≤35: 16; >35: round(phase/2)` (rounded to a catalog size).

`calculateVoltageDrop` — `Vd = √3·I·L·(R·cosφ + X·sinφ)` for 3-phase, `2·I·L·(R·cosφ + X·sinφ)` for 1-phase (the `2×` is the line+neutral loop). R/X in Ω/km from `CABLE_CATALOG` — exact size match, else the largest catalog size ≤ the declared one (no interpolation). Aluminum divides nothing but scales R by `0.0283/0.0172 ≈ 1.645`; reactance is unchanged. `dropPercent = dropVolts/systemVoltage × 100`.

All numeric inputs go through `validate.ts` (`assertPositive`/`assertNonNegative`/
`assertOneOf`) which throw `CalculationError`; API routes map that to HTTP 400 via
`errorResponse`, and the same helpers guard ingestion (phase ∈ {1,3}, positive
power/voltage/current, parseable cable-size strings) before anything persists.

## cablesData.ts + installationMethods.ts — ampacity tables

`CABLE_CATALOG`: 18 cross-sections (1.5 → 500 mm²), each carrying `resistance`
and `reactance` (Ω/km) for voltage-drop/fault math. The sizer's default
`maxCableSize` stays 300 mm² (the last published IEC B.52.x size); 400/500 mm²
are extrapolated rows (ampacity ≈ S^0.63 from each table's own upper range)
and are only reachable when a caller passes a higher `maxCableSize`.

Ampacity lives in **`installationMethods.ts`** as per-method transcriptions of
IEC 60364-5-52 Table B.52.x (1.5 → 300 mm²) plus extrapolated 400/500 entries:
`AMPACITY_{A1,A2,B1,B2,C,E,F,G,D1,D2}_{PVC,XLPE}_{3PH,1PH}`.
`getAmpacity(size, method, insulation, isThreePhase, material)` resolves the
method via `resolveReferenceMethod`, picks the table, and scales copper →
aluminum by `aluminumRatio(...)` (the tables are copper-only). Ground methods
add `GROUND_TEMP_DERATING` via `groundTemperatureDeratingFactor`. Every cell the
engine relies on is pinned by `golden-values.test.ts`.

`TEMP_DERATING[` `insulation` `][` `ambientTemp` `]` — PVC (max 70 °C) and XLPE (max 90 °C) curves over 10–60 °C (Table B.52.14; e.g. XLPE@15 °C = 1.12).
`GROUP_DERATING[` `groupingCount` `]` — 1–20 circuits bunched (Table B.52.17; Cg(2)=0.80 … Cg(6)=0.57).

## phaseBalance.ts — per-phase accounting

`src/lib/calculations/phaseBalance.ts`

```ts
export type PhaseIdx = 0 | 1 | 2;       // L1, L2, L3

export interface PhaseBalance {
  phaseCurrent: [number, number, number]; // [L1, L2, L3] A
  phaseKw: [number, number, number];
  totalKw: number;
  neutralCurrent: number;                // A, vector method
  maxPhaseCurrent: number;              // A — drives cable/breaker sizing
  unbalancePct: number;                  // (max−min)/avg × 100
  imbalanced: boolean;                   // unbalancePct > limit
  unbalanceLimitPct: number;             // 10 (IEC-framed) or 10 (NEMA-framed)
  neutralOversized: boolean;              // neutral > 2× max-phase (PDH §5C)
  internalImbalanceNotModeled: boolean;  // a 3Φ apartment template was modeled balanced
  assignments: { id: string; assignedPhase: number; phaseCount: 1 | 3 }[];
  neutralPhasors: { x: number; y: number };
}

export function phaseBalance(
  items: FloorItem[] | BuildingLoad[],
  project: Project,
  buildingPhaseMap?: Map<string, number>
): PhaseBalance;

export function neutralFromPhasors(x: number, y: number): number;
export function currentUnbalancePct(phaseCurrent: [number,number,number]): number;
```

- **Two kinds of input** — `phaseBalance` accepts `FloorItem[]` **or** `BuildingLoad[]` (detected by `"type" in items[0]`). Pass one kind, not both.
- **3-phase loads** split `kW/3` across L1/L2/L3, same line current each phase — the 120° cancellation drives neutral toward 0 for balanced 3-phase.
- **1-phase loads** with `assignedPhase ∈ {1,2,3}` are placed on their phase. With `assignedPhase = null`, the engine sorts unassigned loads **largest-first** (LPT — Longest Processing Time) then greedily assigns each to the **least-loaded phase**, so big loads land first and small ones fill the gaps — a building-level map can override (see `buildingPhaseMap`).
- **Neutral current** — vector method, total angle = 120° phase offset (L1=0°, L2=−120°, L3=+120°) **+ per-item displacement** `arccos(PF)` (lagging). `I_N = √(X² + Y²)` where `X = Σ I·cos(θ_total)`, `Y = Σ I·sin(θ_total)`. PF angle alone is wrong — it omits the 120° separation.
- **Unbalance** — `(max − min)/avg × 100`, a current-unbalance **proxy** (not VUF/LVUR, both voltage-based). `UNBALANCE_LIMIT_PCT` is 10 for both IEC and NEMA framing — the cited 2%/1–5% are voltage limits; current unbalance runs ~4–6× higher, so a literal 2% would cry-wolf. The framing (IEC vs NEMA) selects the label only.
- **Neutral-oversize guard** — `neutralCurrent > 2 × maxPhaseCurrent` flags `neutralOversized` (PDH Course E336 §5C). Triplen-harmonic 3× branch is intentionally **not** modeled (no harmonic data stored).
- **`internalImbalanceNotModeled`** — a 3-phase apartment template (bundle of 1-phase room circuits, not a balanced motor) is modeled as `kW/3` balanced; the flag surfaces the limitation.
- **`neutralPhasors`** — exposed so callers merging boards can combine the raw X/Y before sqrt, not the magnitudes.

## feeders.ts — shared phase rules + the one sizing path

`src/lib/calculations/feeders.ts`. **The single source of truth for phase/PF derivation + the shared sizing path** the panel, cable-schedule, breaker-schedule, and reports all consume.

```ts
export function isThreePhaseForItem(item: FloorItem): boolean;
export function isThreePhaseForBuildingLoad(load: BuildingLoad): boolean;
export function pfAngleForItem(item: FloorItem, project: Project): number;
export function pfAngleForBuildingLoad(load: BuildingLoad): number;
export function pfForFloorItem(item: FloorItem, project: Project): number;

export function createFindBreaker(equipment: EquipmentItem[], defaultFamilies?: DefaultFamilies, preferredManufacturer?: string): FindBreaker;

export function computeFeeders(building: Building, project: Project, findBreaker: FindBreaker): ComputeFeedersResult;
```

- **`isThreePhaseForItem`** — `APARTMENT` → `apartmentTemplate.phases === 3`; `LIBRARY` → `loadLibraryItem.phase === 3`; manual (SERVICE/PUMP/ELEVATOR panels) → `true`. Mirrors the API routes so every view agrees.
- **`pfForFloorItem`** — `APARTMENT`/manual → `project.powerFactor`; library → `loadLibraryItem.powerFactor`. Single source of truth for the PF the neutral math uses.
- **`createFindBreaker`** — builds a breaker-model finder with a 4-tier fallback: (1) SAME_FAMILY — the selected/default family matching category + poles + ratedCurrent ≥ size; (2) OTHER_FAMILY — other families of the same brand; (3) OTHER_BRAND — other active brands in the catalog; (4) GENERIC_SPEC — a generic engineering specification when nothing matches. Returns `FoundBreaker { model, manufacturer, familyName, ratedCurrent, fallback }`. A Schneider family won't jump to ABB just because the sidebar preference is ABB.
- **`computeFeeders`** — the **shared compute path**. Returns `mdbFeeders` (MDB outgoing: per-floor SMDB for sub-panel floors, else apartments, + building loads) and `smdbFeeders(floorNumber)` (a floor's outgoing apartment feeders). Feeder category routing:
  ```
  Main incomer          → ACB   (computed in panel/page.tsx, not here)
  Sub-panel riser       → MCCB  (floor total via maxPhaseCurrent)
  Building service load → MCCB  (SERVICE/PUMP/ELEVATOR)
  Apartment / end-load  → MCB
  ```
  The riser off the MDB bus is **always 3-phase/3-pole** even when every downstream item is 1-phase (the gear exists; unloaded phases carry zero but the cable is still 3-phase 4-wire). It sizes off `maxPhaseCurrent` (imbalance-aware), not the lumped sum. When the catalog's smallest model exceeds the design breaker size, the cable is re-sized to the actual model rating so breaker and cable stay consistent.

## shortCircuit.ts — IEC 60909 fault currents

`src/lib/calculations/shortCircuit.ts`

```ts
export const TRANSFORMER_IMPEDANCE: Record<number, number>;  // kVA → % (ANSI/IEEE C57.12)
export function sourceXrRatio(voltageSecondary: number): number;      // 6 LV / 10 HV
export function splitSourceImpedance(zOhms: number, xrRatio: number): { r: number; x: number };
export function calculateTransformerImpedance(ratedPowerKva: number, voltageSecondary: number, impedancePercent: number): number;
export function calculateShortCircuitCurrent(transformer: TransformerParameters): ShortCircuitResult;
export function calculateIscWithCable(transformerIsc: number, cableLengthM: number, cableSizeMm2: number, voltage: number, isCopper?: boolean, isSinglePhase?: boolean, insulation?: 'PVC' | 'XLPE', parallelRuns?: number): number;
export function getTypicalImpedance(ratedPowerKva: number): number;
```

- **Voltage factor** — IEC 60909-0 `c_max = 1.05` for LV (≤1000 V), `1.10` above.
  Omitting c understates Isc — the non-conservative direction for breaker Icu checks.
- **`calculateShortCircuitCurrent`** assumes infinite bus at primary (utility source Z=0), transformer is the sole current-limiting impedance, cable impedance negligible (worst case). Returns:
  - `threePhaseIsc` — `c_max · V_secondary / (√3 · Z_total)` in kA.
  - `twoPhaseIsc` — `× 0.866`.
  - `phaseToNeutralIsc` — earthing-system aware: TN-S/TN-C/TN-C-S ≈ 3-phase value; TT divides by the earth-loop impedance (default 0.5 Ω); IT first fault = 0 (`itFirstFault`).
  - `peakCurrent` — `ip = κ·√2·I″k` with `κ = 1.02 + 0.98·e^(−3R/X)` at X/R = 6 LV / 10 HV (κ≈1.61 → ip/I″k ≈ 2.28). The old flat ×2.0 understated LV make-capacity requirements.
  - `faultMVA`, `transformerZ`, `sourceZ`.
- **`calculateIscWithCable`** — adds cable R (20 °C Cu 0.0172 / Al 0.0283 Ω·mm²/m, ×1.28 temp factor for XLPE at 90 °C / ×1.20 for PVC at 70 °C) and X (0.08 mΩ/m) to the transformer impedance for a fault at the cable's far end. Impedances combine **component-wise** per IEC 60909: `Z_total = √((Rt+Rc)² + (Xt+Xc)²)` — scalar |Zt|+|Zc| always overstates Z and understates downstream Isc. The transformer magnitude is split into R + jX via `splitSourceImpedance` at `sourceXrRatio`. Parallel runs divide the cable impedance by n; a single-phase (L-N) fault uses Uo = V/√3 with a go+return loop (×2). No-op if length/size ≤ 0.
- **`getTypicalImpedance`** — nearest `TRANSFORMER_IMPEDANCE` rating; ties and between-rating values round **down** so %Z is never understated (the non-conservative direction again).

## selectivity.ts — TCC curves + coordination

`src/lib/calculations/selectivity.ts`

```ts
export interface BreakerCurveSettings {
  inRating: number; // In (A)
  ir: number;       // Long-time pickup (A)
  tr: number;       // Long-time delay (s)
  isd?: number;     // Short-time pickup (A)
  tsd?: number;     // Short-time delay (s)
  i2t?: boolean;    // S I²t ON/OFF
  ii?: number;      // Instantaneous pickup (A)
  ig?: number;      // Ground-fault pickup (A)
  tg?: number;      // Ground-fault delay (s)
}

export function getTripTimeForCurrent(settings: BreakerCurveSettings, current: number): number;
export function generateCurvePoints(settings: BreakerCurveSettings): CurvePoint[];
export function verifyCoordination(upstream: BreakerCurveSettings, downstream: BreakerCurveSettings, availableFaultCurrentAmps: number, manufacturerPair: { upstreamMfg: string; downstreamMfg: string }): CoordinationResult;
export function recommendBreakerSettings(loadCurrent: number, cableAmpacity: number, breakerIn: number): BreakerCurveSettings;
```

- **`getTripTimeForCurrent`** — the trip-curve model. L region: `t = tr·36/((I/Ir)²−1)` (standard inverse). S region: constant `tsd`, or inverse `tsd·(Isd/I)²` if `i2t` (floored at 0.02 s). I region: 0.02 s above `ii`. The breaker trips on whichever threshold fires first; result clamped to `[0.01, 10000]` s.
- **`generateCurvePoints`** — 101 log-spaced points from `0.5·Ir` to `30·In`.
- **`verifyCoordination`** — scans 201 log-spaced currents from `downstream.ir` to `max(faultCurrent, 15·In)`, finds the first current where the upstream trips ≤ the downstream (overlap). Status:
  - **NONE** — overlap at low current (`≤ downstream.ir·1.5`, overload settings too close), or upstream `Ir ≤ downstream.Ir`.
  - **PARTIAL** — selective up to `limitCurrent`; above it both trip.
  - **FULL** — overlap only occurs above the available fault current (practically selective).
  - **Cascading** — supported only when a tested manufacturer selectivity/cascading limit applies to the same-manufacturer pair; `cascadingIcu` = that tested limit (kA), not a blanket constant.
- **`recommendBreakerSettings`** — `Ir` ≈ `min(In, max(Ib, 1.15·Ib))` bounded by cable ampacity, `Tr=12 s`, `Isd=5·Ir`, `Tsd=0.1 s`, `Ii=10·In`, `Ig=0.4·In`, `Tg=0.1 s`.

## riser.ts — per-floor riser voltage drop

`src/lib/calculations/riser.ts`

```ts
export function parseMm2(value: string | null | undefined): number | null;
export function computeFloorRiserVd(fd: FloorDesign, project: Project): RiserFloorVd;
```

`computeFloorRiserVd` returns the ΔV breakdown for one floor. It reuses `calculateVoltageDrop` and the shared `phaseBalance.maxPhaseCurrent` so the riser page agrees with panel/cable-schedule on the load the riser sees.

- **Direct floor** (`!hasFloorSubPanels`) — no vertical riser; the floor's ΔV = the worst apartment-branch ΔV (`totalVdPercent = branchVdPercent`).
- **SDB floor** (`hasFloorSubPanels`) — `MDB → riser → SDB → apartment branches`. Riser ΔV uses `maxPhaseCurrent` (imbalance-aware) at 3-phase/400 V; `total = riser + worst branch`.

> `ponytail:` a 1-phase apartment feeder carries line-neutral current at 230 V
> (the `2·I·L` path); only 3-phase feeders use `√3·I·L` at 400 V. The riser page
> used to pass 3-phase/400 V for everything — that was the bulk of "ΔV not correct".
> `itemVoltage = is3ph ? project.voltage : project.voltage/√3`.

Each field carries a `*NoData` flag for missing length/size so the UI can show "can't compute" rather than a wrong zero. `worstItemName` annotates the branch producing the worst ΔV.

## trace-engine.ts — "show your work" traces

`buildVoltageDropTrace`, `buildShortCircuitTrace`, `buildPhaseBalanceTrace`, etc.
produce step-by-step derivations for the UI's calculation-trace popover. They
**derive from the same modules the numbers come from** — catalog R/X lookups,
`splitSourceImpedance`, `currentUnbalancePct`, `clampPowerFactor` — so a trace
can never disagree with the result it explains (`trace-engine.test.ts` asserts
trace steps embed the engine's exact `dropVolts`/`dropPercent` strings). Every
trace carries a `standardCitation` (e.g. IEC 60364-5-52 §525, IEC 60909).

## golden-values.test.ts — constant-table tripwire

22 hand-computed expectations from IEC worked examples and transcribed table
cells (transformer Z/Ik″/ip, adiabatic withstand k-values, closed-form voltage
drops, individual ampacity/derating cells). If one fails, a constant was
corrupted or a formula changed: **fix the constant, never the expectation.**

## version.ts — ENGINE_VERSION

Bumped when calculation semantics change; the recalculate routes stamp it on
`Project.engineVersion`. A project whose stamp is older (or null = pre-versioning)
was computed under older rules until a recalculate heals it.

## codes.ts — multi-code profiles (IEC / NEC)

`src/lib/calculations/codes.ts`. Keyed off `Project.calculationStandard`
(`"IEC" | "NEMA"` — `"NEMA"` is the stored alias for NEC practice;
`codeOf()` resolves it, anything else falls back to IEC):

- `BREAKER_RATINGS.IEC` / `.NEC` — standard breaker catalogs (IEC 60898/60947
  preferred values vs NEC 240.6(A)). `nextBreakerRating(ib, code)` is the In
  selection step; `sizeCableAndBreaker({ code })`, the SLD cable editor
  (`recalculateCable({ code })`) and the cable-schedule page all pass the
  project's resolved code through.
- `VD_RECOMMENDED` — informative ΔU limits (IEC Annex G: 3 % lighting /
  5 % other; NEC informational note: 3 % branch, 5 % feeder+branch total).
- `CODE_LABEL` — report/trace provenance strings.
- `awgLabel(mm2)` — mm² → AWG/kcmil display cross-reference (nearest
  conductor area per NEC Chapter 9 Table 8). **Display only**: storage and the
  engine stay metric because `parseCableSize` misreads "3/0" as 3 mm². The
  render-side wrapper is `formatCableSizeFor(value, calculationStandard)`
  (cables.ts) — it accepts a raw size or a stored metric string
  ("2 × 240 mm²") and emits AWG/kcmil labels when the standard is "NEMA".
  All schedule/report surfaces (MDB/breaker/cable/VD/SC/BOM schedules,
  panel/riser/cable-schedule pages, Excel export, SLD generator labels)
  route through it; IEC output is byte-identical to the old formatting.

**Known ceiling:** conductor ampacity still uses the IEC 60364-5-52 method
tables for both codes. A full NEC Table 310.16 port needs an AWG/kcmil size
axis through `parseCableSize` and the data model — until then NEC projects
get NEC breaker ratings + VD guidance on IEC-method ampacity.

## How they compose

The shared pipe is **`computeFeeders`** (feeders.ts): it pulls a building's
`floorDesigns` + `buildingLoads`, runs `phaseBalance` per floor and per building,
then routes each item through `sizeCableAndBreaker` (cables.ts) + the injected
`findBreaker` (catalog match). The panel page adds the main-incomer ACB and
transformer sizing (`sizeTransformer`, `loads.ts`) on top; the riser page runs
`computeFloorRiserVd` (riser.ts) par; the coordination page calls
`verifyCoordination` (selectivity.ts) against `BreakerSettings` from the DB.
Short-circuit (`shortCircuit.ts`) feeds the available-fault-current input to
the coordination verdict and the report's fault-level cell.

## Related

- [Phase balancing](./explanation-phase-balancing.md) — why the neutral math
  uses total angle and the unbalance proxy is current-based.
- [API reference](./reference-api.md) — the routes that persist recalculate/
  rebalance results back to `FloorItem.calculated*` columns.
- [Data model reference](./reference-data-model.md) — `assignedPhase` on
  `FloorItem` / `BuildingLoad`.
