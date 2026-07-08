import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const item = await db.floorItem.findUnique({
      where: { id },
      include: { floorDesign: { include: { building: { include: { project: true } } } } },
    });

    if (!item || item.floorDesign.building.project.userId !== user.id) {
      return NextResponse.json({ error: "Floor item not found" }, { status: 404 });
    }

    await db.floorItem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Floor Item Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
