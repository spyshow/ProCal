import { NextResponse } from "next/server";
import { getSessionUser, getUserByApiKey } from "@/lib/auth";
import { handleMcpRequest, type JsonRpcRequest } from "@/lib/mcp/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const queryKey = url.searchParams.get("key") || url.searchParams.get("apiKey");
    let user = queryKey ? await getUserByApiKey(queryKey) : null;
    if (!user) {
      user = await getSessionUser();
    }

    const body = (await request.json().catch(() => null)) as JsonRpcRequest | null;

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
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const origin = url.origin;
    const response = await handleMcpRequest(body, user, origin);

    return NextResponse.json(response, { headers: CORS_HEADERS });
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
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      name: "ProCal Model Context Protocol (MCP) Server",
      status: "active",
      protocolVersion: "2024-11-05",
      description:
        "Send JSON-RPC 2.0 POST requests with 'Authorization: Bearer procal_sk_...' or '?key=procal_sk_...' to interact with ProCal tools and prompts.",
    },
    { headers: CORS_HEADERS }
  );
}
