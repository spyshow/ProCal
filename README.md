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

The calculation engine is pure TypeScript with Vitest self-checks (`src/lib/calculations/*.test.ts`, plus `sld/` and `reports/`) — no React, no DB.

---

## Project layout

```
src/
  app/
    (app)/          # authenticated engineering app (sidebar layout)
      dashboard/ projects/ calculator/ panel/ riser/
      coordination/ sld/ cable-schedule/ breaker-schedule/
      reports/ settings/
    (admin)/        # role-gated admin (stats, users, breaker catalog)
    login/ signup/  # public auth pages
    api/            # route handlers (projects, buildings, floors, admin, auth, …)
  components/       # Sidebar, report/* schedules, RoomInput, TemplateManager, …
  context/          # ProjectContext (active project + preferred manufacturer)
  lib/
    calculations/   # loads, cables, cablesData, installationMethods,
                    # shortCircuit, selectivity, phaseBalance, feeders, riser
    sld/            # Schematex DSL generator + cable editor
    reports/        # BOM / feeder / cable / breaker / VD aggregates
    auth.ts db.ts middleware.ts
  types/            # shared TS interfaces (Project, Building, FloorItem, …)
prisma/
  schema.prisma
  migrations/
  seed.ts           # engineer/admin user + ABB/Schneider equipment catalog
  seed-test-project.ts  # mixed-use demo project (towers + mall)
```

### Data model (Prisma)
`User` → `Project` → `Building` → `FloorDesign` → `FloorItem` (and `BuildingLoad`, `ApartmentTemplate` → `ApartmentRoom`, `LoadLibraryItem`). `EquipmentCatalog` rows belong to a `BreakerFamily`; projects pick default ACB/MCCB/MCB families. `BreakerSettings` store per-feeder protection settings (Ir/Tr/Isd/Tsd/I²t/Ii/Ig/Tg). Per-phase `assignedPhase` lives on `FloorItem` and `BuildingLoad` (`null` = auto-assign on read).

---

## Getting started

### Prerequisites
- Node.js (matches the Next.js 16 / React 19 stack)
- A PostgreSQL database
- `DATABASE_URL` and `JWT_SECRET` environment variables (see `.env` example below)

### Install & configure
```bash
npm install
```

Create a `.env` (this repo's values are for a local Postgres named `procal`):
```env
DATABASE_URL="postgresql://procal:procal@localhost:5432/procal?schema=public"
JWT_SECRET="<a long random hex string>"
```

### Database
```bash
npx prisma migrate dev     # create/apply migrations
npx prisma generate        # (re)generate the Prisma client into src/generated/prisma
```

Seed the admin user and the ABB/Schneider equipment catalog:
```bash
npx tsx prisma/seed.ts
# → engineer / password123  (role: ADMIN)
```

Optionally seed a full mixed-use demo project (two residential towers + a shopping mall, 112 apartments, templates, load library):
```bash
npx tsx prisma/seed-test-project.ts
```

### Run
```bash
npm run dev      # http://localhost:3000  → redirects to /dashboard (→ /login if not authed)
npm run build
npm start
```
Log in with `engineer` / `password123`, or self-register at `/signup`.

### Lint & test
```bash
npm run lint        # eslint
npm test            # vitest run
npm run test:watch  # vitest watch mode
```

---

## How a project flows

1. **Create a project** (`/projects`) — client, consultant, contractor, location, engineer, voltage/frequency/PF, country, preferred manufacturer (ABB / Schneider / MIXED), calculation standard (IEC / NEMA), voltage-drop limits.
2. **Buildings** (`/projects/[id]`) — floors, service floors, apartments/floor, supply voltage, earthing (TN-S default), lightning protection, generator/transformer, mechanical loads. Define **apartment templates** (room-by-room, 1- or 3-phase) and a **load library** here.
3. **Load Calculator** (`/calculator`) — add floor items, watch totals, per-phase balance, neutral and unbalance update; recalculate, rebalance, copy between floors.
4. **Panel / Riser / SLD / Coordination** designers consume the saved data through one shared `computeFeeders` path so sizing matches everywhere.
5. **Schedules & Reports** (`/reports`) aggregate everything across the building and **export PDF** for submittal.

---

## Conventions

- UI matches the existing dark/orange engineering aesthetic — reuse `.engineering-table` and `.dense-input` classes (see `src/components/Sidebar.tsx` and `globals.css`) rather than introducing a foreign look. See `CLAUDE.md` "Frontend design" for the preferred component/styling tooling (21st.dev, UI UX Pro Max, framer-motion).
- Route groups: `(app)` is the authenticated engineering workspace (sidebar layout); `(admin)` is the role-gated admin area; `/login` and `/signup` are public.
- Calculations live in pure, tested modules under `src/lib/calculations/` — the UI, API routes, and reports all import from there so numbers never drift between surfaces.

---

## License

Private (`"private": true` in `package.json`).
