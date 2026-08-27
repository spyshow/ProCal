import { describe, it, expect } from "vitest";
import {
  codeOf,
  nextBreakerRating,
  BREAKER_RATINGS,
  VD_RECOMMENDED,
  awgLabel,
} from "./codes";
import { sizeCableAndBreaker, STANDARD_BREAKERS, formatCableSizeFor } from "./cables";

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

describe("awgLabel (mm² → AWG/kcmil display cross-reference)", () => {
  it("maps small sizes to AWG trade sizes", () => {
    expect(awgLabel(2.5)).toBe("14 AWG");
    expect(awgLabel(4)).toBe("12 AWG");
    expect(awgLabel(6)).toBe("10 AWG");
    expect(awgLabel(16)).toBe("6 AWG");
  });

  it("crosses into kcmil above 3/0 AWG", () => {
    expect(awgLabel(95)).toBe("3/0 AWG");
    expect(awgLabel(120)).toBe("250 kcmil");
    expect(awgLabel(240)).toBe("500 kcmil");
    expect(awgLabel(500)).toBe("1000 kcmil");
  });

  it("falls back to the nearest catalog entry for non-standard sizes", () => {
    // 18 mm² sits between 16 (6 AWG) and 25 (3 AWG); nearest is 16.
    expect(awgLabel(18)).toBe("6 AWG");
  });
});

describe("formatCableSizeFor (code-aware display layer)", () => {
  it("keeps mm² for IEC/undefined projects", () => {
    expect(formatCableSizeFor(16, "IEC")).toBe("16 mm²");
    expect(formatCableSizeFor(16, undefined)).toBe("16 mm²");
  });

  it("shows AWG/kcmil for NEMA projects, incl. parallel-run strings", () => {
    expect(formatCableSizeFor(95, "NEMA")).toBe("3/0 AWG");
    expect(formatCableSizeFor("2 × 240 mm²", "NEMA")).toBe("2 × 500 kcmil");
    expect(formatCableSizeFor(120, "NEMA")).toBe("250 kcmil");
  });

  it("round-trips stored metric strings unchanged under IEC", () => {
    expect(formatCableSizeFor("2 × 240 mm²", "IEC")).toBe("2 × 240 mm²");
  });
});

describe("NEC Derating & Cable Sizing (NFPA 70)", () => {
  it("applies NEC Table 310.15(B)(1) temperature correction and Table 310.15(C)(1) grouping factors", () => {
    const resNec1 = sizeCableAndBreaker(80, true, {
      material: "copper",
      insulation: "XLPE",
      ambientTemp: 40,
      groupingCount: 2, // 4-6 conductors = 0.80 factor in NEC
      code: "NEC",
    });

    // In NEC: 40°C XLPE factor = 0.91, grouping 2 = 0.80 -> total derating = 0.728
    expect(resNec1.tempFactor).toBeCloseTo(0.91);
    expect(resNec1.groupFactor).toBeCloseTo(0.80);
    // Breaker size for 80A load in NEC = 80A (or 90A)
    expect(resNec1.breakerSize).toBe(80);
    // Cable sizing should ensure Iz >= In
    expect(resNec1.deratedAmpacity).toBeGreaterThanOrEqual(resNec1.breakerSize);
  });

  it("sizes cables with NEC Table 310.16 nominal ampacities when code is NEC", () => {
    const res = sizeCableAndBreaker(120, true, {
      material: "copper",
      insulation: "XLPE",
      ambientTemp: 30,
      groupingCount: 1,
      code: "NEC",
    });

    // Breaker rating for 120A in NEC = 125A
    expect(res.breakerSize).toBe(125);
    // Under NEC Table 310.16: 25 mm² (2 AWG) has 130A, 35 mm² (1 AWG) has 150A.
    // So 25 mm² (130A) can carry 125A breaker!
    expect(res.cableSize).toBe(25);
    expect(res.nominalAmpacity).toBe(130);
    expect(res.deratedAmpacity).toBe(130);
  });
});

