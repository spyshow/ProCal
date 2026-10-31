/**
 * Free Trial project limits (see PLAN.md / docs/ideas/pricing-strategy.md §4.4).
 *
 * A trial project is created without spending a credit, once per account
 * lifetime (User.hasUsedTrial). It is capped at 1 building and 2 levels
 * (floors + serviceFloors) and all exports are watermarked. Spending 1 credit
 * via POST /api/projects/[id]/upgrade lifts every restriction.
 */
export const TRIAL_MAX_BUILDINGS = 1;
export const TRIAL_MAX_LEVELS = 2;
export const TRIAL_WATERMARK_TEXT = "PROCAL FREE TRIAL — NOT FOR CONSTRUCTION";

/** Can this user start a trial project right now (instead of spending a credit)? */
export function canStartTrial(user: { role: string; credits: number; hasUsedTrial?: boolean | null }): boolean {
  return user.role !== "ADMIN" && user.credits < 1 && !user.hasUsedTrial;
}

/** Returns an error message if the level count exceeds the trial cap, otherwise null. */
export function trialLevelsError(floors: number, serviceFloors: number): string | null {
  const f = Number(floors);
  const s = Number(serviceFloors ?? 0);
  if (!Number.isFinite(f) || !Number.isFinite(s) || f < 1 || s < 0) {
    return "Floor count must be at least 1 and service floors cannot be negative.";
  }
  if (f + s > TRIAL_MAX_LEVELS) {
    return `Free trial projects are limited to ${TRIAL_MAX_LEVELS} levels (floors + service floors). Upgrade the project with 1 credit to add more.`;
  }
  return null;
}

/** Returns an error message if adding another building would exceed the trial cap, otherwise null. */
export function trialBuildingsError(existingBuildings: number): string | null {
  if (existingBuildings >= TRIAL_MAX_BUILDINGS) {
    return `Free trial projects are limited to ${TRIAL_MAX_BUILDINGS} building. Upgrade the project with 1 credit to add more.`;
  }
  return null;
}
