import { describe, it, expect } from "vitest";
import {
  codeOf,
  nextBreakerRating,
  BREAKER_RATINGS,
  VD_RECOMMENDED,
} from "./codes";
import { sizeCableAndBreaker, STANDARD_BREAKERS } from "./cables";

describe("codeOf", () => {
  it('maps the stored "NEMA" alias to the NEC profile', () => {
    expect(codeOf("NEMA")).toBe("NEC");
  });

  it.each([undefined, null, "", "IEC", "iec", "garbage"])(
    "falls back to IEC for %j",
    (input) => {
      expect(codeOf(input as string | null | undefined)).toBe("IEC");
    }
  );
});

describe("BREAKER_RATINGS catalogs", () => {
  it("IEC catalog matches the legacy STANDARD_BREAKERS export", () => {
    expect(BREAKER_RATINGS.IEC).toEqual(STANDARD_BREAKERS);
    expect(BREAKER_RATINGS.IEC).toContain(63);
  });

  it("NEC catalog is NEC 240.6(A) — no IEC-only values like 13/63 A", () => {
    expect(BREAKER_RATINGS.NEC).toEqual([
      15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175,
      200, 225, 250, 300, 350, 400, 450, 500, 600, 700, 800, 1000, 1200, 1600,
      2000, 2500, 3000, 4000,
    ]);
  });

  it.each(["IEC", "NEC"] as const)("catalogs are strictly ascending (%s)", (code) => {
    const ratings = BREAKER_RATINGS[code];
    for (let i = 1; i < ratings.length; i++) {
      expect(ratings[i]).toBeGreaterThan(ratings[i - 1]);
    }
  });
});

describe("nextBreakerRating", () => {
  // Hand-computed pins: same load, different code → different standard rating.
  it("56 A lands on 63 A under IEC but 60 A under NEC", () => {
    expect(nextBreakerRating(56, "IEC")).toBe(63);
    expect(nextBreakerRating(56, "NEC")).toBe(60);
  });

  it("95 A lands on 100 A under both; 105 A splits IEC 125 vs NEC 110", () => {
    expect(nextBreakerRating(95, "IEC")).toBe(100);
    expect(nextBreakerRating(95, "NEC")).toBe(100);
    expect(nextBreakerRating(105, "IEC")).toBe(125);
    expect(nextBreakerRating(105, "NEC")).toBe(110);
  });

  it("above the top rating, clamps to each catalog's frame limit", () => {
    expect(nextBreakerRating(9999, "IEC")).toBe(2500);
    expect(nextBreakerRating(9999, "NEC")).toBe(4000);
  });

  it("defaults to IEC when no code is given", () => {
    expect(nextBreakerRating(56)).toBe(63);
  });
});

describe("sizeCableAndBreaker code option", () => {
  const base = {
    material: "copper",
    insulation: "XLPE",
    ambientTemp: 30,
    groupingCount: 1,
  } as const;

  // 56 A design current: breaker selection must follow the project's code
  // even though the cable sizing itself stays on the IEC method tables.
  it("picks a 63 A In for IEC projects and 60 A In for NEC projects", () => {
    const iec = sizeCableAndBreaker(56, true, base);
    const nec = sizeCableAndBreaker(56, true, { ...base, code: "NEC" });
    expect(iec.breakerSize).toBe(63);
    expect(nec.breakerSize).toBe(60);
  });

  it("defaults to IEC behavior when code is omitted", () => {
    const omitted = sizeCableAndBreaker(56, true, base);
    const explicitIec = sizeCableAndBreaker(56, true, { ...base, code: "IEC" });
    expect(omitted.breakerSize).toBe(explicitIec.breakerSize);
  });
});

describe("VD_RECOMMENDED", () => {
  it("IEC Annex G: 3 % lighting / 5 % other; NEC note: 3 % branch circuits", () => {
    expect(VD_RECOMMENDED.IEC).toEqual({ lighting: 3, power: 5 });
    expect(VD_RECOMMENDED.NEC).toEqual({ lighting: 3, power: 3 });
  });
});
