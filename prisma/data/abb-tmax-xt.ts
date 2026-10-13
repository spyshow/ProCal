/**
 * ABB SACE Tmax XT molded-case circuit breakers (IEC 60947-2), XT1 → XT7.
 *
 * Generated from compact per-frame tables instead of hand-writing ~350 rows.
 * Model naming matches the legacy seed convention
 *   `${frame}${level} ${frameAmps} ${tripUnit} ${In}A`
 * (e.g. "XT5N 400 Ekip Dip LSI 320A") so re-seeding upserts existing rows.
 *
 * Scope: 3-pole, thermal-magnetic (TMD/TMA), Ekip Dip LSI and Ekip Touch LSIG
 * releases. Ekip Hi-Touch, 4-pole and XT7M (motorised) variants are NOT included.
 *
 * Data caveats (compiled from ABB catalogue summaries — verify against the
 * current ABB technical catalogue before relying on them for a design issue):
 *  - Ics is assumed equal to Icu (the convention used by the rest of the seed).
 *  - Fixed TMD magnetic threshold is modelled as 10 x In for every rating.
 *  - XT6 "L" (100 kA) and XT7 "V" (150 kA) use the lower of the figures found.
 *  - Ekip Touch is assumed to be offered at the same In ratings as Ekip Dip
 *    on XT2/XT4/XT5/XT6/XT7, with the same L/S/I ranges plus a G stage.
 */

const DATASHEET_URL =
  "https://search.abb.com/library/Download.aspx?DocumentID=1SDC210100D0206&LanguageCode=en&DocumentPartId=&Action=Launch";

type Level = "B" | "C" | "N" | "S" | "H" | "L" | "V";
type TripKind = "TMD" | "TMA" | "EKIP_DIP" | "EKIP_TOUCH";

/** Icu (kA) at 415 V AC per frame and performance level. */
const ICU_KA: Record<string, Partial<Record<Level, number>>> = {
  XT1: { B: 18, C: 25, N: 36, S: 50, H: 70 },
  XT2: { N: 36, S: 50, H: 70, L: 120, V: 150 },
  XT3: { N: 36, S: 50 },
  XT4: { N: 36, S: 50, H: 70, L: 120, V: 150 },
  XT5: { N: 36, S: 50, H: 70, L: 120, V: 200 },
  XT6: { N: 36, S: 50, H: 70, L: 100 },
  XT7: { S: 50, H: 65, L: 120, V: 150 },
};

interface FrameSpec {
  frame: string;
  /** Release rating (In) → physical frame size shown in the model name. */
  groups: { frameAmps: number; trips: Partial<Record<TripKind, number[]>> }[];
}

const FRAMES: FrameSpec[] = [
  {
    frame: "XT1",
    groups: [{ frameAmps: 160, trips: { TMD: [16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160] } }],
  },
  {
    frame: "XT2",
    groups: [
      {
        frameAmps: 160,
        trips: {
          TMD: [1.6, 2, 2.5, 3.2, 4, 5, 6.3, 8, 10, 12.5, 16, 20, 25, 32, 40, 50, 63, 80],
          TMA: [100, 125, 160],
          EKIP_DIP: [10, 25, 63, 100, 160],
        },
      },
    ],
  },
  {
    frame: "XT3",
    groups: [{ frameAmps: 250, trips: { TMD: [63, 80, 100, 125, 160, 200, 250] } }],
  },
  {
    frame: "XT4",
    groups: [
      {
        frameAmps: 250,
        trips: {
          TMD: [20, 32, 50],
          TMA: [80, 100, 125, 160, 200, 250],
          EKIP_DIP: [10, 25, 40, 63, 100, 160, 250],
        },
      },
    ],
  },
  {
    frame: "XT5",
    groups: [
      { frameAmps: 400, trips: { TMA: [320, 400], EKIP_DIP: [320, 400] } },
      { frameAmps: 630, trips: { TMA: [500, 630], EKIP_DIP: [630] } },
    ],
  },
  {
    frame: "XT6",
    groups: [
      { frameAmps: 630, trips: { TMA: [630], EKIP_DIP: [630] } },
      { frameAmps: 800, trips: { TMA: [800], EKIP_DIP: [800] } },
    ],
  },
  {
    frame: "XT7",
    groups: [
      { frameAmps: 1000, trips: { EKIP_DIP: [800, 1000] } },
      { frameAmps: 1600, trips: { EKIP_DIP: [1250, 1600] } },
    ],
  },
];

const round = (n: number) => Number(n.toFixed(1));

