import { NextResponse } from "next/server";
import { getSessionUser, generateApiKey } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const keys = await db.apiKey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ keys });
  } catch (error: unknown) {
    console.error("GET /api/api-keys error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const rawName = typeof body?.name === "string" ? body.name.trim() : "";
    const name = rawName.length > 0 ? rawName.slice(0, 50) : "MCP Agent";

    // Limit active keys to 25 per user
    const activeCount = await db.apiKey.count({
      where: { userId: user.id, revokedAt: null },
    });

    if (activeCount >= 25) {
      return NextResponse.json(
        { error: "Maximum active API keys reached (25). Please revoke unused keys." },
        { status: 400 }
      );
    }

    const { rawKey, keyPrefix, keyHash } = generateApiKey();

    const created = await db.apiKey.create({
      data: {
        userId: user.id,
        name,
        keyPrefix,
        keyHash,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        apiKey: created,
        rawKey, // Returned ONLY once upon creation
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("POST /api/api-keys error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    let id = url.searchParams.get("id");

    if (!id) {
      const body = await request.json().catch(() => ({}));
      if (typeof body?.id === "string") {
        id = body.id;
      }
    }

    if (!id) {
      return NextResponse.json({ error: "API key ID is required" }, { status: 400 });
    }

    const existing = await db.apiKey.findUnique({
      where: { id },
      select: { id: true, userId: true, revokedAt: true },
    });

    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    if (existing.revokedAt) {
      return NextResponse.json({ success: true, message: "API key already revoked" });
    }

    await db.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: "API key revoked successfully" });
  } catch (error: unknown) {
    console.error("DELETE /api/api-keys error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
