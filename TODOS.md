# TODOS — ProCal

Tracked follow-ups from reviews. Each entry carries enough context to pick up cold.

---

## TODO-1: Normalize `FloorItem.calculatedCurrent` derivation across types (P2)

**What:** Make the FloorItem-create API route (`src/app/api/floors/[id]/items/route.ts`) apply `Project.powerFactor` consistently to apartments AND 1-phase library items (currently omitted), remove the hardcoded `0.85` in the manual branch, and fix `src/app/(app)/panel/page.tsx:95` to honor `ApartmentTemplate.phases === 3` instead of the blanket `item.type !== 'APARTMENT'` (which sizes ALL apartments as 1-phase, including 3-phase templates).

**Status:** DONE 2026-07-21. Changes:
- `items/route.ts` APARTMENT branch: added `* powerFactor` to both 3-phase and 1-phase formulas (lines 68, 70).
- `items/route.ts` LIBRARY 1-phase branch: added `* libraryItem.powerFactor` to the formula (line 101).
- `floors/[id]/recalculate/route.ts`: now reads project voltage/PF instead of hardcoded 0.4/0.23; applies PF to both branches.
- `buildings/[id]/recalculate/route.ts`: same fix — reads project, applies PF.
- `panel/page.tsx` phase discriminator: already correct via `isThreePhaseForItem()` in `feeders.ts:48-59`, which checks `ApartmentTemplate.phases === 3`. The TODO's line-95 reference was stale.
- Manual branch already used `project.powerFactor` (line 134); no hardcoded 0.85 existed.

**Why:** The per-phase neutral-current vector consumes `item.calculatedCurrent` as the magnitude with a PF-derived angle. Today `calculatedCurrent` is computed three inconsistent ways:
- apartment 3φ: `maxDemand / (√3·0.4)` — kVA-based, NO PF (≈17% high at PF 0.85)
- library 3φ: `maxDemand / (√3·kV·PF)` — kW-correct
- library 1φ: `maxDemand / kV` — kVA-based, NO PF
- manual custom: `maxDemand / (√3·0.4·0.85)` — hardcoded 0.85

Mixing kVA-magnitudes (no PF) with kW-magnitudes (with PF) produces a kVA-neutral mislabeled as kW. Separately, `panel/page.tsx:95` is a 4th, *wrong*, phase discriminator that disagrees with the calculator (`page.tsx:279`) and the API route (`route.ts:62`) for 3-phase apartments — silently mis-sizing them as 1-phase. The per-phase feature inherits both.

**Pros:** The neutral-current number becomes trustworthy (kW-neutral, not kVA-neutral mislabeled); one phase discriminator instead of four; 3-phase apartments sized correctly everywhere.

**Cons:** Touches a shared API route every feeder/cable calc depends on — wider blast radius; needs its own tests and a careful check that downstream sizing (cable/breaker) doesn't regress on the now-changed apartment current.

**Context:** Surfaced by `/plan-eng-review` 2026-07-14 (issue 3 + outside-voice gap 1). The per-phase `phaseBalance.ts` (PR1) consumes `calculatedCurrent` as the magnitude by design (decision D5); this normalization is what makes that magnitude consistent across types. ProCal leans IEC; `Project.powerFactor` defaults 0.85. Start in `src/app/api/floors/[id]/items/route.ts` lines 44-146 and `src/app/(app)/panel/page.tsx` line 95.

**Depends on / blocked by:** Should land before the per-phase neutral-current number is quoted to a client. Not a PR1 blocker (PR1 consumes the magnitude as-is), but a sequencing constraint on trusting the neutral output.

---

## TODO-2: Transformer sizing under per-phase imbalance (P2)

**What:** Decide and wire what feeds `sizeTransformer` (`src/lib/calculations/loads.ts`) under the per-phase model. Under imbalance the transformer is limited by its most-loaded winding, so feed it **Σ per-phase kVA** (max-winding-limited), not the current lumped kVA and not `3 × max-phase`.

**Status:** DONE 2026-07-21. Changes:
- `loads.ts`: `sizeTransformer` now accepts optional `perPhaseKva?: [number, number, number]`. When provided, uses `Math.max(L1, L2, L3)` (max-winding-limited). Falls back to lumped total when not available.
- `panel/page.tsx`: Computes per-phase kVA by accumulating `f.phaseKw[i] / project.powerFactor` per feeder, then passes it to `sizeTransformer`.

**Why:** The per-phase model splits kVA across L1/L2/L3, but `sizeTransformer` currently takes one lumped kVA. Lumped-sum sizes off the average; `3×max-phase` over-sizes; only Σ per-phase kVA (limited by the most-loaded winding) is correct. An imbalanced building gets an under-sized transformer if lumped-sum survives.

**Pros:** Transformer correctly sized for the most-loaded winding under imbalance; consistent with the per-phase model's premise that balance matters per-board.

**Cons:** Touches the transformer-sizing module (`loads.ts`), which PR1 does not touch; needs a decision on whether transformer sizing reads per-phase kVA directly or is fed it by `computeFeeders`.

**Context:** Surfaced by `/plan-eng-review` outside voice (gap 8), 2026-07-14. Separate calc module from the phase-balancing calc-core; deferred to its own change. Start at `src/lib/calculations/loads.ts` `sizeTransformer`.

**Depends on / blocked by:** PR1 (`phaseBalance.ts` exposing per-phase kVA) must land first so Σ per-phase kVA is available to feed `sizeTransformer`.

---

*Skipped 2026-07-14:* harmonic/THD field on the load model for triplen-neutral sizing (niche — nonlinear-load-heavy buildings; YAGNI for ProCal's current residential/commercial target; the fundamental 2× neutral guard covers the common case).
