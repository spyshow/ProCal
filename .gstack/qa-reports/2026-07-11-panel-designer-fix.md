# QA Report — Panel Designer Fix (1Φ/3Φ three-layer unification)

**Date:** 2026-07-11
**Branch:** master
**Tier:** Standard (critical + high + medium)
**App:** ProCal (running on `http://localhost:3000`, separate terminal)
**Test account:** `engineer` / `[REDACTED]`
**Test projects:** `test` (building `tetst1`, 10 floors, 1Φ template `ate`), `Waar` (building `tower`, 15 floors, mixed)

## Health score

| | Before | After |
|---|---|---|
| **Breaker Schedule page** | 40/100 (blocking console errors + data regression) | **100/100** |
| **Panel Designer (MDB)** | 95/100 (DRY refactor done, no errors) | **100/100** |
| **Panel Designer (SMDB)** | 95/100 | **100/100** |
| **Cable Schedule** | 100/100 | **100/100** |
| **Overall** | ~82/100 | **100/100** |

**Ship-readiness: READY.** All targeted defects verified fixed in-browser across two projects; no regressions introduced; 16 unit tests (incl. 2 IRON-RULE regression tests) green; typecheck clean.

## Scope

This QA covers the implementation of the `panel-designer-fix` plan
(`docs/compose/plans/2026-07-09-panel-designer-fix.md`): unifying the
three-phase classification that had drifted across three layers (API
routes → panel page → cable-schedule page) into a single shared helper
`computeFeeders` / `isThreePhaseForItem`, plus the new Breaker Schedule
page.

## Issues found and fixed

### ISSUE-001 — Duplicate React keys on Breaker Schedule (High)
**Symptom:** Console error `Encountered two children with the same key`
on `/breaker-schedule`. Multiple floors have apartments with identical
names ("A", "B"), so the key `${buildingId}-${feeder.name}` collided.

**Root cause:** `breaker-schedule/page.tsx` keyed rows by feeder name,
which is not unique across floors.

**Fix:** Key rows by a monotonic index instead of name:
`${bldg.id}-mdb-${breakers.length}` / `${bldg.id}-smdb-${breakers.length}`.
File: `src/app/(app)/breaker-schedule/page.tsx`.

**Verification:** Navigated to `/breaker-schedule` on both `test` and
`Waar` projects → console reports `NO_ERRORS`. Screenshots:
`screenshots/issue-001-before.png`, `screenshots/issue-001-after.png`.

### ISSUE-002 — Lost floor prefix in feeder names (Medium, regression)
**Symptom:** Panel Designer MDB table and Breaker Schedule showed bare
feeder names (`A`, `B`) instead of the pre-refactor `F0 – A`, `F1 – B`.

**Root cause:** The shared `feederFromItem` helper set
`name: item.name`, dropping the floor prefix that the original inline
panel code produced via `F${fd.floorNumber} – ${item.name}`.

**Fix:** `feederFromItem` now takes `floorNumber` and sets
`name: \`F${floorNumber} – ${item.name}\``. Both call sites updated to
pass the floor number. File: `src/lib/calculations/feeders.ts`.

**Verification:**
- Panel MDB: `F1 – SMDB` … `F10 – SMDB` render ✓
- Panel SMDB (Floor 4): `F4 – ate` ×2 render ✓
- Breaker Schedule: `F1 – ate` … `F10 – ate`, `F2 – A` / `F2 – B` (Waar) ✓

### Regression pin (IRON RULE)
`src/lib/calculations/feeders.test.ts` — 16 tests, all passing:
- 6 paths for `isThreePhaseForItem` (apartment template phases, library
  item phase, manual default).
- 8 paths for `computeFeeders` (sub-panel floor aggregation, per-apartment
  feeders, building loads, empty-equipment fallback, SMDB floor numbers).
- 2 **regression tests** pinning the two critical bug fixes:
  - SMDB feeder for a 3-phase apartment uses THREE-PHASE sizing.
  - A single-phase Load Library item stays SINGLE-PHASE (the original
    `cable-schedule:114` inversion).

## Cross-view three-phase consistency (the core regression)

Verified `1Φ`/`3Φ` classification is identical across all three views for
the same items, via the shared `isThreePhaseForItem`:

| Item type | Panel | Breaker Schedule | Cable Schedule |
|---|---|---|---|
| Apartment (1Φ template `ate`) | 1Φ | 1Φ (13.7 A, 16 A breaker) | 1Φ (1.5 mm²) |
| Apartment (1Φ, Waar `A`/`B`) | 1Φ | 1Φ | 1Φ |
| SMDB floor feeder | 3Φ | 3Φ (27.3 A, 32 A) | 3Φ |
| Elevator / Water Pump | 3Φ | 3Φ (74.7 A / 25.5 A) | 3Φ |

All three layers now agree — the drift that motivated the plan is gone.

## Verification matrix

| Page | Project | Console errors | Renders correctly |
|---|---|---|---|
| `/breaker-schedule` | test | none | ✓ floor prefixes, phases, 32 breakers |
| `/breaker-schedule` | Waar | none | ✓ floor prefixes, phases |
| `/panel` (MDB) | test | none | ✓ 12 feeders, breaker models resolved |
| `/panel` (SMDB F4) | test | none | ✓ 2 apartment feeders `F4 – ate` |
| `/cable-schedule` | test | none | ✓ 20 cables, 20/20 compliant |

## Build status
- `npx tsc --noEmit` → clean
- `npx vitest run src/lib/calculations/feeders.test.ts` → 16 passed

## Commits this session
- `4e21552` fix(qa): unique keys + floor-prefixed feeder names in breaker schedule

## Notes / not in scope
- `dev.db` remains modified/unstaged — local test data, intentionally not
  committed.
- Statusline badge for the ponytail plugin is not yet configured
  (cosmetic, does not affect QA).

**STATUS: DONE**
