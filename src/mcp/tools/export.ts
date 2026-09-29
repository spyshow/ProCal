import { z } from 'zod';
import { logProjectActivity } from '@/lib/audit-logger';
import { generateReportPdfFromPrintRoute } from '@/lib/reports/print-report-pdf';
import { createPrintTicket } from '@/lib/reports/print-ticket';
import { buildReportWorkbook } from '@/lib/reports/excel';
import { createFindBreaker } from '@/lib/calculations/feeders';
import { generateDrawingsPdf } from '@/lib/drawings/drawings-pdf';
import { safeFilename, storeArtifact } from '../artifacts';
import type { AgentApi } from '../client/agent-api-client';
import { McpToolError, type McpCtx } from '../context';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Export tools.
 *
 * Every one of them calls `ensureFresh()` first. Most report schedules read the
 * stored `FloorItem` columns rather than recomputing, so exporting without this
 * would produce a confident, wrong submittal — the single worst failure mode for
 * an agent-driven workflow.
 *
 * Binaries are stored as artifacts and returned as a download URL, because MCP
 * tool results are text or JSON.
 */

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
};

const ok = (data: unknown): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  structuredContent: data as Record<string, unknown>,
});

interface ExportDeps {
  makeCtx: () => McpCtx;
  makeApi: () => AgentApi;
  origin: string;
}

/** Load the deliverable inputs, or fail the tool with a clear message. */
async function loadExportInputs(api: AgentApi, projectId: string) {
  const data = await api.loadReportBundle(projectId);
  if (!data) throw new McpToolError('Project not found.', 404);
  return {
    project: data.project,
    company: { companyName: data.companyName, logoUrl: data.companyLogoUrl },
    equipment: data.equipment,
    breakerSettings: data.breakerSettings,
    revisions: data.revisions,
  };
}

