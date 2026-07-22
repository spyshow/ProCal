# Phase Balancing in 3-Phase 4-Wire Building Distribution — Engineering Methodology for ProCal

**Deep-research report — continued from the 2026-07-13 `deep-research` workflow run (`wf_47cc1f9d-ec6`).**

> **Environment caveat (important):** The original workflow used a WebSearch fan-out, but **WebSearch returned zero results for every query** in this environment (verified across 5 queries during this continuation), which is exactly why the prior run produced 0 findings. Most standards-body and vendor sites (nema.org, energy.gov, ecmag.com, eaton.com, ieee, weg.net, engineeringtoolbox, electrical4u) return **403 / 404 / ECONNRESET** through WebFetch in this sandbox. The only reliably-reachable sources are Wikipedia-family pages. The methodology and facts below are therefore drawn from those reachable sources plus established electrical-engineering knowledge; two specific numeric facts that I could **not** pull a primary citation for in this session are flagged inline as `[unverified-primary]` so they are not mistaken for cited findings.

---

## 1. Executive summary

ProCal currently sums all loads (single- and three-phase) into one total kW and one total current. In a real 3-phase 4-wire system, each **single-phase** load (most apartments, lighting circuits, sockets) is connected across **one phase and the neutral** — so it only loads L1, L2, *or* L3 — while three-phase loads (elevator, pumps, AC, fire pump) draw equally from all three. Treating everything as one lumped sum overstates the neutral/phase balance and hides imbalance, which inflates neutral current, overheats transformers/cables, and trips protection. The upgrade is a **per-phase bookkeeping model**: (a) tag every load with a phase (3-phase loads → all three; 1-phase loads → assigned to L1/L2/L3), (b) compute per-phase kW and current, (c) compute the resulting neutral current from the vector sum, (d) compute a voltage-unbalance factor, and (e) apply derating when imbalance exceeds the standard limits.

The neutral-current and voltage-unbalance math is well-defined and standard (symmetrical components / KCL). The *engineering* judgment is the **phase-assignment algorithm** for the 1-phase loads — there is no single mandated method; practice is greedy lowest-current-phase assignment, which is near-optimal for the balanced-PF case and trivial to implement.

---

## 2. The five sub-questions, with the reachable-source basis

### 2.1 Phase-assignment algorithm (distributing 1-phase loads across L1/L2/L3)

