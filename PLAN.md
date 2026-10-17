# Plan: Exhaustive `/qa` Fix Loop (ISSUE-001 through ISSUE-016)

## Task Summary
Fix all 16 issues discovered during the exhaustive `/qa-only` audit of ProCal (`http://localhost:3000`), ordered by severity (`1 High`, `6 Medium`, `9 Low`). Each fix will be committed atomically (`fix(qa): ISSUE-NNN — ...`), verified with unit/regression tests where applicable, and re-verified in the browser with `after` screenshots (viewed via `view_file`) and an updated Health Score in `.gstack/qa-reports/qa-report-localhost-3000-2026-10-17.md`.

---

## Steps & Proof (Ordered by Severity: High → Medium → Low)

### Step 0: Commit Pre-existing Breaker Model Fixes & QA Baseline
- Commit the existing working tree changes (`feeders.ts`, `selectivity.ts`, `aggregates.ts`, `BreakerSchedule.tsx`, `AGENTS.md`, `graphify-out/`, `.gstack/qa-reports/`) so `/qa` starts on a clean working tree.
- **Proof**: `git status --porcelain` is empty before starting ISSUE-005.

### Step 1 (High): ISSUE-005 — Allow public access to `/tools` and `/tools/*` in auth middleware
- Update `src/middleware.ts` (or public path allowlist) so `/tools` and `/tools/*` are accessible without redirecting anonymous users to `/login`.
- Also update the `/tools` header (`src/app/tools/layout.tsx` or `src/app/tools/page.tsx`) so authenticated users see a link back to `/dashboard` (`Engineering Dashboard`) instead of only `Sign In` / `Create Free Account`.
- **Proof**: Unauthenticated request to `http://localhost:3000/tools` and `/tools/cable-sizer` returns `200 OK` without redirecting to `/login`; screenshot `issue-005-after.png` + unit test.

### Step 2 (Medium): ISSUE-001 — Allow public static assets `/slides/*` and ensure Feature Showcase images render on `/`
- Update `src/middleware.ts` matcher/public paths so `/slides/*` (`.webp`, `.png`, `.jpg`, `.svg`) are not intercepted and redirected to `/login` (`307`). Verify `public/slides/slide_*.webp` exist and load with `200 OK`.
- **Proof**: Navigate to `http://localhost:3000/` (unauthenticated), scroll to Feature Showcase, verify all 5 slide images load with `naturalWidth > 0`; screenshot `issue-001-after.png`.

### Step 3 (Medium): ISSUE-002 — Fix mobile header (`375×812`) on landing page (`/`)
- Fix responsive layout in the landing page navbar (`src/app/page.tsx` or landing header component):
  - Prevent `Engineering Dashboard` / CTA button from clipping off-screen at `375px` width.
  - Provide accessible mobile navigation links (`Free Tools`, `Pricing`, `Sign In`) at `375px`.
  - Fix brand subtitle wrapping so `, Solved` never overflows below the `65px` header border.
- **Proof**: Set viewport to `375×812` on `http://localhost:3000/`, verify all header elements fit within `0..375px` and `0..65px`; screenshot `issue-002-after.png`.

### Step 4 (Medium): ISSUE-006 — Fix broken `/contact` link on landing page `#pricing`
- Create a clean public `/contact` page (`src/app/contact/page.tsx`) and add `/contact` to the public middleware allowlist so clicking `Contact Engineering Team` in `#pricing` works both logged out and logged in.
- **Proof**: Navigate to `http://localhost:3000/contact` (both unauthenticated and authenticated), verify `200 OK` and rendered contact page; screenshot `issue-006-after.png`.

### Step 5 (Medium): ISSUE-009 — Fix `/dashboard` showing `0` Apartments and `0` Load Items
- Update `GET /api/projects` (`src/app/api/projects/route.ts`) and/or `/dashboard` (`src/app/(app)/dashboard/page.tsx`) so the project summary includes accurate `apartmentsCount` and `loadItemsCount` (sum of floor apartments + building/template load items), and display them in the `APARTMENTS` and `LOAD ITEMS` KPI cards and `RECENT PROJECTS` rows.
- **Proof**: Navigate to `http://localhost:3000/dashboard`, verify non-zero `APARTMENTS` and `LOAD ITEMS` KPIs and `112 Apartments` on `Test Project - Mixed Use Complex`; screenshot `issue-009-after.png` + regression test.

