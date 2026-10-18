#!/usr/bin/env node

/**
 * ProCal MCP Stdio Bridge
 *
 * Lightweight, zero-DB-dependency stdio bridge that connects Claude Desktop,
 * Cursor, or custom local AI agents to the ProCal MCP API over HTTP.
 *
 * Usage:
 *   npx -y tsx scripts/procal-mcp-stdio.ts
 *
 * Environment variables:
 *   PROCAL_API_KEY: Secret key starting with procal_sk_... (required)
 *   PROCAL_URL: URL of your ProCal server (default: http://localhost:3000)
 */

import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";

const apiKey = process.env.PROCAL_API_KEY;
const procalUrl = (process.env.PROCAL_URL || "http://localhost:3000").replace(/\/+$/, "");

if (!apiKey) {
  process.stderr.write(
    "[ProCal MCP Stdio Bridge] Error: PROCAL_API_KEY environment variable is required.\n" +
      "Generate an API key in ProCal under Account Settings -> AI & MCP API Keys.\n"
  );
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const rpcRequest = JSON.parse(trimmed);

    // Forward JSON-RPC request to ProCal /api/mcp endpoint
    const response = await fetch(`${procalUrl}/api/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(rpcRequest),
    });

    const rpcResponse = await response.json();

    // Check if user requested local file output in tool arguments
    if (
      rpcRequest.method === "tools/call" &&
      rpcResponse.result?.content?.[0]?.text &&
      rpcRequest.params?.arguments?.outputFilePath
    ) {
      try {
        const outPath = path.resolve(process.cwd(), String(rpcRequest.params.arguments.outputFilePath));
        const parsedContent = JSON.parse(rpcResponse.result.content[0].text);

        if (parsedContent.overviewDiagram?.svg && outPath.endsWith(".svg")) {
          fs.writeFileSync(outPath, parsedContent.overviewDiagram.svg, "utf8");
          process.stderr.write(`[ProCal MCP] Wrote SLD diagram to ${outPath}\n`);
        } else if (parsedContent.base64Pdf && outPath.endsWith(".pdf")) {
          fs.writeFileSync(outPath, Buffer.from(parsedContent.base64Pdf, "base64"));
          process.stderr.write(`[ProCal MCP] Wrote PDF report to ${outPath}\n`);
        }
      } catch (fileErr) {
        process.stderr.write(`[ProCal MCP] Warning: failed to write outputFilePath: ${fileErr}\n`);
      }
    }

    process.stdout.write(JSON.stringify(rpcResponse) + "\n");
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    const errResponse = {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32603,
        message: `Stdio Bridge Error: ${errMessage}`,
      },
    };
    process.stdout.write(JSON.stringify(errResponse) + "\n");
  }
});

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
