import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mocks = {
  verifyProjectAccess: vi.fn(),
  verifyReportDownloadToken: vi.fn(),
  getCompanySettings: vi.fn(),
  getLogoAsset: vi.fn(),
  generateServerPdf: vi.fn(),
  projectFindUnique: vi.fn(),
  revisionFindMany: vi.fn(),
  equipmentFindMany: vi.fn(),
  breakerSettingsFindMany: vi.fn(),
};

vi.mock("@/lib/project-auth", () => ({
  verifyProjectAccess: (...args: unknown[]) => mocks.verifyProjectAccess(...args),
}));

vi.mock("@/lib/auth", () => ({
  verifyReportDownloadToken: (...args: unknown[]) => mocks.verifyReportDownloadToken(...args),
}));

vi.mock("@/lib/app-settings", () => ({
  getCompanySettings: (...args: unknown[]) => mocks.getCompanySettings(...args),
  getLogoAsset: (...args: unknown[]) => mocks.getLogoAsset(...args),
}));

vi.mock("@/lib/reports/server-pdf", () => ({
  generateServerPdf: (...args: unknown[]) => mocks.generateServerPdf(...args),
}));

vi.mock("@/lib/db", () => ({
  db: {
    project: {
      findUnique: (...args: unknown[]) => mocks.projectFindUnique(...args),
    },
    projectRevision: {
      findMany: (...args: unknown[]) => mocks.revisionFindMany(...args),
    },
    equipmentCatalog: {
      findMany: (...args: unknown[]) => mocks.equipmentFindMany(...args),
    },
    breakerSettings: {
      findMany: (...args: unknown[]) => mocks.breakerSettingsFindMany(...args),
    },
  },
}));

function makeFullProject(isTrial: boolean) {
  return {
    id: "proj-pdf-1",
    name: "Horizon Tower",
    client: "Horizon Holdings",
    consultant: "Apex Engineering",
    contractor: "Gulf Builders",
    location: "Riyadh",
    engineer: "Eng. Ali",
    date: "2026-11-25",
    country: "SA",
    voltage: 400,
    frequency: 50,
    powerFactor: 0.85,
    maxDemandFactor: 0.8,
    preferredManufacturer: "ABB",
    calculationStandard: "IEC",
    maxVoltageDropLighting: 3,
    maxVoltageDropPower: 5,
    ambientTemp: 40,
    groupingCount: 1,
    isTrial,
    buildings: [
      {
        id: "b-1",
        name: "Tower A",
        floors: 2,
        serviceFloors: 0,
        apartmentsPerFloor: 2,
        supplyVoltage: "400V 3-Phase",
        earthingSystem: "TN-S",
        lightningProtection: false,
        floorDesigns: [
          {
            id: "fd-1",
            floorNumber: 1,
            hasFloorSubPanels: false,
            items: [
              {
                id: "fi-1",
                name: "Apt 101",
                type: "APARTMENT",
                calculatedConnectedLoad: 20,
                calculatedMaxDemand: 10,
                calculatedCurrent: 18.2,
                cableSize: "6 mm²",
                breakerSize: "25A",
                cableLength: 20,
              },
            ],
          },
        ],
        buildingLoads: [],
      },
    ],
    apartmentTemplates: [],
    loadLibraryItems: [],
  };
}

