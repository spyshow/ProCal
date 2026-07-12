import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

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

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const csv = HEADERS.join(",") + "\n";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="procal-breaker-template.csv"',
    },
  });
}
