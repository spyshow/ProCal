import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { handleMcpRequest, type JsonRpcRequest } from "@/lib/mcp/server";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    const body = (await request.json().catch(() => null)) as JsonRpcRequest | null;

    if (!user) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: body?.id ?? null,
          error: {
            code: -32000,
            message:
              "Unauthorized: Missing or invalid API key. Please provide Authorization: Bearer procal_sk_... or x-api-key header.",
          },
        },
        { status: 401 }
      );
    }

    if (!body || typeof body !== "object" || !body.method) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32600,
            message: "Invalid Request: expected a valid JSON-RPC 2.0 request object with 'method'",
          },
        },
        { status: 400 }
      );
    }

    const origin = new URL(request.url).origin;
    const response = await handleMcpRequest(body, user, origin);

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("POST /api/mcp error:", error);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: "Internal server error processing MCP request",
        },
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: "ProCal Model Context Protocol (MCP) Server",
    status: "active",
    protocolVersion: "2024-11-05",
    description:
      "Send JSON-RPC 2.0 POST requests with 'Authorization: Bearer procal_sk_...' to interact with ProCal tools and prompts.",
  });
}
