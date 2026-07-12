import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { upsertBreakerFamilies, getFamilyKey } from "@/lib/breaker-families";

type Where = {
  category?: string | { in: string[] };
  manufacturer?: string;
  ratedCurrent?: { gte?: number; lte?: number };
  familyId?: string | null;
  OR?: Array<{
    model?: { contains: string; mode: "insensitive" };
    series?: { contains: string; mode: "insensitive" };
  }>;
};

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const manufacturer = searchParams.get("manufacturer");
    const familyId = searchParams.get("familyId");
    const minCurrent = searchParams.get("minCurrent");
    const maxCurrent = searchParams.get("maxCurrent");
    const search = searchParams.get("search");

    const where: Where = {};

    if (category) {
      const categories = category
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);
      where.category = categories.length === 1 ? categories[0] : { in: categories };
    }

    if (manufacturer && manufacturer.toUpperCase() !== "MIXED") {
      where.manufacturer = manufacturer;
    }

    if (familyId) {
      where.familyId = familyId === "null" ? null : familyId;
    }

    if (minCurrent || maxCurrent) {
      where.ratedCurrent = {};
      if (minCurrent) where.ratedCurrent.gte = parseFloat(minCurrent);
      if (maxCurrent) where.ratedCurrent.lte = parseFloat(maxCurrent);
    }

    const searchTerm = search?.trim().toLowerCase();

    let items = await db.equipmentCatalog.findMany({
      where,
      include: { family: true },
      orderBy: [
        { manufacturer: "asc" },
        { category: "asc" },
        { ratedCurrent: "asc" },
      ],
    });

    if (searchTerm) {
      items = items.filter(
        (i) =>
          i.model.toLowerCase().includes(searchTerm) ||
          i.series.toLowerCase().includes(searchTerm)
      );
    }

    return NextResponse.json(
      items.map((i) => ({
        ...i,
        familyId: i.family?.id ?? null,
        familyName: i.family?.name ?? null,
      }))
    );
  } catch (error) {
    console.error("GET admin/breakers error:", error);
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

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const data = await request.json();
    const parsed = parseBreaker(data);

    const familyIdByKey = await upsertBreakerFamilies(db, [parsed]);
    const familyId = familyIdByKey.get(getFamilyKey(parsed.manufacturer, parsed.category, parsed.series));

    const item = await db.equipmentCatalog.create({
      data: { ...parsed, familyId },
      include: { family: true },
    });

    return NextResponse.json(
      { ...item, familyId: item.family?.id ?? null, familyName: item.family?.name ?? null },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST admin/breakers error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const singleId = searchParams.get("id");

    if (singleId) {
      await db.equipmentCatalog.delete({ where: { id: singleId } });
      return NextResponse.json({ success: true });
    }

    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "No ids provided" }, { status: 400 });
    }

    const result = await db.equipmentCatalog.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ success: true, deleted: result.count });
  } catch (error) {
    console.error("DELETE admin/breakers error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
