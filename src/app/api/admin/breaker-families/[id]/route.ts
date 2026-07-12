import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const family = await db.breakerFamily.findUnique({
      where: { id },
      include: { _count: { select: { catalogItems: true } } },
    });
    if (!family) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      ...family,
      catalogItemCount: family._count.catalogItems,
    });
  } catch (error) {
    console.error("GET admin/breaker-families/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const data = await request.json();
    const family = await db.breakerFamily.update({
      where: { id },
      data: {
        manufacturer: data.manufacturer,
        category: data.category?.toUpperCase(),
        name: data.name,
      },
    });
    return NextResponse.json(family);
  } catch (error) {
    console.error("PUT admin/breaker-families/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const count = await db.equipmentCatalog.count({ where: { familyId: id } });
    if (count > 0) {
      return NextResponse.json(
        { error: `Cannot delete family: ${count} catalog items still reference it.` },
        { status: 409 }
      );
    }

    await db.breakerFamily.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE admin/breaker-families/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
