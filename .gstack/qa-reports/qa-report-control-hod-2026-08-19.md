# QA Report — RBAC Guards, Batch Ops, Username Invites

- **Commit under test:** `c88e493` feat: enforce RBAC navigation guards, optimize batch operations, and add username invite support
- **Date:** 2026-08-19
- **Tier:** Standard
- **Host:** CONTROL-HOD
- **Stack:** Next.js (App Router) + Prisma + Vitest, dev build on :3001, browse-driven browser QA

---

## Summary

| Area | Status | Notes |
|---|---|---|
| RBAC navigation guards | PASS | Sidebar, dashboard quick links, direct-URL access all enforce matrix |
| Username invites | PASS | Lookup + auto-fill + accept link flow verified end-to-end |
| Batch operations | PASS | Recalculate / Rebalance / batch-defaults / cable upsizing all return 200 |
| Copy-items | PASS | Bulk copy F1 → all floors, 200, items 4→8 |
| Test suite | PASS | 483 tests / 45 files, all green |
| Security (authz on APIs) | **2 bugs found → FIXED** | See Security Findings |

---

## Test Environment

- Fresh signup users created: `qa_rbac` (Rana QA, ENGINEER), `intruder_qa` (non-member) — credentials `[REDACTED]`.
- E2E project `a2abb0ca-8920-47ba-9ac8-1e515c921988` used as the RBAC fixture. Permission matrix applied to `qa_rbac`: Load Calculator=EDIT, Breaker Schedule=EDIT, Coordination (TCC)=VIEW, Cable Schedule=EDIT, Panel Designer (MDB)=NONE, Riser Diagram=EDIT, SLD=EDIT, Engineering Reports=EDIT.
- Admin (`engineer`) and second engineer (`Tariq`) added via username invites.

---

## Feature Verification

### 1. RBAC navigation guards (PASS)

As `qa_rbac` (Panel Designer=NONE, Coordination=VIEW):

- Sidebar: Panel Designer link is locked — `aria-disabled=true`, `href="#"`, `tabIndex=-1`, opacity 0.5, `cursor: not-allowed`, lock icon shown. Coordination (VIEW) link remains clickable.
- Direct URL `/panel` → "Access Restricted" page rendered (server-side check works).
- Dashboard quick-link card for Panel Designer is locked; clicking it does not navigate.
- Coordination page loads in view-only mode (banner shown; inputs not disabled — see Minor Issues).
- Riser Diagram / calculator / breaker schedule / cable schedule / SLD / reports all navigable with EDIT.

### 2. Username invite flow (PASS)

- Project team tab → Invite → typing a username that exists auto-fills name + email and shows "✓ Account found" badge.
- Invite POST returns 200 and appears in pending invitations.
- `.test` email delivery is not configured in this environment, so the UI falls back to showing the accept link — by design.
- `POST /api/invites/accept` with the invite token works for an already-logged-in user (no password prompt) and adds them as a project member.
- Both Tariq (engineer) and Rana (`qa_rbac`) joined the E2E project this way.

### 3. Batch operations (PASS)

- `POST /api/buildings/43f714c4.../recalculate` → 200 (≈5s for full tower).
- `POST /api/buildings/43f714c4.../rebalance` → 200.
- `POST /api/projects/a2abb0ca.../cables/batch-defaults` → 200 `{success:true, updatedFloorItems:67, updatedFloorRisings:19, updatedBuildingLoads:0}`.
- Cable schedule "Apply" upsizing → 2× `PATCH /api/floor-items` → 200.

### 4. Copy-items (PASS)

- Floor 1 (F1) copied to all other floors → 200, `copiedItemsCount=12` (4 items × 3 targets), target floors went 4 → 8 items each.

---

## Security Findings

### S1 (CRITICAL) — `PUT/PATCH /api/floors/[id]` had no authz check — FIXED

- **Before:** both handlers only looked up the floor; any logged-in user (even a non-member) could mutate any floor's riser fields.
- **Proof (pre-fix):** non-member `qa_rbac` successfully PATCHed `riserCableLength` to 999 on the E2E project. Value restored to seed default afterward.
- **Fix:** handlers now resolve the floor with `building` and call `verifyProjectAccess(projectId, { requiredAction: "EDIT", pageKey: "calculator" })`. Matches sibling routes (recalculate, rebalance, items, copy-items).
- **Post-fix re-test:** non-member `intruder_qa` PATCH → **403 Forbidden**; member with calculator EDIT (admin, qa_rbac) → 200. Data restored and confirmed.

### S2 (HIGH) — `POST/PUT/DELETE /api/breaker-settings` only required login — FIXED

- **Before:** `GET/POST /api/breaker-settings` and `PUT/DELETE /api/breaker-settings/[id]` checked only `getSessionUser()`. Any logged-in user could create/modify/delete global breaker settings for any project.
- **Proof (pre-fix):** `qa_rbac` POSTed a probe breaker setting for the E2E project successfully (record `qa-rbac-probe`), then deleted it.
- **Fix:** breaker settings are keyed per-project (`<projectId>-...`). The routes now extract the project UUID from the breakerId prefix and require EDIT on `breakerSchedule` **or** `coordination`. `[id]` DELETE also fetches the record and verifies against its stored breakerId before deleting; 404 if the record is missing.
- **Post-fix re-test:** non-member POST → **403**; non-member DELETE → **403**; member with breakerSchedule EDIT (qa_rbac) → POST 200, DELETE 200. Probe records cleaned up.

---

## Minor Issues / Notes

- Coordination view-only mode shows the "View-Only Mode" banner but does not disable the underlying input fields; no Apply/save buttons are rendered for VIEW users, so no mutation is possible from the UI. Cosmetic only.
- The stale `:3000` dev server (pre-QA build) is still running and could not be stopped from this shell (access denied). All testing used the fresh build on `:3001`. Recommend restarting `:3000` after the fix commit is pulled.
- `.test` emails are not delivered; invite accept links are shown in-app. Intended for development.

---

## Test Suite

- `npx vitest run` — **45 files, 483 tests, all passing** (was 43/469 before this QA; +8 breaker-settings, +6 floors authz tests added).

---

## Files Changed (fixes)

- `src/app/api/floors/[id]/route.ts` — added `verifyProjectAccess` (EDIT / calculator) to PUT and PATCH.
- `src/app/api/breaker-settings/route.ts` — POST now verifies project-scoped EDIT (breakerSchedule or coordination).
- `src/app/api/breaker-settings/[id]/route.ts` — PUT and DELETE now verify project-scoped EDIT; DELETE 404s on missing record.
- `src/app/api/floors/[id]/route.test.ts` — new (6 tests).
- `src/app/api/breaker-settings/route.test.ts` — new (8 tests).

## Verdict

Feature work ships cleanly. The two authorization gaps were confirmed and fixed, with tests and live re-verification. **Approved to merge.**