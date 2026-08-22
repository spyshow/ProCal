import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = {
  appSettingFindUnique: vi.fn(),
  appSettingUpsert: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  db: {
    appSetting: {
      findUnique: vi.fn(async (...args) => mocks.appSettingFindUnique(...args)),
      upsert: vi.fn(async (...args) => mocks.appSettingUpsert(...args)),
    },
  },
}));

vi.mock("fs/promises", () => ({
  readFile: vi.fn(async (...args) => mocks.readFile(...args)),
  writeFile: vi.fn(async (...args) => mocks.writeFile(...args)),
  mkdir: vi.fn(async (...args) => mocks.mkdir(...args)),
}));

import { getCompanySettings, saveCompanySettings, saveLogoAsset, getLogoAsset } from "./app-settings";

describe("app-settings company profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads company settings from the AppSetting table", async () => {
    mocks.appSettingFindUnique.mockResolvedValue({
      key: "company",
      value: JSON.stringify({ companyName: "Acme Power", logoUrl: "/api/assets/logo:x" }),
    });

    const company = await getCompanySettings();
    expect(company).toEqual({ companyName: "Acme Power", logoUrl: "/api/assets/logo:x" });
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it("falls back to legacy data/company.json when the table is unavailable", async () => {
    mocks.appSettingFindUnique.mockRejectedValue(new Error("P2021 table does not exist"));
    mocks.readFile.mockResolvedValue(JSON.stringify({ companyName: "Legacy Co", logoUrl: "/uploads/a.png" }));

    const company = await getCompanySettings();
    expect(company).toEqual({ companyName: "Legacy Co", logoUrl: "/uploads/a.png" });
  });

  it("returns empty defaults when neither store has data", async () => {
    mocks.appSettingFindUnique.mockResolvedValue(null);
    mocks.readFile.mockRejectedValue(new Error("ENOENT"));

    const company = await getCompanySettings();
    expect(company).toEqual({ companyName: "", logoUrl: "" });
  });

  it("saves durably to the AppSetting table", async () => {
    mocks.appSettingUpsert.mockResolvedValue({});
    await saveCompanySettings({ companyName: "New Co", logoUrl: "" });

    expect(mocks.appSettingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "company" } })
    );
    const payload = JSON.parse(mocks.appSettingUpsert.mock.calls[0][0].create.value);
    expect(payload.companyName).toBe("New Co");
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it("falls back to the legacy file write when the table is unavailable", async () => {
    mocks.appSettingUpsert.mockRejectedValue(new Error("P2021"));
    await saveCompanySettings({ companyName: "Old Path", logoUrl: "" });

    expect(mocks.writeFile).toHaveBeenCalled();
  });
});

describe("app-settings logo assets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores logos durably and returns an /api/assets URL", async () => {
    mocks.appSettingUpsert.mockResolvedValue({});

    const url = await saveLogoAsset("image/png", new Uint8Array([1, 2, 3]));

    expect(url).toMatch(/^\/api\/assets\/logo%3A[0-9a-f]+$/);
    const arg = mocks.appSettingUpsert.mock.calls[0][0];
    expect(arg.create.key).toContain("logo:");
    const asset = JSON.parse(arg.create.value);
    expect(asset.mime).toBe("image/png");
    expect(Buffer.from(asset.data, "base64")).toEqual(Buffer.from([1, 2, 3]));
  });

  it("falls back to public/uploads when the table is unavailable", async () => {
    mocks.appSettingUpsert.mockRejectedValue(new Error("P2021"));

    const url = await saveLogoAsset("image/svg+xml", new Uint8Array([9]));

    expect(url).toMatch(/^\/uploads\/.+\.svg$/);
    expect(mocks.writeFile).toHaveBeenCalled();
  });

  it("serves a stored logo by key", async () => {
    const value = JSON.stringify({ mime: "image/png", data: Buffer.from([7]).toString("base64"), createdAt: "t" });
    mocks.appSettingFindUnique.mockResolvedValue({ key: "logo:abc", value });

    const asset = await getLogoAsset("logo:abc");
    expect(asset?.mime).toBe("image/png");
    expect(Buffer.from(asset!.data, "base64")).toEqual(Buffer.from([7]));
  });

  it("rejects keys outside the logo namespace", async () => {
    const asset = await getLogoAsset("../../etc/passwd");
    expect(asset).toBeNull();
    expect(mocks.appSettingFindUnique).not.toHaveBeenCalled();
  });
});
