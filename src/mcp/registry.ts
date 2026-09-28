import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpCtx, type McpCtx } from './context';
import { registerDiscoverTools } from './tools/discover';
import { registerBuildTools } from './tools/build';
import { registerExportTools } from './tools/export';
import type { AuthedUser } from '@/lib/project-auth';

/**
 * Builds the MCP server for one request.
 *
 * Stateless: the endpoint constructs a fresh server (and therefore a fresh
 * context) per request. Nothing is shared between calls, so it scales and
 * survives serverless recycling.
 */

export const MCP_SERVER_NAME = 'procal';
export const MCP_SERVER_VERSION = '1.0.0';

export function createMcpServer(user: AuthedUser, origin: string): McpServer {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    {
      capabilities: { tools: {} },
      instructions:
        'ProCal is an electrical load and distribution design tool (IEC 60364-5-52, IEC 60909). ' +
        'Typical flow: procal_list_projects or procal_create_project_from_spec, then ' +
        'procal_get_design_summary to check the result, then the export tools for the ' +
        'drawings, the engineering report PDF, and the Excel schedules. ' +
        'You describe the design (rooms, areas, quantities); ProCal derives every load, ' +
        'current, breaker rating and cable size with its own calculation engine — do not ' +
        'compute or invent engineering values yourself.',
    }
  );

  const makeCtx = (): McpCtx => createMcpCtx(user);

  registerDiscoverTools(server, makeCtx);
  registerBuildTools(server, makeCtx);
  registerExportTools(server, { makeCtx, origin });

  return server;
}
