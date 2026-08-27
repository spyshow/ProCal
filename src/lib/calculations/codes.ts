/**
 * Multi-code support: per-standard profiles for the parts of the engine that
 * are code-specific. Everything here is keyed off Project.calculationStandard
 * ("IEC" | "NEMA"); "NEMA" projects size against NEC practice.
 *
 * ponytail ceiling: conductor AMPACITY still comes from the IEC 60364-5-52
 * method tables for both codes — a full NEC Table 310.16 port needs an
 * AWG/kcmil size axis through parseCableSize and the whole data model. Until
 * then NEC projects get IEC-method ampacity plus NEC standard breaker ratings
 * and voltage-drop guidance below.
 */

export type CodeStandard = "IEC" | "NEC";

/**
 * Resolves a project's calculationStandard to a code profile. "NEMA" is the
 * stored alias for NEC practice; null/anything else falls back to IEC.
 */
export function codeOf(calculationStandard?: string | null): CodeStandard {
  return calculationStandard === "NEMA" ? "NEC" : "IEC";
}

/** Standard breaker ratings (Amperes) — IEC 60898/60947 preferred values. */
export const IEC_BREAKER_RATINGS = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 320, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500];

/** Standard breaker ratings (Amperes) — NEC 240.6(A). */
export const NEC_BREAKER_RATINGS = [
  15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200,
  225, 250, 300, 350, 400, 450, 500, 600, 700, 800, 1000, 1200, 1600, 2000,
  2500, 3000, 4000,
];

export const BREAKER_RATINGS: Record<CodeStandard, number[]> = {
  IEC: IEC_BREAKER_RATINGS,
  NEC: NEC_BREAKER_RATINGS,
};

/** Human-readable provenance label for reports/traces. */
export const CODE_LABEL: Record<CodeStandard, string> = {
  IEC: "IEC 60364",
  NEC: "NEC (NEMA)",
};

/**
 * First standard rating ≥ Ib (last rating if none). The In-selection step of
 * sizeCableAndBreaker and the SLD cable editor both route through this so a
 * project's code decides whether a 56 A load lands on 63 A (IEC) or 60 A (NEC).
 */
export function nextBreakerRating(ib: number, code: CodeStandard = "IEC"): number {
  const ratings = BREAKER_RATINGS[code];
  return ratings.find((rating) => rating >= ib) || ratings[ratings.length - 1];
}

/**
 * Informative voltage-drop limits per code (percent):
 * - IEC 60364-5-52 Annex G: 3 % lighting, 5 % other loads (from LV origin).
 * - NEC 210.19(A) Informational Note: 3 % branch circuit, 5 % total
 *   feeder + branch. `power` below is the per-circuit branch figure; the
 *   5 % total budget spans circuits the engine sizes independently.
 * Projects override these via maxVoltageDropLighting / maxVoltageDropPower;
 * these are the suggested defaults when a code is picked.
 */
export const VD_RECOMMENDED: Record<CodeStandard, { lighting: number; power: number }> = {
  IEC: { lighting: 3, power: 5 },
  NEC: { lighting: 3, power: 3 },
};

/**
 * mm² → AWG/kcmil display cross-reference for NEC projects. Storage and the
 * engine stay metric (parseCableSize misreads "3/0" as 3 mm²), so this is
 * DISPLAY-ONLY: nearest conductor area per NEC Chapter 9 Table 8. Sizes not
 * in the table fall back to their mm² value.
 */
const MM2_TO_AWG: ReadonlyArray<readonly [number, string]> = [
  [1.5, "16 AWG"],
  [2.5, "14 AWG"],
  [4, "12 AWG"],
  [6, "10 AWG"],
  [10, "8 AWG"],
  [16, "6 AWG"],
  [25, "3 AWG"],
  [35, "2 AWG"],
  [50, "1/0 AWG"],
  [70, "2/0 AWG"],
  [95, "3/0 AWG"],
  [120, "250 kcmil"],
  [150, "300 kcmil"],
  [185, "350 kcmil"],
  [240, "500 kcmil"],
  [300, "600 kcmil"],
  [400, "800 kcmil"],
  [500, "1000 kcmil"],
];

/** Nearest-area NEC trade size for a metric cross-section ("3/0 AWG", "250 kcmil", …). */
export function awgLabel(sizeMm2: number): string {
  let best = MM2_TO_AWG[0];
  for (const row of MM2_TO_AWG) {
    if (Math.abs(row[0] - sizeMm2) < Math.abs(best[0] - sizeMm2)) best = row;
  }
  return best[1];
}
