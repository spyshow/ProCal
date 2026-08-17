import * as XLSX from "xlsx";
import type { Project } from "@/types";
import type { FindBreaker } from "@/lib/calculations/feeders";import { aggregateBOM,
  aggregateFeederRows,
  aggregateCableRows,
  aggregateBreakerRows,
  aggregateVoltageDropRows,
} from "./aggregates";
import { phaseBalance } from "@/lib/calculations/phaseBalance";
import { sizeTransformer } from "@/lib/calculations/loads";

export type { FindBreaker };

/**
 * Build a multi-sheet .xlsx workbook from a project's report schedules.
 *
 * Sheets: Project (summary), BOM, MDB Schedule, Cable Schedule, Breaker
 * Schedule, Voltage Drop. Uses the same aggregates as the printable report so
 * the Excel export and the PDF always agree.
 */
export function buildReportWorkbook(
  project: Project,
  findBreaker: FindBreaker
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  appendSheet(wb, "Project", buildProjectRows(project));
  appendSheet(wb, "BOM", buildBomRows(project));
  appendSheet(
    wb,
    "MDB Schedule",
    aggregateFeederRows(project, findBreaker).map((r) => ({
      "#": r.index,
      Building: r.buildingName,
      Floor: r.floor === 0 ? "—" : r.floor,
      Feeder: r.feeder,
      Type: r.type,
      "Demand (kW)": round(r.demandKw, 2),
      "Current (A)": round(r.current, 1),
      Breaker: r.breakerAmps,
      Cable: r.cableMm2,
      "Breaker Model": r.breakerModel,
      Phase: r.isThreePhase ? "3Φ" : "1Φ",
    }))
  );
  appendSheet(
    wb,
    "Cable Schedule",
    aggregateCableRows(project).map((r) => ({
      Circuit: r.circuit,
      Building: r.buildingName,
      Floor: r.floor,
      Phase: `${r.phase}Φ`,
      "Current (A)": round(r.current, 1),
      "Breaker (A)": r.breakerAmps,
      "Cable (mm²)": r.cableMm2,
      Method: r.method,
      Insulation: r.insulation,
      Material: r.material === "aluminum" ? "Aluminum" : "Copper",
    }))
  );
  appendSheet(
    wb,
    "Breaker Schedule",
    aggregateBreakerRows(project, findBreaker).map((r) => ({
      Feeder: r.feeder,
      Building: r.buildingName,
      Floor: r.floor === 0 ? "—" : r.floor,
      Type: r.type,
      "Current (A)": round(r.current, 1),
      Breaker: r.breakerAmps,
      Cable: r.cableMm2,
      Model: r.breakerModel,
      Phase: r.isThreePhase ? "3Φ" : "1Φ",
    }))
  );
  appendSheet(
    wb,
    "Voltage Drop",
    aggregateVoltageDropRows(project).map((r) => ({
      Circuit: r.circuit,
      Building: r.buildingName,
      Floor: r.floor,
      "Current (A)": round(r.current, 1),
      "Cable (mm²)": r.cableMm2,
      "Length (m)": round(r.lengthMeters, 1),
      "Voltage Drop (%)": round(r.voltageDropPercent, 2),
      Status: r.status,
    }))
  );

  return wb;
}

/** Project metadata + per-building summary sheet. */
function buildProjectRows(project: Project): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = [
    { Field: "Project", Value: project.name },
    { Field: "Client", Value: project.client },
    { Field: "Consultant", Value: project.consultant },
    { Field: "Contractor", Value: project.contractor },
    { Field: "Location", Value: project.location },
    { Field: "Engineer", Value: project.engineer },
    { Field: "Date", Value: project.date || new Date().toLocaleDateString() },
    { Field: "System", Value: `${project.voltage}V / ${project.frequency}Hz / PF ${project.powerFactor}` },
    { Field: "Calculation Standard", Value: project.calculationStandard ?? "IEC" },
    { Field: "Transformer", Value: `${project.transformerSize ?? sizeTransformer(
      (project.buildings.reduce((sum, b) => {
        const items = [...b.floorDesigns.flatMap((fd) => fd.items), ...(b.buildingLoads ?? [])];
        return sum + phaseBalance(items as never, project as never).totalKw;
      }, 0) / (project.powerFactor || 0.85))
    )} kVA` },
    { Field: "", Value: "" },
  ];

  // Building summary block (same numbers as the Project Summary tab).
  for (const bldg of project.buildings) {
    const items = [...bldg.floorDesigns.flatMap((fd) => fd.items), ...(bldg.buildingLoads ?? [])];
    const balance = phaseBalance(items as never, project as never);
    rows.push({
      Field: bldg.name,
      Floors: bldg.floors,
      "Apts/Floor": bldg.apartmentsPerFloor,
      "Total Apts": bldg.floors * bldg.apartmentsPerFloor,
      "Demand (kW)": round(balance.totalKw, 1),
      "Main Current (A)": round(balance.maxPhaseCurrent, 1),
    });
  }

  return rows;
}

/** BOM sheet rows (cables + breakers). */
function buildBomRows(project: Project): Record<string, string | number>[] {
  const bom = aggregateBOM(project);
  const rows: Record<string, string | number>[] = [];

  rows.push({ "BOM — Cables": "" });
  for (const c of bom.cables) {
    rows.push({
      "Cable (mm²)": c.size,
      Count: c.count,
      "Total Length (m)": c.totalLength,
    });
  }

  rows.push({ "BOM — Breakers": "" });
  for (const b of bom.breakers) {
    rows.push({
      "Breaker (A)": b.rating,
      Count: b.count,
      "Total Length (m)": b.totalLength,
    });
  }

  return rows;
}

function appendSheet(
  wb: XLSX.WorkBook,
  name: string,
  rows: Record<string, string | number>[]
): void {
  const ws = XLSX.utils.json_to_sheet(rows);
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 12) }));
  XLSX.utils.book_append_sheet(wb, ws, name);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
