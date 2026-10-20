import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleMcpRequest, type JsonRpcRequest, type McpUser } from "../server";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    project: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    user: {
      update: vi.fn().mockResolvedValue({}),
    },
    apartmentTemplate: {
      create: vi.fn(),
    },
    apartmentRoom: {
      create: vi.fn(),
    },
    building: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    floorDesign: {
      create: vi.fn(),
    },
    floorItem: {
      create: vi.fn(),
    },
    loadLibraryItem: {
      create: vi.fn(),
    },
    buildingLoad: {
      create: vi.fn(),
    },
    projectAuditLog: {
      findFirst: vi.fn(),
      create: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockDb)),
  },
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/reports/server-pdf", () => ({
  generateServerPdf: vi.fn().mockResolvedValue(Buffer.from("mock-pdf-bytes")),
}));

describe("Zero-Dependency JSON-RPC 2.0 MCP Server", () => {
  const testUser: McpUser = {
    id: "user-mcp-1",
    role: "USER",
    credits: 10,
    name: "Alex",
    username: "alex",
  };

  const baseUrl = "https://procal.example.com";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles 'initialize' method with protocolVersion and serverInfo", async () => {
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05" },
    };

    const res = await handleMcpRequest(req, testUser, baseUrl);
    expect(res.id).toBe(1);
    expect(res.result).toEqual({
      protocolVersion: "2024-11-05",
      capabilities: { tools: {}, prompts: {} },
      serverInfo: {
        name: "procal-mcp-server",
        title: "ProCal",
        version: "1.6.5",
        websiteUrl: baseUrl,
        icons: [
          {
            src: `${baseUrl}/apple-touch-icon.png`,
            mimeType: "image/png",
            sizes: ["180x180"],
          },
          {
            src: `${baseUrl}/icon.svg`,
            mimeType: "image/svg+xml",
            sizes: ["any"],
          },
          {
            src: `${baseUrl}/favicon.ico`,
            mimeType: "image/x-icon",
            sizes: ["32x32"],
          },
        ],
        icon: `${baseUrl}/apple-touch-icon.png`,
        iconUrl: `${baseUrl}/apple-touch-icon.png`,
      },
    });
  });

  it("lists all 9 official MCP tools under 'tools/list'", async () => {
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    };

    const res = await handleMcpRequest(req, testUser, baseUrl);
    const tools = (res.result as { tools: { name: string }[] }).tools;
    expect(tools).toHaveLength(9);

    const names = tools.map((t) => t.name);
    expect(names).toContain("get_engineering_catalog");
    expect(names).toContain("validate_project_spec");
    expect(names).toContain("create_project_from_spec");
    expect(names).toContain("update_project_spec");
    expect(names).toContain("update_project_loads");
    expect(names).toContain("check_project_compliance");
    expect(names).toContain("get_project_bom");
    expect(names).toContain("get_project_sld");
    expect(names).toContain("get_project_report");
  });

  it("exposes and returns 'drawing-to-procal-workflow' prompt", async () => {
    const listReq: JsonRpcRequest = { jsonrpc: "2.0", id: 3, method: "prompts/list" };
    const listRes = await handleMcpRequest(listReq, testUser, baseUrl);
    expect((listRes.result as { prompts: { name: string }[] }).prompts[0].name).toBe(
      "drawing-to-procal-workflow"
    );

    const getReq: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 4,
      method: "prompts/get",
      params: { name: "drawing-to-procal-workflow", arguments: { projectName: "Burj Tower" } },
    };
    const getRes = await handleMcpRequest(getReq, testUser, baseUrl);
    const text = (getRes.result as { messages: { content: { text: string } }[] }).messages[0]
      .content.text;
    expect(text).toContain("Burj Tower");
    expect(text).toContain("get_engineering_catalog");
    expect(text).toContain("validate_project_spec");
    expect(text).toContain("create_project_from_spec");
    expect(text).toContain("update_project_spec");
  });

  it("executes 'get_engineering_catalog' tool", async () => {
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "get_engineering_catalog",
        arguments: { country: "United Arab Emirates" },
      },
    };

    const res = await handleMcpRequest(req, testUser, baseUrl);
    expect(res.result).toBeDefined();
    const content = (res.result as { content: { text: string }[] }).content[0].text;
    const data = JSON.parse(content);
    expect(data.country).toBe("United Arab Emirates");
    expect(data.electricalDefaults.voltage).toBe(400);
    expect(data.electricalDefaults.standard).toBe("IEC");
    expect(data.roomDensitiesVaPerM2.kitchen).toBeGreaterThan(0);
  });

  it("executes 'validate_project_spec' tool and returns pre-flight confirmation", async () => {
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "validate_project_spec",
        arguments: {
          name: "Marina Heights",
          country: "United Arab Emirates",
          apartmentTemplates: [
            {
              name: "1-Bed",
              rooms: [{ name: "Living", type: "LIVING_ROOM", areaM2: 25 }],
            },
          ],
          buildings: [
            {
              name: "Block A",
              floors: 3,
              floorAssignments: [{ floorNumber: 1, templateName: "1-Bed", count: 2 }],
            },
          ],
        },
      },
    };

    const res = await handleMcpRequest(req, testUser, baseUrl);
    const content = (res.result as { content: { text: string }[] }).content[0].text;
    const data = JSON.parse(content);
    expect(data.valid).toBe(true);
    expect(data.readyToCreate).toBe(false);
    expect(data.requiresConfirmation).toBe(true);
    expect(data.confirmationPrompt).toContain("Marina Heights");
  });

  it("executes 'get_project_sld' and returns DSL, standalone SVG, and parsed AST", async () => {
    mockDb.project.findUnique.mockResolvedValueOnce({
      id: "proj-sld-1",
      name: "Solaris Tower",
      voltage: 400,
      frequency: 50,
      powerFactor: 0.85,
      calculationStandard: "IEC",
      buildings: [
        {
          id: "b-1",
          name: "Main",
          floors: 1,
          floorDesigns: [
            {
              floorNumber: 1,
              hasFloorSubPanels: false,
              items: [
                {
                  id: "it-1",
                  name: "Studio 1",
                  type: "APARTMENT",
                  calculatedMaxDemand: 5,
                  calculatedCurrent: 21.7,
                  breakerSize: "25A",
                  cableSize: "4 mm²",
                },
              ],
            },
          ],
          buildingLoads: [],
        },
      ],
    });

    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "get_project_sld",
        arguments: { projectId: "proj-sld-1" },
      },
    };

    const res = await handleMcpRequest(req, testUser, baseUrl);
    const content = (res.result as { content: { text: string }[] }).content[0].text;
    const data = JSON.parse(content);

    expect(data.projectId).toBe("proj-sld-1");
    expect(data.overviewDiagram.dsl).toContain("Solaris Tower");
    expect(data.overviewDiagram.svg).toContain("<svg");
    expect(data.overviewDiagram.ast).toBeDefined();
    expect(data.floorPages).toHaveLength(1);
    expect(data.floorPages[0].svg).toContain("<svg");
  });

  it("executes 'get_project_report' and returns signed download token URL and deep links", async () => {
    mockDb.project.findUnique.mockResolvedValue({
      id: "proj-rep-1",
      name: "Crown Plaza",
      voltage: 400,
      powerFactor: 0.85,
      calculationStandard: "IEC",
      buildings: [],
      apartmentTemplates: [],
    });

    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: {
        name: "get_project_report",
        arguments: { projectId: "proj-rep-1", includeBase64: false },
      },
    };

    const res = await handleMcpRequest(req, testUser, baseUrl);
    const content = (res.result as { content: { text: string }[] }).content[0].text;
    const data = JSON.parse(content);

    expect(data.projectId).toBe("proj-rep-1");
    expect(data.signedDownloadUrl).toContain("/api/projects/proj-rep-1/pdf?token=");
    expect(data.deepLinks.overview).toBe("https://procal.example.com/projects/proj-rep-1");
    expect(data.deepLinks.calculator).toBe("https://procal.example.com/calculator?projectId=proj-rep-1");
    expect(data.downloadTokenExpiresIn).toBe("1 hour");
  });

  it("generates base64Pdf when outputFilePath is specified in 'get_project_report'", async () => {
    mockDb.project.findUnique.mockResolvedValue({
      id: "proj-rep-2",
      name: "Crown Plaza",
      voltage: 400,
      powerFactor: 0.85,
      calculationStandard: "IEC",
      buildings: [],
      apartmentTemplates: [],
    });

    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: {
        name: "get_project_report",
        arguments: { projectId: "proj-rep-2", outputFilePath: "report.pdf" },
      },
    };

    const res = await handleMcpRequest(req, testUser, baseUrl);
    const content = (res.result as { content: { text: string }[] }).content[0].text;
    const data = JSON.parse(content);

    expect(data.base64Pdf).toBe(Buffer.from("mock-pdf-bytes").toString("base64"));
  });

  it("executes 'update_project_spec' tool and updates project in-place", async () => {
    mockDb.project.findUnique.mockResolvedValue({
      id: "proj-update-1",
      userId: testUser.id,
      name: "Sunrise Tower",
      voltage: 400,
      frequency: 50,
      powerFactor: 0.85,
      calculationStandard: "IEC",
      buildings: [],
      apartmentTemplates: [],
    });

    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: {
        name: "update_project_spec",
        arguments: {
          projectId: "proj-update-1",
          voltage: 380,
          resetSizing: false,
        },
      },
    };

    const res = await handleMcpRequest(req, testUser, baseUrl);
    expect(res.error).toBeUndefined();
    const content = (res.result as { content: { text: string }[] }).content[0].text;
    const data = JSON.parse(content);

    expect(data.success).toBe(true);
    expect(data.projectId).toBe("proj-update-1");
    expect(data.message).toContain("Sunrise Tower");
  });

  it("returns error -32601 on unknown RPC method", async () => {
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 99,
      method: "unknown_method",
    };

    const res = await handleMcpRequest(req, testUser, baseUrl);
    expect(res.error?.code).toBe(-32601);
  });

  it("handles anonymous 'initialize' and 'tools/list' without error", async () => {
    const initReq: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 101,
      method: "initialize",
      params: { protocolVersion: "2024-11-05" },
    };
    const initRes = await handleMcpRequest(initReq, null, baseUrl);
    expect(initRes.id).toBe(101);
    expect(initRes.error).toBeUndefined();
    expect((initRes.result as { serverInfo: { name: string } }).serverInfo.name).toBe("procal-mcp-server");

    const toolsReq: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 102,
      method: "tools/list",
    };
    const toolsRes = await handleMcpRequest(toolsReq, null, baseUrl);
    expect(toolsRes.id).toBe(102);
    expect(toolsRes.error).toBeUndefined();
    const tools = (toolsRes.result as { tools: unknown[] }).tools;
    expect(tools.length).toBe(9);
  });

  it("allows anonymous execution of 'get_engineering_catalog'", async () => {
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 103,
      method: "tools/call",
      params: {
        name: "get_engineering_catalog",
        arguments: { country: "Saudi Arabia" },
      },
    };

    const res = await handleMcpRequest(req, null, baseUrl);
    expect(res.error).toBeUndefined();
    const content = (res.result as { content: { text: string }[] }).content[0].text;
    const data = JSON.parse(content);
    expect(data.country).toBe("Saudi Arabia");
    expect(data.electricalDefaults.voltage).toBe(400);
  });

  it("returns authentication required error when an anonymous user calls 'create_project_from_spec'", async () => {
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 104,
      method: "tools/call",
      params: {
        name: "create_project_from_spec",
        arguments: {
          name: "Unauthorized Project",
          isConfirmedByUser: true,
          apartmentTemplates: [],
          buildings: [],
        },
      },
    };

    const res = await handleMcpRequest(req, null, baseUrl);
    expect(res.error).toBeUndefined();
    const content = (res.result as { content: { text: string }[]; isError: boolean }).content[0].text;
    expect(res.result).toHaveProperty("isError", true);
    expect(content).toContain("Authentication required");
    expect(content).toContain("procal_sk_");
  });
});
