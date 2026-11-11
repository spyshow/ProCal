# Implementation Plan: Free Trial Project

> Previous plan (MCP 5-stage workflow) archived at `docs/PLAN-archive-mcp-5stage.md`.

## Goal
Every new account may create **one lifetime Trial Project** without credits.
Trial = max **1 building**, max **2 levels** (`floors + serviceFloors <= 2`),
**watermarked + copy-protected** PDF, watermarked Excel and SLD.
Trial converts to a full project by spending **1 credit** (work is kept).

## Decisions (grill-me, 2026-10-21)
- Trial granted via `User.hasUsedTrial` (lifetime, survives project delete).
- `Project.isTrial` flag; limits enforced server-side, mirrored in UI.
- Upgrade = `POST /api/projects/[id]/upgrade` (owner, -1 credit, isTrial=false).
- Admins never get trial projects (they bypass credits).

## Steps
1. **Schema** — `User.hasUsedTrial Boolean @default(false)`, `Project.isTrial Boolean @default(false)`; expose `hasUsedTrial` in `getSessionUser`, `/api/auth/me`, `UserContext`.
   *Proof:* `npx prisma validate` + `tsc --noEmit` clean.
2. **API gates** — `POST /api/projects` (trial path when credits<1 && !hasUsedTrial), `POST /api/buildings` + `PUT /api/buildings/[id]` (1 building / 2 levels for trial), new `/upgrade` route. Shared helper `src/lib/trial.ts`.
   *Proof:* vitest unit tests for each gate (`src/lib/__tests__/trial.test.ts`, `src/app/api/projects/route.test.ts`, `src/app/api/projects/[id]/upgrade/route.test.ts`, `src/app/api/buildings/route.test.ts`, `src/app/api/buildings/[id]/route.test.ts`).
3. **Exports** — PDF watermark overlay + `user-select:none` in report HTML when `isTrial`; Excel disclaimer row; SLD/Riser watermark overlay.
   *Proof:* render-report-html test asserts watermark present only for trial; excel tests pass.
4. **UI** — projects page "Start free trial project" button; trial banner with Upgrade button; building/floor limits surfaced as errors.
   *Proof:* `src/app/(app)/projects/page.test.tsx` passes + `npx vitest run` (91/91 test files, 979/979 tests passing).

## Status
- [x] 1  - [x] 2  - [x] 3  - [x] 4

---

# Code Review Remediation Plan (2026-10-31)

## Steps
1. **PDF Security & Trial Encryption Integrity** (`src/app/api/projects/[id]/pdf/route.ts`, `src/lib/reports/server-pdf.ts`, `src/lib/mcp/server.ts`)
   - Canonicalize `/uploads/` paths (`path.resolve`) in `inlineImagesInHtml` to block path traversal (`CWE-22`).
   - In `generateServerPdf`, verify `/tmp/chromium` is an executable file (`fs.statSync` + `fs.accessSync`), and rethrow `encryptErr` when `options?.isTrial` is true so trial PDFs never silently fall back to unencrypted output.
   - In `src/lib/mcp/server.ts` (`get_project_report`), escape `project.name`, pass `Boolean(project.isTrial)` to `wrapReportMarkup` and `generateServerPdf`, and remove the unused `company` variable.
   - *Proof:* `npx vitest run src/lib/reports/server-pdf.test.ts src/lib/mcp/__tests__/server.test.ts` passes.
2. **Trial Limit Enforcement on Building Routes & `trialLevelsError`** (`src/lib/trial.ts`, `src/app/api/buildings/[id]/route.ts`)
   - Reject negative or non-positive floor counts in `trialLevelsError` (`floors < 1 || serviceFloors < 0`).
   - Enforce `building.project.isTrial` level limits in `PATCH /api/buildings/[id]` when `floors` or `serviceFloors` is updated.
   - *Proof:* `npx vitest run src/lib/__tests__/trial.test.ts 'src/app/api/buildings/[id]/route.test.ts'` passes with new tests covering `PATCH` trial enforcement and negative level inputs.
3. **Trial Limit & Upsert Hardening in `updateProjectSpec`** (`src/lib/agent/build-project.ts`)
   - Enforce `spec.buildings.length <= TRIAL_MAX_BUILDINGS`, account for `existingBldg?.serviceFloors ?? 0`, and check `fa.floorNumber <= TRIAL_MAX_LEVELS` on trial projects.
   - Restrict the single-building fallback (`project.buildings.length === 1 ? project.buildings[0] : null`) to when `spec.buildings.length === 1`.
   - *Proof:* `npx vitest run src/lib/agent/__tests__/update-project-spec.test.ts` passes with new trial enforcement tests.
