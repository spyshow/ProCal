import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { upsertBreakerFamilies, getFamilyKey } from "@/lib/breaker-families";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const item = await db.equipmentCatalog.findUnique({
      where: { id },
      include: { family: true },
    });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      ...item,
      familyId: item.family?.id ?? null,
      familyName: item.family?.name ?? null,
    });
  } catch (error) {
    console.error("GET admin/breakers/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

function parseBreaker(data: Record<string, unknown>) {
  return {
    category: String(data.category || "").toUpperCase(),
    manufacturer: String(data.manufacturer || ""),
    series: String(data.series || ""),
    model: String(data.model || ""),
    ratedCurrent: parseFloat(String(data.ratedCurrent || "0")),
    poles: parseInt(String(data.poles || "3"), 10),
    breakingCapacity: parseFloat(String(data.breakingCapacity || "0")),
    tripUnit: data.tripUnit ? String(data.tripUnit) : null,
    settingsJson: data.settingsJson ? String(data.settingsJson) : null,
    datasheetUrl: data.datasheetUrl ? String(data.datasheetUrl) : null,
  };
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const data = await request.json();
    const parsed = parseBreaker(data);

    const familyIdByKey = await upsertBreakerFamilies(db, [parsed]);
    const familyId = familyIdByKey.get(getFamilyKey(parsed.manufacturer, parsed.category, parsed.series));

    const item = await db.equipmentCatalog.update({
      where: { id },
      data: { ...parsed, familyId },
      include: { family: true },
    });

    return NextResponse.json({
      ...item,
      familyId: item.family?.id ?? null,
      familyName: item.family?.name ?? null,
    });
  } catch (error) {
    console.error("PUT admin/breakers/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await db.equipmentCatalog.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE admin/breakers/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
