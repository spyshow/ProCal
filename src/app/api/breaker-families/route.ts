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

    const where: {
      category?: string;
      manufacturer?: string;
    } = {};

    if (category) {
      where.category = category.toUpperCase();
    }

    if (manufacturer && manufacturer.toUpperCase() !== "MIXED") {
      where.manufacturer = manufacturer.toUpperCase();
    }

    const families = await db.breakerFamily.findMany({
      where,
      orderBy: [
        { manufacturer: "asc" },
        { category: "asc" },
        { name: "asc" },
      ],
    });

    return NextResponse.json(families);
  } catch (error) {
    console.error("GET Breaker Families Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
