# Plan: Update Brand Slogan to "Low Voltage Electrical Design , Solved"

## Task Overview
Update the official ProCal brand slogan across the entire brand system and web application to:
`Low Voltage Electrical Design , Solved` with the word `Solved` highlighted in brand orange (`#ea580c` / `text-orange-500` / `text-orange-400`).

---

## Steps to Implement & Prove

### Step 1: Update Vector Masters & Generated Lockups
- **Files**:
  - `brand/logos/build_procal_masters.py`
  - `brand/logos/spec.json`
- **Actions**:
  - Update `get_lockup_horizontal()`, `get_lockup_stacked()`, `get_wordmark()` to render `Low Voltage Electrical Design , ` with `<tspan fill="#ea580c">Solved</tspan>`.
  - Re-run `build_procal_masters.py`.
  - Re-export variant kit to `brand/logos/dist/` and mirror to `public/brand/kit/`.
  - Re-run `presentation_board.py` to refresh `brand/logos/presentation.html`.
- **Proof**: Run `svg_audit.py` to ensure 100/100 score and inspect generated SVGs and PNGs.

### Step 2: Update React Components & Application Pages
- **Files**:
  - `src/components/brand/ProCalLogo.tsx`
  - `src/components/BrandSlogan.tsx`
  - `src/components/Sidebar.tsx`
  - `src/app/page.tsx`
  - `src/app/login/page.tsx`
  - `src/app/signup/page.tsx`
  - `src/app/forgot-password/page.tsx`
  - `src/app/reset-password/page.tsx`
  - `src/app/layout.tsx`
  - `src/components/ProCalConversionBanner.tsx`
  - `src/components/report/CoverPage.tsx`
  - `src/components/report/ReportHeader.tsx`
  - `src/lib/reports/render-report-html.tsx`
  - `src/app/api/projects/[id]/pdf/route.ts`
  - `src/components/settings/ProjectSettingsTab.tsx`
  - `src/app/tools/**`
- **Proof**: Verify exact casing and orange styling for `Solved`.

### Step 3: Update i18n Locales & Brand Guidelines
- **Files**:
  - `src/i18n/locales/en.json`
  - `brand/BRAND_GUIDELINES.md`
- **Proof**: Confirm `appTagline`, `appSloganPrefix`, and `appSloganHighlight` match the new slogan.

### Step 4: Verification & Automated Tests
- Run `npm test` across all suites to ensure zero regressions.
