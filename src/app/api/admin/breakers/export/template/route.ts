import { NextResponse } from "next/server";
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

export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const csv = HEADERS.join(",") + "\n";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="procal-breaker-template.csv"',
    },
  });
}
