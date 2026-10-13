# Plan: Disable Automatic Seeding of Apartment Templates & Service Loads on Project Creation

## Task Summary
When creating a new project, stop automatically seeding default apartment templates and service loads. Instead, create new projects cleanly with empty templates and load library by default, while maintaining optional on-demand buttons to fill defaults whenever the user desires.

---

## Proposed Steps

### Step 1: Update API - Stop Automatic Seeding in Project Creation
- **File**: `src/app/api/projects/route.ts`
- **Changes**:
  - In `POST /api/projects`, inspect `seedDefaults` from request payload.
  - Only call `seedDefaultProjectTemplates` and `seedDefaultLoadLibrary` if `data.seedDefaults === true`.
  - By default (when `seedDefaults` is omitted or false), do not seed anything.
- **Proof**:
  - Unit test in `src/app/api/projects/route.test.ts` verifying that `POST /api/projects` without `seedDefaults: true` does not invoke seeding functions, and does invoke them when `seedDefaults: true`.

### Step 2: Enhance Seed Defaults API
- **File**: `src/app/api/projects/[id]/seed-defaults/route.ts`
- **Changes**:
  - Allow an optional request body `{ type?: "all" | "templates" | "loads" }`.
  - When `type === "templates"`: only seed default apartment templates if none exist (or add standard templates).
  - When `type === "loads"`: only seed default service loads if none exist (or add standard loads).
  - When `type === "all"` or unspecified: keep existing behavior of seeding both if empty.
- **Proof**:
  - Add API route tests for `POST /api/projects/[id]/seed-defaults` testing selective seeding (`type: "loads"`, `type: "templates"`, `type: "all"`).

### Step 3: Add/Preserve UI Buttons for On-Demand Defaults
- **Files**:
  - `src/app/(app)/projects/[id]/page.tsx`:
    - In **Apartment Templates** tab: preserve the existing "Generate Default Templates" button in empty state, and ensure it calls the endpoint properly.
    - In **Service Load Library** tab (`LoadLibrary` component): add a "Load Default Service Loads" button with icon (`Sparkles`), both in the empty state and next to the "Add Load" button, so users can populate standard service loads anytime with one click.
  - `src/components/LoadManager.tsx`:
    - Add an equivalent "Load Defaults" button when loads list is empty.
  - `src/app/(app)/projects/page.tsx`:
    - In the "New Project" modal, add an optional unchecked checkbox: `[ ] Populate default apartment templates and service loads` (`seedDefaults`), so users who want them on creation can opt-in, but projects default to clean/empty.
- **Proof**:
  - Run frontend component tests and verify UI renders cleanly in both empty and populated states without errors.

### Step 4: Verification & Test Suite
- Run full test suite with `npm test` to ensure 100% passing tests and zero regressions.
- Verify building, floor, calculator, and report workflows function properly when starting with a project that has 0 templates and 0 service loads.
