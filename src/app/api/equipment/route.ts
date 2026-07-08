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
      category?: string;
      manufacturer?: string;
      ratedCurrent?: { gte?: number; lte?: number };
    } = {};

    if (category) {
      where.category = category.toUpperCase();
    }

    if (manufacturer) {
      where.manufacturer = manufacturer.toUpperCase();
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

    const equipment = await db.equipmentCatalog.findMany({
      where,
      orderBy: [
        { manufacturer: "asc" },
        { category: "asc" },
        { ratedCurrent: "asc" },
      ],
    });

    return NextResponse.json(equipment);
  } catch (error) {
    console.error("GET Equipment Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
