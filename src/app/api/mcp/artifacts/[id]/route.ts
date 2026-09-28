import { NextResponse } from 'next/server';
import { readArtifact, safeFilename } from '@/mcp/artifacts';
import { resolveMcpActor } from '@/lib/mcp-auth';
import { getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * Download a file produced by an MCP export tool (Task 5 Step 5).
 *
 * Accepts either credential:
 *  - the MCP bearer token, so an agent can fetch the file without a browser;
 *  - the session cookie, so the user can click the URL the agent gave them.
 *
 * Ownership is enforced in both cases, and expired artifacts are not served.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const actor = await resolveMcpActor(request);
    const sessionUser = actor ?? (await getSessionUser());

    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const artifact = await readArtifact(sessionUser.id, id);
    if (!artifact) {
      return NextResponse.json(
        { error: "Artifact not found, expired, or not yours" },
        { status: 404 }
      );
    }

    // Legacy rows may predate the expiry column being set; backfill lazily.
    if (!artifact.expiresAt) {
      void db.mcpArtifact
        .update({
          where: { id: artifact.id },
          data: { expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        })
        .catch(() => undefined);
    }

    return new Response(new Uint8Array(artifact.bytes), {
      status: 200,
      headers: {
        "Content-Type": artifact.mime,
        "Content-Disposition": `attachment; filename="${safeFilename(artifact.filename)}"`,
        "Content-Length": String(artifact.bytes.byteLength),
        "Cache-Control": "no-store, private",
      },
    });
  } catch (error) {
    console.error("GET /api/mcp/artifacts/[id] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