### Step 6 (Medium): ISSUE-011 — Fix `/sld` top toolbar overflow, `1 / 36` pagination counter wrap, and SVG busbar label overlap
- In `src/app/(app)/sld/page.tsx` and SLD SVG component:
  - Make the top toolbar wrap or compact cleanly at `1280×720` so `Print All (Full Package)` is fully visible inside the viewport.
  - Add `white-space: nowrap` / `shrink-0` to the `1 / 36` pagination counter and adjust the `Simulation Status` overlay position so they never collide.
  - Adjust SVG vertical/horizontal offsets for branch phase labels (`Nfla`, `Nflb`, `Nflc`) and busbar title (`MDB Bus`) so they do not overlap the busbar line or clip at the left boundary.
- **Proof**: Navigate to `http://localhost:3000/sld` at `1280×720`, verify `Print All` is inside `1280px`, `1 / 36` is on one line, and SVG labels do not overlap; screenshot `issue-011-after.png`.

### Step 7 (Medium): ISSUE-012 — Fix `/reports` Executive Summary `1000 kVA` Utility Transformer sizing and building filter reactivity
- In `src/app/(app)/reports/page.tsx` and/or `ExecutiveSummary` report component:
  - Dynamically size or aggregate the `UTILITY TRANSFORMER` capacity from actual diversified project/building demand (standard IEC transformer ratings or sum of building transformers) instead of displaying a static `1000 kVA (400V)` when demand is `3434.1 kVA`.
  - Ensure switching the `BUILDING FILTER` updates Section 1 (`SYSTEM ELECTRICAL CALCULATIONS SUMMARY`) KPI cards for the selected building.
- **Proof**: Navigate to `http://localhost:3000/reports`, verify `UTILITY TRANSFORMER` matches demand (e.g. `4000 kVA` or multi-transformer rating $\ge 3434.1\text{ kVA}$) and updates when selecting `Residential Tower A`; screenshot `issue-012-after.png` + regression test.

### Step 8 (Low): ISSUE-003 — Prevent `401 (Unauthorized)` on `PATCH /api/auth/me` when switching theme while unauthenticated
- In the Theme Provider / Theme Switcher (`src/components/ThemeProvider.tsx` or `ThemeSwitcher`), only call `PATCH /api/auth/me` if a user session is active (or skip remote persistence on public unauthenticated pages).
- **Proof**: Switch theme on `http://localhost:3000/` while logged out and verify zero `401` console errors; screenshot `issue-003-after.png`.

### Step 9 (Low): ISSUE-004 — Fix `$20 Deal` navbar badge and `Design , Solved` stray comma spacing
- Update landing page navbar badge from `$20 Deal` to match actual pricing (e.g. `$29 Starter` or `$49 Pass`), and fix `Low Voltage Electrical Design , Solved` → `Low Voltage Electrical Design, Solved` across translations/components.
- **Proof**: Inspect `http://localhost:3000/` header, hero badge, and footer; screenshot `issue-004-after.png`.

### Step 10 (Low): ISSUE-007 — Fix `/signup` Confirm Password label/eye-toggle and `/forgot-password` label & theme switcher
- On `/signup` (`src/app/signup/page.tsx`), change the 5th input label/placeholder from `PASSWORD` / `Password` to `CONFIRM PASSWORD` / `Confirm password` and add a show/hide toggle.
- On `/forgot-password` (`src/app/forgot-password/page.tsx`), update field label to `USERNAME OR EMAIL` and include the `ThemeSwitcher` in the footer.
- **Proof**: Inspect `/signup` and `/forgot-password`; screenshots `issue-007-signup-after.png` and `issue-007-forgot-after.png`.

