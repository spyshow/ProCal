import { describe, it, expect } from "vitest";
import {
  isHalfStepArea,
  HALF_STEP_AREA_MESSAGE,
  formatRoomHalfStepError,
} from "../room-area";

describe("room-area 0.5 m² validator", () => {
  it("accepts positive integers and .5 multiples", () => {
    expect(isHalfStepArea(1)).toBe(true);
    expect(isHalfStepArea(19)).toBe(true);
    expect(isHalfStepArea(19.5)).toBe(true);
    expect(isHalfStepArea(0.5)).toBe(true);
    expect(isHalfStepArea(100.5)).toBe(true);
  });

  it("rejects non-half-step decimals, zero, negative, and non-finite numbers", () => {
    expect(isHalfStepArea(19.1)).toBe(false);
    expect(isHalfStepArea(4.4)).toBe(false);
    expect(isHalfStepArea(2.25)).toBe(false);
    expect(isHalfStepArea(0)).toBe(false);
    expect(isHalfStepArea(-5)).toBe(false);
    expect(isHalfStepArea(Number.NaN)).toBe(false);
    expect(isHalfStepArea(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("formats clear room area error messages", () => {
    expect(HALF_STEP_AREA_MESSAGE).toContain("integer or end in .5");
    expect(formatRoomHalfStepError("Living", 19.3)).toBe(
      'Room "Living" area (19.3 m²) must be an integer or end in .5 (e.g. 19 or 19.5). Decimals like .1 or .4 are not allowed.'
    );
    expect(formatRoomHalfStepError(undefined, 4.4)).toContain('"unnamed"');
  });
});
