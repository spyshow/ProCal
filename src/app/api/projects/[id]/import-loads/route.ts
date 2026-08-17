import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { sizeCableAndBreaker } from "@/lib/calculations/cables";

/**
 * Import a client load list (xlsx) into a building.
 *
 * Expected sheet columns (header row, order-insensitive, case-insensitive):
 *   Floor (required)  — floor number; must exist in the target building
 *   Name / Load Name  — circuit / load description (required)
 *   kW                — connected power per unit (required)
 *   Type              — MANUAL | SERVICE_PANEL | PUMP_PANEL | ELEVATOR_PANEL (default MANUAL)
 *   Quantity / Qty    — unit count (default 1)
 *   Material          — Copper | Aluminum (default Copper)
 *
 * Rows are created as manual custom loads using the same demand/current math
 * as POST /api/floors/[id]/items (manual branch), so the imported items size
 * breakers and cables exactly like manually-entered loads.
 */

interface ImportRow {
  floor: number;
  name: string;
  kw: number;
  type: "MANUAL" | "SERVICE_PANEL" | "PUMP_PANEL" | "ELEVATOR_PANEL";
  quantity: number;
  material: "copper" | "aluminum";
}

interface ImportResult {
  created: number;
  skipped: { row: number; reason: string }[];
  floorsMissing: number[];
}

function normalizeHeader(header: unknown): string {
  return String(header ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const HEADER_ALIASES: Record<string, string[]> = {
  floor: ["floor", "floorno", "floornumber"],
  name: ["name", "loadname", "description", "load", "circuit"],
  kw: ["kw", "powerkw", "power", "loadkw", "kwperunit"],
  type: ["type", "loadtype"],
  quantity: ["quantity", "qty", "count", "units"],
  material: ["material", "cablenaterial", "cablematerial"],
};

function resolveColumn(header: string): string | null {
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(header)) return key;
  }
  return null;
}

function parseRow(raw: Record<string, unknown>, rowNumber: number): { row: ImportRow; error?: string } {
  const cells = new Map<string, unknown>();
  for (const [key, value] of Object.entries(raw)) {
    const col = resolveColumn(normalizeHeader(key));
    if (col) cells.set(col, value);
  }

  const floor = Number(cells.get("floor"));
  if (!Number.isFinite(floor) || floor <= 0) {
    return { row: {} as ImportRow, error: `row ${rowNumber}: missing or invalid "Floor"` };
  }

  const name = String(cells.get("name") ?? "").trim();
  if (!name) {
    return { row: {} as ImportRow, error: `row ${rowNumber}: missing "Name"` };
  }

  const kw = Number(cells.get("kw"));
  if (!Number.isFinite(kw) || kw <= 0) {
    return { row: {} as ImportRow, error: `row ${rowNumber}: missing or invalid "kW"` };
  }

  let type: ImportRow["type"] = "MANUAL";
  const rawType = normalizeHeader(String(cells.get("type") ?? ""));
  if (rawType === "servicepanel" || rawType === "service") type = "SERVICE_PANEL";
  else if (rawType === "pumppanel" || rawType === "pump") type = "PUMP_PANEL";
  else if (rawType === "elevatorpanel" || rawType === "elevator" || rawType === "lift") type = "ELEVATOR_PANEL";

  const quantity = Math.max(1, Number(cells.get("quantity")) || 1);

  const rawMaterial = normalizeHeader(String(cells.get("material") ?? ""));
  const material: "copper" | "aluminum" =
    rawMaterial.startsWith("al") ? "aluminum" : "copper";

  return { row: { floor, name, kw, type, quantity, material } };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;
    const form = await request.formData();
    const file = form.get("file");
    const buildingId = String(form.get("buildingId") ?? "");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Excel file is required" }, { status: 400 });
    }
    if (!buildingId) {
      return NextResponse.json({ error: "Building is required" }, { status: 400 });
    }

    const project = await db.project.findUnique({
      where: { id: projectId, userId: user.id },
      include: {
        buildings: { include: { floorDesigns: { select: { id: true, floorNumber: true } } } },
      },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const building = project.buildings.find((b) => b.id === buildingId);
    if (!building) {
      return NextResponse.json({ error: "Building not found in project" }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: "buffer" });
    } catch {
      return NextResponse.json(
        { error: "Could not read file — expected an .xlsx workbook" },
        { status: 400 }
      );
    }

    const sheetName =
      workbook.SheetNames.find((s) => s.toLowerCase().includes("load")) ??
      workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ error: "Workbook has no sheets" }, { status: 400 });
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });

    // Reject files that don't carry a load-list header (Floor + Name/KW).
    const hasRecognizableHeader = rawRows.some((raw) => {
      const keys = Object.keys(raw).map(normalizeHeader);
      return keys.some((k) => HEADER_ALIASES.floor.includes(k));
    });
    if (!hasRecognizableHeader) {
      return NextResponse.json(
        {
          error:
            "Sheet does not look like a load list — expected columns: Floor, Name, kW, Type, Quantity, Material",
        },
        { status: 400 }
      );
    }

    const result: ImportResult = { created: 0, skipped: [], floorsMissing: [] };
    const voltageKv = project.voltage / 1000;
    const powerFactor = project.powerFactor;
    const floorByNumber = new Map(
      building.floorDesigns.map((fd) => [fd.floorNumber, fd])
    );

    const creates: Promise<void>[] = [];
    rawRows.forEach((raw, idx) => {
      const rowNumber = idx + 2; // 1-indexed + header row
      const parsed = parseRow(raw, rowNumber);
      if (parsed.error) {
        result.skipped.push({ row: rowNumber, reason: parsed.error });
        return;
      }
      const { row } = parsed;

      const floorDesign = floorByNumber.get(row.floor);
      if (!floorDesign) {
        if (!result.floorsMissing.includes(row.floor)) {
          result.floorsMissing.push(row.floor);
        }
        result.skipped.push({
          row: rowNumber,
          reason: `floor ${row.floor} does not exist in "${building.name}"`,
        });
        return;
      }

      // Manual-branch math — mirrors POST /api/floors/[id]/items.
      let kw = row.kw;
      let df = 1.0;
      if (row.type === "SERVICE_PANEL") { kw = kw || 15; df = 0.8; }
      else if (row.type === "PUMP_PANEL") { kw = kw || 7.5; df = 1.0; }
      else if (row.type === "ELEVATOR_PANEL") { kw = kw || 22; df = 0.8; }

      const calculatedConnectedLoad = kw * row.quantity;
      const calculatedMaxDemand = calculatedConnectedLoad * df;
      const calculatedCurrent = parseFloat(
        (calculatedMaxDemand / (Math.sqrt(3) * voltageKv * powerFactor)).toFixed(2)
      );

      const sizing = sizeCableAndBreaker(calculatedCurrent, true, {
        material: row.material,
        insulation: "XLPE",
        ambientTemp: 30,
        groupingCount: 2,
        installMethod: "C",
      });

      creates.push(
        db.floorItem
          .create({
            data: {
              type: row.type,
              name: row.name,
              floorDesignId: floorDesign.id,
              calculatedConnectedLoad,
              calculatedMaxDemand,
              calculatedCurrent,
              breakerSize: `${sizing.breakerSize}A`,
              cableSize: sizing.formattedCableSize,
              cableMaterial: row.material,
              voltageDrop: 0.1,
            },
          })
          .then(() => { result.created += 1; })
          .catch((err) => {
            console.error("Import FloorItem create error:", err);
            result.skipped.push({ row: rowNumber, reason: "DB write failed" });
          })
      );
    });

    await Promise.all(creates);
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST Import Loads Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
