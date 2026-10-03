import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import en from "./locales/en.json";
import de from "./locales/de.json";
import ar from "./locales/ar.json";
import itLocale from "./locales/it.json";

// Regression: ISSUE-001 — found by /qa on 2026-10-03
// Report: .gstack/qa-reports/qa-report-localhost-3000-2026-10-03.md
//
// projects/[id]/page.tsx rendered the building-card subtitle via
// t('common.buildingLoads', 'building loads'). No such key exists — the
// string lives at cableSchedule.buildingLoads. I18nProvider only consults the
// fallback when i18n.exists() is false, so de/ar/it users saw a hardcoded
// English fragment ("0 building loads"), and in RTL it broke reading order.
//
// A repo-wide "every t() key exists" check is not viable here: 73 distinct
// keys are missing across 960 t() call sites as pre-existing debt. These
// assertions pin the keys this fix depends on so the regression cannot return.
const locales = { en, de, ar, it: itLocale } as const;

// Locale bundles nest arbitrarily deep (e.g. workflow.short.reports), so a
// Record<string, Record<string, string>> cast does not typecheck. Resolve
// dotted paths through `unknown` instead.
function lookup(bundle: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => (node == null ? undefined : (node as Record<string, unknown>)[part]), bundle);
}

describe("cableSchedule.buildingLoads (ISSUE-001)", () => {
  it("exists in every supported locale", () => {
    for (const [name, bundle] of Object.entries(locales)) {
      expect(
        lookup(bundle, "cableSchedule.buildingLoads"),
        `${name}.cableSchedule.buildingLoads is missing`,
      ).toBeTruthy();
    }
  });

  it("is actually translated, not an English copy, in de/ar/it", () => {
    const source = en.cableSchedule.buildingLoads;
    for (const name of ["de", "ar", "it"] as const) {
      const value = locales[name].cableSchedule.buildingLoads;
      expect(
        value,
        `${name}.cableSchedule.buildingLoads is identical to the English string ("${source}")`,
      ).not.toBe(source);
    }
  });
});

describe("cableSchedule.load (ISSUE-002)", () => {
  // ISSUE-002 was a title={t('cableSchedule.load', ...)} call whose fallback was
  // silently discarded because the key resolves to "Load". The call site is now a
  // plain literal, but breaker-schedule/page.tsx still legitimately reads this key
  // for its "Feeder" header — so it must not be removed as part of any cleanup.
  it("stays resolvable for breaker-schedule", () => {
    for (const [name, bundle] of Object.entries(locales)) {
      expect(
        lookup(bundle, "cableSchedule.load"),
        `${name}.cableSchedule.load is missing but breaker-schedule depends on it`,
      ).toBeTruthy();
    }
  });
});

describe("cableSchedule header keys (ISSUE-002)", () => {
  const headerKeys = [
    "circuitTag",
    "thCurrent",
    "thSize",
    "thInsulation",
    "thMaterial",
    "thTemp",
    "thGrouping",
    "thAmpacity",
    "thLength",
  ] as const;

  it("exist in every supported locale", () => {
    for (const [name, bundle] of Object.entries(locales)) {
      for (const key of headerKeys) {
        expect(lookup(bundle, `cableSchedule.${key}`), `${name}.cableSchedule.${key} is missing`).toBeTruthy();
      }
    }
  });
});

describe("translation keys used by the cable-schedule and project-detail pages", () => {
  // This is the assertion that would have caught ISSUE-001 directly: it inspects
  // the actual call sites, so reintroducing t('common.buildingLoads', ...) fails
  // here rather than silently shipping English text again.
  const repoRoot = path.resolve(__dirname, "..", "..");
  const pages = [
    "src/app/(app)/projects/[id]/page.tsx",
    "src/app/(app)/cable-schedule/page.tsx",
  ];

  // Pre-existing debt as of 2026-10-03: these call sites rely on their inline
  // English fallback because the key was never added to any locale. Tracked, not
  // introduced here. Shrink this list as the keys land.
  const knownMissing = new Set([
    "cableSchedule.allSizesOptimal",
    "cableSchedule.cableLength",
    "cableSchedule.requiresAttention",
    "cableSchedule.runs",
    "common.applying",
    "common.selectProject",
    "projects.maxDemandFactor",
    "tour.pageTour",
  ]);

  function resolveKey(key: string): boolean {
    return key.split(".").reduce<unknown>((node, part) => (node == null ? undefined : (node as Record<string, unknown>)[part]), en) !== undefined;
  }

  it.each(pages)("%s references only keys that resolve in en.json", (rel) => {
    const source = fs.readFileSync(path.join(repoRoot, rel), "utf8");
    const unresolved: string[] = [];

    for (const match of source.matchAll(/\bt\(\s*'([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)'/g)) {
      const key = match[1];
      if (!resolveKey(key) && !knownMissing.has(key)) unresolved.push(key);
    }

    expect(
      [...new Set(unresolved)],
      `${rel} calls t() with keys absent from en.json and not in knownMissing`,
    ).toEqual([]);
  });
});