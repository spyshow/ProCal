import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mocks = {
  user: null as null | { id: string; username: string; name: string; role: string; credits: number; email: string | null },
  projectFindUnique: vi.fn(),
  revisionFindMany: vi.fn(),
  equipmentCatalogFindMany: vi.fn(),
  breakerSettingsFindMany: vi.fn(),
  getCompanySettings: vi.fn(),
  getLogoAsset: vi.fn(),
  generateServerPdf: vi.fn(),
  verifyProjectAccess: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => mocks.user),
}));

vi.mock("@/lib/project-auth", () => ({
  verifyProjectAccess: vi.fn(async (id: string) => mocks.verifyProjectAccess(id)),
}));

vi.mock("@/lib/db", () => ({
  db: {
    project: { findUnique: mocks.projectFindUnique },
    projectRevision: { findMany: mocks.revisionFindMany },
    equipmentCatalog: { findMany: mocks.equipmentCatalogFindMany },
    breakerSettings: { findMany: mocks.breakerSettingsFindMany },
  },
}));

vi.mock("@/lib/app-settings", () => ({
  getCompanySettings: vi.fn(async () => mocks.getCompanySettings()),
  getLogoAsset: vi.fn(async (key: string) => mocks.getLogoAsset(key)),
}));

vi.mock("@/lib/reports/server-pdf", () => ({
  generateServerPdf: vi.fn(async (html: string) => mocks.generateServerPdf(html)),
}));

async function get(id: string, searchParams = "") {
  const { GET } = await import("./route");
  return GET(
    new Request(`http://localhost/api/projects/${id}/pdf${searchParams}`),
    {
      params: Promise.resolve({ id }),
    }
  );
}

async function post(id: string, body: any) {
  const { POST } = await import("./route");
  return POST(
    new Request(`http://localhost/api/projects/${id}/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    {
      params: Promise.resolve({ id }),
    }
  );
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.user = { id: "u1", username: "alice", name: "Alice", role: "USER", credits: 0, email: null };
  mocks.verifyProjectAccess.mockResolvedValue({ user: mocks.user });
  mocks.getCompanySettings.mockResolvedValue({ companyName: "Test Co", logoUrl: "" });
  mocks.revisionFindMany.mockResolvedValue([]);
  mocks.equipmentCatalogFindMany.mockResolvedValue([]);
  mocks.breakerSettingsFindMany.mockResolvedValue([]);
  mocks.getLogoAsset.mockResolvedValue(null);
  mocks.generateServerPdf.mockResolvedValue(Buffer.from("%PDF-1.4 mock-pdf-content"));
});

describe("GET /api/projects/[id]/pdf", () => {
  it("returns 401/error response when verifyProjectAccess rejects", async () => {
    mocks.verifyProjectAccess.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

    const res = await get("p1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when project is not found", async () => {
    mocks.projectFindUnique.mockResolvedValue(null);

    const res = await get("p1");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Project not found");
  });

  it("generates and returns application/pdf with proper headers when project is valid", async () => {
    mocks.projectFindUnique.mockResolvedValue({
      id: "p1",
      name: "Residential Complex",
      client: "Client A",
      consultant: "Consultant B",
      contractor: "Contractor C",
      location: "City",
      engineer: "Eng A",
      date: "2026-09-13",
      country: "SA",
      voltage: 400,
      frequency: 60,
      powerFactor: 0.85,
      ambientTemp: 45,
      groupingCount: 1,
      maxVoltageDropLighting: 3,
      maxVoltageDropPower: 5,
      preferredManufacturer: "ABB",
      buildings: [],
      apartmentTemplates: [],
      loadLibraryItems: [],
    });

    const res = await get("p1");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("Residential_Complex_Executive_Engineering_Package.pdf");
    expect(res.headers.get("Content-Length")).toBe(Buffer.from("%PDF-1.4 mock-pdf-content").byteLength.toString());

    const buffer = await res.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});

describe("POST /api/projects/[id]/pdf", () => {
  it("returns 401/error response when verifyProjectAccess rejects", async () => {
    mocks.verifyProjectAccess.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

    const res = await post("p1", { html: "<p>Hello</p>" });
    expect(res.status).toBe(401);
  });

  it("returns 404 when project is not found", async () => {
    mocks.projectFindUnique.mockResolvedValue(null);

    const res = await post("p1", { html: "<p>Hello</p>" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Project not found");
  });

  it("returns 400 when html is missing or not a string", async () => {
    mocks.projectFindUnique.mockResolvedValue({ id: "p1", name: "Residential Complex" });

    const resMissing = await post("p1", {});
    expect(resMissing.status).toBe(400);

    const resInvalid = await post("p1", { html: 12345 });
    expect(resInvalid.status).toBe(400);
  });

  it("generates and returns application/pdf with proper headers on valid POST", async () => {
    mocks.projectFindUnique.mockResolvedValue({ id: "p1", name: "Residential Complex" });

    const res = await post("p1", { html: "<div id='print-all-tabs'><h1>Report</h1></div>" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("Residential_Complex_Executive_Engineering_Package.pdf");
    expect(res.headers.get("Content-Length")).toBe(Buffer.from("%PDF-1.4 mock-pdf-content").byteLength.toString());

    const buffer = await res.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
    expect(mocks.generateServerPdf).toHaveBeenCalled();
  });

  it("inlines relative image assets from /api/assets/ into base64 data URIs before generating PDF", async () => {
    mocks.projectFindUnique.mockResolvedValue({ id: "p1", name: "Residential Complex" });
    mocks.getLogoAsset.mockImplementation(async (key: string) => {
      if (key === "logo:test12345") {
        return {
          mime: "image/png",
          data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          createdAt: "2026-09-13T00:00:00.000Z",
        };
      }
      return null;
    });

    const res = await post("p1", {
      html: "<div id='print-all-tabs'><img src='/api/assets/logo%3Atest12345' alt='Logo' /></div>",
    });
    expect(res.status).toBe(200);
    expect(mocks.generateServerPdf).toHaveBeenCalled();
    const passedHtml = mocks.generateServerPdf.mock.calls[0][0];
    expect(passedHtml).toContain("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ");
    expect(passedHtml).not.toContain("/api/assets/logo%3Atest12345");
  });
});
