# Phase balancing: why the math is shaped the way it is

## What this is

ProCal models every distribution board as three phases — L1, L2, L3 — instead of
one lumped kilowatt. `phaseBalance.ts` splits each load across the phases,
computes per-phase current and kilowatts, the **neutral current**, and an
**unbalance percentage**, then checks both against limits. This document is the
*why*. For the function contract, see the [calc engine reference](./reference-calc-engine.md).

## The problem

A three-phase board with six single-phase apartments isn't "24 kW". It's
"apartments 1, 3, 5 on L1; 2, 4 on L2; 6 on L3" — and if those aren't balanced,
three things go wrong that a lumped-kW model hides:

1. **Sizing is wrong.** Cables and breakers see *one phase's* current, not the
   sum. A 24 kW board balanced 8/8/8 kV per phase draws the right current; the same
   24 kW dumped 18/6/0 draws a destructive current on L1 and an underused L3.
   Size to the sum and the cable is undersized on L1; size to the max phase and
   that's the real number.
2. **The neutral cooks.** On a perfectly balanced board the neutral current is
   zero — the three phases cancel. On an imbalanced board the neutral carries
   the *uncancelled* current, and it can exceed the phase current. Undersized
   neutrals are a real fire cause.
3. **Voltage unbalance drives motor heating.** A current imbalance becomes a
   voltage imbalance upstream, and 3-phase motors run hot under voltage
   unbalance. Standards set limits on it.

So the board needs per-phase accounting: phase-by-phase current, a real neutral
current, and an unbalance metric you can check against a limit.

## The approach (four decisions)

### Total-angle neutral — not PF angle alone

The neutral current is a vector sum. Each load contributes a current phasor at
some angle; the neutral is the magnitude of their sum. Two angles compose that
phasor:

- the **120° phase offset** — L1 sits at 0°, L2 at −120°, L3 at +120°. This is
  what makes the three phases *different*. It's why a balanced 3-phase load
  contributes zero to the neutral (its three currents at 0/−120/+120° sum to
  zero).
- the **per-item displacement** — `arccos(PF)`, lagging. A PF of 0.85 means the
  current lags the voltage by ~31.8°. This varies per load (a motor is 0.8, a
  heater is 1.0).

```mermaid
graph LR
  subgraph "Wrong: PF angle only"
    W[Each phasor at its PF angle only]
    W -->|no 120° separation| WB[Balanced 3Φ contributes non-zero neutral — wrong]
  end
  subgraph "Right: total angle"
    R["θ = 120° phase offset + arccos(PF)"]
    R -->|balanced 3Φ cancels| RB[I_N = √(X² + Y²) → 0 for balanced]
  end
```

`I_N = √(X² + Y²)` where `X = Σ I·cos(θ_total)`, `Y = Σ I·sin(θ_total)`. The
raw `neutralPhasors { x, y }` is exposed on the result so a caller merging
multiple boards combines the phasors before the sqrt — combining magnitudes would
be wrong (two boards each with 10 A neutral aren't always 20 A together; their
phasors may partially cancel).

### Current-unbalance proxy — not voltage unbalance, not literally 2%

The unbalance metric is `(max_phase − min_phase) / avg × 100`. Standards cite
IEEE 112 / NEMA MG1 (~1% hard, 5% advisory) and EN 50160 (2%) — but those are
**voltage** unbalance limits. Voltage unbalance runs about 4–6× lower than
current unbalance (the transformer impedance damps it). So a literal 2%
current-unbalance threshold would flag every realistic mixed residential board
as non-compliant — a cry-wolf metric that nobody would take seriously.

ProCal's compromise: a **current-unbalance proxy** at a 10% default for both
IEC and NEMA framing. The `calculationStandard` selects the *label and cited
standard*, not the numeric threshold. This keeps the standard framing honest
("this is checked against the EN 50160 / NEMA limit") without false-positiving
on normal boards. The threshold is a tunable engineering judgment, not a
verbatim quote; it can move per project later.

