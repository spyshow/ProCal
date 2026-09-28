import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { listMcpTokens, mintMcpToken, revokeMcpToken } from '@/lib/mcp-auth';

/**
 * Personal Access Tokens for the MCP server.
 *
 * Cookie-authenticated, unlike `POST /api/mcp` which takes a bearer token.
 * `POST` is the only place a raw secret is ever returned.
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ tokens: await listMcpTokens(user.id) });
  } catch (error) {
    console.error("GET /api/mcp/tokens Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Token name is required" }, { status: 400 });
    }
    if (name.length > 80) {
      return NextResponse.json({ error: "Token name is too long" }, { status: 400 });
    }

    const { token, record } = await mintMcpToken(user.id, name);

    // `token` is shown exactly once. It is not recoverable afterwards.
    return NextResponse.json({ token, record }, { status: 201 });
  } catch (error) {
    console.error("POST /api/mcp/tokens Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Token id is required" }, { status: 400 });
    }

    const revoked = await revokeMcpToken(user.id, id);
    if (!revoked) {
      return NextResponse.json(
        { error: "Token not found, already revoked, or not yours" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/mcp/tokens Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
