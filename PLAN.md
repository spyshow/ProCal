# Plan: Exhaustive `/qa` Fix Loop (ISSUE-001 through ISSUE-016) — COMPLETED ✅

## Task Summary
All 16 issues discovered during the exhaustive `/qa-only` audit of ProCal (`http://localhost:3000`), ordered by severity (`1 High`, `6 Medium`, `9 Low`), have been fixed, committed atomically (`fix(qa): ISSUE-NNN — ...`), verified with unit/regression tests (`77 test files, 868 passed`), and re-verified in the browser with `after` screenshots (viewed via `view_file`) raising the Health Score from **79/100 → 100/100**.

---

## Completed Steps & Proof

- [x] **Step 0: Commit Pre-existing Breaker Model Fixes & QA Baseline** (`e41d905`)
- [x] **Step 1 (High): ISSUE-005 — Allow public access to `/tools` and `/tools/*` in auth proxy (`src/proxy.ts`)** (`a557a9c`)
  - **Proof**: Unauthenticated `http://localhost:3000/tools` returns `200 OK`; verified in `issue-005-after.png`.
- [x] **Step 2 (Medium): ISSUE-001 — Allow public static assets `/slides/*` and render Feature Showcase images on `/`** (`d865409`)
  - **Proof**: All 5 `/slides/slide_*.webp` load with `naturalWidth: 1600`; verified in `issue-001-after.png`.
- [x] **Step 3 (Medium): ISSUE-002 — Fix mobile header (`375×812`) on landing page (`/`)** (`e9c73e7`)
  - **Proof**: Responsive CTA and mobile quick-nav links (`Free Tools`, `Pricing`, `Sign In`) fit cleanly within `375px`; verified in `issue-002-after.png`.
- [x] **Step 4 (Medium): ISSUE-006 — Create public `/contact` page and allow `/contact` in `src/proxy.ts`** (`7e41723`)
  - **Proof**: `http://localhost:3000/contact` renders `200 OK` (logged out and logged in); verified in `issue-006-after.png`.
- [x] **Step 5 (Medium): ISSUE-009 — Fix `/dashboard` showing `0` Apartments and `0` Load Items** (`e2130bc`, `55c5099`)
  - **Proof**: `GET /api/projects` returns `apartmentsPerFloor` and `loadLibraryItems`; `/dashboard` shows `225 Apartments` and `32 Load Items` (`112 Apartments` on `Test Project - Mixed Use Complex`); verified in `issue-009-after.png` + `src/app/api/projects/route.test.ts`.
- [x] **Step 6 (Medium): ISSUE-011 — Fix `/sld` top toolbar overflow, `1 / 36` pagination counter wrap, and SVG busbar label overlap** (`5c101ee`)
  - **Proof**: `Print All` button (`right: 1256px <= 1280px`), single-line `1 / 36` counter, non-overlapping `Simulation Status` badge, and clean SVG cable tags; verified in `issue-011-after.png`.
- [x] **Step 7 (Medium): ISSUE-012 — Fix `/reports` Executive Summary Utility Transformer sizing and building filter reactivity** (`e59b486`)
  - **Proof**: `UTILITY TRANSFORMER` displays `5100 kVA (400V)` for `3434.1 kVA` project demand and updates dynamically per building filter; verified in `issue-012-after.png`.
- [x] **Step 8 (Low): ISSUE-003 — Prevent `401 (Unauthorized)` on `PATCH /api/auth/me` when switching theme while unauthenticated** (`8be7b5b`)
  - **Proof**: Zero console errors when switching themes while logged out + `src/context/ThemeContext.test.tsx` (8/8 passed).
- [x] **Step 9 (Low): ISSUE-004 — Fix `$20 Deal` navbar badge (`$29 Starter`) and `Design, Solved` comma spacing** (`383b0ab`)
  - **Proof**: Verified on `http://localhost:3000/` in `issue-004-after.png`.
- [x] **Step 10 (Low): ISSUE-007 — Fix `/signup` Confirm Password label/eye-toggle and `/forgot-password` label & theme switcher** (`225be42`)
  - **Proof**: Verified on `/signup` and `/forgot-password` in `issue-007-after.png`.
- [x] **Step 11 (Low): ISSUE-008 — Replace raw LaTeX strings (`$k_t, k_g$`, `$I_b \le I_n \le I_z$`, `$\Delta V$`, `$u_k\%$`, `$I_b$`) in `/tools/*`** (`c785cc1`)
  - **Proof**: Clean HTML `<sub>` and Unicode math symbols across `/tools/*`; verified in `issue-008-after.png`.
- [x] **Step 12 (Low): ISSUE-010 — Fix `/projects/[id]` sidebar active tab highlighting, global `Settings` footer link, `Project Name *`, and `Service Load Library` capitalization** (`f4264d1`)
  - **Proof**: Verified on `/projects/[id]?tab=settings` in `issue-010-after.png`.
- [x] **Step 13 (Low): ISSUE-013 — Make floating `QA Notes` and `Feedback` buttons compact side-by-side pills with bottom scroll clearance** (`c7d52fd`)
  - **Proof**: `UTILITY TRANSFORMER` (`5100 kVA (400V)`) and inspector cards are unobstructed; verified in `issue-013-after.png`.
- [x] **Step 14 (Low): ISSUE-014 — Abort in-flight fetches on unmount and suppress navigation `TypeError: Failed to fetch` in `/panel` and `/riser`** (`d412011`)
  - **Proof**: Rapid navigation `/panel` → `/riser` → `/sld` produces `(no console errors)`.
- [x] **Step 15 (Low): ISSUE-015 — Translate sidebar section headers (`نظرة عامة`, `مسار العمل الهندسي`) in Arabic (`ar`) and offset RTL floating buttons** (`d86f7fa`)
  - **Proof**: Verified on `/dashboard` in Arabic RTL in `issue-015-after.png`.
- [x] **Step 16 (Low): ISSUE-016 — Allow Admin users to view `/billing` with an admin banner and redirect `/admin/dashboard` to `/admin`** (`aaff23f`)
  - **Proof**: Verified on `/admin/dashboard` (`200 OK`) and `/billing` (`200 OK`) in `issue-016-after.png`.
- [x] **Step 17: Final Verification, Test Suite (`77 passed, 868 tests`), Report Update & Graphify**
