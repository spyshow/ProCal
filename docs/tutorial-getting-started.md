# Tutorial: your first ProCal project

A learning-oriented walk: install → run → create a project → add a building
with an apartment template → put apartments on floors → balance phases → size
panels → draw the SLD → export a PDF report. You'll learn the shape of the app
and how its surfaces stay consistent. By the end you'll have a one-building
residential project with sized circuits, a balanced board, a single-line
diagram, and a printable report.

> This is the *tutorial*. For narrow task recipes (run locally, add a load,
> grant credits, import a catalog), see the [how-tos](#related). For contracts
> and algorithms, see the [references](#related). This page narrates; those
> specify.

## Prerequisites

Run ProCal locally ([How-to: run locally](./how-to-run-locally.md)). You need:
the dev server on `:3000`, Postgres + Mailpit up (`docker compose up -d`),
migrations applied, the client generated, and the seed run (gives you the
`engineer` / `password123` admin + the ABB/Schneider catalog).

## 0. Log in

Open `http://localhost:3000` — it redirects to `/login` (the middleware
matcher sends every non-auth route there; see
[Auth & admin reference](./reference-auth-admin.md)). Log in as
`engineer` / `password123`.

You land on `/dashboard`. The sidebar groups the app into: **project setup**
(dashboard, projects, settings), **engineering** (calculator, panel, riser,
coordination, sld), **output** (cable-schedule, breaker-schedule, reports), and
**admin** (admin area). You'll trace the first three.

## 1. Create a project

`/projects` → New Project (as admin you bypass the credit gate; a non-admin
needs `credits >= 1` — see [Captured-lead credit gate](./explanation-billing-captured-lead.md)).

Fill in:
- **Name** — "Tutorial Tower".
- **Client / Consultant / Contractor / Engineer / Location** — submittal
  metadata; these print on the report cover.
- **Voltage 400 V, Frequency 50 Hz, Power Factor 0.85** — the defaults are
  IEC-flavored; voltage is line-to-line.
- **Country: Syria** — your electrical defaults come from here (line voltage,
  frequency, per-room load densities, AC sizing rules). 90+ presets exist;
  unknown countries fall back to a neutral 400 V/50 Hz/0.85. See
  [country-defaults](./reference-auth-admin.md#country-defaults--srclibcountry-defaultsts).
- **Preferred manufacturer: MIXED** — the breaker schedules won't filter by
  manufacturer; you'll see ABB and Schneider rows. (Set ABB or Schneider to
  scope the catalog match.)
- **Calculation standard: IEC** — selects the current-unbalance limit + label
  (currently 10 % for both IEC and NEMA framing; see
  [Phase balancing](./explanation-phase-balancing.md) for why it's a current
  proxy, not a literal voltage-unbalance %).
- **Voltage drop limits: 3 % lighting / 5 % power** — IEC 60364-5-52 defaults.

Save. You now have an empty project — no buildings, no templates, no loads.

## 2. Add a building + define an apartment template

Open the project. Add a **building**:
- **Name** "Block A", **Floors** 4, **Service floors** 0, **Apartments/floor** 3.
- **Supply voltage 400V 3-Phase**, **Earthing TN-S**.

Saving the building **auto-creates one `FloorDesign` per floor** (floors 1–4).
You never create a floor by hand — see [API reference](./reference-api.md),
`POST /api/buildings`.

Now define the **apartment template** (still on the project page, templates
section). Two-bedroom flat:
- **Name** "2BR Flat", **Phases 1** (a 1-phase apartment — the common case).
- **Rooms**:
  - Kitchen, 12 m², density 150 VA/m² (from Syria defaults), has A/C ✓
  - Living Room, 25 m², density 100, has A/C ✓
  - Bedroom, 15 m², density 80, has A/C ✓
  - Bedroom, 15 m², density 80, has A/C ✓
  - Bathroom, 6 m², density 60, no A/C

The template route computes each room's `connectedLoad = area·density + AC
watts` (the AC BTU is auto-sized from the country's AC rules by area — 12 kBTU
for the kitchen, 24 kBTU for the living room, 12 kBTU for the bedrooms). The
template stores these.

> **What just happened, conceptually.** A 1-phase apartment is a bundle of
> 1-phase room circuits. The template encodes the rooms; the floor item just
> points at the template. Sizing happens at *insert* time, not template-define
> time — so changing a room later and running **recalculate** re-sizes
> everything. See [How-to: add a load](./how-to-add-a-load.md).

## 3. Load the floors (calculator)

`/calculator` → pick Block A. On Floor 1, add an apartment item:
- Type **Apartment**, name "Apt 101", template **2BR Flat**.

Repeat for three apartments per floor (Apt 101/102/103 on Floor 1, etc.) across
all four floors — 12 apartments total. (The UI has a "Copy to floors" action
that duplicates a floor's items; use it.)

**What you'll see as you add:**
- **Per-phase L1/L2/L3** current and kW tick up. Each new 1-phase apartment,
  with no pinned phase, is auto-assigned to the **least-loaded phase on read**
  (greedy LPT, stable order). So 12 apartments spread roughly 4/4/4 across L1/L2/L3
  with no manual work.
- **Neutral current** is the vector sum `I_N = √(X² + Y²)` at each load's
  total angle (120° phase offset + `arccos(PF)` displacement). On a roughly
  balanced board it's small; it grows with imbalance.
- **Unbalance %** = `(max phase − min phase) / avg × 100` (a current proxy for
  the EN 50160 / NEMA voltage-unbalance limit — see
  [Phase balancing](./explanation-phase-balancing.md) for why it's not a literal 2 %).
- Each item gets a **breaker size**, **cable size** (IEC 60364-5-52 ampacity
  with temp/group/install derating, copper/XLPE/30 °C/method C defaults), and a
  **voltage drop** verdict against your 3 %/5 % limits.

Want a fixed phase? Pin one apartment to L1 (set `assignedPhase: 1`). The
rebalance will honor your pin and re-flow only the `null` ones.

> **Don't panic if the numbers look "too balanced."** They are, because the
  greedy assignment is good. The interesting case is when you add a big single
  panel that can't split — then you'll see the neutral and unbalance climb,
  and the `2× max-phase` neutral guard flag a too-small neutral.

## 4. Recalculate & rebalance

After all 12 apartments are in, run **Recalculate** (re-applies the IEC
diversity factor for the current apartment count — at 12 apartments that's the
0.55 step in the `getApartmentDiversityFactor` ladder; see
[Calc engine reference](./reference-calc-engine.md)) — and **Rebalance**
(persists the 1-phase `assignedPhase` values, preserving any pins).

These two keep the stored numbers honest when structure changes. The calc
engine is pure TS with Vitest self-checks — run `npm test` if anything looks
off; the tests are the cheap guard against drift.

## 5. Panel Designer

`/panel` → Block A. The designer runs **`computeFeeders`** over the building:
- **MDB outgoing feeders** — one per floor (Floor 1..4), each sized on the sum of
  its apartment currents, with the catalog breaker model picked by your
  preferred manufacturer (MIXED → ABB and Schneider both show).
- **Main incomer current** — sum of feeders, 3-phase (`√3·V`).
- **Main breaker + cable** — sized off the incomer.
- **Transformer** — kVA, max-winding-limited across phases (a max-phase × 3
  model, so an imbalanced board sizes the transformer to the *real* hot phase,
  not the average).

The riser is always 3-phase/3-pole off the MDB bus, sized on `maxPhaseCurrent`
(see [Calc engine reference](./reference-calc-engine.md), feeders + riser).

## 6. Single-Line Diagram

`/sld` → Block A. The SLD generator emits a **DSL per floor**
(`generateSLDPages`); `schematex/react` renders each as a vertical SVG. Page
through floors 1–4. You'll see: MDB bus → floor breaker → floor bus (or
sub-panel) → MCBs (one per apartment with its `breakerSize` and `cableSize`
labels).

Two things worth knowing:
- The SVG is **post-processed in the browser** (`extendCables` adds ladder-step
  spacing; `repositionLabels` aligns MCB labels to the right) — so it's
  readable, not the raw auto-layout.
- **Export PNG** (2× retina canvas) or **Export PDF** (`window.print`). The
  diagram's breaker/cable labels match the panel designer because both read
  the same `computeFeeders`. See [SLD & reports reference](./reference-sld-reports.md).

## 7. Reports & Export PDF

`/reports` → Block A. Tabs: Project Summary, Bill of Materials, MDB Schedule,
Cable Schedule, Voltage Drop (Breaker Schedule is print-only).

Walk the tabs. The numbers here are the same ones you saw on the calculator and
the panel designer — they all read `computeFeeders` / the stored item fields,
so nothing drifts. The Project Summary shows total demand and main current per
building (`calculateThreePhaseCurrent(Σ maxDemand)`, 3-phase assumed for the
main).

**Export PDF** — `react-to-print` clones an off-screen container that composes
Cover Page → BOM → MDB → Cable → Breaker → Voltage-Drop schedules, each on its
own page (forced via `pageBreakBefore`). The cover carries the project identity +
company name/logo (set in `/settings`, stored in `data/company.json`).

> If a schedule's breaker model is blank/fallback, the catalog doesn't have a
> row matching that category+poles+current with your manufacturer filter.
> Either import more rows ([How-to: import catalog](./how-to-import-breaker-catalog.md))
> or switch the project's preferred manufacturer to MIXED.

## You did it

You have: a 4-floor / 12-apartment residential building, an apartment template
driving the room loads, greedy phase balancing with a real neutral and
unbalance metric, an MDB + transformer sized to the max phase, a per-floor SLD,
and a printable multi-page report — all with the numbers consistent across
surfaces because they share the calc engine.

Where to go next:
- **Coordination study** (`/coordination`) — TCC curves, selectivity verdicts,
  L/S/I/G protection settings. Bring your fault current from the short-circuit
  module.
- **Riser Diagram** (`/riser`) — vertical riser with per-floor VD banding.
- **Add a 3-phase apartment template** and watch it get flagged
  `internalImbalanceNotModelled` — the disclosed limitation, not a bug.

## Related

How-tos:
- [Run locally](./how-to-run-locally.md)
- [Add a load](./how-to-add-a-load.md)
- [Grant credits (admin)](./how-to-grant-credits-admin.md)
- [Import the breaker catalog (admin)](./how-to-import-breaker-catalog.md)

References:
- [Calc engine](./reference-calc-engine.md)
- [Data model](./reference-data-model.md)
- [API](./reference-api.md)
- [Auth & admin](./reference-auth-admin.md)
- [SLD & reports](./reference-sld-reports.md)

Explanations:
- [Phase balancing](./explanation-phase-balancing.md)
- [Captured-lead credit gate](./explanation-billing-captured-lead.md)
