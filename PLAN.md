# Plan: Add Ability to Change Load Name in the Load Calculator Table

## Task Summary
Add inline editing for load names in the load calculator table (`/calculator`), allowing engineers to rename floor items (apartments, service panels, elevator loads, custom equipment) directly from the circuit table with instant optimistic UI feedback, keyboard navigation, and database persistence.

---

## Proposed Steps

### Step 1: Update API - Support `name` in `PATCH /api/floor-items/[id]`
- **File**: `src/app/api/floor-items/[id]/route.ts`
- **Changes**:
  - Accept `name` in the PATCH request body.
  - Validate that `name` is a non-empty string after trimming; return 400 if empty.
  - Update `name` in `db.floorItem.update`.
  - Track `name` in `computeCableCircuitDiff` in `src/lib/audit-diff.ts` to log audit activity when renamed.
- **Proof**:
  - Add unit test in `src/app/api/floor-items/[id]/route.test.ts` verifying updating `name` succeeds and empty `name` returns 400.

### Step 2: Implement Inline Name Editing in Load Calculator Table
- **File**: `src/app/(app)/calculator/page.tsx`
- **Changes**:
  - Add `handleUpdateItemName(itemId: string, newName: string)`.
  - Apply optimistic state mutation to both local `project` and `ProjectContext` (`mutateProject`).
  - Create an inline editable name component or cell for the "Name" column in the floor items table:
    - Display current load name with an edit pencil button on hover.
    - Clicking the name or pencil enters edit mode with an auto-focused `<input>`.
    - Supports `Enter` (save), `Escape` (cancel), and blur handling.
    - Includes explicit Save (Check) and Cancel (X) buttons for clear touch/mouse affordance.
    - Respects `isReadOnly` state (view-only mode for QA / read-only permissions).
- **Proof**:
  - Test editing in `src/app/(app)/calculator/page.test.tsx` (or new test suite) verifying name edit triggers optimistic update and API call.

### Step 3: Verify and Run Test Suite
- Run `npm test` across the full test suite to ensure zero regressions.
- Run `npx tsc --noEmit` to verify type safety.
- Update knowledge graph via `graphify update .`.