4. **Transactional Trial Claim, Auth Select & UI/Workspace Polish** (`src/app/api/projects/route.ts`, `src/app/api/auth/me/route.ts`, `src/components/TopHeader.tsx`, `src/app/(app)/projects/[id]/page.tsx`, `src/app/(app)/sld/page.tsx`)
   - Wrap the trial `user.updateMany` + `project.create` in `db.$transaction` in `POST /api/projects`.
   - Add `hasUsedTrial: true` to `PATCH /api/auth/me` select.
   - Gate the Upgrade button on owner/admin, add print-mode trial watermark on `/sld`, and move `scratch_test_pup.mjs` out of the repo root.
   - *Proof:* `npx tsc --noEmit` and `npx vitest run` pass.

## Remediation Status
- [x] 1  - [x] 2  - [x] 3  - [x] 4


---

# FEAT-07 Plan: Native AutoCAD DXF Vector Export for SLD & Vertical Riser Diagrams (2026-10-31)

## Goal
Serialize ProCal's Single-Line Diagram (SLD) and Vertical Riser Diagram SVG layouts into layered ASCII AutoCAD `.dxf` drawings using `@tarikjabiri/dxf`, organized into standard AIA/ISO electrical CAD layers (`E-SLD-BUS`, `E-SLD-BRKR`, `E-SLD-CABL`, `E-SLD-TEXT`, `E-SLD-SYMB`, `E-SLD-GRID`) and gated behind non-trial project status (`isTrial === false`).

## Steps
1. **Install `@tarikjabiri/dxf` & Implement `src/lib/dxf/svg-to-dxf.ts`**
   - Install `@tarikjabiri/dxf` (`v2.10.0`).
   - Create `src/lib/dxf/svg-to-dxf.ts` exposing `convertSvgElementToDxf(svg: SVGSVGElement | Element, options?: DxfExportOptions): string`, `convertSvgStringToDxf(svgMarkup: string, options?: DxfExportOptions): string`, and `downloadDxf(dxfContent: string, filename: string): void`.
   - Support cumulative 2D affine transforms (`translate`, `scale`, `rotate`, `matrix`) across nested `<g>` elements, CAD Y-axis inversion ($y_{\text{CAD}} = H - y_{\text{SVG}}$), SVG primitive conversion (`<line>`, `<rect>`, `<circle>`, `<ellipse>`, `<polyline>`, `<polygon>`, `<path>`, `<text>`/`<tspan>`), and automatic layer routing (`E-SLD-BUS`, `E-SLD-BRKR`, `E-SLD-CABL`, `E-SLD-TEXT`, `E-SLD-SYMB`, `E-SLD-GRID`) with AutoCAD Color Index (ACI) colors.
   - *Proof:* `npx vitest run src/lib/dxf/__tests__/svg-to-dxf.test.ts` passes all unit tests (layer creation, coordinate inversion, affine transforms, path/primitive conversion, and trial guard).
2. **Integrate AutoCAD (.DXF) Export into SLD (`src/app/(app)/sld/page.tsx`) & Vertical Riser (`src/app/(app)/riser/page.tsx`)**
   - In `src/app/(app)/sld/page.tsx`, add `exportDXF()` handler and toolbar button (`Export DXF` / `AutoCAD .DXF`), gated behind `!project?.isTrial` (disabled with upgrade tooltip when `project?.isTrial` is true).
   - In `src/app/(app)/riser/page.tsx`, add `handleExportDXF()` handler and toolbar button next to `Export SVG`, gated behind `!project?.isTrial` (disabled with upgrade tooltip when `project?.isTrial` is true).
   - Add i18n keys (`sld.exportDxf`, `sld.dxfLockedTrial`) in `src/i18n/locales/en.json` and `src/i18n/locales/ar.json`.
   - *Proof:* `npx tsc --noEmit` exits 0 and `npx vitest run` passes across the test suite.

## FEAT-07 Status
- [x] 1  - [x] 2

---

# Supabase RLS Remediation Plan: `public.ApiKey` (`rls_disabled_in_public`, 2026-11-11)

## Goal
Resolve Supabase security linter error `0013_rls_disabled_in_public` on `public."ApiKey"` permanently in the repository and database by creating an idempotent Prisma migration and updating startup/sync scripts.

## Steps
1. **Create Prisma Migration (`prisma/migrations/20261111082600_enable_rls_and_api_key/migration.sql`)**
   - Idempotently ensure `"ApiKey"` table, indexes (`"ApiKey_keyHash_key"`, `"ApiKey_userId_idx"`, `"ApiKey_keyHash_idx"`), and foreign key (`"ApiKey_userId_fkey"`) exist.
   - Enable Row Level Security (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`) on `public."ApiKey"` and all public application tables.
   - *Proof:* `npx prisma migrate deploy` and `npx prisma migrate status` succeed cleanly.
2. **Update `scripts/pre-start.js` & `scripts/db-sync.ts`**
   - Include idempotent `ENABLE ROW LEVEL SECURITY` on `"ApiKey"` in `scripts/pre-start.js` and `scripts/db-sync.ts` so every deployment enforces RLS.
   - *Proof:* `npx prisma validate` and `npm test` pass.

## Status
- [x] 1  - [x] 2
