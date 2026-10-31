import { describe, it, expect } from "vitest";
import {
  canStartTrial,
  trialLevelsError,
  trialBuildingsError,
  TRIAL_MAX_BUILDINGS,
  TRIAL_MAX_LEVELS,
} from "../trial";

describe("Free Trial Helpers (src/lib/trial.ts)", () => {
  it("allows non-admin with 0 credits and unused trial to start a trial", () => {
    expect(canStartTrial({ role: "USER", credits: 0, hasUsedTrial: false })).toBe(true);
    expect(canStartTrial({ role: "USER", credits: 0, hasUsedTrial: null })).toBe(true);
    expect(canStartTrial({ role: "USER", credits: 0, hasUsedTrial: undefined })).toBe(true);
  });

  it("disallows trial if user already has credits", () => {
    expect(canStartTrial({ role: "USER", credits: 1, hasUsedTrial: false })).toBe(false);
    expect(canStartTrial({ role: "USER", credits: 5, hasUsedTrial: false })).toBe(false);
  });

  it("disallows trial if user has already used their trial", () => {
    expect(canStartTrial({ role: "USER", credits: 0, hasUsedTrial: true })).toBe(false);
  });

  it("disallows trial for ADMINs (admins bypass credits)", () => {
    expect(canStartTrial({ role: "ADMIN", credits: 0, hasUsedTrial: false })).toBe(false);
  });

  it("validates floor limits against TRIAL_MAX_LEVELS (2)", () => {
    expect(TRIAL_MAX_LEVELS).toBe(2);
    expect(trialLevelsError(1, 0)).toBeNull();
    expect(trialLevelsError(1, 1)).toBeNull();
    expect(trialLevelsError(2, 0)).toBeNull();

    // Exceeding 2 levels returns an error message
    expect(trialLevelsError(2, 1)).toContain("limited to 2 levels");
    expect(trialLevelsError(3, 0)).toContain("limited to 2 levels");
    expect(trialLevelsError(1, 2)).toContain("limited to 2 levels");
  });

  it("rejects non-positive floor counts or negative serviceFloors", () => {
    expect(trialLevelsError(10, -9)).toBe(
      "Floor count must be at least 1 and service floors cannot be negative."
    );
    expect(trialLevelsError(0, 0)).toBe(
      "Floor count must be at least 1 and service floors cannot be negative."
    );
    expect(trialLevelsError(-1, 2)).toBe(
      "Floor count must be at least 1 and service floors cannot be negative."
    );
    expect(trialLevelsError(1, -1)).toBe(
      "Floor count must be at least 1 and service floors cannot be negative."
    );
  });

  it("validates building limits against TRIAL_MAX_BUILDINGS (1)", () => {
    expect(TRIAL_MAX_BUILDINGS).toBe(1);
    expect(trialBuildingsError(0)).toBeNull();

    // Already having 1 or more buildings returns an error message
    expect(trialBuildingsError(1)).toContain("limited to 1 building");
    expect(trialBuildingsError(2)).toContain("limited to 1 building");
  });
});
