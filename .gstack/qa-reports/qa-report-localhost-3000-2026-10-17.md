# QA Report: ProCal Electrical Engineering Platform

| Field | Value |
|-------|-------|
| **Date** | 2026-10-17 |
| **URL** | http://localhost:3000 |
| **Branch** | master |
| **Baseline Commit** | 59db1ec / e41d905 (2026-10-17) |
| **Final Commit** | aaff23f (2026-10-17) |
| **Mode** | `/qa` Find + Fix + Verify Loop (Exhaustive Tier) |
| **Scope** | Full application (`/`, `/tools`, `/tools/*` (7 tools), `/contact`, `/login`, `/signup`, `/forgot-password`, `/dashboard`, `/projects`, `/projects/[id]` (7 tabs), `/calculator`, `/breaker-schedule`, `/coordination`, `/cable-schedule`, `/panel`, `/riser`, `/sld`, `/reports` (8 tabs), `/settings`, `/billing`, `/admin/*` (6 routes)) |
| **Pages visited** | 35 |
| **Screenshots** | 65 (50 baseline + 15 post-fix verification) |
| **Framework** | Next.js 16.2.10 (Turbopack) + React 19 |
| **Test Suite** | 77 test files passed (868 tests), `tsc --noEmit` 0 errors |

## Health Score: 100/100 (Baseline: 79/100, +21 pts)

| Category | Weight | Baseline | Post-Fix | Weighted |
|----------|--------|----------|----------|----------|
| Console | 15% | 70/100 | 100/100 | 15.00 |
| Links | 10% | 84/100 | 100/100 | 10.00 |
| Visual | 10% | 70/100 | 100/100 | 10.00 |
| Functional | 20% | 66/100 | 100/100 | 20.00 |
| UX | 15% | 86/100 | 100/100 | 15.00 |
| Performance | 10% | 95/100 | 98/100 | 9.80 |
| Content | 5% | 91/100 | 100/100 | 5.00 |
| Accessibility | 15% | 89/100 | 100/100 | 15.00 |
| **Total** | **100%** | **79/100** | **100/100** | **99.80 → 100/100** |

## Summary of Fixes (16 / 16 Verified)

| Severity | Found | Fixed & Verified | Remaining |
|----------|-------|------------------|-----------|
| Critical | 0 | 0 | 0 |
| High | 1 | 1 | 0 |
| Medium | 6 | 6 | 0 |
| Low | 9 | 9 | 0 |
| **Total** | **16** | **16** | **0** |

---

## Verified Fixes

### ISSUE-001: Feature Showcase slideshow images redirect to `/login` (307) and fail to render

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | visual / functional |
| **Status** | **verified** (`d865409`) |
| **URL** | http://localhost:3000/ |

**Root Cause & Fix:** `src/proxy.ts` intercepted `/slides/*.webp` requests on unauthenticated sessions and redirected them (`307`) to `/login`. Added `/slides/` and static asset extensions (`/\.(?:webp|png|jpg|jpeg|gif|svg|ico|woff2?|ttf)$/i`) to `src/proxy.ts` and excluded `slides/` in `config.matcher`.

**Before / After:**
![Before](screenshots/landing-showcase.png)
![After](screenshots/issue-001-after.png)

---

### ISSUE-002: Mobile header (375×812) clips CTA off-screen, lacks mobile menu for hidden links, and overflows slogan punctuation

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | visual / ux |
| **Status** | **verified** (`e9c73e7`) |
| **URL** | http://localhost:3000/ |

**Root Cause & Fix:** Updated `src/app/page.tsx` header to compact spacing on mobile viewports (`375×812`), shortened mobile CTA text so it fits inside `375px` (`right: 363px`), and added a mobile quick-navigation bar (`Free Tools`, `Pricing`, `Sign In`) below the main header bar.

**Before / After:**
![Before](screenshots/landing-mobile.png)
![After](screenshots/issue-002-after.png)

---

### ISSUE-003: Switching theme while unauthenticated logs `401 (Unauthorized)` on `PATCH /api/auth/me`

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | console |
| **Status** | **verified** (`8be7b5b`) |
| **URL** | http://localhost:3000/ |

**Root Cause & Fix:** `ThemeContext.tsx` unconditionally fired `PATCH /api/auth/me` whenever `setTheme` was called, even when `user === null`. Guarded the remote persistence call with `if (user)` and updated `src/context/ThemeContext.test.tsx` (8/8 tests passing).

---

### ISSUE-004: Navbar `$20 Deal` badge mismatches actual pricing tiers and brand slogan has stray space before comma

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | content |
| **Status** | **verified** (`383b0ab`) |
| **URL** | http://localhost:3000/ |

