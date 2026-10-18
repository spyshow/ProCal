import {
  COUNTRY_DEFAULTS,
  getCountryDefaults,
  DEFAULT_COUNTRY_CONFIG,
} from "@/lib/country-defaults";
import { IEC_BREAKER_RATINGS, NEC_BREAKER_RATINGS } from "@/lib/calculations/codes";
import { CABLE_CATALOG } from "@/lib/calculations/cablesData";
import { validateProjectSpec } from "@/lib/agent/validate-spec";
import {
  createProjectFromSpec,
  updateProjectLoads,
  getProjectComplianceSummary,
  getProjectBOM,
} from "@/lib/agent/build-project";
import { generateSLD, generateSLDPages } from "@/lib/sld/generator";
import { render, parse } from "schematex";
import { db } from "@/lib/db";
import { signReportDownloadToken } from "@/lib/auth";
import { generateServerPdf } from "@/lib/reports/server-pdf";
import { renderReportHtml, wrapReportMarkup } from "@/lib/reports/render-report-html";
import { getCompanySettings } from "@/lib/app-settings";
import type { Project as AppProject } from "@/types";

export interface McpUser {
  id: string;
  role: string;
  credits: number;
  name?: string;
  username?: string;
}

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

const MCP_TOOLS = [
  {
    name: "get_engineering_catalog",
    description:
      "Returns regional electrical engineering defaults (voltage, frequency, power factor, IEC/NEMA standards), standard room load densities (VA/m²), AC sizing rules, and standard circuit breaker/cable catalog sizes.",
    inputSchema: {
      type: "object",
      properties: {
        country: {
          type: "string",
          description: "Country name (e.g. 'United Arab Emirates', 'Saudi Arabia', 'Germany', 'United States')",
        },
      },
    },
  },
  {
    name: "validate_project_spec",
    description:
      "Pre-flight dry-run check of an architectural/electrical drawing schedule spec. Identifies missing electrical parameters, assigns regional IEC/NEMA engineering defaults, and returns an estimated loads preview with a confirmation table. The AI agent MUST confirm missing/assumed parameters with the engineer before calling create_project_from_spec.",
    inputSchema: {
      type: "object",
      required: ["name", "apartmentTemplates", "buildings"],
      properties: {
        name: { type: "string", description: "Name of the project" },
        country: { type: "string", description: "Country for regional electrical codes" },
        voltage: { type: "number", description: "3-phase supply voltage (e.g. 400, 380, 480)" },
        frequency: { type: "number", description: "Grid frequency (50 or 60 Hz)" },
        powerFactor: { type: "number", description: "Power factor (default 0.85)" },
        calculationStandard: { type: "string", enum: ["IEC", "NEMA"], description: "Calculation standard" },
        apartmentTemplates: { type: "array", description: "Apartment load templates and room schedules" },
        buildings: { type: "array", description: "Buildings, floors, assignments, and mechanical loads" },
        isConfirmedByUser: { type: "boolean", description: "Set to true once the engineer confirms assumed parameters" },
      },
    },
  },
  {
    name: "create_project_from_spec",
    description:
      "Atomically creates a project in ProCal from a confirmed drawing specification, sizing apartment loads, branch circuits, MDB incomers, and mechanical equipment under IEC/NEMA standards. Requires isConfirmedByUser: true and deducts 1 credit for non-admin users.",
    inputSchema: {
      type: "object",
      required: ["name", "apartmentTemplates", "buildings", "isConfirmedByUser"],
      properties: {
        name: { type: "string", description: "Name of the project" },
        country: { type: "string", description: "Country for regional electrical codes" },
        voltage: { type: "number", description: "3-phase supply voltage (e.g. 400)" },
        frequency: { type: "number", description: "Grid frequency (50 or 60 Hz)" },
        powerFactor: { type: "number", description: "Power factor (default 0.85)" },
        calculationStandard: { type: "string", enum: ["IEC", "NEMA"] },
        apartmentTemplates: { type: "array" },
        buildings: { type: "array" },
        isConfirmedByUser: { type: "boolean", description: "Must be true" },
        idempotencyKey: { type: "string", description: "Optional deduplication key" },
      },
    },
  },
  {
    name: "update_project_loads",
    description:
      "Targeted modification of loads, templates, or mechanical equipment for an existing project, automatically triggering complex-wide global recalculation across all buildings.",
    inputSchema: {
      type: "object",
      required: ["projectId"],
      properties: {
        projectId: { type: "string", description: "Project ID" },
        buildingId: { type: "string", description: "Optional target building ID" },
        buildingLoads: { type: "array", description: "Mechanical/building loads to add or update" },
        resetSizing: { type: "boolean", description: "Whether to recalculate cables & breakers" },
      },
    },
  },
  {
    name: "check_project_compliance",
    description:
      "Instant electrical code audit of a ProCal project. Verifies the fundamental protection chain (Ib <= Ir <= In <= Iz), phase current unbalance %, neutral conductor loading, and voltage drop limits.",
    inputSchema: {
      type: "object",
      required: ["projectId"],
      properties: {
        projectId: { type: "string", description: "Project ID to audit" },
      },
    },
  },
  {
    name: "get_project_bom",
    description:
      "Generates an aggregated Bill of Materials (BOM) takeoff schedule for switchgear (ACB, MCCB, MCB, RCCB) and power cables (by conductor size, material, and total run length in meters) ready for procurement and estimation.",
    inputSchema: {
      type: "object",
      required: ["projectId"],
      properties: {
        projectId: { type: "string", description: "Project ID" },
      },
    },
  },
  {
    name: "get_project_sld",
    description:
      "Generates code-compliant Single Line Diagrams (SLD) in Schematex DSL, standalone SVG format, and parsed AST JSON for the main MDB switchboard and individual floor sub-panels (including elevators, pumps, and chillers).",
    inputSchema: {
      type: "object",
      required: ["projectId"],
      properties: {
        projectId: { type: "string", description: "Project ID" },
        buildingId: { type: "string", description: "Optional building ID filter" },
        floorNumber: { type: "number", description: "Optional floor number filter" },
        outputFilePath: { type: "string", description: "Optional local file path to save SVG when using stdio bridge (e.g. sld.svg)" },
      },
    },
  },
  {
    name: "get_project_report",
    description:
      "Generates an executive engineering compliance summary with targeted deep links and a 1-hour signed PDF report download URL. Optionally returns base64 PDF bytes if includeBase64 is true or outputFilePath is specified.",
    inputSchema: {
      type: "object",
      required: ["projectId"],
      properties: {
        projectId: { type: "string", description: "Project ID" },
        includeBase64: { type: "boolean", description: "Set to true to embed base64 PDF bytes (default: false)" },
        outputFilePath: { type: "string", description: "Optional local file path to save PDF when using stdio bridge (e.g. report.pdf)" },
      },
    },
  },
];

