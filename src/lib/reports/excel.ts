import * as XLSX from "xlsx";
import type { Project } from "@/types";
import {
  aggregateBOM,
  aggregateDetailedBOM,
  aggregateFeederRows,
  aggregateCableRows,
  aggregateBreakerRows,
  aggregateVoltageDropRows,
  aggregateLoadRows,
  aggregateShortCircuitRows,
  type DetailedBreakerBOMItem,
} from "./aggregates";
import { phaseBalance } from "@/lib/calculations/phaseBalance";
import { sizeTransformer } from "@/lib/calculations/loads";
import { awgLabel } from "@/lib/calculations/codes";
import type { FindBreaker } from "@/lib/calculations/feeders";

export type { FindBreaker };

/** NEMA/NEC projects export AWG/kcmil trade sizes instead of mm². */
function cableCell(project: Project, sizeMm2: number | null | undefined): string | number {
  if (sizeMm2 == null || sizeMm2 <= 0) return "—";
  return project.calculationStandard === "NEMA" ? awgLabel(sizeMm2) : sizeMm2;
}

/**
 * Build a multi-sheet .xlsx workbook from a project's report schedules.
 *
 * Sheets: Project (summary), Load Analysis, MDB Schedule, Cable Schedule,
 * Breaker Schedule, Voltage Drop, Short-Circuit, BOM (consolidated),
 * BOM — Breakers, BOM — Cables, and optional BOM — Procurement Annex.
 */
export function buildReportWorkbook(
  project: Project,
  findBreaker: FindBreaker,
  breakerSettings?: any[]
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  appendSheet(wb, "Project", buildProjectRows(project));
  appendSheet(
    wb,
    "Load Analysis",
    aggregateLoadRows(project).map((r) => ({
      Building: r.buildingName,
      Floor: r.floor === 0 ? "MDB" : `F${r.floor}`,
      "Load Name": r.name,
      Type: r.type,
      "Connected (kVA)": round(r.connectedLoadKw, 2),
      "Demand Factor": round(r.demandFactor, 2),
      "Max Demand (kW)": round(r.maxDemandKw, 2),
      "Max Demand (kVA)": round(r.maxDemandKva, 2),
      Phase: `${r.phase}Φ`,
      "L1 (A)": round(r.currentL1, 1),
      "L2 (A)": round(r.currentL2, 1),
      "L3 (A)": round(r.currentL3, 1),
      PF: round(r.powerFactor, 2),
    }))
  );
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
      Cable: cableCell(project, r.cableMm2),
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
      "Cable (mm²)": cableCell(project, r.cableMm2),
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
      Cable: r.parallelRuns && r.parallelRuns > 1
        ? `${r.parallelRuns} × ${cableCell(project, r.cableMm2)}`
        : cableCell(project, r.cableMm2),
      Model: r.breakerModel,
      Phase: r.isThreePhase ? "3Φ" : "1Φ",
      "Trip Unit Settings": r.isThreePhase && r.breakerAmps >= 100 ? `Ir=${(r.current || 0).toFixed(1)}A, Isd=${(r.breakerAmps || 0) * 4}A, tsd=${r.type === 'INCOMER' ? '0.30s' : '0.05s'}, Ii=${(r.breakerAmps || 0) * 10}A` : "Thermal-Magnetic Type C",
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
      "Cable (mm²)": cableCell(project, r.cableMm2),
      "Length (m)": round(r.lengthMeters, 1),
      "Voltage Drop (%)": round(r.voltageDropPercent, 2),
      Status: r.status,
    }))
  );
  appendSheet(
    wb,
    "Short-Circuit",
    aggregateShortCircuitRows(project, findBreaker).map((r) => ({
      "Feeder / Bus": r.feeder,
      Building: r.buildingName,
      Floor: r.floor === 0 ? "MDB" : `F${r.floor}`,
      Type: r.type,
      "Cable (mm²)": r.cableSizeMm2 ? cableCell(project, r.cableSizeMm2) : "Busbar",
      "3Φ Isc (kA)": round(r.threePhaseIscKa, 2),
      "2Φ Isc (kA)": round(r.twoPhaseIscKa, 2),
      "Breaker Icu (kA)": r.breakerIcuKa ?? "—",
      Status: r.status,
    }))
  );
  appendAoaSheet(wb, "BOM", buildBomAoa(project, findBreaker, breakerSettings));

  return wb;
}

/** Project metadata + per-building summary sheet. */
function buildProjectRows(project: Project): Record<string, string | number>[] {
  const allProjectItems = project.buildings.flatMap((b) => [
    ...b.floorDesigns.flatMap((fd) => fd.items),
    ...(b.buildingLoads ?? []),
  ]);
  const overallBalance = phaseBalance(allProjectItems as never, project as never);
  const pf = project.powerFactor || 0.85;
  const demandKva = overallBalance.totalKw / pf;
  const perPhaseKva: [number, number, number] = [
    overallBalance.phaseKw[0] / pf,
    overallBalance.phaseKw[1] / pf,
    overallBalance.phaseKw[2] / pf,
  ];
  const transformerKva = project.transformerSize ?? sizeTransformer(demandKva, 1.2, perPhaseKva);

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
    { Field: "Transformer", Value: `${transformerKva} kVA` },
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
      "Demand (kVA)": round(balance.totalKw / pf, 1),
      "Demand (kW)": round(balance.totalKw, 1),
      "Main Current (A)": round(balance.maxPhaseCurrent, 1),
    });
  }

  return rows;
}

