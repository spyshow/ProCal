# Plan: Fix Cable Schedule Upsize Failing to Apply for Large Incomers & ACB Ratings

## Task Summary
When clicking "Apply" on the Cable Schedule page for an overloaded main incomer (e.g. Mall MDB Main Incomer with $I_b = 3904.9\text{ A}$), nothing changes because:
1. `IEC_BREAKER_RATINGS` in `codes.ts` capped at 2500 A (standard IEC 60947-2 ACB ratings go up to 6300 A), causing 3904.9 A to map down to 2500 A.
2. `sizeCableAndBreaker` in `cables.ts` sized cables against `breakerSize` rather than $\max(I_b, \text{breakerSize})$, picking $6 \times 300\text{ mm}^2$ ($I_z = 2832\text{ A}$) which is still overloaded ($2832\text{ A} < 3904.9\text{ A}$).
3. In `cable-editor.ts`, numeric `existingCableSize` caused `parseCableSize` to discard `existingRuns`, causing false changes or re-proposing identical overloaded cables.
4. The Runs dropdown in `cable-schedule/page.tsx` was limited to `[1..6]`, preventing proper display/selection of multi-run arrangements like 8x or 9x runs.

---

## Proposed Steps

### Step 1: Update Breaker Catalog in `src/lib/calculations/codes.ts` & `src/lib/calculations/codes.test.ts`
- **File**: `src/lib/calculations/codes.ts`
  - Add standard IEC ACB ratings to `IEC_BREAKER_RATINGS`: `3200, 4000, 5000, 6300`.
  - Add standard NEC ratings to `NEC_BREAKER_RATINGS`: `5000, 6000`.
- **Proof**:
  - Update `codes.test.ts` to verify `nextBreakerRating(3904.9, 'IEC')` returns 4000 and boundary 9999 returns 6300. Run `npm test -- src/lib/calculations/codes.test.ts`.

### Step 2: Enforce Continuous Ampacity $\ge I_b$ in `src/lib/calculations/cables.ts`
- **File**: `src/lib/calculations/cables.ts`
  - In `sizeCableAndBreaker`, define `const targetCurrent = Math.max(ib, breakerSize);`.
  - Enforce `totalIz >= targetCurrent` across single-run, parallel-run search, and fallback calculations so $I_z \ge I_b$ is guaranteed.
- **Proof**:
  - Run `npm test -- src/lib/calculations/cables.test.ts`.

### Step 3: Fix Existing Runs Parsing & Breaker Forwarding in `src/lib/sld/cable-editor.ts`
- **File**: `src/lib/sld/cable-editor.ts`
  - Parse `existingRuns` preserving `input.existingRuns`:
    `const existingRuns = input.existingRuns ?? rawParsed?.runs ?? 1;`
  - Pass `manualBreakerRating: input.assignedBreakerSize` into `sizeCableAndBreaker`.
- **Proof**:
  - Add unit test for 3904.9A incomer in `cable-editor.test.ts` verifying it proposes $9 \times 300\text{ mm}^2$ ($I_z = 4248\text{ A}$), not overloaded $6 \times 300\text{ mm}^2$. Run `npm test -- src/lib/sld/cable-editor.test.ts`.

### Step 4: Expand Parallel Runs Options in `src/app/(app)/cable-schedule/page.tsx`
- **File**: `src/app/(app)/cable-schedule/page.tsx`
  - Update the runs selector options to support up to 12 runs: `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12]`, including `c.parallelRuns` if dynamically higher.
- **Proof**:
  - Verify component renders and runs dropdown displays up to 12x.

### Step 5: Full Test Suite & Verification
- Run `npm test` across all suites to ensure no regressions.
- Run `graphify update .`.