### Greedy assignment on read — no backfill event

Single-phase loads carry an `assignedPhase` (1/2/3) that's `null` until a user
pins it. The obvious implementation would be: when a load is added, pick a phase
and write it back. ProCal doesn't. Instead, the balance engine auto-assigns
**on read**: any `null` load goes to the least-loaded phase (greedy LPT, stable
order), and the assignment is returned in `assignments` for the UI to display.

This removes a whole class of bugs. There's no "forgot to rebalance after
adding an item" state — every entry point (calculator, reports, `computeFeeders`)
gets correct numbers because the assignment is computed fresh each time. A
newly-added `null` item is assigned on the next read. A deleted item re-balances
the rest on the next read. No UI backfill event, no migration, no stale stored
assignment diverging from what the engine would pick.

The cost: the assignment isn't persisted (the UI shows it, doesn't store it), so
two reads with different item sets can assign the same item to different phases.
That's fine — the *numbers* are always right, and a user who wants a fixed phase
pins it (then it's stored and honored). Stable order (floorNumber → createdAt →
id) keeps the greedy result deterministic for a given input set.

### 2× max-phase neutral guard only — no triplen harmonics

The neutral-oversize guard is `neutralCurrent > 2 × maxPhaseCurrent` (the
fundamental-frequency bound, PDH Course E336 §5C). A stricter check would add a
3× multiplier for triplen harmonics — nonlinear loads (discharge lighting, SMPS)
dump third-harmonic current into the neutral, which **adds** across phases
instead of cancelling, and can push the neutral above the phase current.

ProCal doesn't model that. There's no harmonic data stored per load — the
equipment catalog and floor items don't carry a harmonic signature. Modeling it
would mean inventing data the inputs don't have. The 2× fundamental guard is the
honest ceiling given what's known; the triplen branch was dropped deliberately
and documented. When the inputs gain harmonic data, add the 3× branch.

### 3-phase apartment templates: modeled balanced, flagged

A 3-phase apartment template is modeled as `kW/3` per phase — a balanced
3-phase load. That's the wrong model: a 3-phase apartment is a bundle of 1-phase
room circuits (kitchen on phase A, bedrooms on phase B), not a balanced motor.
Per-room decomposition would show the real internal imbalance.

Per-room decomposition is deferred. Until then, the engine flags the modeled
load `internalImbalanceNotModeled` so the UI can disclose the limitation rather
than present a too-clean balance as exact.

## Trade-offs named

- **Proxy, not direct.** The unbalance metric is a current proxy for a voltage
  limit. It's a tuned threshold, not a quoted one. Honest-but-tunable over
  literally-correct-but-useless.
- **On-read over backfill.** No stored auto-assignment. Always-correct numbers
  traded for non-persisted assignment display. Pin to persist.
- **Fundamental-only neutral.** The 2× guard misses triplen-harmonic overload.
  Honest ceiling given absent harmonic data; upgrade when inputs carry it.
- **3-phase apartments under-stressed.** Modeled balanced, flagged. The
  displayed balance is optimistic for 3-phase apartments until per-room
  decomposition lands.

## Alternatives considered

- **VUF / LVUR (voltage-unbalance) metric.** Rejected — ProCal computes
  currents, not voltages, and the ~4–6× gap to voltage unbalance makes a literal
  standard threshold cry-wolf on real boards.
- **Backfill assignment on add.** Rejected — creates a stale-state class and a
  migration. On-read is always-correct and simpler.
- **Custom cache class for merged-board neutral.** Rejected — the exposed
  `neutralPhasors { x, y }` lets callers combine raw phasors with plain
  arithmetic; no abstraction needed.

## Related

- [Calc engine reference](./reference-calc-engine.md) — `phaseBalance`,
  `currentUnbalancePct`, `neutralFromPhasors` signatures + `computeFeeders`.
- [Data model reference](./reference-data-model.md) — `assignedPhase` on
  `FloorItem` and `BuildingLoad`.
