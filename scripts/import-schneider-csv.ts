import fs from "fs";
import path from "path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { upsertBreakerFamilies, getFamilyKey } from "../src/lib/breaker-families";

const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
const db = new PrismaClient({ adapter });

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

async function main() {
  const csvPath = process.argv[2] || path.join(process.cwd(), "data", "schneider-breakers.csv");
  const text = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCsv(text);
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name.toLowerCase());

  const candidates = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length < header.length || row.every((cell) => cell.trim() === "")) {
      if (row.some((cell) => cell.trim() !== "")) console.warn(`Skipping row ${r + 1}: length ${row.length} < ${header.length}`);
      continue;
    }
    const manufacturer = row[idx("manufacturer")]?.trim();
    const category = row[idx("category")]?.trim().toUpperCase();
    const series = row[idx("series")]?.trim();
    const model = row[idx("model")]?.trim();
    const ratedCurrent = parseFloat(row[idx("ratedCurrent")] || "");
    const poles = parseInt(row[idx("poles")] || "", 10);
    if (!manufacturer || !category || !series || !model || !Number.isFinite(ratedCurrent) || !Number.isInteger(poles)) {
      console.warn(`Skipping invalid row ${r + 1}: mfg='${manufacturer}' cat='${category}' series='${series}' model='${model}' In=${ratedCurrent} poles=${poles}`);
      continue;
    }
    candidates.push({
      manufacturer,
      category,
      series,
      model,
      ratedCurrent,
      poles,
      breakingCapacity: parseFloat(row[idx("breakingCapacity")] || "0") || 0,
      tripUnit: row[idx("tripUnit")]?.trim() || null,
      settingsJson: row[idx("settingsJson")]?.trim() || null,
      datasheetUrl: row[idx("datasheetUrl")]?.trim() || null,
    });
  }

  const familyIdByKey = await upsertBreakerFamilies(
    db,
    candidates.map((c) => ({ manufacturer: c.manufacturer, category: c.category, series: c.series }))
  );

  let count = 0;
  for (const c of candidates) {
    const familyId = familyIdByKey.get(getFamilyKey(c.manufacturer, c.category, c.series));
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
        ...c,
        familyId,
      },
    });
    count++;
    if (count % 50 === 0) console.log(`Imported ${count} rows...`);
  }

  console.log(`Imported ${count} Schneider breaker rows into dev.db.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