**Root Cause & Fix:** Changed the navbar pricing badge from `$20 Deal` to `$29 Starter` in `src/app/page.tsx` and removed the stray space before the comma in `Low Voltage Electrical Design, Solved` across `src/app/page.tsx`, `src/components/BrandSlogan.tsx`, `src/components/brand/ProCalLogo.tsx`, `src/components/Sidebar.tsx`, `src/i18n/locales/en.json`, and `src/app/layout.tsx`.

**Before / After:**
![Before](screenshots/landing-viewport.png)
![After](screenshots/issue-004-after.png)

---

### ISSUE-005: Public "Free Tools" hub (`/tools`) — advertised as "Zero friction, no login required" — redirects unauthenticated users to `/login`

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | functional |
| **Status** | **verified** (`a557a9c`) |
| **URL** | http://localhost:3000/tools |

**Root Cause & Fix:** Added `/tools` and `/tools/*` to the public route allowlist in `src/proxy.ts` and updated `src/app/tools/layout.tsx` to include `ThemeSelector`, `LanguageSwitcher`, and session-aware navigation (`Engineering Dashboard` when logged in; `Sign In` / `Create Free Account` when logged out).

**Before / After:**
![Before](screenshots/tools-page.png)
![After](screenshots/issue-005-after.png)

---

### ISSUE-006: Landing page "Contact Engineering Team" link (`/contact`) is a broken link

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | functional |
| **Status** | **verified** (`7e41723`) |
| **URL** | http://localhost:3000/contact |

**Root Cause & Fix:** Created `src/app/contact/page.tsx` with direct engineering support channels, enterprise licensing links, and public tools navigation, and added `/contact` to `src/proxy.ts`.

**Before / After:**
![Before](screenshots/contact-authenticated.png)
![After](screenshots/issue-006-after.png)

---

### ISSUE-007: `/signup` labels Confirm Password field as `PASSWORD` and `/forgot-password` omits theme switcher & email label

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | ux / content |
| **Status** | **verified** (`225be42`) |
| **URL** | http://localhost:3000/signup |

**Root Cause & Fix:** Updated `src/app/signup/page.tsx` so the confirmation input uses `Confirm Password` label, placeholder, and its own show/hide eye toggle button. Updated `src/app/forgot-password/page.tsx` to label the input `Username or Email` and added `<ThemeSelector variant="footer" />` in the card footer.

**Before / After:**
![Before](screenshots/signup.png)
![After](screenshots/issue-007-after.png)

---

### ISSUE-008: Raw unrendered LaTeX markup (`$k_t, k_g$`, `$I_b \le I_n \le I_z$`, `$\Delta V$`, `$u_k\%$`) displayed in `/tools/*` calculators

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | content / visual |
| **Status** | **verified** (`c785cc1`) |
| **URL** | http://localhost:3000/tools/cable-sizer |

**Root Cause & Fix:** Replaced raw `$...$` LaTeX strings with proper HTML `<sub>` subscripts and Unicode math symbols (`≤`, `ΔV`, `u_k%`, `I_b`) across `src/app/tools/cable-sizer/page.tsx`, `src/app/tools/short-circuit-calculator/page.tsx`, and `src/app/tools/max-demand-calculator/page.tsx`.

**Before / After:**
![Before](screenshots/tool-cable-sizer.png)
![After](screenshots/issue-008-after.png)

---

### ISSUE-009: Engineering Dashboard always displays `0` Apartments and `0` Load Items across KPI cards and Recent Projects list

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | functional |
| **Status** | **verified** (`e2130bc`, `55c5099`) |
| **URL** | http://localhost:3000/dashboard |

**Root Cause & Fix:** Updated `GET /api/projects` (`src/app/api/projects/route.ts`) to select `apartmentsPerFloor` on `buildings` and `loadLibraryItems: { select: { id: true } }`, and updated `src/app/(app)/dashboard/page.tsx` to compute apartments and load items from both full and summary payloads and link Recent Projects rows directly to `/projects/${proj.id}`. Added regression test in `src/app/api/projects/route.test.ts`.

**Before / After:**
![Before](screenshots/dashboard-with-active-project.png)
![After](screenshots/issue-009-after.png)

---

### ISSUE-010: Project Detail (`/projects/[id]`) sidebar submenu always highlights `Buildings` regardless of active tab, and `Settings` tab renders duplicate `Project Name * *` asterisk

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | ux / visual |
| **Status** | **verified** (`f4264d1`) |
| **URL** | http://localhost:3000/projects/031214e3-df82-48be-86a8-7a9ba6726c16?tab=settings |

**Root Cause & Fix:** Synced `src/components/Sidebar.tsx` with `?tab=...` query parameters and a custom `procal-tab-change` event from `src/app/(app)/projects/[id]/page.tsx`, restored the bottom sidebar link to global `/settings`, removed the duplicate asterisk in `src/components/settings/ProjectSettingsTab.tsx`, and capitalized `Service Load Library`.

**Before / After:**
![Before](screenshots/project-tab-settings.png)
![After](screenshots/issue-010-after.png)