describe("/api/projects/[id]/pdf route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyProjectAccess.mockResolvedValue({ user: { id: "u1" } });
    mocks.verifyReportDownloadToken.mockResolvedValue({ projectId: "proj-pdf-1", userId: "u1", purpose: "report-pdf" });
    mocks.getCompanySettings.mockResolvedValue({ companyName: "ProCal", logoUrl: null });
    mocks.getLogoAsset.mockResolvedValue(null);
    mocks.revisionFindMany.mockResolvedValue([]);
    mocks.equipmentFindMany.mockResolvedValue([]);
    mocks.breakerSettingsFindMany.mockResolvedValue([]);
    mocks.generateServerPdf.mockResolvedValue(Buffer.from("%PDF-1.4 mock-pdf-bytes"));
  });

  it("GET returns 401 when signed report download token is invalid or expired", async () => {
    mocks.verifyReportDownloadToken.mockResolvedValueOnce(null);
    const { GET } = await import("./route");

    const res = await GET(
      new Request("http://localhost/api/projects/proj-pdf-1/pdf?token=bad-token"),
      { params: Promise.resolve({ id: "proj-pdf-1" }) }
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Invalid or expired");
    expect(mocks.generateServerPdf).not.toHaveBeenCalled();
  });

  it("GET succeeds with valid signed token and propagates trial watermark and isTrial=true", async () => {
    mocks.projectFindUnique.mockResolvedValueOnce(makeFullProject(true));
    const { GET } = await import("./route");

    const res = await GET(
      new Request("http://localhost/api/projects/proj-pdf-1/pdf?token=valid-token"),
      { params: Promise.resolve({ id: "proj-pdf-1" }) }
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(mocks.generateServerPdf).toHaveBeenCalledTimes(1);
    const [renderedHtml, pdfOpts] = mocks.generateServerPdf.mock.calls[0];
    expect(pdfOpts).toEqual({ isTrial: true });
    expect(renderedHtml).toContain("trial-watermark-overlay");
    expect(renderedHtml).toContain("PROCAL FREE TRIAL — NOT FOR CONSTRUCTION");
  });

  it("GET without token delegates to verifyProjectAccess and returns 403 when denied", async () => {
    mocks.verifyProjectAccess.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const { GET } = await import("./route");

    const res = await GET(
      new Request("http://localhost/api/projects/proj-pdf-1/pdf"),
      { params: Promise.resolve({ id: "proj-pdf-1" }) }
    );

    expect(res.status).toBe(403);
    expect(mocks.generateServerPdf).not.toHaveBeenCalled();
  });

  it("POST returns 400 when html is missing on a non-trial project", async () => {
    mocks.projectFindUnique.mockResolvedValueOnce({ name: "Horizon Tower", isTrial: false });
    const { POST } = await import("./route");

    const res = await POST(
      new Request("http://localhost/api/projects/proj-pdf-1/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "proj-pdf-1" }) }
    );

    expect(res.status).toBe(400);
    expect(mocks.generateServerPdf).not.toHaveBeenCalled();
  });

  it("POST strips scripts/handlers and blocks CWE-22 path traversal in inlineImagesInHtml", async () => {
    mocks.projectFindUnique.mockResolvedValueOnce({ name: "Horizon Tower", isTrial: false });
    const { POST } = await import("./route");

    const maliciousHtml =
      '<div><h1>Report</h1><script>alert(1)</script><img src="/uploads/../../.env" onclick="steal()" /></div>';

    const res = await POST(
      new Request("http://localhost/api/projects/proj-pdf-1/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: maliciousHtml }),
      }),
      { params: Promise.resolve({ id: "proj-pdf-1" }) }
    );

    expect(res.status).toBe(200);
    const [passedHtml, pdfOpts] = mocks.generateServerPdf.mock.calls[0];
    expect(pdfOpts).toEqual({ isTrial: false });
    expect(passedHtml).not.toContain("<script>");
    expect(passedHtml).not.toContain("alert(1)");
    expect(passedHtml).not.toContain("onclick=");
    // Traversal path must remain un-inlined (never replaced with a data: URI from outside public/uploads)
    expect(passedHtml).toContain('src="/uploads/../../.env"');
    expect(passedHtml).not.toContain("data:image/png;base64");
  });

  it("POST on isTrial=true ignores client CSS watermark suppression and renders authoritative server HTML", async () => {
    mocks.projectFindUnique
      .mockResolvedValueOnce({ name: "Horizon Tower", isTrial: true })
      .mockResolvedValueOnce(makeFullProject(true));
    const { POST } = await import("./route");

    const suppressivePayload =
      '<style>.trial-watermark-overlay { display: none !important; opacity: 0 !important; }</style><div>Fake clean export</div>';

    const res = await POST(
      new Request("http://localhost/api/projects/proj-pdf-1/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: suppressivePayload }),
      }),
      { params: Promise.resolve({ id: "proj-pdf-1" }) }
    );

    expect(res.status).toBe(200);
    const [passedHtml, pdfOpts] = mocks.generateServerPdf.mock.calls[0];
    expect(pdfOpts).toEqual({ isTrial: true });
    expect(passedHtml).toContain("PROCAL FREE TRIAL — NOT FOR CONSTRUCTION");
    expect(passedHtml).not.toContain("opacity: 0 !important");
    expect(passedHtml).not.toContain("Fake clean export");
  });
});
