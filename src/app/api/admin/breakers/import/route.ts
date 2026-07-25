import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { upsertBreakerFamilies, getFamilyKey } from "@/lib/breaker-families";

/**
 * Minimal RFC-4180-ish CSV parser. Handles commas and newlines inside quotes.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let insideQuotes = false;
  let quoteEscaped = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoteEscaped) {
      if (char === '"') {
        cell += '"';
        quoteEscaped = false;
      } else {
        insideQuotes = false;
        quoteEscaped = false;
        if (char === ",") {
          row.push(cell);
          cell = "";
        } else if (char === "\n" || char === "\r") {
          row.push(cell);
          cell = "";
          if (row.some((c) => c.length > 0)) rows.push(row);
          row = [];
          if (char === "\r" && text[i + 1] === "\n") i++;
        } else {
          cell += char;
        }
      }
      continue;
    }

    if (insideQuotes) {
      if (char === '"') {
        quoteEscaped = true;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      insideQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n" || char === "\r") {
      row.push(cell);
      cell = "";
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      if (char === "\r" && text[i + 1] === "\n") i++;
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((c) => c.length > 0)) rows.push(row);

  return rows;
}

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "null") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

const COLUMNS = [
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

function getColumnIndexes(header: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  for (const col of COLUMNS) {
    idx[col] = header.indexOf(col.toLowerCase());
  }
  return idx;
}

export async function POST(request: Request) {
  try {
    const gate = await requireAdmin();
    if (gate instanceof NextResponse) return gate;

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
      return NextResponse.json({ error: "CSV must contain a header row and at least one data row" }, { status: 400 });
    }

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const missing = COLUMNS.filter((c) => !header.includes(c));
    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing required columns: ${missing.join(", ")}` }, { status: 400 });
    }

    const idx = getColumnIndexes(header);

    const candidates = [];
    const errors: Array<{ row: number; message: string }> = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const manufacturer = row[idx.manufacturer]?.trim();
      const category = row[idx.category]?.trim().toUpperCase();
      const series = row[idx.series]?.trim();
      const model = row[idx.model]?.trim();
      const ratedCurrent = parseNumber(row[idx.ratedCurrent] ?? "");
      const poles = parseNumber(row[idx.poles] ?? "");
      const breakingCapacity = parseNumber(row[idx.breakingCapacity] ?? "") ?? 0;
      const tripUnit = row[idx.tripUnit]?.trim() || null;
      const settingsJson = row[idx.settingsJson]?.trim() || null;
      const datasheetUrl = row[idx.datasheetUrl]?.trim() || null;

      if (!manufacturer || !category || !series || !model) {
        errors.push({ row: r + 1, message: "Missing manufacturer, category, series, or model" });
        continue;
      }
      if (ratedCurrent == null || ratedCurrent <= 0 || !Number.isFinite(ratedCurrent)) {
        errors.push({ row: r + 1, message: "Invalid ratedCurrent" });
        continue;
      }
      if (poles == null || poles <= 0 || !Number.isInteger(poles)) {
        errors.push({ row: r + 1, message: "Invalid poles" });
        continue;
      }
      if (settingsJson) {
        try {
          JSON.parse(settingsJson);
        } catch {
          errors.push({ row: r + 1, message: "Invalid settingsJson" });
          continue;
        }
      }

      candidates.push({
        manufacturer,
        category,
        series,
        model,
        ratedCurrent,
        poles,
        breakingCapacity,
        tripUnit,
        settingsJson,
        datasheetUrl,
      });
    }

    if (errors.length > 0 && candidates.length === 0) {
      return NextResponse.json({ error: "All rows failed validation", errors }, { status: 400 });
    }

    const familyIdByKey = await upsertBreakerFamilies(
      db,
      candidates.map((c) => ({ manufacturer: c.manufacturer, category: c.category, series: c.series }))
    );

    let applied = 0;
    const upsertErrors: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const familyId = familyIdByKey.get(getFamilyKey(c.manufacturer, c.category, c.series));
      try {
        await db.equipmentCatalog.upsert({
          where: {
            catalogUniqueKey: {
              manufacturer: c.manufacturer,
              category: c.category,
              series: c.series,
              model: c.model,
              ratedCurrent: c.ratedCurrent,
              poles: c.poles,
            },
          },
          update: {
            breakingCapacity: c.breakingCapacity,
            tripUnit: c.tripUnit,
            settingsJson: c.settingsJson,
            datasheetUrl: c.datasheetUrl,
            familyId,
          },
          create: {
            manufacturer: c.manufacturer,
            category: c.category,
            series: c.series,
            model: c.model,
            ratedCurrent: c.ratedCurrent,
            poles: c.poles,
            breakingCapacity: c.breakingCapacity,
            tripUnit: c.tripUnit,
            settingsJson: c.settingsJson,
            datasheetUrl: c.datasheetUrl,
            familyId,
          },
        });
        applied++;
      } catch (err) {
        upsertErrors.push({ row: i + 2, message: err instanceof Error ? err.message : String(err) });
      }
    }

    return NextResponse.json({
      summary: {
        totalRows: rows.length - 1,
        validRows: candidates.length,
        applied,
        validationErrors: errors,
        upsertErrors,
      },
    });
  } catch (error) {
    console.error("POST admin/breakers/import error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
