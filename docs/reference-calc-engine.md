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
  cablesData.ts       — 16-cross-section ampacity table (Cu/Al, PVC/XLPE, 1Φ/3Φ)
  installationMethods.ts — Reference Method A1–G ampacity multipliers
  phaseBalance.ts     — per-phase L1/L2/L3 accounting, neutral, unbalance
  feeders.ts          — shared phase rules + computeFeeders + breaker-finding
  shortCircuit.ts     — IEC 60909 transformer-impedance fault currents
  selectivity.ts      — TCC curves + coordination verdict
  riser.ts            — per-floor riser voltage-drop profile
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
export const STANDARD_BREAKERS = [10,16,20,25,32,40,50,63,80,100,125,160,200,250,320,400,500,630,800,1000,1250,1600,2000,2500];

export interface SizingResult {
  cableSize: number;        // mm²
  breakerSize: number;      // A
  nominalAmpacity: number;  // A, from the table
  deratedAmpacity: number;  // A, after temp/group/install derating
  tempFactor: number;
  groupFactor: number;
  neutralSize: number;      // mm², IEC 60364-5-54
  earthSize: number;        // mm², IEC 60364-5-54
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
    installMethod?: string;           // "A1"|"A2"|"B1"|"B2"|"C"|"E"|"F"|"G"
  }
): SizingResult;

export function calculateVoltageDrop(
  current: number, lengthMeters: number, cableSizeSqMm: number,
  powerFactor: number, isThreePhase: boolean, systemVoltage: number
): { dropVolts: number; dropPercent: number };
```

`sizeCableAndBreaker`:
1. **Breaker** — smallest `STANDARD_BREAKERS[i] ≥ ib`, clamps to the largest.
2. **Derating** — `tempFactor × groupFactor × installFactor`:
   - `tempFactor` from `TEMP_DERATING[insulation][ambientTemp]` (10–60 °C), default 1.0.
   - `groupFactor` from `GROUP_DERATING[groupingCount]` (1–20 cables), default 0.5.
   - `installFactor` from `METHOD_AMPACITY_FACTORS[method]` (Reference Methods A1/A2/B1/B2/C/E/F/G), default 1.0.
3. **Cable** — smallest cross-section whose `tableAmpacity × totalDerating ≥ breakerSize`, selected by material/insulation/phase. Falls back to the largest cross-section if none comply.
4. **Neutral** (IEC 60364-5-54) — for copper phase cables > 16 mm² 3-phase, neutral can reduce to `max(16, round(phaseSize/2))`; if `neutralCurrent` exceeds the reduced neutral's derated ampacity, neutral upsizes to full phase size.
5. **Earth (PE)** — `≤16: =phase; ≤35: 16; >35: round(phase/2)` (rounded to a catalog size).

`calculateVoltageDrop` — `Vd = √3·I·L·(R·cosφ + X·sinφ)` for 3-phase, `2·I·L·(R·cosφ + X·sinφ)` for 1-phase (the `2×` is the line+neutral loop). R/X in Ω/km from `CABLE_CATALOG`. `dropPercent = dropVolts/systemVoltage × 100`. The 1-phase `2×` factor is the riser bug that used to be wrong (see `riser.ts`).

## cablesData.ts + installationMethods.ts — ampacity tables

`CABLE_CATALOG`: 16 cross-sections (1.5 → 300 mm²). Each `CableSpec` carries per-configuration ampacity:
`copperPvc1Ph` / `copperPvc3Ph` / `copperXlpe1Ph` / `copperXlpe3Ph` / `alXlpe3Ph`, plus `resistance` and `reactance` (Ω/km) for voltage-drop.

`TEMP_DERATING[` `insulation` `][` `ambientTemp` `]` — PVC (max 70 °C) and XLPE (max 90 °C) curves over 10–60 °C.
`GROUP_DERATING[` `groupingCount` `]` — 1–20 cables bunched.
`METHOD_AMPACITY_FACTORS` — Reference Methods A1, A2, B1, B2, C, E, F, G (IEC 60364-5-52 Table B.52).

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
- **1-phase loads** with `assignedPhase ∈ {1,2,3}` are placed on their phase. With `assignedPhase = null`, the engine auto-assigns to the **least-loaded phase** (greedy LPT) in a stable order — a building-level map can override (see `buildingPhaseMap`).
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
- **`createFindBreaker`** — builds a breaker-model finder with a 3-tier fallback: (1) the selected/default family matching category + poles + ratedCurrent ≥ size; (2) the family's manufacturer, or the preferred manufacturer; (3) any matching category + poles. Returns `FoundBreaker { model, manufacturer, familyName, ratedCurrent, fallback }`. A Schneider family won't jump to ABB just because the sidebar preference is ABB.
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
export function calculateTransformerImpedance(ratedPowerKva: number, voltageSecondary: number, impedancePercent: number): number;
export function calculateShortCircuitCurrent(transformer: TransformerParameters): ShortCircuitResult;
export function calculateIscWithCable(transformerIsc: number, cableLengthM: number, cableSizeMm2: number, voltage: number, isCopper?: boolean, isSinglePhase?: boolean, insulation?: 'PVC' | 'XLPE'): number;
export function getTypicalImpedance(ratedPowerKva: number): number;
```

- **`calculateShortCircuitCurrent`** assumes infinite bus at primary (utility source Z=0), transformer is the sole current-limiting impedance, cable impedance negligible (worst case). Returns:
  - `threePhaseIsc` — `V_secondary / (√3 · Z_total)` in kA.
  - `twoPhaseIsc` — `× 0.866`.
  - `phaseToNeutralIsc` — `× 1.0` (solidly grounded ≈ 3-phase).
  - `peakCurrent` — `× 2.0` for LV (≤1000 V), `× 2.5` for HV (mechanical stress).
  - `faultMVA`, `transformerZ`, `sourceZ`.
- **`calculateIscWithCable`** — adds cable R (20 °C Cu 0.0172 / Al 0.0283 Ω·mm²/m, ×1.28 temp factor for XLPE at 90 °C / ×1.20 for PVC at 70 °C) and X (0.08 mΩ/m) to the transformer impedance for a fault at the cable's far end. No-op if length/size ≤ 0.
- **`getTypicalImpedance`** — looks up the closest `TRANSFORMER_IMPEDANCE` rating (4.0% → 7.5%), default `7.5` for larger-than-tabulated.

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