### Step 11 (Low): ISSUE-008 — Replace raw LaTeX strings (`$k_t, k_g$`, `$I_b \le I_n \le I_z$`, `$\Delta V$`, `$u_k\%$`, `$I_b$`) in `/tools/*`
- Replace literal `$...$` LaTeX markup in `/tools/cable-sizer`, `/tools/short-circuit-calculator`, and `/tools/max-demand-calculator` with clean formatted Unicode/HTML math symbols (`kₜ, k₉`, `I_b ≤ I_n ≤ I_z`, `ΔV`, `u_k%`, `I_b`).
- **Proof**: Inspect `/tools/cable-sizer`, `/tools/short-circuit-calculator`, and `/tools/max-demand-calculator`; screenshot `issue-008-after.png`.

### Step 12 (Low): ISSUE-010 — Fix `/projects/[id]` sidebar active tab highlighting, duplicate `Project Settings` link, `Project Name * *`, and stray tab underline
- In the app sidebar and `/projects/[id]/page.tsx`:
  - Highlight the matching sidebar item (`Buildings`, `Project Team`, `QA & Compliance`, `Activity Log`, `Project Settings`) based on `?tab=...` query param.
  - Keep global `Settings` (`/settings`) at the bottom of the sidebar instead of duplicating `Project Settings`.
  - Remove the duplicate asterisk in `Project Name * *`, fix `Service Load library` → `Service Load Library`, and hide the horizontal tab bar active underline when `?tab=settings` is active (or include `Project Settings` as a proper tab).
- **Proof**: Navigate to `/projects/[id]?tab=settings` and `?tab=team`; screenshot `issue-010-after.png`.

### Step 13 (Low): ISSUE-013 — Prevent floating `QA Notes` and `Feedback` buttons from overlapping report cards, tables, and inspector controls
- Adjust positioning/compactness of the floating `QA Notes` and `Feedback` widgets and add bottom safe-area padding (`pb-24`) to workflow pages so bottom-right cards, table columns, and action buttons can always be scrolled clear of the floating pills.
- **Proof**: Check `/reports`, `/sld`, and `/coordination`; screenshot `issue-013-after.png`.

### Step 14 (Low): ISSUE-014 — Suppress unhandled `AbortError` / navigation `TypeError: Failed to fetch` in `/panel` and `/riser`
- In `src/app/(app)/panel/page.tsx` and `src/app/(app)/riser/page.tsx`, use an `AbortController` or ignore `AbortError` / unmounted fetch cancellations so navigating away mid-fetch does not log uncaught `TypeError: Failed to fetch` to `console.error`.
- **Proof**: Rapidly navigate across `/panel` → `/riser` → `/sld` and verify zero `TypeError: Failed to fetch` errors in `$B console --errors`.

### Step 15 (Low): ISSUE-015 — Translate sidebar section headers in Arabic (`ar`) and fix RTL floating button collision
- Add Arabic translations for `OVERVIEW` (`نظرة عامة`) and `ENGINEERING WORKFLOW` (`سير العمل الهندسي`) in the i18n dictionary/sidebar, and offset the RTL floating `Feedback` / `QA Notes` buttons so they do not collide with the Next.js Dev indicator or obscure project card counts.
- **Proof**: Switch language to Arabic (`العربية`) on `/dashboard` and verify translated sidebar headers and non-overlapping floating button; screenshot `issue-015-after.png`.

### Step 16 (Low): ISSUE-016 — Allow Admin users to view `/billing` and support `/admin/dashboard`
- Remove the forced redirect on `/billing` that sends admins to `/admin/users` (so admins can view `/billing`), and add a redirect/alias from `/admin/dashboard` to `/admin`.
- **Proof**: Navigate to `/billing` and `/admin/dashboard` while logged in as Admin (`engineer`); screenshot `issue-016-after.png`.

### Step 17: Final Verification, Test Suite, Report Update & Graphify
- Run `npm test` and `npx tsc --noEmit`.
- Re-verify all fixed routes in `$B`, compute the updated Health Score, update `.gstack/qa-reports/qa-report-localhost-3000-2026-10-17.md`, `.gstack/qa-reports/baseline.json`, and run `graphify update .`.
