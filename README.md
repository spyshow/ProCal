# ProCal — Electrical Load & MDB Designer

ProCal is a multi-tenant web application for electrical engineers to design low-voltage power-distribution systems for residential and commercial buildings. It runs load calculations, sizes cables and breakers, performs per-phase balancing, checks protection coordination, draws single-line and riser diagrams, provides step-by-step mathematical traces with standard citations, and exports printable engineering schedules and multi-tab Excel workbooks — all against an equipment catalog of real ABB / Schneider breakers.

Built for the workflow: **project → buildings → floors → loads → panels → schedules → report**. Standards referenced throughout: **IEC 60364-5-52** (cable sizing, ampacity, installation methods, voltage drop), **NEC / NFPA 70** (standard ampere ratings & branch circuit limits), **IEC 60909** (short-circuit currents), **IEC 60076** (transformers), **ANSI/IEEE C57.12** (transformer impedance), and **IEC/EN 50160 / NEMA** (phase unbalance).

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
- **Recalculate / Rebalance all floors** buttons propagate template and assignment changes through stored results, stamping the calculation engine version (`ENGINE_VERSION = "2.0.0"`).
- **Copy to floors** duplicates a floor's items onto other floors.

### Multi-code standards engine: IEC 60364 & NEC / NEMA (`codes.ts`)
- **Dual Code Standards**: Project-wide toggle between **IEC 60364** and **NEC (NEMA)**.
- **Standard Breaker Ladders**: IEC 60898/60947 preferred ratings (6 A → 2500 A) or NEC 240.6(A) standard ampere ratings (15 A → 4000 A: 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500, 600, 700, 800, 1000, 1200, 1600, 2000, 2500, 3000, 4000 A).
- **AWG / kcmil Cross-Referencing**: Metric cross-sections display corresponding NEC trade sizes (14 AWG up to 1000 kcmil) per NEC Chapter 9 Table 8.
- **Code-Specific Voltage Drop Limits**: Recommended voltage drop defaults for IEC (3 % lighting / 5 % power) and NEC (3 % branch circuit / 5 % total feeder + branch per NEC 210.19(A) Informational Note).

### Calculation Trace Engine ("Show Your Work")
- **Interactive Trace Popovers** (`CalculationTracePopover.tsx`, `TraceableCell.tsx`): Clickable calculation cells across schedules and calculators open a detailed diagnostic inspection drawer.
- **Step-by-step Mathematical Provenance**: Displays symbolic formulas, substituted numerical parameters, parameter origins (Project Settings, IEC Tables, user inputs), and exact governing standard citations (e.g., `IEC 60364-5-52 §525`, `NEC 210.19(A)`).
- **Compliance Status Badging**: Instant `PASS` / `WARN` / `FAIL` status evaluations with safety margins and submittal-ready plain-text copying.

### Cable & breaker sizing (`src/lib/calculations/`)
- **Ampacity** from IEC 60364-5-52 tables: 16 cross-sections (1.5 → 300 mm²), copper & aluminum, PVC & XLPE, 1- and 3-phase, with **installation-method multipliers** (Reference Methods A1, A2, B1, B2, C, E, F, G), **temperature derating** (10–60 °C), and **grouping derating** (1–20 cables).
- **Voltage drop** per circuit against configurable project limits (default 3 % lighting / 5 % power — IEC 60364-5-52), with OK / WARNING / FAIL status.
- **Short-circuit currents** (`shortCircuit.ts`) via the IEC 60909 transformer-impedance method: three-phase, phase-to-phase (`×0.866`), phase-to-neutral, peak (mechanical stress), and fault MVA, with standard impedance-% lookup by kVA rating (ANSI/IEEE C57.12) and a cable-impedance correction path.
- **Breaker sizing & catalog matching**: Selects standard ratings and matches specific catalog models (ABB Emax 2 / Tmax XT / S200, Schneider Masterpact MTZ / ComPacT NSX / Acti9 iC60) respecting manufacturer preference.
- **Batch cable defaults**: Bulk-update cable installation methods, insulation types, and ambient derating factors across entire buildings or floors.

### Panel, riser & diagram designers
- **Panel Designer** (`/panel`): MDB / SMDB toggle. Computes outgoing feeders per board, the **main incomer current**, sizes the **main breaker + cable**, and sizes the **transformer** (kVA, max-winding-limited across phases). Shows the catalog breaker model for each feeder.
- **Riser Diagram** (`/riser`): auto-generated SVG vertical riser (MDB → floor SDBs) with per-floor demand, current, and voltage-drop, warning/danger banding, zoom, and PNG export.
- **SLD Designer** (`/sld`): auto-generates a single-line diagram from project data (utility → transformer → MDB → sub-panels → apartments) as **Schematex DSL**, rendered to SVG. Multi-page, zoom, and PNG/PDF export.