**What the sources say.** A four-wire star (wye) system exists precisely to serve *"a mixture of single-phase and three-phase loads,"* and *"all three phases will have the same magnitude of voltage relative to the neutral,"* enabling *"three separate single-phase supplies at constant voltage"* — in Europe each customer *"may be only fed from one phase and the neutral"* [[Three-phase electric power](https://en.wikipedia.org/wiki/Three-phase_electric_power)]. Engineers strive to design so *"the power drawn from each of three phases is the same, as far as possible at that site"* [[Three-phase electric power](https://en.wikipedia.org/wiki/Three-phase_electric_power)]. Single-phase loads connect *"between one phase and neutral or between two phases"* [[Single-phase electric power](https://en.wikipedia.org/wiki/Single-phase_electric_power)].

**No Wikipedia/practitioner source gives a named mandated algorithm** — phase balancing at the board level is an engineering heuristic, not a code requirement. The standard practice, and what you should implement, is:

- **3-phase loads** (elevators, pumps, central AC, fire pump): contribute equally to L1, L2, L3 → per-phase kW = kW/3 each.
- **1-phase loads** (apartments fed L-N, lighting circuits, sockets): each is assigned to exactly one phase. Assign greedily to whichever phase currently has the **lowest running kW/current** (a "lowest-bin-first" / greedy bin-packing). Sort loads largest-first (LPT — longest-processing-time first) before assigning; this is the classic approximation that keeps the max bin close to the optimum and bounds the resulting imbalance.
- Apartments that are themselves 3-phase: treat as a 3-phase load (kW/3 per phase).

This gives, for a feeder/MDB, three per-phase kW totals (kW_L1, kW_L2, kW_L3) and three per-phase currents, plus a neutral current from the residual.

> Note: Wikipedia's *Load balancing (electrical power)* and *Power balance* articles cover **grid-level demand management / energy storage** — not board-level phase balancing [[Load balancing (electrical power)](https://en.wikipedia.org/wiki/Load_balancing_(electrical_power))]. There is no Wikipedia article that documents the greedy/ LPT phase-assignment heuristic; it is general scheduling/bin-packing knowledge, so it is presented here as established practice, not a cited finding.

### 2.2 Neutral current in an unbalanced 3-phase 4-wire system (the vector math)

**What the sources say.** By Kirchhoff's Current Law at the neutral node, **I_N = I₁ + I₂ + I₃** (phasor sum). In the balanced case this is zero; when *"the currents on the three live wires…are not equal or are not at an exact 120° phase angle,"* the residual returns via the neutral [[Three-phase electric power](https://en.wikipedia.org/wiki/Three-phase_electric_power)]. Unbalanced loading means *"the common neutral wire carries the currents resulting from these imbalances,"* and *"any unbalanced phase loading on the secondary side of the transformer will use the transformer capacity inefficiently"* [[Three-phase electric power](https://en.wikipedia.org/wiki/Three-phase_electric_power)]. *"The neutral carries current if the loads on each phase are not identical"* [[Neutral wire](https://en.wikipedia.org/wiki/Neutral_wire)].

The formal framework is **symmetrical components**: any unbalanced set of three phasors decomposes into positive, negative, and zero sequence; the **zero-sequence current is exactly one-third of the neutral current** (because zero-sequence components are in-phase and *sum* rather than cancel) [[Symmetrical components](https://en.wikipedia.org/wiki/Symmetrical_components)]. Delta connections block zero-sequence currents; a wye with a neutral provides the path for them [[Symmetrical components](https://en.wikipedia.org/wiki/Symmetrical_components)].

**The closed-form magnitude formula** you asked about —
`I_N = √(I₁² + I₂² + I₃² − I₁·I₂ − I₂·I₃ − I₃·I₁)` — is the magnitude of the phasor sum **assuming the three phase currents have equal power-factor angle** (i.e. they are 120° apart in phase). Derivation: with I₁ = I₁∠0, I₂ = I₂∠−120°, I₃ = I₃∠+120°, |I₁+I₂+I₃|² = I₁²+I₂²+I₃² + 2·(I₁I₂cos120° + I₂I₃cos120° + I₃I₁cos120°) = I₁²+I₂²+I₃² − (I₁I₂ + I₂I₃ + I₃I₁).

**Primary citation for the correct (general) method.** The authoritative source located in this session is a PE-authored PDH engineering course, *"Calculating Currents in Balanced and Unbalanced Three Phase Circuits"* (Joseph E. Fleckenstein, P.E., PDH Online Course E336, 2020) — provided by the user as `uploads/3phase.pdf` (84 pp.). It computes the neutral/line current as the **vector (component) resultant**, not the scalar shortcut:

> Equation 5A: `X = I₁·cos θ₁ + I₂·cos θ₂ + … + Iₙ·cos θₙ`; `Y = I₁·sin θ₁ + I₂·sin θ₂ + … + Iₙ·sin θₙ`; `I = √(X² + Y²)`.

Section 5C ("Unbalanced Three Phase Wye Circuit") states for the neutral conductor (Conductor D): *"the current in the neutral conductor (Conductor D) is of importance and the size of the neutral conductor is likewise important. Conductor D must be sized to carry the largest combination of currents that may result from the combination of currents in Conductors A, B and C. It may be shown that the largest possible current in Conductor D will be **twice the maximum current** in conductors A, B or C."* It works examples with **different power factors per phase** (e.g. Ida = 15 A @ PF 0.8 leading, Idb = 5 A @ PF 1.0, Idc = 10 A @ PF 0.9 lagging) — confirming the component method, not the equal-PF scalar form.

This **confirms the implementation recommendation**: ProCal should use the general complex/component sum (Equation 5A generalized to 3 phases with their individual PF angles) so it stays correct for mixed apartment (PF ~0.9) + motor (PF ~0.8) loads. The simplified scalar `√(I₁²+I₂²+I₃²−I₁I₂−I₂I₃−I₃I₁)` form is a valid special case (equal PF, equal 120° separation) usable only as a sanity check; the PDH source does not present it and instead uses the component method. The `2× max phase current` worst-case neutral bound is a useful sizing guard.

### 2.3 Voltage-unbalance factor / phase-voltage unbalance — definition & calc

**What the sources say.** Voltage unbalance is conventionally defined two ways and the two give **different** numbers, which is a known source of confusion:

- **NEMA / line-to-line method** ("Line Voltage Unbalance Rate", LVUR): the maximum deviation of any line-to-line voltage from the *average* line-to-line voltage, divided by the average, as a percent.
  `LVUR% = max|V_LL − V_avg_LL| / V_avg_LL × 100`
  Line-to-neutral voltages must **not** be used (zero-sequence components give wrong results), and phase angles are **not** included.
- **True / IEC method** ("Voltage Unbalance Factor", VUF): the ratio of **negative-sequence** to **positive-sequence** voltage via symmetrical-component decomposition.
  `VUF% = |V₂| / |V₁| × 100`
  This captures both magnitude *and* phase-angle differences, which is why it differs from LVUR. Zero-sequence is not used because zero-sequence currents cannot flow in induction motors (delta or ungrounded-wye windings). An induction motor responds to the "true" (VUF) value.

**Primary citation.** [voltage-disturbance.com — Voltage Unbalance](https://voltage-disturbance.com/voltage-quality/voltage-unbalance/) — a power-quality reference that gives both definitions side by side, the LVUR formula, the VUF = V₂/V₁ formula, and the **NEMA motor derating table**:

| Voltage unbalance | Recommended motor loading |
|---|---|
| ≤ 1% | 100% (no derating) |
| 3% | 90% (derate to 0.9) |
| > 5% | Operation not recommended |

It also notes the amplifier effect on motors: *"5% voltage unbalance may produce 20–30% current unbalance,"* and that insulation life is **halved for every 10 °C** of additional winding temperature from the extra I²R losses. Negative sequence is the mechanism — counter-rotating flux → rotor heating [[Symmetrical components](https://en.wikipedia.org/wiki/Symmetrical_components)].

> The NEMA **derating numbers** above (≤1% / 3%→0.9 / >5%) are now primary-cited via voltage-disturbance.com.

**European standard — EN 50160 (now primary-cited).** From `uploads/EN50160.pdf` (EN 50160 voltage-quality standard, Table 1, row 9 "Supply voltage unbalance"):

> **EN 50160: LV, MV — up to 2% for 95% of week, mean 10-min rms values; up to 3% in some locations.** (Compatibility reference: IEC 61000-2-12 → 2%.)

EN 50160's *definition* of voltage unbalance: *"a condition where the rms value of the phase voltages or the phase angles between consecutive phases in a three-phase system are not equal"* — i.e. it matches the IEC/"true" VUF framing (both magnitude and angle), not the NEMA line-to-line-only LVUR. The motor-impact mechanism is the same: *"Voltage unbalance in a three-phase system causes an opposing torque, proportional to the negative sequence voltage component."*

For ProCal defaults (European project), the same PDF gives the two other LV envelope numbers worth surfacing in project settings:
- **Voltage magnitude variation:** ±10% for 95% of week (10-min rms).
- **Power frequency:** ±1% (49.5–50.5 Hz) for 99.5% of week; −6%/+4% (47–52 Hz) for 100% of week.

### 2.4 Derating of transformers, cables, breakers under unbalance (IEC 60076 / 60364 / NEC)

**What the sources say.**
- **Motors (NEMA MG 1 derating curve):** now primary-cited — ≤1% unbalance no derating, 3% → 0.9 load factor, >5% not recommended; current unbalance can run ~4–6× the voltage unbalance; insulation life halves per +10 °C winding temp [voltage-disturbance.com](https://voltage-disturbance.com/voltage-quality/voltage-unbalance/).
- **Transformers:** *"any unbalanced phase loading on the secondary side of the transformer will use the transformer capacity inefficiently"* [[Three-phase electric power](https://en.wikipedia.org/wiki/Three-phase_electric_power)] — the transformer is limited by its most-loaded winding; unbalance wastes usable kVA. Zero-sequence/triplen-harmonic currents cause additional neutral/tank heating [[Neutral wire](https://en.wikipedia.org/wiki/Neutral_wire)].
- **Neutral conductor (IEC 60364-5-52 / NEC):** triplen (3rd, 9th…) harmonics *"add in the neutral in a star system,"* and *"in the absolute worst case, the current in the shared neutral conductor can be triple that in each phase conductor"* even with balanced *fundamental* currents [[Neutral wire](https://en.wikipedia.org/wiki/Neutral_wire)]. The PDH course independently gives a worst-case **neutral ≤ 2× max phase current** bound *without* harmonics [`uploads/3phase.pdf` §5C] — so the practical neutral-sizing envelope is ~2× (fundamental unbalance) up to ~3× (with triplen harmonics). Some jurisdictions *"prohibit the use of shared neutral conductors when feeding single-phase loads from a three-phase source"* or require the neutral to be *"substantially larger than the phase conductors"* [[Neutral wire](https://en.wikipedia.org/wiki/Neutral_wire)].
- **Breakers:** four-pole breakers (with a neutral pole) are recommended *"to protect against overcurrent on the neutral conductor"* [[Neutral wire](https://en.wikipedia.org/wiki/Neutral_wire)].

> The motor derating curve is now primary-cited. The IEC 60076 transformer K-factor / zero-sequence derating factors and the NEC 220.61 neutral-load reduction rules still need primary citations — implement as configurable multipliers with the standard names.

### 2.5 The relevant standards (American vs European) and their stated limits

The user flagged that this app may need to support **both American and European** standards — so the imbalance limit and derating defaults must be standard-selectable, not hard-coded to one.

| Standard (family) | Region | What it covers | Citation status this session |
|---|---|---|---|
| **NEMA MG 1** (LVUR + derating) | American | Motors; voltage-unbalance definition + derating curve | ✅ Primary-cited via [voltage-disturbance.com](https://voltage-disturbance.com/voltage-quality/voltage-unbalance/) — ≤1% / 3%→0.9 / >5% |
| **IEEE 112** | American | Motor testing incl. unbalance | ❌ Not reachable (404) |
| **NEC (NFPA 70), Art. 220 / 220.61** | American | Feeder/dwelling load calcs, neutral reduction | Overview only [[NEC](https://en.wikipedia.org/wiki/National_Electrical_Code)]; numeric rules need primary |
| **IEC 60034-1 / 60034-26** | European | Rotating machinery supply-voltage unbalance tolerance / derating | ❌ Stub only on-wiki; need primary |
| **IEC 61000-2-12 / EN 50160** | European | LV/MV public-supply voltage unbalance limit (2%, up to 3% in some locations) | ✅ Primary-cited via `uploads/EN50160.pdf` Table 1 row 9 |
| **IEC 61000-4-30** | Both | Power-quality *measurement* method | Mentioned [[power quality](https://en.wikipedia.org/wiki/Electric_power_quality)] |
| **IEC 60364 (-5-52)** | European | LV installations; neutral conductor, wiring, earthing (TT/TN-S/TN-C/TN-C-S/IT) | Structure confirmed [[IEC 60364](https://en.wikipedia.org/wiki/IEC_60364)], [[Earthing system](https://en.wikipedia.org/wiki/Earthing_system)]; numeric derating not on-wiki |

**Two-standards implication for ProCal:** add a project-level "calculation standard" setting (American / European, or NEMA / IEC). This selects the default voltage-unbalance *limit* (NEMA 1–5% ladder vs IEC ~2%) and which *definition* to report (LVUR vs VUF). It pairs naturally with the existing planned "Configurable IEC calculation defaults" feature (spec 001) — though spec 001 is IEC-only, the neutral/unbalance logic should be standard-aware.

---

## 3. Recommended implementation for ProCal

This is the actionable mapping of the research onto the codebase (load library → calculator → feeders → schedules). The relevant models already exist: `LoadLibraryItem` carries `power`, `phase` (1 or 3), `voltage`, `powerFactor`, `quantity` (per the schema; see prior exploration agent report). So the upgrade is **calculation-layer**, mostly not schema.

1. **Per-load phase tag.** Add a `phase` field / tag at the floor-item & building-load level (the `LoadLibraryItem.phase` is already 1|3; for 1-phase items add an *assigned phase* ∈ {L1,L2,L3}). Default-assign new 1-phase loads greedily to the least-loaded phase of their parent board.

2. **Per-phase aggregation in `computeFeeders`** (`src/lib/calculations/feeders.ts`). For each feeder/MDB, build three per-phase buckets:
   - 3-phase load → kW/3 to L1, L2, L3 (current = kW/(√3·V_LL·PF) shared across phases).
   - 1-phase load on phase X → full kW to phase X (current = kW/(V_LN·PF)).
   - Produce `kW_L1/L2/L3`, `I_L1/L2/L3`.

3. **Neutral current** = magnitude of the complex phasor sum (general form, the PDH course's Equation 5A applied to the three phase currents with their individual PF angles) — not the simplified scalar formula, because apartments (PF ~0.9) and motors (PF ~0.8, but 3-phase) differ. Report it; flag if it approaches/exceeds phase current (harmonic/tripen concern). Source: [`uploads/3phase.pdf` Eq 5A & §5C](uploads/3phase.pdf).

4. **Voltage-unbalance factor.** Compute VUF via symmetrical components on the three phase *voltages* (or, as a planning proxy, a current-unbalance factor on the three phase currents: `(max(I)−min(I))/avg(I)`). Report as %; compare against a **standard-dependent configurable** limit: American (NEMA) → derating ladder ≤1% none / 3%→0.9 / >5% not recommended [voltage-disturbance.com](https://voltage-disturbance.com/voltage-quality/voltage-unbalance/); European (EN 50160) → **2%** (up to 3% in some locations) for LV/MV per Table 1 row 9 [`uploads/EN50160.pdf`, ref IEC 61000-2-12]. Report which definition is shown (NEMA LVUR vs IEC/EN VUF — EN 50160's definition covers both magnitude and angle).

5. **Derating.** When imbalance > limit, apply a derating factor to: transformer kVA utilization (limit by max-loaded winding), neutral conductor sizing (worst case ≤ **2× max phase current** from fundamental unbalance [`uploads/3phase.pdf` §5C], up to **3×** with triplen harmonics [[Neutral wire](https://en.wikipedia.org/wiki/Neutral_wire)]), and motor selection (use the NEMA derating ladder when on the American standard: 3%→0.9, >5% not recommended). Make limits user-configurable project settings tied to the calculation-standard selector.

6. **UI in the calculator / floor designer.** Show a small per-phase bar (L1/L2/L3 kW and A) and a neutral-current + unbalance% readout per floor/building/MDB, with a warning when unbalance exceeds the configured limit. Apartments already foldable per the recent calculator change — show their assigned phase.

7. **Schedules.** Add per-phase columns (L1/L2/L3 kW, Neutral A, Unbalance %) to the MDB/breaker/cable schedules so the imbalance is visible in the printed PDF (consistent with the recent column work).

8. **Tests** (`feeders.test.ts`). Add cases: balanced (neutral=0), one heavy single-phase load on L1 (neutral = that current), two equal 1-phase loads on L1+L2 (neutral = magnitude of sum), a 3-phase motor + 1-phase mix, and assert per-phase sums, neutral current, and unbalance factor.

---

## 4. Caveats & open questions

- **Sourcing update.** The NEMA voltage-unbalance definition/formula/derating table, the neutral-current vector method (incl. the 2× max-phase neutral bound), and the **EN 50160** LV unbalance limit (2%, up to 3% in some locations, ref IEC 61000-2-12) are now **primary-cited** (voltage-disturbance.com; `uploads/3phase.pdf`; `uploads/EN50160.pdf`). No remaining `[unverified-primary]` numeric facts for the core limits.
- **Neutral-current formula caveat.** The scalar `√(I₁²+I₂²+I₃²−I₁I₂−I₂I₃−I₃I₁)` form assumes equal PF angles across phases — invalid for a mixed apartment+motor building. The PDH source uses the component method (Equation 5A); ProCal should too.
- **Two standards (American/European).** The user noted the app may serve both NEMA-region and IEC-region engineers. Make the voltage-unbalance *limit*, the *definition* reported (LVUR vs VUF), and the derating defaults standard-selectable at the project level.
- **Voltage unbalance vs. current unbalance.** VUF is defined on *voltage*; ProCal plans loads (currents). Current imbalance is the driver, but the standard *limits* are on voltage unbalance. Document this distinction; a current-unbalance proxy is fine for planning but is not the regulatory quantity.
- **Open questions:**
  1. Does ProCal want a *fixed* greedy assignment, or should the user be able to manually override which phase an apartment sits on (real designs do sometimes pin phases)? Suggest: auto-assign with manual override.
  2. Should 1-phase apartment *templates* be modeled as one L-N load or as their own internal per-room phase split? (Probably one L-N load at the apartment level; rooms are sub-circuits of the apartment, not separate phases.)
  3. At what level is balance enforced — per floor distribution board, per building MDB, or the project service? Unbalance is most usefully measured at each board, not just the service entrance.
  4. Which standard is the ProCal default — American (NEMA) or European (IEC)? The existing roadmap leans IEC/Middle-East, but confirm before hard-coding defaults.

---

## 5. Sources

**Primary (this session):**
- voltage-disturbance.com — *Voltage Unbalance* (NEMA LVUR vs IEC VUF definitions, formulas, NEMA derating table) — https://voltage-disturbance.com/voltage-quality/voltage-unbalance/
- Fleckenstein, J.E., P.E., *Calculating Currents in Balanced and Unbalanced Three Phase Circuits*, PDH Online Course E336 (2020) — `uploads/3phase.pdf` — Equation 5A (vector-component resultant) and §5C (unbalanced wye, neutral current, 2× max-phase bound).
- EN 50160 — *Voltage characteristics of electricity supplied by public electricity networks* — `uploads/EN50160.pdf` — Table 1 row 9 (supply voltage unbalance: 2% LV/MV, up to 3% in some locations, ref IEC 61000-2-12); also rows 1–2 (frequency ±1%, voltage magnitude ±10%) and the voltage-unbalance definition.

**Secondary / Wikipedia (reachable):**
- Three-phase electric power — https://en.wikipedia.org/wiki/Three-phase_electric_power
- Symmetrical components — https://en.wikipedia.org/wiki/Symmetrical_components
- Neutral wire — https://en.wikipedia.org/wiki/Neutral_wire
- Single-phase electric power — https://en.wikipedia.org/wiki/Single-phase_electric_power
- Earthing system — https://en.wikipedia.org/wiki/Earthing_system
- IEC 60364 — https://en.wikipedia.org/wiki/IEC_60364
- IEC 60034 (stub) — https://en.wikipedia.org/wiki/IEC_60034
- Electric power quality — https://en.wikipedia.org/wiki/Electric_power_quality
- Y-Δ transform — https://en.wikipedia.org/wiki/Y-%CE%94_transform
- Electric power distribution — https://en.wikipedia.org/wiki/Electric_power_distribution
- National Electrical Code (overview) — https://en.wikipedia.org/wiki/National_Electrical_Code

**Still pending primary citation (lower priority):**
- IEEE 112 (motor unbalance test method), IEC 60034-1/-26 (machine supply-voltage unbalance tolerance & derating), NEC 220.61 (neutral-load reduction), IEC 60076 (transformer K-factor / zero-sequence derating) — none needed for the core imbalance *limit* defaults (those are now cited), only for detailed derating curves if/when implemented.

*Could not reach in this sandbox (403/404/ECONNRESET):* nema.org (MG 1 page redirects off-site), energy.gov NEMA MG1 PDF, ecmag.com (NEC 220), eaton.com, ieee.org (IEEE 112), weg.net, engineeringtoolbox.com, electrical4u.com, electrical-installation.org, electronics.stackexchange.com (WebFetch blocked).
