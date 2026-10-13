import { describe, it, expect } from "vitest";
import { abbTmaxXtCatalog, abbTmaxXtLegacyModels } from "../../prisma/data/abb-tmax-xt";

describe("ABB Tmax XT MCCB seed catalog", () => {
  it("covers every frame XT1..XT7", () => {
    const series = new Set(abbTmaxXtCatalog.map((i) => i.series));
    expect([...series].sort()).toEqual(
      ["Tmax XT1", "Tmax XT2", "Tmax XT3", "Tmax XT4", "Tmax XT5", "Tmax XT6", "Tmax XT7"]
    );
  });

  it("has no duplicate catalog unique keys", () => {
    const keys = abbTmaxXtCatalog.map(
      (i) => `${i.manufacturer}|${i.category}|${i.series}|${i.model}|${i.ratedCurrent}|${i.poles}`
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps the model names of the previous hand-written rows (upsert in place)", () => {
    const models = new Set(abbTmaxXtCatalog.map((i) => i.model));
    for (const legacy of [
      "XT1B 160 TMD 40A",
      "XT1N 160 TMD 63A",
      "XT1N 160 TMD 100A",
      "XT5N 400 TMA 320A",
      "XT5N 400 Ekip Dip LSI 320A",
      "XT5N 400 Ekip Dip LSI 400A",
      "XT5N 630 Ekip Dip LSI 630A",
    ]) {
      expect(models.has(legacy), legacy).toBe(true);
    }
  });

  it("replaces the renamed legacy Ekip LSI rows", () => {
    const models = new Set(abbTmaxXtCatalog.map((i) => i.model));
    for (const legacy of abbTmaxXtLegacyModels) {
      expect(models.has(legacy.model)).toBe(false);
    }
    expect(models.has("XT2N 160 Ekip Dip LSI 160A")).toBe(true);
    expect(models.has("XT4N 250 Ekip Dip LSI 250A")).toBe(true);
  });

  it("never exceeds the frame size and always has valid settingsJson", () => {
    for (const item of abbTmaxXtCatalog) {
      const frameAmps = Number(item.model.split(" ")[1]);
      expect(item.ratedCurrent, item.model).toBeLessThanOrEqual(frameAmps);
      const s = JSON.parse(item.settingsJson);
      expect(s.Ics).toBe(item.breakingCapacity);
      expect(item.breakingCapacity).toBeGreaterThan(0);
      expect(item.poles).toBe(3);
    }
  });

  it("offers rising breaking capacity across performance levels", () => {
    const xt4 = abbTmaxXtCatalog.filter((i) => i.series === "Tmax XT4" && i.ratedCurrent === 100 && i.tripUnit.startsWith("TMA"));
    const byLevel = Object.fromEntries(xt4.map((i) => [i.model.split(" ")[0].replace("XT4", ""), i.breakingCapacity]));
    expect(byLevel).toEqual({ N: 36, S: 50, H: 70, L: 120, V: 150 });
  });

  it("includes Ekip Touch LSIG (with a G stage) only on frames that offer it", () => {
    const touch = abbTmaxXtCatalog.filter((i) => i.tripUnit === "Ekip Touch LSIG");
    expect([...new Set(touch.map((i) => i.series))].sort()).toEqual(
      ["Tmax XT2", "Tmax XT4", "Tmax XT5", "Tmax XT6", "Tmax XT7"]
    );
    for (const item of touch) {
      const s = JSON.parse(item.settingsJson);
      expect(s.curveType).toBe("LSIG");
      expect(s.G.defaultIg).toBeGreaterThan(0);
    }
    const models = new Set(abbTmaxXtCatalog.map((i) => i.model));
    expect(models.has("XT4N 250 Ekip Touch LSIG 250A")).toBe(true);
    expect(models.has("XT7H 1600 Ekip Touch LSIG 1600A")).toBe(true);
  });
});
