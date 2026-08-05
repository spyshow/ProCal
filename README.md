# ProCal — Electrical Load & MDB Designer

ProCal is a multi-tenant web application for electrical engineers to design low-voltage power-distribution systems for residential and commercial buildings. It runs load calculations, sizes cables and breakers, performs per-phase balancing, checks protection coordination, draws single-line and riser diagrams, and exports printable engineering schedules — all against an equipment catalog of real ABB / Schneider breakers.

Built for the workflow: **project → buildings → floors → loads → panels → schedules → report**. Standards referenced throughout: **IEC 60364-5-52** (cable sizing, ampacity, voltage drop), **IEC 60909** (short-circuit currents), **IEC 60076** (transformers), and **IEC/EN 50160 / NEMA** (phase unbalance).

> This is **not** stock Next.js. Per `AGENTS.md`, this Next.js version has breaking changes — read the relevant guide in `node_modules/next/dist/docs/` before writing any code.

---

## Documentation

Structured docs live in [`docs/`](./docs/README.md), organized by the Diataxis framework (tutorial / how-to / reference / explanation):

- **Tutorial** — [your first project](./docs/tutorial-getting-started.md)
- **How-to** — [run locally](./docs/how-to-run-locally.md) · [add a load](./docs/how-to-add-a-load.md) · [grant credits (admin)](./docs/how-to-grant-credits-admin.md) · [import the catalog (admin)](./docs/how-to-import-breaker-catalog.md)
- **Reference** — [calc engine](./docs/reference-calc-engine.md) · [data model](./docs/reference-data-model.md) · [API](./docs/reference-api.md) · [auth & admin](./docs/reference-auth-admin.md) · [SLD & reports](./docs/reference-sld-reports.md)
- **Explanation** — [phase balancing](./docs/explanation-phase-balancing.md) · [captured-lead credit gate](./docs/explanation-billing-captured-lead.md)

New to the codebase? Start with the [tutorial](./docs/tutorial-getting-started.md). Need a contract or signature? Use a reference. Wondering why a decision was made? Read an explanation.

---

## Features

### Load calculation & per-phase balancing
- **Floor-level load board** (`/calculator`): add apartments, service panels, pump panels, and elevator panels to each floor. Apartments pull their connected load from a room-based template (kitchen / bedroom / living room / … with area, load density in VA/m², and auto A/C sizing); other panels pull from a reusable load library or a custom kW value.
- **Per-phase (L1 / L2 / L3) accounting** for every board. The balance engine (`src/lib/calculations/phaseBalance.ts`) splits 3-phase loads equally (kW/3 per phase) and auto-assigns single-phase loads to the least-loaded phase on read (stable greedy order) when no phase is pinned. Manual pinning overrides this. It reports per-phase current and kW, the **vector neutral current** (true 120° phase offset + per-item PF displacement angle, `I_N = √(X² + Y²)` — not the wrong PF-only approximation), a **current-unbalance % proxy** `(max − min) / avg × 100` against an IEC- or NEMA-framed limit, and a `2× max-phase` neutral-oversize guard (PDH Course E336 §5C). Three-phase *apartment templates* are flagged `internalImbalanceNotModelled` because they are bundles of 1-phase room circuits, not balanced motors.
- **Recalculate / Rebalance all floors** buttons propagate template and assignment changes through stored results.
- **Copy to floors** duplicates a floor's items onto other floors.

### Cable & breaker sizing (`src/lib/calculations/`)
- **Ampacity** from IEC 60364-5-52 tables: 16 cross-sections (1.5 → 300 mm²), copper & aluminum, PVC & XLPE, 1- and 3-phase, with **installation-method multipliers** (Reference Methods A1, A2, B1, B2, C, E, F, G), **temperature derating** (10–60 °C), and **grouping derating** (1–20 cables).
- **Voltage drop** per circuit against configurable project limits (default 3 % lighting / 5 % power — IEC 60364-5-52), with OK / WARNING / FAIL status.
- **Short-circuit currents** (`shortCircuit.ts`) via the IEC 60909 transformer-impedance method: three-phase, phase-to-phase (`×0.866`), phase-to-neutral, peak (mechanical stress), and fault MVA, with standard impedance-% lookup by kVA rating (ANSI/IEEE C57.12) and a cable-impedance correction path.
- **Breaker sizing** with a standard breaker-amp ladder, and **catalog matching** so the chosen breaker model comes from your equipment catalog (ABB / Schneider), respecting the project's preferred manufacturer and default ACB / MCCB / MCB families.