export function registerExportTools(server: McpServer, deps: ExportDeps) {
  // ------------------------------------------------------------- report PDF
  server.registerTool(
    'procal_export_report_pdf',
    {
      title: 'Export the engineering report PDF',
      description:
        'Generate the multi-page A4-landscape engineering package: cover, load analysis, MDB schedule, cable schedule, breaker and selectivity schedule, voltage drop, short-circuit, and bill of materials. Recalculates first if the stored numbers are stale. Returns a download URL.',
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: {
        projectId: z.string().uuid(),
        buildingId: z.string().uuid().optional().describe('Limit schedules to one building.'),
      },
    },
    async ({ projectId, buildingId }) => {
      const ctx = deps.makeCtx();
      await ctx.resolveProject(projectId, { pageKey: 'reports', requiredAction: 'VIEW' });

      const fresh = await deps.makeApi().recalculateProject(projectId);
      const { project } = await loadExportInputs(deps.makeApi(), projectId);

      // The report schedules are client components (the "Show Your Work" trace
      // popover), so rendering them with renderToStaticMarkup throws on a real
      // Next build. Drive the print route in headless Chromium instead; it renders
      // the same components and reuses the browser-POST export's wrapping.
      const ticket = createPrintTicket({
        projectId,
        userId: ctx.user.id,
        ...(buildingId ? { buildingId } : {}),
        manufacturer: project.preferredManufacturer,
      });
      const printUrl = `${deps.origin}/print/report?ticket=${encodeURIComponent(ticket)}`;

      const pdf = await generateReportPdfFromPrintRoute(
        printUrl,
        `${project.name} - Engineering Package`
      );
      const filename = `${safeFilename(project.name)}_Engineering_Package.pdf`;
      const artifact = await storeArtifact({
        ctx,
        projectId,
        kind: 'report_pdf',
        filename,
        mime: 'application/pdf',
        data: pdf,
      });

      await logProjectActivity({
        projectId,
        userId: ctx.user.id,
        userName: ctx.user.name || ctx.user.username,
        userRole: 'ENGINEER',
        action: 'UPDATE',
        entityType: 'PROJECT',
        entityId: projectId,
        description: `Exported engineering report PDF via MCP`,
        details: { source: 'mcp', sizeBytes: artifact.sizeBytes },
      });

      return ok({
        projectId,
        filename: artifact.filename,
        downloadUrl: artifact.downloadUrl(deps.origin),
        sizeBytes: artifact.sizeBytes,
        expiresAt: artifact.expiresAt,
        recalculated: fresh,
        pages: 'cover + 8 schedules',
      });
    }
  );

  // -------------------------------------------------------------- Excel
  server.registerTool(
    'procal_export_excel',
    {
      title: 'Export the schedules workbook',
      description:
        'Generate the multi-sheet Excel workbook: project, load analysis, MDB, cable, breaker, voltage drop, short-circuit, and three BOM sheets. Recalculates first if stale. Returns a download URL.',
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: { projectId: z.string().uuid() },
    },
    async ({ projectId }) => {
      const ctx = deps.makeCtx();
      await ctx.resolveProject(projectId, { pageKey: 'reports', requiredAction: 'VIEW' });

      const fresh = await deps.makeApi().recalculateProject(projectId);
      const { project, equipment, breakerSettings } = await loadExportInputs(deps.makeApi(), projectId);

      const findBreaker = createFindBreaker(
        equipment as never,
        {
          ACB: project.defaultAcbFamilyId ?? undefined,
          MCCB: project.defaultMccbFamilyId ?? undefined,
          MCB: project.defaultMcbFamilyId ?? undefined,
        },
        project.preferredManufacturer
      );

      // Server-side, so the ~1 MB SheetJS bundle is not in the client chunk.
      const XLSX = await import('xlsx');
      const workbook = buildReportWorkbook(project as never, findBreaker, breakerSettings);
      const data = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

      const filename = `${safeFilename(project.name)}_Schedules.xlsx`;
      const artifact = await storeArtifact({
        ctx,
        projectId,
        kind: 'excel',
        filename,
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        data,
      });

      return ok({
        projectId,
        filename: artifact.filename,
        downloadUrl: artifact.downloadUrl(deps.origin),
        sizeBytes: artifact.sizeBytes,
        expiresAt: artifact.expiresAt,
        recalculated: fresh,
        sheets: workbook.SheetNames,
      });
    }
  );

  // -------------------------------------------------------------- Drawings
  server.registerTool(
    'procal_export_drawings_pdf',
    {
      title: 'Export the drawings PDF',
      description:
        'Generate the drawing pack: one landscape A4 sheet per SLD floor (so a 20-storey tower is 20 sheets) plus paginated riser diagrams, one per building. Uses the same styling as the engineering report. Recalculates first if stale. Returns a download URL.',
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: {
        projectId: z.string().uuid(),
        buildingId: z.string().uuid().optional().describe('Limit the pack to one building.'),
      },
    },
    async ({ projectId, buildingId }) => {
      const ctx = deps.makeCtx();
      await ctx.resolveProject(projectId, { pageKey: 'sldDesigner', requiredAction: 'VIEW' });

      const fresh = await deps.makeApi().recalculateProject(projectId);
      const { project, equipment, breakerSettings, company } = await loadExportInputs(deps.makeApi(), projectId);

      const result = await generateDrawingsPdf({
        project: project as never,
        equipment: equipment as never,
        breakerSettings,
        buildingId,
        companyName: company?.companyName,
      });

      const filename = `${safeFilename(project.name)}_Drawings.pdf`;
      const artifact = await storeArtifact({
        ctx,
        projectId,
        kind: 'drawings_pdf',
        filename,
        mime: 'application/pdf',
        data: result.pdf,
      });

      return ok({
        projectId,
        filename: artifact.filename,
        downloadUrl: artifact.downloadUrl(deps.origin),
        sizeBytes: artifact.sizeBytes,
        expiresAt: artifact.expiresAt,
        recalculated: fresh,
        sldSheets: (result.svgs?.length ?? 0) || result.sheetCount - result.riserSheetCount,
        riserSheets: result.riserSheetCount,
        totalSheets: result.sheetCount,
        schematexDiagnostics: result.diagnostics,
      });
    }
  );
}