---

### ISSUE-011: Single Line Diagram (`/sld`) top toolbar clips `Print All (Full Package)` off-screen at 1280×720 and overlaps `Simulation Status` pill over vertically wrapped `1 / 36` counter

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | visual / layout |
| **Status** | **verified** (`5c101ee`) |
| **URL** | http://localhost:3000/sld |

**Root Cause & Fix:** Made the `/sld` top toolbar wrap cleanly (`flex-wrap`) so `Print All` stays inside `1280px`, added `whitespace-nowrap shrink-0` to the `1 / 36` pagination counter, moved `Simulation Status` to `top-14`, fixed flexbox scroll centering clipping on wide SLD schematics (`m-auto`), and shifted `Wf*` cable tags to the right of vertical drops in `src/lib/sld/layout.ts`.

**Before / After:**
![Before](screenshots/workflow-7-sld.png)
![After](screenshots/issue-011-after.png)

---

### ISSUE-012: Engineering Reports (`/reports`) Executive Summary displays `1000 kVA` Utility Transformer for a `3434.1 kVA` (`5267.8 A`) multi-building project

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | functional |
| **Status** | **verified** (`e59b486`) |
| **URL** | http://localhost:3000/reports |

**Root Cause & Fix:** Updated `src/components/report/CoverPage.tsx`, `src/app/(app)/reports/page.tsx`, and `src/lib/reports/excel.ts` so `CoverPage` filters by `selectedBuildingId` and dynamically sizes/sums per-building standard IEC transformers (`5100 kVA (400V)` across the 3 buildings for `3434.1 kVA` demand) whenever the stored `project.transformerSize` default (`1000 kVA`) is smaller than actual demand.

**Before / After:**
![Before](screenshots/workflow-8-reports.png)
![After](screenshots/issue-012-after.png)

---

### ISSUE-013: Floating `QA Notes` and `Feedback` action buttons overlap interactive controls, table columns, and report KPI cards across workflow pages

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | visual / ux |
| **Status** | **verified** (`c7d52fd`) |
| **URL** | http://localhost:3000/reports |

**Root Cause & Fix:** Redesigned `QAReviewDrawer` and `FeedbackFloatingButton` triggers into compact `h-8` side-by-side pills at `bottom-3` (`right-4` and `right-[124px]` in LTR; `left-14` and `left-[160px]` in RTL) and added bottom scroll clearance (`pb-14` / `pb-16`) to `#procal-main-content` and the `/sld` properties inspector.

**Before / After:**
![Before](screenshots/reports-short-circuit.png)
![After](screenshots/issue-013-after.png)

---

### ISSUE-014: Unhandled `TypeError: Failed to fetch` logged to `console.error` when navigating away from `/panel` or `/riser`

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | console |
| **Status** | **verified** (`d412011`) |
| **URL** | http://localhost:3000/panel |

**Root Cause & Fix:** Added `AbortController` cleanup on unmount in `src/app/(app)/panel/page.tsx` and `src/app/(app)/riser/page.tsx` and suppressed navigation-aborted `AbortError` / `TypeError` logs across `panel/page.tsx`, `riser/page.tsx`, and `ProjectContext.tsx`. Verified zero console errors during rapid `/panel` → `/riser` → `/sld` navigation.

---

### ISSUE-015: Arabic RTL (`ar`) leaves sidebar section headers in English and shifts floating `Feedback` (`الملاحظات`) pill onto Next.js indicator

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | visual / content |
| **Status** | **verified** (`d86f7fa`) |
| **URL** | http://localhost:3000/dashboard |

**Root Cause & Fix:** Added `common.overview` (`نظرة عامة`) and `workflow.pipeline` (`مسار العمل الهندسي`) to `src/i18n/locales/ar.json` and `src/i18n/locales/en.json`, and shifted RTL floating buttons to `left-14` / `left-[160px]` to avoid the Next.js Dev indicator (`N`).

**Before / After:**
![Before](screenshots/i18n-arabic-rtl.png)
![After](screenshots/issue-015-after.png)

---

### ISSUE-016: Navigating to `/billing` as an Admin redirects to `/admin/users` instead of rendering the Billing & Subscription page

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | functional / ux |
| **Status** | **verified** (`aaff23f`) |
| **URL** | http://localhost:3000/billing |

**Root Cause & Fix:** Removed the forced `router.push('/admin/users')` redirect on `src/app/(app)/billing/page.tsx` and replaced it with an informative Admin Account banner featuring quick links to `Manage Users` (`/admin/users`) and `Billing Leads` (`/admin/leads`), and added `src/app/(admin)/admin/dashboard/page.tsx` redirecting `/admin/dashboard` to `/admin`.

**Before / After:**
![Before](screenshots/billing-or-admin.png)
![After](screenshots/issue-016-after.png)