### Protection coordination study (`/coordination`)
- **Interactive TCC curves**: Log-log Time–Current Characteristic curves with dynamic L / S / I / G electronic and thermal-magnetic trip unit profiles (Ir, Tr, Isd, Tsd, I²t, Ii, Ig, Tg).
- **Selectivity verdict**: Automated evaluation (**FULL / PARTIAL / NONE**) with exact selectivity-limit current ($I_s$) derived from Schneider Electric and ABB tested coordination tables.
- **Cascading & backup protection**: Reinforced breaking capacity ($I_{cu}$) lookup when upstream and downstream breakers are from the same manufacturer family.
- **Cable thermal damage curve**: Overlaid adiabatic withstand limit line $t = (k \cdot S / I)^2$ confirming fault clearance before conductor insulation breakdown.

### Deliverable schedules & multi-format reports (`/reports`)
- **Schedule views**: `/cable-schedule`, `/breaker-schedule`, and `/reports` offer complete visibility across all circuits, feeders, boards, and equipment.
- **Report tabs**: Project Summary (with multi-building aggregation), Bill of Materials (BOM), MDB Schedule, Cable Schedule, Voltage Drop Schedule, and Short Circuit Schedule.
- **Printable PDF Submittal**: Formatted multi-page engineering submittal (Cover Page with company logo and client/consultant metadata, followed by each schedule on individual pages with clean page breaks) via `react-to-print`.
- **Excel Workbook Export (`.xlsx`)**: Comprehensive multi-tab spreadsheet generation via SheetJS (`exceljs`), exporting all schedules, metadata, and calculation summaries directly to Excel.

### Engineering revisions, audit logs & QA review
- **Immutable project revisions** (`ProjectRevision`): Create named snapshot checkpoints with metadata before major redesigns; restore snapshots with automated data rollback.
- **Revision diffing** (`revisions-diff.ts`): Side-by-side comparison of two revision snapshots highlighting added/modified/deleted loads, panels, and sizing changes.
- **Audit trail** (`ProjectAuditLog`): Detailed chronological log tracking project modifications, calculation updates, and team actions.
- **QA review workflow** (`QAReviewDrawer.tsx`, `ProjectReviewItem`): In-app engineering peer review system for logging checks, questions, and approval sign-offs on designs.

### Multi-user, team collaboration & administration
- **Auth**: username + password (bcryptjs), signed JWT (HS256, 24 h) in an `httpOnly` `session_token` cookie.
- **Team collaboration**: Project owners can invite colleagues by email/username with scoped roles (`VIEWER`, `EDITOR`, `ADMIN`); invitees join via tokenized `/invite/accept` links.
- **Captured-lead credit gate**: Non-admin project creation decrements credits; credit requests trigger captured-lead notifications to administrators with an integrated lead ledger (`/admin/leads`).
- **Admin area** (`/admin`): Metrics dashboard, user management (roles, credits, soft-delete), lead processing, and breaker catalog management (full CRUD, CSV/Excel import/export).

### Country engineering defaults & internationalization (i18n)
- **90+ country presets** (`country-defaults.ts`): Automatic configuration of nominal voltages, frequency, standard power factor, room load densities (VA/m²), and climate-adapted A/C sizing rules.
- **Multilingual UI**: Native support for **English (`en`)**, **Arabic (`ar` with RTL layout)**, **German (`de`)**, and **Italian (`it`)** with in-app language switching.

### Architecture knowledge graph (`graphify`)
- Built-in knowledge graph in `graphify-out/` indexing 6,000+ nodes and 8,800+ AST/semantic edges across components, calculation functions, and standards.
- Navigable via `graphify query`, `graphify path`, and interactive HTML visualization (`graphify-out/graph.html`).

---

## Tech stack

| Layer | Choice |
|------|--------|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript 5 (strict) |
| Styling & UI | Tailwind CSS 4, Radix UI primitives, `lucide-react`, `motion-icons-react`, `framer-motion` |
| Database | PostgreSQL via Prisma 7 + `@prisma/adapter-pg` |
| Auth & Security | `jose` (JWT HS256), `bcryptjs` (passwords), secure `httpOnly` cookie |
| Schematics & Curves | `schematex` (SLD SVG generator), hand-rolled SVG (riser), interactive SVG (TCC curves) |
| Forms & Validation | `react-hook-form` + `zod` + `@hookform/resolvers` |
| Data Tables | `@tanstack/react-table` |
| Deliverable Exports | `react-to-print` (multi-page submittal PDF), `xlsx` (multi-tab SheetJS Excel workbooks) |
| Internationalization | `i18next` + `react-i18next` (English, Arabic RTL, German, Italian) |
| Observability | `@microsoft/clarity` (user session analytics & heatmaps) |
| Testing | Vitest (56 test suites, 630+ unit & integration tests) |
| Knowledge Graph | `graphify` (6,000+ nodes, persistent AST + semantic codebase map) |

---

## Getting started

### Prerequisites
- Node.js (v20+)
- Docker & Docker Compose (for PostgreSQL and Mailpit)
- `DATABASE_URL`, `JWT_SECRET`, and `SMTP_*` environment variables (see `.env.example`)

### Quick Start
```bash
# 1. Start backing services (Postgres on :5432, Mailpit on :1025 / web UI on :8025)
docker compose up -d

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Fill in JWT_SECRET with a secure random string

# 4. Apply database migrations & seed catalog + admin
npx prisma migrate dev
npx prisma generate
npx prisma db seed

# 5. Start development server
npm run dev
```

### Lint & Test
```bash
npm run lint
npm test
```
