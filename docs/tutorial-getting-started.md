# Tutorial: your first ProCal project

A learning-oriented walk: install → run → create a project (IEC or NEC/NEMA) → add a building
with an apartment template → put apartments on floors → balance phases & inspect calculation traces → size
panels → draw the SLD → run a coordination study → view the riser → export PDF submittals & Excel workbooks → snapshot revisions & review QA items. You'll learn the shape of the app
and how its surfaces stay consistent. By the end you'll have a complete
residential project with sized circuits, balanced boards, single-line
diagrams, TCC curves, and submittal deliverables.

> This is the *tutorial*. For narrow task recipes (run locally, add a load,
> grant credits, import a catalog), see the [how-tos](#related). For contracts
> and algorithms, see the [references](#related). This page narrates; those
> specify.

## Prerequisites

Run ProCal locally ([How-to: run locally](./how-to-run-locally.md)). You need:
the dev server on `:3000`, Postgres + Mailpit up (`docker compose up -d`),
migrations applied, the client generated, and the seed run (gives you an
`engineer` admin — set `SEED_ADMIN_PASSWORD` in `.env` to choose its password,
otherwise the seed prints a random one-time password — plus the ABB/Schneider
catalog).

## 0. Log in & Language Selection

Open `http://localhost:3000` — it redirects to `/login` (the middleware
matcher sends every non-auth route there; see
[Auth & admin reference](./reference-auth-admin.md)). Log in as `engineer`
with your `SEED_ADMIN_PASSWORD` (or the one-time password the seed printed).

Notice the **Language Selector** in the header: ProCal supports **English (`en`)**, **Arabic (`ar` with native RTL layout)**, **German (`de`)**, and **Italian (`it`)**. Choose your preferred language.

You land on `/dashboard`. The sidebar groups the app into:
- **Project Setup**: dashboard, projects, settings (company logo, branding, team defaults)
- **Engineering**: calculator, panel, riser, coordination, sld
- **Output**: cable-schedule, breaker-schedule, reports
- **Admin**: admin area (users, lead ledger, breaker catalog)

You'll trace through each major capability.

## 1. Create a project

`/projects` → New Project (as admin you bypass the credit gate; a non-admin
needs `credits >= 1` — see [Captured-lead credit gate](./explanation-billing-captured-lead.md)).

Fill in:
- **Name** — "Tutorial Tower".
- **Client / Consultant / Contractor / Engineer / Location** — submittal
  metadata; these print on the report cover page and Excel summary tab.
- **Voltage 400 V, Frequency 50 Hz, Power Factor 0.85** — the defaults are
  IEC-flavored; voltage is line-to-line.
- **Country: Syria** — your electrical defaults come from here (line voltage,
  frequency, per-room load densities, AC sizing rules). 90+ presets exist;
  unknown countries fall back to a neutral 400 V/50 Hz/0.85. See
  [country-defaults](./reference-auth-admin.md#country-defaults--srclibcountry-defaultsts).
- **Calculation standard: IEC or NEC (NEMA)**:
  - **IEC**: Sizing routes through IEC 60898/60947 preferred ratings (6 A to 2500 A) and applies IEC 60364-5-52 Annex G recommended voltage drop limits (3 % lighting / 5 % power).
  - **NEC (NEMA)**: Sizing routes through NEC 240.6(A) standard ampere ratings (15 A to 4000 A: 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500, 600, 700, 800, 1000, 1200, 1600, 2000, 2500, 3000, 4000 A), applies NEC 210.19(A) Informational Note voltage drop guidance (3 % branch / 5 % total), and cross-references metric cable mm² to nearest AWG/kcmil trade sizes (per NEC Ch. 9 Table 8).
  - *For this tutorial, keep the default **IEC**.*
- **Preferred manufacturer: MIXED** — the breaker schedules won't filter by
  manufacturer; you'll see ABB and Schneider rows. (Set ABB or Schneider to
  scope the catalog match.)
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

### Inspect the Math: Calculation Trace Popover ("Show Your Work")

Click directly on any calculated cell (e.g. current, cable size, breaker rating, or voltage drop %):
1. An interactive **Calculation Trace Popover** opens immediately.
2. It reveals:
   - **Symbolic Formula**: the exact engineering equation ($I = \frac{S}{\sqrt{3} \cdot V}$, $\Delta V = \sqrt{3} \cdot I \cdot L \cdot (R \cos\phi + X \sin\phi)$, etc.).
   - **Substituted Values**: your actual project numbers plugged into the equation step-by-step.
   - **Parameter Provenance**: where every constant came from (e.g. "Table B.52.14", "Project Settings", "CABLE_CATALOG").
   - **Governing Standard Citation**: exact clause reference (`IEC 60364-5-52 §525`, `IEC 60909`, `NEC 210.19(A)`).
   - **Compliance Badge**: `PASS` / `WARN` / `FAIL` evaluation against code limits with safety margin.
   - **Copy Formula**: formatted plain-text copy button for submittal calculation booklets.

### Batch Cable Defaults

Need to change cable insulation (PVC vs XLPE), installation method (Methods A1–G), or ambient temperature across all circuits?
Instead of editing items one-by-one, click **Batch Cable Defaults**:
- Select the scope (entire building or specific floor).
- Pick conductor material (Copper / Aluminum), insulation (XLPE / PVC), installation method (e.g., Method C - single-core on perforated tray), and ambient temperature (e.g., 40 °C).
- Apply — all circuits update and re-size instantly against the IEC derating tables.

## 4. Recalculate & rebalance

After all 12 apartments are in, run **Recalculate** (re-applies the IEC
diversity factor for the current apartment count — at 12 apartments that's the
0.55 step in the `getApartmentDiversityFactor` ladder; see
[Calc engine reference](./reference-calc-engine.md)) — and **Rebalance**
(persists the 1-phase `assignedPhase` values, preserving any pins).

**Engine Version Stamping**: Recalculation stamps the project with the current engine version (`ENGINE_VERSION = "2.0.0"`), guaranteeing that design parameters are auditable and flagged if the calculation core is upgraded.

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

## 6. Single-Line Diagram & Cable Editor

`/sld` → Block A. The SLD generator emits a **DSL per floor**
(`generateSLDPages`); `schematex/react` renders each as a vertical SVG. Page
through floors 1–4. You'll see: MDB bus → floor breaker → floor bus (or
sub-panel) → MCBs (one per apartment with its `breakerSize` and `cableSize`
labels).

Key capabilities:
- **Browser SVG Post-processing**: `extendCables` adds ladder-step spacing and `repositionLabels` aligns MCB labels to the right so the diagram is clear and publication-ready.
- **Cable Editor**: Click on any feeder circuit in the diagram to inspect and fine-tune its conductor properties, length, and installation method on the fly.
- **Export Formats**: Export high-resolution PNG (2× retina canvas) or vector PDF for drafting packages.

## 7. Protection Coordination & TCC Curves

`/coordination` → Block A. This module performs selectivity and cascading studies:
1. **Upstream & Downstream Pair**: Select the MDB main incomer (e.g. Masterpact MTZ or Emax 2 ACB) as upstream and a floor feeder (e.g. ComPacT NSX or Tmax XT MCCB) as downstream.
2. **Interactive TCC Curves**: The log-log plot displays the Time-Current Characteristic curves. Adjust the electronic trip parameters:
   - **L (Overload)**: Long-time pickup $I_r$ and time delay $t_r$.
   - **S (Short-Time Delay)**: Short-time pickup $I_{sd}$ and time delay $t_{sd}$ with $I^2t$ on/off slope options.
   - **I (Instantaneous)**: Instantaneous pickup $I_i$.
   - **G (Ground Fault)**: Ground-fault pickup $I_g$ and delay $t_g$.
3. **Selectivity Verdict**: ProCal cross-references Schneider Electric and ABB manufacturer coordination tables to output:
   - Verdict: **TOTAL**, **PARTIAL**, or **NO SELECTIVITY**.
   - Selectivity limit current $I_s$ (the highest fault current where only the downstream breaker trips).
4. **Cascading / Backup Protection**: Verifies enhanced downstream breaking capacity ($I_{cu}$) when protected by an upstream current-limiting breaker of the same manufacturer.
5. **Thermal Cable Damage Curve**: The curve $t = (k \cdot S / I)^2$ (per IEC 60364-4-43) is overlaid on the plot, verifying that fault clearance occurs well below the conductor insulation damage threshold.

## 8. Riser Diagram

`/riser` → Block A.
- Renders an auto-generated vertical distribution riser from the basement/ground MDB through Floor 1 to Floor 4.
- Displays per-floor demand kW, operating current, and cumulative voltage drop %.
- **Visual Banding**: Safe voltage drops are rendered in green/neutral tones, elevated drops in warning amber, and limit breaches in danger red.
- Offers interactive zoom, pan, and PNG export.

## 9. Deliverables: PDF Submittal & Excel Workbook

`/reports` → Block A. Walk through the tabs:
- **Project Summary**: Multi-building site summary, total connected load, diversified demand, transformer kVA, and main incomer current.
- **Bill of Materials (BOM)**: Aggregated equipment quantities, cable lengths by cross-section and type, and catalog breaker counts.
- **MDB Schedule**: Detailed outgoing feeder schedule with load descriptions, phase distributions, breaker frames, trip units, and cable specs.
- **Cable Schedule**: Circuit-by-circuit inventory with route lengths, conductor material, installation methods, derated ampacity, and voltage drop %.
- **Voltage Drop Schedule**: Full compliance table checking every run against project lighting and power limits.
- **Short Circuit Schedule**: Calculated three-phase, phase-to-phase, and phase-to-neutral fault levels per IEC 60909 at each bus and board.

### Exporting Deliverables:
- **Export PDF (`react-to-print`)**: Generates an engineering submittal package. Includes a formal Cover Page (populated with project metadata, client, consultant, contractor, engineer, and company branding from `/settings`), followed by each schedule on separate pages with clean page breaks.
- **Export Excel (`.xlsx`)**: One-click download of a multi-tab spreadsheet workbook generated via SheetJS (`exceljs`). Contains separate tabs for Project Summary, BOM, MDB, Cables, Breakers, Voltage Drop, and Short Circuits for client delivery or external auditing.

## 10. Revisions, Team Collaboration & Engineering QA Review

ProCal includes full lifecycle controls for team-based engineering projects:

### Revision Snapshots & Rollback
- Open project settings → **Revisions** tab.
- Click **Create Revision Snapshot**, give it a milestone tag (e.g. "Rev A - Preliminary Submittal") and description.
- ProCal creates an immutable snapshot of all buildings, floors, templates, loads, and settings.
- If changes need to be reverted, click **Restore Snapshot** to roll the design back with automated data integrity checks.
- Use the **Revision Diff** view to compare two milestones side-by-side.

### Team Collaboration & Invites
- Go to project settings → **Team** tab.
- Click **Invite Member**, enter their email or username, and assign a role:
  - `VIEWER`: Read-only access to view schedules, diagrams, and reports.
  - `EDITOR`: Full design access to modify loads, cables, breakers, and settings.
  - `ADMIN`: Full project management access including revision restoration and member management.
- The invitee accepts via the `/invite/accept` link.

### Engineering QA Review Drawer
- Open any engineering page and click the **QA Review** tab/drawer.
- Log peer review items, engineering questions, or standard compliance flags.
- Assign items to team members, track statuses (`OPEN`, `IN_PROGRESS`, `RESOLVED`), and attach resolution notes before final sign-off.

---

## You did it

You have walked through the full engineering cycle:
1. Created an IEC- or NEC-configured project with country engineering defaults.
2. Modeled buildings and room-level apartment templates.
3. Populated floors with balanced loads, inspected mathematical traces on-demand, and applied batch cable defaults.
4. Sized the MDB, outgoing feeders, and transformer off the worst-case phase.
5. Generated single-line diagrams with Schematex DSL and verified vertical riser voltage drops.
6. Conducted protection coordination studies with TCC curves, selectivity limits, cascading, and cable damage boundaries.
7. Produced publication-ready multi-page PDF submittals and multi-tab Excel workbooks.
8. Managed design milestones with revision snapshots, team collaboration invites, and the engineering QA review workflow.

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
