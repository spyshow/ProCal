import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const manufacturer = searchParams.get("manufacturer");
    const minCurrent = searchParams.get("minCurrent");
    const maxCurrent = searchParams.get("maxCurrent");

    const where: {
      category?: { in: string[] } | string;
      ratedCurrent?: { gte?: number; lte?: number };
    } = {};

    if (category) {
      const categories = category
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);
      where.category = categories.length === 1 ? categories[0] : { in: categories };
    }

    if (minCurrent || maxCurrent) {
      where.ratedCurrent = {};
      if (minCurrent) {
        where.ratedCurrent.gte = parseFloat(minCurrent);
      }
      if (maxCurrent) {
        where.ratedCurrent.lte = parseFloat(maxCurrent);
      }
    }

    let equipment = await db.equipmentCatalog.findMany({
      where,
      include: { family: true },
      orderBy: [
        { manufacturer: "asc" },
        { category: "asc" },
        { ratedCurrent: "asc" },
      ],
    });

    if (manufacturer) {
      const mfg = manufacturer.toUpperCase();
      equipment = equipment.filter(
        (e) => e.manufacturer.toUpperCase() === mfg
      );
    }

    return NextResponse.json(
      equipment.map((e) => ({
        ...e,
        familyId: e.family?.id ?? null,
        familyName: e.family?.name ?? null,
      }))
    );
  } catch (error) {
    console.error("GET Equipment Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
