import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const data = await request.json();
    const {
      breakerId,
      model,
      manufacturer,
      frameSize,
      ir,
      tr,
      isd,
      tsd,
      i2t,
      ii,
      ig,
      tg,
    } = data;

    const settings = await db.breakerSettings.update({
      where: { id },
      data: {
        ...(breakerId && { breakerId }),
        ...(model && { model }),
        ...(manufacturer && { manufacturer }),
        ...(frameSize && { frameSize }),
        ...(ir !== undefined && { ir: parseFloat(ir) }),
        ...(tr !== undefined && { tr: parseFloat(tr) }),
        isd: isd !== undefined ? (isd ? parseFloat(isd) : null) : undefined,
        tsd: tsd !== undefined ? (tsd ? parseFloat(tsd) : null) : undefined,
        i2t: i2t !== undefined ? i2t : undefined,
        ii: ii !== undefined ? (ii ? parseFloat(ii) : null) : undefined,
        ig: ig !== undefined ? (ig ? parseFloat(ig) : null) : undefined,
        tg: tg !== undefined ? (tg ? parseFloat(tg) : null) : undefined,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("PUT BreakerSettings Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

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

    await db.breakerSettings.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE BreakerSettings Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
