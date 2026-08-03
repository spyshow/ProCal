# How-to: add a load to a floor

Goal: put a board (apartment, service panel, pump panel, or elevator panel) on
a floor, get it sized, and have the phase balance reflect it. Three load kinds
exist; the path differs for each.

## Where this happens

The Load Calculator page (`/calculator`), against a project that already has a
**building** (with its auto-created floors) and, for apartments, an **apartment
template**. Behind the UI: `POST /api/floors/[id]/items` — see
[API reference](./reference-api.md).

## 1. Three item kinds — pick the one that matches your load

| Kind | `type` | Where the numbers come from |
|------|--------|------------------------------|
| Apartment | `APARTMENT` | an `ApartmentTemplate`'s rooms — `Σ connectedLoad/1000` × diversity factor |
| Library load | `LIBRARY` | a `LoadLibraryItem` (phase, PF, demandFactor, power) |
| Manual panel | `SERVICE_PANEL`/`PUMP_PANEL`/`ELEVATOR_PANEL` | fixed defaults (15 kW/0.8, 7.5 kW/1.0, 22 kW/0.8) |

The route's `type` + `name` are required; `apartmentTemplateId` or
`loadLibraryItemId` link the kinds that need one. Everything defaults to
**copper / XLPE / 30 °C / install method C** unless you override per item.

## 2a. Apartment — define the template first

1. On the project page, create an apartment template (`POST /api/templates`):
   name, phases (1 or 3), and a `rooms` array. Each room gets a `type`, `name`,
   `area`, `hasAc`, `loadDensity` (VA/m², from the project's country defaults).
   The route computes each room's `connectedLoad = area·density + AC watts`
   (AC BTU auto-sized from the country's `acSizingRules`) and stores the
   template.
2. Add the apartment to a floor: `POST /api/floors/[id]/items` with
   `{ type: "APARTMENT", name, apartmentTemplateId }`. The route sums room
   loads, applies the IEC apartment diversity factor by the building's
   apartment count, computes phase-aware current (3-phase `√3·V·PF`, 1-phase
   `V/√3·PF`), and `sizeCableAndBreaker`s it. Stored fields:
   `calculatedConnectedLoad`, `calculatedMaxDemand`, `calculatedCurrent`,
   `breakerSize`, `cableSize`, `voltageDrop`.

> **3-phase templates are flagged.** A `phases: 3` apartment is modeled as
> `kW/3` per phase (balanced), not its real per-room 1-phase decomposition. The
> balance engine marks it `internalImbalanceNotModelled` to disclose the
> simplification. See [Phase balancing explanation](./explanation-phase-balancing.md).

## 2b. Library load — create it, then drop it on a floor

1. Add to the project's load library: `POST /api/loads` with
   `{ projectId, name, category, power (kW), voltage, phase (1|3), powerFactor,
   demandFactor, quantity }`. The route computes and stores `runningCurrent`
   server-side (`phase===3 ? S/(√3·V) : S/V`) — a client typo can't orphan a
   wrong current.
2. Add to a floor: `POST /api/floors/[id]/items` with
   `{ type: "LIBRARY", name, loadLibraryItemId }`. Uses the library item's
   `phase`/`powerFactor`/`demandFactor` directly.

## 2c. Manual panel — one POST

`POST /api/floors/[id]/items` with
`{ type: "SERVICE_PANEL" | "PUMP_PANEL" | "ELEVATOR_PANEL", name }`. The fixed
defaults (15/7.5/22 kW at the PFs above) shape it; override the per-circuit
cable/length/install method afterward via the floor PATCH if needed.

## 3. Recalculate after template/apartment-count changes

If you changed the template rooms or the building's apartment count **after**
items were already sized, the stored numbers are stale:

```bash
POST /api/buildings/[id]/recalculate
# → { success, updated, diversityFactor }
```

It re-applies the IEC diversity factor for the current apartment count and
re-sizes every apartment floor item. (Note: this is the one sessionless route —
matcher-excluded and `getSessionUser`-free; see
[API reference](./reference-api.md). Run it from the calculator page's button,
not a curl, if you care about auth posture.)

## 4. Rebalance to assign single-phase loads across phases

New single-phase items get `assignedPhase: null`. The greedy auto-assignment
runs on **read** (every `phaseBalance` call assigns nulls to the least-loaded
phase), so the numbers are already right. But if you want the assignments
**persisted** for display and stable ordering, run:

```bash
POST /api/floors/[id]/rebalance
# → { balance, floorDesign }
```

It calls `phaseBalance`, writes 1-phase `assignedPhase` values back, and
**preserves manual pins** — items you already pinned to L1/L2/L3 are kept; only
the `null` ones are auto-assigned. To start over (clear all pins):
`POST /api/buildings/[id]/rebalance` resets everything to `null`.

## 5. Verify in the surfaces that read it

- `/calculator` — per-phase current/kW, neutral, unbalance% update live.
- `/panel` — `computeFeeders` picks up the new item as an MDB/SMDB feeder.
- `/sld` — the item appears as an MCB off its floor bus/sub-panel.
- `/reports` — Breaker/Cable schedules include it; the VD schedule checks its
  drop against the project limits.

All four read the same `computeFeeders` / `isThreePhaseForItem` path, so they
agree. If something looks off after a structural change, `recalculate` is the
reconciliation button (see [SLD & reports reference](./reference-sld-reports.md),
"How the pieces share numbers").

## Related

- [API reference](./reference-api.md) — `/api/floors/[id]/items`,
  `/api/templates`, `/api/loads`, `/recalculate`, `/rebalance`.
- [Calc engine reference](./reference-calc-engine.md) — `sizeCableAndBreaker`,
  `phaseBalance`, `getApartmentDiversityFactor`.
- [Data model reference](./reference-data-model.md) — `FloorItem.assignedPhase`,
  the stored sizing fields.
- [Phase balancing explanation](./explanation-phase-balancing.md) — why
  assignment is on-read and how the neutral/unbalance are computed.
