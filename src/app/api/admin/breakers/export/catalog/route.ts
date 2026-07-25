import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const HEADERS = [
  "manufacturer",
  "category",
  "series",
  "model",
  "ratedCurrent",
  "poles",
  "breakingCapacity",
  "tripUnit",
  "settingsJson",
  "datasheetUrl",
];

function escapeCsv(value: string | number | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

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
    const gate = await requireAdmin();
    if (gate instanceof NextResponse) return gate;

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
      orderBy: [
        { manufacturer: "asc" },
        { category: "asc" },
        { series: "asc" },
        { ratedCurrent: "asc" },
        { poles: "asc" },
      ],
    });

    if (searchTerm) {
      items = items.filter(
        (i) =>
          i.model.toLowerCase().includes(searchTerm) ||
          i.series.toLowerCase().includes(searchTerm)
      );
    }

    const lines = [HEADERS.join(",")];
    for (const item of items) {
      lines.push(
        HEADERS.map((h) => {
          const value = (item as Record<string, string | number | null>)[h];
          return escapeCsv(value);
        }).join(",")
      );
    }

    const csv = lines.join("\n") + "\n";
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="procal-breaker-catalog.csv"',
      },
    });
  } catch (error) {
    console.error("GET admin/breakers/export/catalog error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