/** Single consolidated BOM sheet with clean vertically stacked tables for Cables, Breakers, and Annex. */
export function buildBomAoa(
  project: Project,
  findBreaker?: FindBreaker,
  breakerSettings?: any[]
): (string | number)[][] {
  const detailed = aggregateDetailedBOM(project, findBreaker, breakerSettings);
  const aoa: (string | number)[][] = [];

  // --- Section 1: Cable Drums & Total Conductor Sizing BOQ ---
  aoa.push([
    "Cable Specification",
    "Cores / System",
    "Conductor Size",
    "Circuits",
    "Total Length (m)",
  ]);

  for (const c of detailed.cableRows) {
    aoa.push([
      c.sizeLabel,
      c.cores === 2 ? "2-Core (1φ)" : "4-Core (3φ)",
      cableCell(project, c.sizeNum),
      c.count,
      Math.round(c.length),
    ]);
  }

  aoa.push([
    "Total Aggregated Cables",
    "",
    "",
    detailed.allItems.length,
    detailed.totalCableLength,
  ]);

  // Blank separator
  aoa.push([]);

  // --- Section 2: Protective Switchgear & Circuit Breakers BOQ ---
  aoa.push(["2. Protective Switchgear & Circuit Breakers BOQ"]);
  aoa.push([
    "Rating (In)",
    "Category",
    "Poles",
    "Model & Manufacturer",
    "Sourcing Status",
    "Quantity",
  ]);

  for (const b of detailed.breakerRows) {
    aoa.push([
      b.ratingLabel,
      b.category,
      b.poles,
      b.model,
      b.sourcingStatus,
      b.count,
    ]);
  }

  aoa.push([
    "Total Protective Switchgear Units",
    "",
    "",
    "",
    "",
    detailed.totalBreakers,
  ]);

  // --- Section 3: Procurement Technical Specifications Annex (if any) ---
  if (detailed.annexItems && detailed.annexItems.length > 0) {
    aoa.push([]);
    aoa.push(["3. Procurement Technical Specifications Annex"]);
    aoa.push([
      "Rating (In)",
      "Category",
      "Poles",
      "Model / Reference",
      "Sourcing Status",
      "Required Icu (kA)",
      "Standard",
      "Trip Unit Specification",
      "Procurement Notes",
    ]);

    for (const a of detailed.annexItems) {
      aoa.push([
        a.ratingLabel,
        a.category,
        a.poles,
        a.model,
        a.sourcingStatus,
        a.genericSpec?.requiredIcuKa ? `${a.genericSpec.requiredIcuKa} kA` : "—",
        a.genericSpec?.standard ?? "IEC 60947-2",
        a.genericSpec?.tripUnitType ?? "Electronic LSI / TMD",
        a.genericSpec?.procurementNotes ?? `Procure ${a.ratingLabel} ${a.category} ${a.poles} breaker.`,
      ]);
    }
  }

  return aoa;
}

/** Consolidated BOM sheet rows (cables + complete protective switchgear). */
export function buildBomRows(
  project: Project,
  findBreaker?: FindBreaker,
  breakerSettings?: any[]
): Record<string, string | number>[] {
  const detailed = aggregateDetailedBOM(project, findBreaker, breakerSettings);
  const rows: Record<string, string | number>[] = [];

  rows.push({ "BOM — Cables": "" });
  for (const c of detailed.cableRows) {
    rows.push({
      "Cable Specification": c.sizeLabel,
      "Cores": `${c.cores} Cores`,
      "Phase System": c.phase === 1 ? "1-Phase (1φ)" : "3-Phase (3φ)",
      "Conductor Size": cableCell(project, c.sizeNum),
      "Circuits": c.count,
      "Total Length (m)": Math.round(c.length),
    });
  }

  rows.push({ "BOM — Breakers": "" });
  for (const b of detailed.breakerRows) {
    rows.push({
      "Breaker (A)": b.ratingAmps,
      "Rating (In)": b.ratingLabel,
      "Category": b.category,
      "Poles": b.poles,
      "Model & Manufacturer": b.model,
      "Sourcing Status": b.sourcingStatus,
      "Quantity": b.count,
    });
  }

  return rows;
}

function appendAoaSheet(
  wb: XLSX.WorkBook,
  name: string,
  aoa: (string | number | null | undefined)[][]
): void {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const maxCols = aoa.reduce((max, row) => Math.max(max, row.length), 0);
  const colWidths: { wch: number }[] = [];

  for (let c = 0; c < maxCols; c++) {
    let maxLen = 10;
    for (const row of aoa) {
      const val = row[c];
      if (val != null) {
        if (c === 0 && row.length === 1) continue;
        maxLen = Math.max(maxLen, String(val).length);
      }
    }
    colWidths.push({ wch: Math.min(Math.max(maxLen + 2, 12), 48) });
  }

  ws["!cols"] = colWidths;
  XLSX.utils.book_append_sheet(wb, ws, name);
}

function appendSheet(
  wb: XLSX.WorkBook,
  name: string,
  rows: Record<string, string | number>[]
): void {
  const ws = XLSX.utils.json_to_sheet(rows);
  const keySet = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      keySet.add(k);
    }
  }
  const headers = Array.from(keySet);
  ws["!cols"] = headers.map((h) => {
    let maxLen = h.length;
    for (const r of rows) {
      const val = r[h];
      if (val != null) {
        maxLen = Math.max(maxLen, String(val).length);
      }
    }
    return { wch: Math.min(Math.max(maxLen + 2, 12), 50) };
  });
  XLSX.utils.book_append_sheet(wb, ws, name);
}

function round(value: number | null | undefined, digits: number): number {
  if (value == null || !Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
