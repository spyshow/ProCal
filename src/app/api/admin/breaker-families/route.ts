import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

type Where = {
  category?: string;
  manufacturer?: string;
};

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const manufacturer = searchParams.get("manufacturer");

    const where: Where = {};
    if (category) where.category = category.toUpperCase();
    if (manufacturer && manufacturer.toUpperCase() !== "MIXED") {
      where.manufacturer = manufacturer;
    }

    const families = await db.breakerFamily.findMany({
      where,
      include: { _count: { select: { catalogItems: true } } },
      orderBy: [{ manufacturer: "asc" }, { category: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(
      families.map((f) => ({
        ...f,
        catalogItemCount: f._count.catalogItems,
      }))
    );
  } catch (error) {
    console.error("GET admin/breaker-families error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const data = await request.json();
    const family = await db.breakerFamily.create({
      data: {
        manufacturer: data.manufacturer,
        category: data.category.toUpperCase(),
        name: data.name,
      },
    });
    return NextResponse.json(family, { status: 201 });
  } catch (error) {
    console.error("POST admin/breaker-families error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