// Ekip Touch shares the Ekip Dip rating list on every frame that offers it
// (XT1 and XT3 are thermal-magnetic only).
for (const spec of FRAMES) {
  for (const group of spec.groups) {
    if (group.trips.EKIP_DIP) group.trips.EKIP_TOUCH = [...group.trips.EKIP_DIP];
  }
}

function tripDefinition(kind: TripKind, inRating: number) {
  const i = (mult: number) => round(inRating * mult);
  switch (kind) {
    case "TMD":
      return {
        label: "TMD",
        tripUnit: "TMD (Thermal Magnetic)",
        curve: {
          curveType: "TM",
          thermal: { range: `0.7..1.0xIn (${i(0.7)}..${inRating}A)`, defaultIr: inRating },
          magnetic: { range: `10xIn fixed (${i(10)}A)`, defaultIm: i(10) },
        },
      };
    case "TMA":
      return {
        label: "TMA",
        tripUnit: "TMA (Thermal Magnetic)",
        curve: {
          curveType: "TM",
          thermal: { range: `0.7..1.0xIn (${i(0.7)}..${inRating}A)`, defaultIr: inRating },
          magnetic: { range: `5..10xIn (${i(5)}..${i(10)}A)`, defaultIm: i(10) },
        },
      };
    case "EKIP_DIP":
      return {
        label: "Ekip Dip LSI",
        tripUnit: "Ekip Dip LSI",
        curve: {
          curveType: "LSI",
          L: { range: `0.4..1.0xIn (${i(0.4)}..${inRating}A)`, delay: "3..12s", defaultIr: inRating, defaultTr: 12 },
          S: { range: `1.0..10xIn (${inRating}..${i(10)}A)`, delay: "0.05..0.4s", i2t: true, defaultIsd: i(5), defaultTsd: 0.1 },
          I: { range: `1.5..15xIn (${i(1.5)}..${i(15)}A)`, defaultIi: i(10) },
        },
      };
    case "EKIP_TOUCH":
      return {
        label: "Ekip Touch LSIG",
        tripUnit: "Ekip Touch LSIG",
        curve: {
          curveType: "LSIG",
          L: { range: `0.4..1.0xIn (${i(0.4)}..${inRating}A)`, delay: "3..144s", defaultIr: inRating, defaultTr: 12 },
          S: { range: `0.6..10xIn (${i(0.6)}..${i(10)}A)`, delay: "0.05..0.8s", i2t: true, defaultIsd: i(5), defaultTsd: 0.1 },
          I: { range: `1.5..15xIn (${i(1.5)}..${i(15)}A)`, defaultIi: i(10) },
          G: { range: `0.2..1.0xIn (${i(0.2)}..${inRating}A)`, delay: "0.1..1s", defaultIg: i(0.2), defaultTg: 0.1 },
        },
      };
  }
}

export interface AbbMccbSeedItem {
  category: "MCCB";
  manufacturer: "ABB";
  series: string;
  model: string;
  ratedCurrent: number;
  poles: 3;
  breakingCapacity: number;
  tripUnit: string;
  datasheetUrl: string;
  settingsJson: string;
}

function buildCatalog(): AbbMccbSeedItem[] {
  const items: AbbMccbSeedItem[] = [];
  for (const { frame, groups } of FRAMES) {
    const levels = ICU_KA[frame];
    for (const { frameAmps, trips } of groups) {
      for (const kind of Object.keys(trips) as TripKind[]) {
        for (const inRating of trips[kind] ?? []) {
          const def = tripDefinition(kind, inRating);
          for (const level of Object.keys(levels) as Level[]) {
            const icu = levels[level]!;
            items.push({
              category: "MCCB",
              manufacturer: "ABB",
              series: `Tmax ${frame}`,
              model: `${frame}${level} ${frameAmps} ${def.label} ${inRating}A`,
              ratedCurrent: inRating,
              poles: 3,
              breakingCapacity: icu,
              tripUnit: def.tripUnit,
              datasheetUrl: DATASHEET_URL,
              settingsJson: JSON.stringify({
                Ics: icu,
                standard: "IEC 60947-2",
                category: frame === "XT7" ? "B" : "A",
                ...def.curve,
              }),
            });
          }
        }
      }
    }
  }
  return items;
}

export const abbTmaxXtCatalog: AbbMccbSeedItem[] = buildCatalog();

/**
 * Legacy rows whose model label changed ("Ekip LSI" → "Ekip Dip LSI") and
 * would otherwise remain as duplicates after re-seeding.
 */
export const abbTmaxXtLegacyModels = [
  { series: "Tmax XT2", model: "XT2N 160 Ekip LSI 160A" },
  { series: "Tmax XT4", model: "XT4N 250 Ekip LSI 250A" },
];
