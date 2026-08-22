import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = {
  appSettingFindMany: vi.fn(),
  appSettingUpsert: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  db: {
    appSetting: {
      findMany: vi.fn(async (...args) => mocks.appSettingFindMany(...args)),
      upsert: vi.fn(async (...args) => mocks.appSettingUpsert(...args)),
    },
  },
}));

import {
  getEffectiveCountrySettings,
  saveCountryOverride,
  resetForTests,
} from "./country-overrides";
import { COUNTRY_DEFAULTS, type CountryConfig } from "./country-defaults";

const overrideFixture: CountryConfig = {
  ...COUNTRY_DEFAULTS.US,
  powerFactor: 0.91,
};

function row(country: string, settings: unknown) {
  return { key: `country:${encodeURIComponent(country)}`, value: JSON.stringify(settings) };
}

describe("country-overrides", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetForTests();
  });

  it("layers saved overrides on top of the shipped defaults", async () => {
    mocks.appSettingFindMany.mockResolvedValue([
      row("US", { roomDensities: [], acSizingRules: [] }),
      row("UK", { roomDensities: [], acSizingRules: [] }),
    ]);

    const effective = await getEffectiveCountrySettings();
    // Defaults still present for untouched countries.
    expect(Object.keys(effective).length).toBeGreaterThan(2);
    expect(effective.US).toEqual({ roomDensities: [], acSizingRules: [] });
    expect(effective.UK).toEqual({ roomDensities: [] as unknown[], acSizingRules: [] });
  });

  it("survives a cold start: hydration reads persisted rows once per process", async () => {
    mocks.appSettingFindMany.mockResolvedValue([row("AE", { roomDensities: [1], acSizingRules: [] })]);

    await getEffectiveCountrySettings();
    await getEffectiveCountrySettings();

    expect(mocks.appSettingFindMany).toHaveBeenCalledTimes(1);
  });

  it("persists new overrides and they appear in subsequent reads without re-hydration", async () => {
    mocks.appSettingFindMany.mockResolvedValue([]);
    mocks.appSettingUpsert.mockResolvedValue({});
    const settings = overrideFixture;

    const where = await saveCountryOverride("DE", settings);
    expect(where).toBe("db");
    expect(mocks.appSettingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "country:DE" } })
    );

    const effective = await getEffectiveCountrySettings();
    expect(effective.DE).toBeDefined();
    expect(effective.DE.powerFactor).toBe(0.91);
    expect(effective.DE).toEqual(overrideFixture);
  });

  it("degrades to in-memory when the AppSetting table is not migrated yet", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.appSettingFindMany.mockRejectedValue(new Error("P2021"));
    mocks.appSettingUpsert.mockRejectedValue(new Error("P2021"));
    const settings = { ...overrideFixture, powerFactor: 0.9 };

    const effective = await getEffectiveCountrySettings();
    const before = Object.keys(effective).length;

    const where = await saveCountryOverride("FR", settings);
    expect(where).toBe("memory");

    const after = await getEffectiveCountrySettings();
    expect(Object.keys(after)).toContain("FR");
    expect(after.FR).toEqual(settings);
    expect(Object.keys(after).length).toBeGreaterThanOrEqual(before);
    warn.mockRestore();
  });

  it("ignores corrupt override rows instead of crashing hydration", async () => {
    mocks.appSettingFindMany.mockResolvedValue([{ key: "country:XX", value: "{not json" }]);

    const effective = await getEffectiveCountrySettings();
    expect(effective.XX).toBeUndefined();
  });
});