const MCP_PROMPTS = [
  {
    name: "drawing-to-procal-workflow",
    description:
      "Step-by-step guidance for an external multimodal AI agent on inspecting drawing schedules, confirming missing electrical parameters with the engineer, and atomically creating the project in ProCal.",
    arguments: [
      {
        name: "projectName",
        description: "Name of the project being created",
        required: false,
      },
    ],
  },
];

export async function handleMcpRequest(
  request: JsonRpcRequest,
  user: McpUser,
  baseUrl: string = "https://procal.example.com"
): Promise<JsonRpcResponse> {
  const { id = null, method, params = {} } = request;

  try {
    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
              prompts: {},
            },
            serverInfo: {
              name: "procal-mcp-server",
              version: "1.5.6",
            },
          },
        };

      case "notifications/initialized":
      case "ping":
        return {
          jsonrpc: "2.0",
          id,
          result: {},
        };

      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: MCP_TOOLS,
          },
        };

      case "prompts/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            prompts: MCP_PROMPTS,
          },
        };

      case "prompts/get": {
        const promptName = params.name as string;
        if (promptName !== "drawing-to-procal-workflow") {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: `Unknown prompt: ${promptName}` },
          };
        }

        const projectName = (params.arguments as Record<string, string>)?.projectName || "the project";
        return {
          jsonrpc: "2.0",
          id,
          result: {
            description: "ProCal Drawing-to-Project Engineering Workflow",
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text:
                    `You are an expert electrical engineer connected to ProCal via MCP. Your goal is to process the drawing for ${projectName}:\n\n` +
                    `1. Visually inspect the drawing schedules: extract room types, areas (m²), air conditioning requirements, apartment counts, and building mechanical loads (elevators, fire pumps, chillers).\n` +
                    `2. Call 'get_engineering_catalog' to fetch country voltage and code conventions.\n` +
                    `3. Call 'validate_project_spec' with the extracted specification. If any parameters are assumed (e.g. standard densities, 400V 50Hz supply), present the structured confirmation table to the engineer.\n` +
                    `4. Once the engineer confirms, call 'create_project_from_spec' with isConfirmedByUser: true.\n` +
                    `5. Call 'check_project_compliance' and 'get_project_sld' to present the verified Single Line Diagram and provide the engineer with the signed PDF report link.`,
                },
              },
            ],
          },
        };
      }

      case "tools/call": {
        const toolName = params.name as string;
        const toolArgs = (params.arguments || {}) as Record<string, unknown>;

        const toolResult = await executeTool(toolName, toolArgs, user, baseUrl);
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult, null, 2),
              },
            ],
            isError: false,
          },
        };
      }

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
        };
    }
  } catch (error: unknown) {
    console.error("MCP Execution Error:", error);
    const message = error instanceof Error ? error.message : "Internal MCP Server error";
    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [
          {
            type: "text",
            text: `Error: ${message}`,
          },
        ],
        isError: true,
      },
    };
  }
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  user: McpUser,
  baseUrl: string
): Promise<unknown> {
  switch (name) {
    case "get_engineering_catalog": {
      const country = (args.country as string) || "United Arab Emirates";
      const config = getCountryDefaults(country);
      return {
        country,
        electricalDefaults: {
          voltage: config.voltage,
          frequency: config.frequency,
          powerFactor: config.powerFactor,
          standard: country === "United States" ? "NEMA" : "IEC",
        },
        roomDensitiesVaPerM2: config.roomDensities,
        acSizingRules: config.acSizingRules,
        standardBreakers: {
          iec: IEC_BREAKER_RATINGS.slice(0, 15),
          nec: NEC_BREAKER_RATINGS.slice(0, 15),
        },
        availableConductorSizesMm2: CABLE_CATALOG.map((c) => c.size),
      };
    }

    case "validate_project_spec": {
      return validateProjectSpec(args);
    }

    case "create_project_from_spec": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await createProjectFromSpec(user, args as any);
    }

    case "update_project_loads": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await updateProjectLoads(user, args as any);
    }

    case "check_project_compliance": {
      const projectId = args.projectId as string;
      if (!projectId) throw new Error("projectId is required");
      return await getProjectComplianceSummary(projectId);
    }

    case "get_project_bom": {
      const projectId = args.projectId as string;
      if (!projectId) throw new Error("projectId is required");
      return await getProjectBOM(projectId);
    }

    case "get_project_sld": {
      const projectId = args.projectId as string;
      if (!projectId) throw new Error("projectId is required");

      const project = await db.project.findUnique({
        where: { id: projectId },
        include: {
          buildings: {
            include: {
              floorDesigns: {
                include: { items: true },
              },
              buildingLoads: {
                include: { loadLibraryItem: true },
              },
            },
          },
        },
      });

      if (!project) throw new Error(`Project not found: ${projectId}`);

      const fullDsl = generateSLD(project as unknown as AppProject);
      const fullSvg = render(fullDsl);
      const fullAst = parse(fullDsl);

      const pages = generateSLDPages(project as unknown as AppProject).map((p) => ({
        title: p.title,
        floors: p.floors,
        buildingName: p.buildingName,
        floorNumber: p.floorNumber,
        dsl: p.dsl,
        svg: render(p.dsl),
      }));

      return {
        projectId,
        projectName: project.name,
        overviewDiagram: {
          dsl: fullDsl,
          svg: fullSvg,
          ast: fullAst,
        },
        floorPages: pages,
      };
    }

    case "get_project_report": {
      const projectId = args.projectId as string;
      if (!projectId) throw new Error("projectId is required");
      const includeBase64 = args.includeBase64 === true || Boolean(args.outputFilePath);

      const project = await db.project.findUnique({
        where: { id: projectId },
        include: {
          buildings: {
            include: {
              floorDesigns: {
                include: { items: true },
              },
              buildingLoads: {
                include: { loadLibraryItem: true },
              },
            },
          },
        },
      });

      if (!project) throw new Error(`Project not found: ${projectId}`);

      const compliance = await getProjectComplianceSummary(projectId);
      const downloadToken = await signReportDownloadToken(projectId, user.id);
      const signedDownloadUrl = `${baseUrl}/api/projects/${projectId}/pdf?token=${downloadToken}`;

      let base64Pdf: string | undefined;
      if (includeBase64) {
        try {
          const company = await getCompanySettings().catch(() => null);
          const fullHtml = wrapReportMarkup(
            `<div><h1>${project.name}</h1><p>Executive Report</p></div>`,
            `${project.name} - Executive Package`
          );
          const buffer = await generateServerPdf(fullHtml);
          base64Pdf = buffer.toString("base64");
        } catch (err) {
          console.warn("Eager base64 PDF generation failed:", err);
        }
      }

      return {
        projectId,
        projectName: project.name,
        complianceSummary: compliance,
        signedDownloadUrl,
        downloadTokenExpiresIn: "1 hour",
        deepLinks: {
          overview: `${baseUrl}/projects/${projectId}`,
          calculator: `${baseUrl}/calculator?projectId=${projectId}`,
          sld: `${baseUrl}/projects/${projectId}?tab=sld`,
          pdfReport: signedDownloadUrl,
        },
        ...(base64Pdf ? { base64Pdf } : {}),
      };
    }

    default:
      throw new Error(`Tool not implemented: ${name}`);
  }
}
