# Plan: Fix Default Breaker Families Resetting on Navigation / Page Change

## Root Cause Analysis
1. **Context Stale State Clashing**: In `src/app/(app)/breaker-schedule/page.tsx`, `saveDefaults` persisted selected breaker families (`defaultAcbFamilyId`, `defaultMccbFamilyId`, `defaultMcbFamilyId`) to the database via `PUT /api/projects/${id}` and called local `setProject` / `setDefaults`. However, it **never called `mutateProject` from `ProjectContext`**.
2. **Client-Side Route Memory Desync**: When navigating to another page and returning to the breaker schedule, Next.js performs client-side routing without reloading `ProjectContext`. The global `selectedProject` in `ProjectContext` still contained stale/null family IDs.
3. **Stale Overwrite on Remount/Sync**: On remount (and whenever context re-renders), `BreakerSchedulePage` initialized and synced `defaults` from `selectedProject.default*FamilyId`. Because context was never updated, it reset `defaults` back to `undefined`, which displays `<option value="">Use preferred manufacturer fallback</option>`. (If the user hard-refreshed with F5 or hit a route that triggered `refreshProject()`, context pulled from DB, which is why it appeared "sometimes ok").
4. **Navigating Mid-Save Loss**: If the user changed the dropdown and immediately navigated away, the fetch lacked `keepalive: true`, leaving the HTTP request vulnerable to cancellation by the browser.

---

## Proposed Steps

### Step 1: Reproduce Bug via Test
- **File**: `src/app/(app)/breaker-schedule/page.test.tsx`
- **Actions**:
  - Mock `useProject` with `selectedProject`, `mutateProject`, and `selectedProjectId`.
  - Simulate selecting a family (e.g. ACB or MCCB).
  - Assert that `mutateProject` is called so that context updates immediately and stays persistent.
  - Assert that re-rendering or remounting with the updated project preserves the selected family instead of reverting to fallback.
- **Proof**: Run test; verify failure prior to fix.

### Step 2: Implement Fix in `src/app/(app)/breaker-schedule/page.tsx`
- **Actions**:
  - Destructure `mutateProject` from `useProject()`.
  - Maintain a ref `defaultsRef` to prevent state stale closures during rapid changes.
  - In `saveDefaults`:
    - Optimistically call `mutateProject` to immediately sync context state.
    - Add `keepalive: true` to `fetch(`/api/projects/${projId}`, ...)` so in-flight saves survive page navigation.
    - On successful response, update `mutateProject` and local state with confirmed data.
  - In `useEffect` syncing `selectedProject`:
    - Do not overwrite `defaults` if `saving` is true or if `defaults` is already matching.
- **Proof**: Run `page.test.tsx` and verify it passes.

### Step 3: Verify and Run Test Suite
- Run `npm test` across the full test suite.
- Run `npx tsc --noEmit` to verify type safety.
- Update knowledge graph via `graphify update .`.
