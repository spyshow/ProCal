# Plan: Fix SLD Displaying Load Current Instead of Circuit Breaker Amps

## Task Summary
In the Single Line Diagram (SLD) DSL generator and viewer, circuit breaker ratings currently display raw load current ($I_b$) rounded up (`rating: "${Math.ceil(floorCurrent)}A"`) instead of the standardized Circuit Breaker Amps rating ($I_n$, e.g., 50A, 63A, 100A, 160A) or configured manual `riserBreakerSize`. Additionally, branch circuit MCBs with unset/null breaker sizes output `"null"` instead of resolving the standard breaker rating. We will update the generator and SLD explorer to determine and display standardized CB amp ratings.

---

## Proposed Steps

### Step 1: Create Breaker Rating Resolution Helper in `src/lib/sld/generator.ts`
- **File**: `src/lib/sld/generator.ts`
- **Changes**:
  - Add `riserBreakerSize?: string | null` to `SLDProject['buildings'][0]['floorDesigns'][0]`.
  - Implement `resolveBreakerRating(storedBreakerSize: string | number | null | undefined, current: number, code?: CodeStandard): string`:
    - If `storedBreakerSize` is provided and non-empty, format cleanly as e.g. `"63A"`.
    - If `storedBreakerSize` is null/empty/undefined, compute standard CB size via `nextBreakerRating(current, code)` (e.g. 43.5A load -> 50A breaker, 21.7A load -> 25A breaker).
  - Update `generateSLD` and `generateSLDPages` to use `resolveBreakerRating` for:
    - Floor main breakers: use `fd.riserBreakerSize` or floor design current (from phase balance / item current) to output standard CB amps (e.g., `50A` or `63A` instead of raw load current `44A`).
    - Branch MCBs: use `item.breakerSize` or `item.calculatedCurrent` to output standard CB amps (e.g., `25A`, `32A`) instead of `"null"` or load current.
- **Proof**:
  - Add unit tests in `src/lib/sld/generator.test.ts` asserting that floor breakers and MCBs output standard CB ratings and honor `riserBreakerSize`.

### Step 2: Update SLD Explorer Component in `src/app/(app)/sld/page.tsx`
- **File**: `src/app/(app)/sld/page.tsx`
- **Changes**:
  - Import `resolveBreakerRating` from `@/lib/sld/generator`.
  - In `dynamicTree`:
    - Floor switchboard nodes: use `resolveBreakerRating` for the floor's title, badge, and `data.rating` (e.g. `"Floor 1 (50A Main)"` and `"50A Main Breaker"`), while retaining the exact load current in `data.current` (e.g. `"43.5 A"`).
    - Branch load circuit nodes: resolve `itemCbRating` for badge and `data.rating` (e.g. `"25A MCB"`), while keeping load current in `data.current`.
- **Proof**:
  - Run component tests / Vitest to verify the SLD page loads without errors and displays CB ratings in badges/inspectors.

### Step 3: Verification & Test Suite
- Run `npx tsc --noEmit` to verify type safety.
- Run `npm test` across all 75 test suites.
- Run `graphify update .`.