### Panel, riser & diagram designers
- **Panel Designer** (`/panel`): MDB / SMDB toggle. Computes outgoing feeders per board, the **main incomer current**, sizes the **main breaker + cable**, and sizes the **transformer** (kVA, max-winding-limited across phases). Shows the catalog breaker model for each feeder.
- **Riser Diagram** (`/riser`): auto-generated SVG vertical riser (MDB → floor SDBs) with per-floor demand, current, and voltage-drop, warning/danger banding, zoom, and PNG export.
- **SLD Designer** (`/sld`): auto-generates a single-line diagram from project data (utility → transformer → MDB → sub-panels → apartments) as **Schematex DSL**, rendered to SVG. Multi-page, zoom, PNG export.
- **Coordination study** (`/coordination`): interactive **TCC (time–current) curves** on a log-log plot. Edit L / S / I / G protection settings (Ir, Tr, Isd, Tsd, I²t, Ii, Ig, Tg) for an upstream and downstream breaker, set the available fault current, and get a **FULL / PARTIAL / NONE** selectivity verdict with the selectivity-limit current and same-manufacturer **cascading** (backup) enhanced breaking capacity. A simplified cable-damage curve `(k·S/I)²` is overlaid.

### Schedules & reports (`/reports`, `/cable-schedule`, `/breaker-schedule`)
- **Cable Schedule** and **Breaker Schedule** pages list every circuit/feeder across the selected building.
- **Reports & Schedules** page has tabs — Project Summary, Bill of Materials, MDB Schedule, Cable Schedule, Voltage Drop — and an **Export PDF** button that prints a full multi-page report (Cover Page → BOM → MDB → Cable → Breaker → Voltage-Drop schedules) via `react-to-print`. The cover page carries the project, client/consultant/contractor/engineer, and an uploadable company logo + name (set in `/settings`).

### Multi-user, roles & admin
- **Auth**: username + password (bcryptjs), signed JWT (HS256, 24 h) in an `httpOnly` `session_token` cookie. `middleware.ts` redirects every non-auth route to `/login`; `/signup` is open (username ≥ 3 chars, password ≥ 6). Admin routes additionally gate on `role === "ADMIN"` (`requireAdmin()` returns 401/403).
- **Credits**: each non-admin project create decrements a credit; **admins bypass** the credit gate. Admins grant credits per user.
- **Admin area** (`/admin`, role-gated): a stats dashboard (users total/enabled/disabled/admins, projects, credits held, catalog items; billing tiles are placeholders), **user management** (create / role / credits / disable soft-delete), and a **breaker-catalog manager** — full CRUD on `EquipmentCatalog` rows and `BreakerFamily` groupings, plus **CSV/Excel import** (with validation + upsert summary) and **template / catalog export**.
- **Equipment catalog** covers ACB, MCCB, MCB, RCCB, RCBO, SPD, Contactor, Overload, Meter, and CT from ABB and Schneider (seeded with Emax 2, Masterpact MTZ, Tmax XT, ComPacT NSX, S200, Acti9 iC60, …). Catalog rows are unique on `(manufacturer, category, series, model, ratedCurrent, poles)`.

### Per-country engineering defaults
90+ country presets (`src/lib/country-defaults.ts`) supply line voltage, frequency, power factor, per-room load densities (VA/m²), and A/C sizing rules (BTU & watts by room area). Defaults lean Middle-East (default country: **Syria**, default standard: **IEC**).

---

## Tech stack

| Layer | Choice |
|------|--------|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4, `lucide-react` icons, `motion-icons-react` |
| Database | PostgreSQL via Prisma 7 + `@prisma/adapter-pg` |
| Auth | `jose` (JWT), `bcryptjs` (passwords), httpOnly cookie |
| Charts/Diagrams | `schematex` (SLD SVG), hand-rolled SVG (riser) |
| Forms/validation | `react-hook-form` + `zod` + `@hookform/resolvers` |
| Tables | `@tanstack/react-table` |
| Export | `react-to-print` (PDF), `print-js`, `pagedjs` |
| Tests | Vitest |

---

## Getting started

### Prerequisites
- Node.js
- PostgreSQL database
- `DATABASE_URL` and `JWT_SECRET` environment variables (see `.env`)

### Install & Run
```bash
npm install
npm run dev
```

### Lint & Test
```bash
npm run lint
npm test
```
