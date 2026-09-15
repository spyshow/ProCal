import { db } from "./db";
import {
  INSTALLATION_METHODS,
  NEC_INSTALLATION_METHODS,
} from "./calculations/installationMethods";

export interface FieldChange {
  field: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
  oldDisplay: string;
  newDisplay: string;
}

export interface AuditDiffResult {
  category: "PROJECT" | "BREAKER" | "CABLE" | "BUILDING" | "FLOOR" | "PANEL" | "LOAD" | "BUILDING_LOAD";
  description: string;
  changes: FieldChange[];
  details: {
    changes: FieldChange[];
    raw?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export const ALL_FIELD_LABELS: Record<string, string> = {
  // Project
  defaultAcbFamilyId: "ACB Family",
  defaultMccbFamilyId: "MCCB Family",
  defaultMcbFamilyId: "MCB Family",
  preferredManufacturer: "Preferred Manufacturer",
  voltage: "System Voltage",
  frequency: "Grid Frequency",
  powerFactor: "Power Factor",
  maxDemandFactor: "Max Demand Factor",
  maxVoltageDropLighting: "Max Voltage Drop (Lighting)",
  maxVoltageDropPower: "Max Voltage Drop (Power)",
  calculationStandard: "Calculation Standard",
  transformerSize: "Transformer Sizing",
  name: "Name",
  client: "Client Name",
  consultant: "Consultant",
  contractor: "Contractor",
  location: "Project Location",
  engineer: "Project Engineer",
  date: "Project Date",
  notes: "Notes",
  logoUrl: "Project Logo",

  // Building & Incomer Cable
  incomerCableSize: "Incomer Cable Size",
  incomerCableLength: "Incomer Cable Length",
  incomerInstallMethod: "Incomer Installation Method",
  incomerCableInsulation: "Incomer Insulation",
  incomerCableMaterial: "Incomer Material",
  incomerAmbientTemp: "Incomer Ambient Temp",
  incomerGroupingCount: "Incomer Grouping",

  // Incomer Breaker
  incomerIr: "Incomer Ir (Trip)",
  incomerIn: "Incomer In (Frame)",
  incomerBreakerType: "Incomer Breaker Type",
  incomerPoles: "Incomer Poles",
  incomerIcu: "Incomer Icu",
  incomerIcs: "Incomer Ics",

  // Building General
  floors: "Floors Count",
  serviceFloors: "Service Floors",
  apartmentsPerFloor: "Apartments Per Floor",
  supplyVoltage: "Supply Voltage",
  earthingSystem: "Earthing System",
  lightningProtection: "Lightning Protection",
  mechanicalLoads: "Mechanical Loads",
  generator: "Generator Size",
  transformer: "Transformer Size",

  // Riser Cable (FloorDesign)
  riserCableSize: "Riser Cable Size",
  riserCableLength: "Riser Cable Length",
  riserBreakerSize: "Riser Breaker Size",
  riserInstallMethod: "Riser Installation Method",
  riserCableInsulation: "Riser Insulation",
  riserCableMaterial: "Riser Material",
  riserAmbientTemp: "Riser Ambient Temp",
  riserGroupingCount: "Riser Grouping",
  hasFloorSubPanels: "Floor Sub-Panels (SDB)",

  // Floor Item & Building Load Cables
  cableSize: "Cable Size",
  cableLength: "Cable Length",
  breakerSize: "Breaker Size",
  installMethod: "Installation Method",
  cableInsulation: "Cable Insulation",
  cableMaterial: "Cable Material",
  ambientTemp: "Ambient Temperature",
  groupingCount: "Grouping Count",
  assignedPhase: "Assigned Phase",
  quantity: "Quantity",
};

const BREAKER_FAMILY_FIELDS = new Set(["defaultAcbFamilyId", "defaultMccbFamilyId", "defaultMcbFamilyId"]);

const WELL_KNOWN_METHOD_NAMES: Record<string, string> = {
  // IEC Reference Letters
  "C": "Method C (Clipped direct)",
  "A1": "Method A1 (Conduit in insulated wall)",
  "A2": "Method A2 (Multi-core in insulated wall)",
  "B1": "Method B1 (Conduit on wall)",
  "B2": "Method B2 (Multi-core in conduit on wall)",
  "D1": "Method D1 (Underground duct)",
  "D2": "Method D2 (Direct buried)",
  "E": "Method E (Perforated cable tray)",
  "F": "Method F (Touching on cable tray)",
  "G": "Method G (Spaced on cable tray)",
  "A": "Method A (Conduit in insulated wall)",
  "B": "Method B (Conduit on wall)",
  "D": "Method D (Underground / Buried)",

  // Common Methods with archetype descriptions
  "1": "Method 1 (A1 - Conduit in insulated wall)",
  "2": "Method 2 (A2 - Multi-core in insulated wall)",
  "3": "Method 3 (A1 - Direct in insulated wall)",
  "4": "Method 4 (B1 - Conduit on wall)",
  "5": "Method 5 (B2 - Multi-core in conduit on wall)",
  "6": "Method 6 (B1 - Trunking on wall)",
  "8": "Method 8 (B2 - Multi-core in trunking on wall)",
  "10": "Method 10 (B1 - Suspended trunking)",
  "11": "Method 11 (B2 - Multi-core suspended trunking)",
  "12": "Method 12 (A1 - In mouldings)",
  "15": "Method 15 (A1 - In architrave)",
  "16": "Method 16 (A1 - In window frames)",
  "20": "Method 20 (C - Fixed to wall)",
  "21": "Method 21 (C - Fixed under ceiling)",
  "22": "Method 22 (E - Spaced from ceiling)",
  "30": "Method 30 (C - Unperforated tray)",
  "31": "Method 31 (E - Perforated cable tray)",
  "31-E": "Method 31 (E - Perforated cable tray)",
  "31-F-touch": "Method 31 - F (Touching on tray)",
  "31-F-tref": "Method 31 - F (Trefoil on tray)",
  "32": "Method 32 (E - Wire mesh tray)",
  "32-E": "Method 32 (E - Wire mesh tray)",
  "32-F-touch": "Method 32 - F (Touching on wire mesh)",
  "32-F-tref": "Method 32 - F (Trefoil on wire mesh)",
  "33": "Method 33 (E - On brackets)",
  "34": "Method 34 (E - Cable ladder)",
  "34-E": "Method 34 (E - Cable ladder)",
  "34-F-touch": "Method 34 - F (Touching on ladder)",
  "34-F-tref": "Method 34 - F (Trefoil on ladder)",
  "36": "Method 36 (G - On insulators)",
  "40": "Method 40 (B1 - In building void)",
  "41": "Method 41 (B2 - Multi-core in building void)",
  "50": "Method 50 (B1 - In floor channel)",
  "51": "Method 51 (B2 - Multi-core in floor channel)",
  "52": "Method 52 (B1 - Flush floor duct)",
  "53": "Method 53 (B2 - Multi-core flush floor duct)",
  "59": "Method 59 (B1 - Conduit in masonry)",
  "60": "Method 60 (B2 - Multi-core conduit in masonry)",
  "70": "Method 70 (D1 - Underground duct)",
  "71": "Method 71 (D2 - Multi-core in underground duct)",
  "72": "Method 72 (D2 - Direct buried in ground)",
  "73": "Method 73 (D2 - Multi-core direct buried)",

  // NEC
  "NEC-1": "NEC-1 (Raceway / Conduit)",
  "NEC-2": "NEC-2 (Raceway on Wall)",
  "NEC-3": "NEC-3 (Open Air / Messenger)",
  "NEC-4": "NEC-4 (Cable Tray)",
  "NEC-5": "NEC-5 (Spaced Cable Tray)",
  "NEC-6": "NEC-6 (Ladder Cable Tray)",
  "NEC-10": "NEC-10 (Direct Buried)",
  "NEC-11": "NEC-11 (Underground Duct Bank)",
};

export function formatInstallationMethod(val: unknown): string {
  if (val === null || val === undefined || val === "") return "None";
  const str = String(val).trim();
  const cleanKey = str.replace(/^Method\s+/i, "");

  if (WELL_KNOWN_METHOD_NAMES[str]) return WELL_KNOWN_METHOD_NAMES[str];
  if (WELL_KNOWN_METHOD_NAMES[cleanKey]) return WELL_KNOWN_METHOD_NAMES[cleanKey];

  const found = INSTALLATION_METHODS.find(
    (m) => m.id === str || m.id === cleanKey || String(m.number) === cleanKey || m.code === cleanKey
  );
  if (found) {
    const descShort = found.description.length > 35 ? `${found.description.slice(0, 32)}...` : found.description;
    return `${found.name} - ${descShort}`;
  }

  const foundNec = NEC_INSTALLATION_METHODS.find(
    (m) => m.id === str || m.id === cleanKey || m.code === cleanKey
  );
  if (foundNec) {
    return `${foundNec.id} (${foundNec.name})`;
  }

  return str.startsWith("Method") ? str : `Method ${str}`;
}

export function formatFieldValue(field: string, val: unknown, familyNameMap?: Map<string, string>): string {
  if (val === null || val === undefined || val === "") {
    return "None";
  }

  if (BREAKER_FAMILY_FIELDS.has(field)) {
    const id = String(val);
    return familyNameMap?.get(id) || id;
  }

  switch (field) {
    case "voltage":
    case "supplyVoltage":
      return `${val}V`;
    case "frequency":
      return `${val}Hz`;
    case "powerFactor":
    case "maxDemandFactor":
      return typeof val === "number" ? val.toFixed(2) : String(val);
    case "maxVoltageDropLighting":
    case "maxVoltageDropPower":
      return `${val}%`;
    case "transformerSize":
    case "transformer":
    case "generator":
      return `${val} kVA`;
    case "incomerCableLength":
    case "riserCableLength":
    case "cableLength":
      return `${val}m`;
    case "incomerAmbientTemp":
    case "riserAmbientTemp":
    case "ambientTemp":
      return `${val}°C`;
    case "incomerInstallMethod":
    case "riserInstallMethod":
    case "installMethod":
      return formatInstallationMethod(val);
    case "incomerIr":
      return `${val}A`;
    case "incomerIn":
    case "riserBreakerSize":
    case "breakerSize":
      return `${val}A`;
    case "incomerIcu":
    case "incomerIcs":
      return `${val} kA`;
    case "incomerPoles":
      return `${val}P`;
    case "assignedPhase":
      return val ? `L${val}` : "Auto";
    case "hasFloorSubPanels":
    case "lightningProtection":
      return val ? "Enabled" : "Disabled";
    case "logoUrl":
      return "Uploaded Logo";
    default:
      return String(val);
  }
}

function areValuesEqual(field: string, v1: unknown, v2: unknown): boolean {
  if (v1 === v2) return true;
  if ((v1 === null || v1 === undefined || v1 === "") && (v2 === null || v2 === undefined || v2 === "")) return true;

  const numFields = [
    "voltage", "frequency", "powerFactor", "maxDemandFactor", "maxVoltageDropLighting",
    "maxVoltageDropPower", "transformerSize", "incomerCableLength", "riserCableLength",
    "cableLength", "ambientTemp", "incomerAmbientTemp", "riserAmbientTemp",
    "groupingCount", "incomerGroupingCount", "riserGroupingCount", "incomerIr",
    "incomerIn", "breakerSize", "riserBreakerSize", "generator", "transformer",
    "floors", "serviceFloors", "apartmentsPerFloor"
  ];

  if (numFields.includes(field)) {
    const n1 = v1 !== null && v1 !== undefined ? parseFloat(String(v1)) : NaN;
    const n2 = v2 !== null && v2 !== undefined ? parseFloat(String(v2)) : NaN;
    if (!Number.isNaN(n1) && !Number.isNaN(n2)) {
      return Math.abs(n1 - n2) < 0.0001;
    }
  }

  return String(v1 ?? "") === String(v2 ?? "");
}

/**
 * Computes human-readable diffs between existing project state and incoming updates,
 * resolving BreakerFamily IDs into friendly names (e.g. "Schneider Acti9 iC60N").
 */
export async function computeProjectDiff(
  existing: Record<string, any>,
  updated: Record<string, any>,
  rawPayload?: Record<string, any>
): Promise<AuditDiffResult> {
  const projectFields = [
    "defaultAcbFamilyId", "defaultMccbFamilyId", "defaultMcbFamilyId", "preferredManufacturer",
    "voltage", "frequency", "powerFactor", "maxDemandFactor", "maxVoltageDropLighting",
    "maxVoltageDropPower", "calculationStandard", "transformerSize", "name", "client",
    "consultant", "contractor", "location", "engineer", "date", "notes", "logoUrl"
  ];
  const changedFields: { field: string; oldVal: unknown; newVal: unknown }[] = [];

  for (const field of projectFields) {
    if (field in updated && !areValuesEqual(field, existing[field], updated[field])) {
      changedFields.push({
        field,
        oldVal: existing[field],
        newVal: updated[field],
      });
    }
  }

  const familyIdsToFetch = new Set<string>();
  for (const change of changedFields) {
    if (BREAKER_FAMILY_FIELDS.has(change.field)) {
      if (change.oldVal) familyIdsToFetch.add(String(change.oldVal));
      if (change.newVal) familyIdsToFetch.add(String(change.newVal));
    }
  }

  const familyNameMap = new Map<string, string>();
  if (familyIdsToFetch.size > 0 && db.breakerFamily?.findMany) {
    try {
      const families = await db.breakerFamily.findMany({
        where: { id: { in: Array.from(familyIdsToFetch) } },
        select: { id: true, name: true, manufacturer: true, category: true },
      });
      for (const fam of families) {
        familyNameMap.set(fam.id, `${fam.manufacturer} ${fam.name}`);
      }
    } catch (err) {
      console.error("Failed to query breaker families for audit diff:", err);
    }
  }

  const changes: FieldChange[] = changedFields.map((c) => ({
    field: c.field,
    label: ALL_FIELD_LABELS[c.field] || c.field,
    oldValue: c.oldVal,
    newValue: c.newVal,
    oldDisplay: formatFieldValue(c.field, c.oldVal, familyNameMap),
    newDisplay: formatFieldValue(c.field, c.newVal, familyNameMap),
  }));

  const isOnlyBreaker = changes.length > 0 && changes.every((c) => BREAKER_FAMILY_FIELDS.has(c.field));
  const category: "PROJECT" | "BREAKER" = isOnlyBreaker ? "BREAKER" : "PROJECT";

  let description = "Updated project parameters";

  if (changes.length === 0) {
    description = "Saved project parameters (no values modified)";
  } else if (isOnlyBreaker) {
    if (changes.length === 1) {
      const ch = changes[0];
      description = `Updated ${ch.label} to "${ch.newDisplay}"${ch.oldDisplay !== "None" ? ` (was "${ch.oldDisplay}")` : ""}`;
    } else {
      const parts = changes.map((ch) => `${ch.label.replace(" Family", "")} ("${ch.newDisplay}")`);
      description = `Updated default breaker families: ${parts.join(", ")}`;
    }
  } else if (changes.length === 1) {
    const ch = changes[0];
    if (ch.field === "preferredManufacturer") {
      description = `Updated Preferred Manufacturer to ${ch.newDisplay}${ch.oldDisplay !== "None" ? ` (was ${ch.oldDisplay})` : ""}`;
    } else if (ch.oldDisplay !== "None") {
      description = `Updated ${ch.label}: ${ch.oldDisplay} → ${ch.newDisplay}`;
    } else {
      description = `Set ${ch.label} to ${ch.newDisplay}`;
    }
  } else if (changes.length <= 3) {
    const parts = changes.map((ch) => {
      if (ch.oldDisplay !== "None") {
        return `${ch.label} (${ch.oldDisplay} → ${ch.newDisplay})`;
      }
      return `${ch.label} (${ch.newDisplay})`;
    });
    description = `Updated project parameters: ${parts.join(", ")}`;
  } else {
    const top3 = changes.slice(0, 3).map((ch) => ch.label).join(", ");
    description = `Updated ${changes.length} project parameters (${top3}, and ${changes.length - 3} others)`;
  }

  return {
    category,
    description,
    changes,
    details: {
      changes,
      raw: rawPayload,
    },
  };
}

const INCOMER_CABLE_FIELDS = new Set([
  "incomerCableSize", "incomerCableLength", "incomerInstallMethod",
  "incomerCableInsulation", "incomerCableMaterial", "incomerAmbientTemp", "incomerGroupingCount"
]);

const INCOMER_BREAKER_FIELDS = new Set([
  "incomerIr", "incomerIn", "incomerBreakerType", "incomerPoles", "incomerIcu", "incomerIcs"
]);

/**
 * Computes human-readable diffs for building and incomer cable/breaker updates.
 */
export function computeBuildingDiff(
  buildingName: string,
  existing: Record<string, any>,
  updated: Record<string, any>,
  incomerCableTag: string = "W_MDB"
): AuditDiffResult {
  const trackedFields = [
    "name", "floors", "serviceFloors", "apartmentsPerFloor", "supplyVoltage",
    "earthingSystem", "lightningProtection", "mechanicalLoads", "generator", "transformer",
    "incomerCableSize", "incomerCableLength", "incomerInstallMethod",
    "incomerCableInsulation", "incomerCableMaterial", "incomerAmbientTemp", "incomerGroupingCount",
    "incomerIr", "incomerIn", "incomerBreakerType", "incomerPoles", "incomerIcu", "incomerIcs"
  ];

  const changedFields: { field: string; oldVal: unknown; newVal: unknown }[] = [];
  for (const field of trackedFields) {
    if (field in updated && !areValuesEqual(field, existing[field], updated[field])) {
      changedFields.push({
        field,
        oldVal: existing[field],
        newVal: updated[field],
      });
    }
  }

  const changes: FieldChange[] = changedFields.map((c) => ({
    field: c.field,
    label: ALL_FIELD_LABELS[c.field] || c.field,
    oldValue: c.oldVal,
    newValue: c.newVal,
    oldDisplay: formatFieldValue(c.field, c.oldVal),
    newDisplay: formatFieldValue(c.field, c.newVal),
  }));

  const hasCable = changes.some((c) => INCOMER_CABLE_FIELDS.has(c.field));
  const hasBreaker = changes.some((c) => INCOMER_BREAKER_FIELDS.has(c.field));
  const isOnlyCable = changes.length > 0 && changes.every((c) => INCOMER_CABLE_FIELDS.has(c.field));
  const isOnlyBreaker = changes.length > 0 && changes.every((c) => INCOMER_BREAKER_FIELDS.has(c.field));

  let category: AuditDiffResult["category"] = "BUILDING";
  if (isOnlyCable) category = "CABLE";
  else if (isOnlyBreaker) category = "BREAKER";
  else if (hasCable) category = "CABLE";

  const cableTag = incomerCableTag || "W_MDB";
  const bldgCablePrefix = `"${buildingName}" Cable ${cableTag}`;

  let description = `Updated building "${buildingName}"`;

  if (changes.length === 0) {
    description = `Saved building "${buildingName}" (no values modified)`;
  } else if (isOnlyCable) {
    if (changes.length === 1) {
      const ch = changes[0];
      description = `Updated ${bldgCablePrefix} ${ch.label} to ${ch.newDisplay}${ch.oldDisplay !== "None" ? ` (was ${ch.oldDisplay})` : ""}`;
    } else {
      const parts = changes.map((ch) => `${ch.label} (${ch.oldDisplay} → ${ch.newDisplay})`);
      description = `Updated ${changes.length} incomer cable settings on ${bldgCablePrefix}: ${parts.join(", ")}`;
    }
  } else if (isOnlyBreaker) {
    if (changes.length === 1) {
      const ch = changes[0];
      description = `Updated "${buildingName}" ${ch.label} to ${ch.newDisplay}${ch.oldDisplay !== "None" ? ` (was ${ch.oldDisplay})` : ""}`;
    } else {
      const parts = changes.map((ch) => `${ch.label} (${ch.oldDisplay} → ${ch.newDisplay})`);
      description = `Updated incomer breaker settings on "${buildingName}": ${parts.join(", ")}`;
    }
  } else if (changes.length === 1) {
    const ch = changes[0];
    description = `Updated "${buildingName}" ${ch.label}: ${ch.oldDisplay} → ${ch.newDisplay}`;
  } else {
    const parts = changes.slice(0, 3).map((ch) => `${ch.label} (${ch.oldDisplay} → ${ch.newDisplay})`);
    description = `Updated ${changes.length} parameters on "${buildingName}": ${parts.join(", ")}`;
  }

  return {
    category,
    description,
    changes,
    details: {
      buildingName,
      cableName: cableTag,
      cableTag,
      changes,
      raw: updated,
    },
  };
}

const RISER_CABLE_FIELDS = new Set([
  "riserCableSize", "riserCableLength", "riserInstallMethod",
  "riserCableInsulation", "riserCableMaterial", "riserAmbientTemp", "riserGroupingCount"
]);

/**
 * Computes human-readable diffs for floor design updates (subpanels, riser cables, riser breakers).
 */
export function computeFloorDiff(
  floorName: string,
  buildingName: string,
  existing: Record<string, any>,
  updated: Record<string, any>,
  riserCableTag?: string
): AuditDiffResult {
  const trackedFields = [
    "hasFloorSubPanels", "riserCableLength", "riserCableSize", "riserBreakerSize",
    "riserInstallMethod", "riserCableInsulation", "riserCableMaterial",
    "riserAmbientTemp", "riserGroupingCount"
  ];

  const changedFields: { field: string; oldVal: unknown; newVal: unknown }[] = [];
  for (const field of trackedFields) {
    if (field in updated && !areValuesEqual(field, existing[field], updated[field])) {
      changedFields.push({
        field,
        oldVal: existing[field],
        newVal: updated[field],
      });
    }
  }

  const changes: FieldChange[] = changedFields.map((c) => ({
    field: c.field,
    label: ALL_FIELD_LABELS[c.field] || c.field,
    oldValue: c.oldVal,
    newValue: c.newVal,
    oldDisplay: formatFieldValue(c.field, c.oldVal),
    newDisplay: formatFieldValue(c.field, c.newVal),
  }));

  const isOnlyCable = changes.length > 0 && changes.every((c) => RISER_CABLE_FIELDS.has(c.field));
  const isOnlyBreaker = changes.length > 0 && changes.every((c) => c.field === "riserBreakerSize");
  const isOnlyPanel = changes.length > 0 && changes.every((c) => c.field === "hasFloorSubPanels");

  let category: AuditDiffResult["category"] = "FLOOR";
  if (isOnlyCable) category = "CABLE";
  else if (isOnlyBreaker) category = "BREAKER";
  else if (isOnlyPanel) category = "PANEL";

  const safeFloorName = (floorName && floorName !== "undefined" && floorName.trim() !== "") ? floorName.trim() : "Floor";
  const safeBldgName = (buildingName && buildingName !== "undefined" && buildingName.trim() !== "") ? buildingName.trim() : "Building";
  const cableTag = riserCableTag || "Wsdb";
  const bldgCablePrefix = `"${safeBldgName}" Cable ${cableTag} (${safeFloorName})`;

  let description = `Updated floor "${safeFloorName}" in "${safeBldgName}"`;

  if (changes.length === 0) {
    description = `Saved floor "${safeFloorName}" (no values modified)`;
  } else if (isOnlyCable) {
    if (changes.length === 1) {
      const ch = changes[0];
      description = `Updated ${bldgCablePrefix} ${ch.label} to ${ch.newDisplay}${ch.oldDisplay !== "None" ? ` (was ${ch.oldDisplay})` : ""}`;
    } else {
      const parts = changes.map((ch) => `${ch.label} (${ch.oldDisplay} → ${ch.newDisplay})`);
      description = `Updated ${changes.length} riser cable settings on ${bldgCablePrefix}: ${parts.join(", ")}`;
    }
  } else if (isOnlyBreaker) {
    const ch = changes[0];
    description = `Updated ${ch.label} to ${ch.newDisplay} on floor "${safeFloorName}" in "${safeBldgName}"`;
  } else if (isOnlyPanel) {
    const ch = changes[0];
    description = `${ch.newDisplay === "Enabled" ? "Enabled" : "Disabled"} floor sub-panels (SDB) on floor "${safeFloorName}" in "${safeBldgName}"`;
  } else {
    const parts = changes.map((ch) => `${ch.label} (${ch.oldDisplay} → ${ch.newDisplay})`);
    description = `Updated ${changes.length} settings on floor "${safeFloorName}" in "${safeBldgName}": ${parts.join(", ")}`;
  }

  return {
    category,
    description,
    changes,
    details: {
      floorName: safeFloorName,
      buildingName: safeBldgName,
      riserCableTag: riserCableTag || null,
      cableName: riserCableTag || null,
      cableTag: riserCableTag || null,
      changes,
      raw: updated,
    },
  };
}

const CABLE_CIRCUIT_FIELDS = new Set([
  "cableSize", "cableLength", "installMethod", "cableInsulation", "cableMaterial",
  "ambientTemp", "groupingCount"
]);

/**
 * Computes human-readable diffs for individual cable circuits (FloorItem or BuildingLoad).
 */
export function computeCableCircuitDiff(
  targetName: string,
  locationContext?: string | null,
  existing: Record<string, any> = {},
  updated: Record<string, any> = {},
  cableName?: string,
  buildingName?: string | null,
  floorName?: string | null
): AuditDiffResult {
  const trackedFields = [
    "cableSize", "cableLength", "breakerSize", "installMethod", "cableInsulation",
    "cableMaterial", "ambientTemp", "groupingCount", "assignedPhase", "quantity"
  ];

  const changedFields: { field: string; oldVal: unknown; newVal: unknown }[] = [];
  for (const field of trackedFields) {
    if (field in updated && !areValuesEqual(field, existing[field], updated[field])) {
      changedFields.push({
        field,
        oldVal: existing[field],
        newVal: updated[field],
      });
    }
  }

  const changes: FieldChange[] = changedFields.map((c) => ({
    field: c.field,
    label: ALL_FIELD_LABELS[c.field] || c.field,
    oldValue: c.oldVal,
    newValue: c.newVal,
    oldDisplay: formatFieldValue(c.field, c.oldVal),
    newDisplay: formatFieldValue(c.field, c.newVal),
  }));

  const isOnlyCable = changes.length > 0 && changes.every((c) => CABLE_CIRCUIT_FIELDS.has(c.field));
  const isOnlyBreaker = changes.length > 0 && changes.every((c) => c.field === "breakerSize");
  const isOnlyPhase = changes.length > 0 && changes.every((c) => c.field === "assignedPhase");
  const isOnlyQuantity = changes.length > 0 && changes.every((c) => c.field === "quantity");

  let category: AuditDiffResult["category"] = "CABLE";
  if (isOnlyCable) category = "CABLE";
  else if (isOnlyBreaker) category = "BREAKER";
  else if (isOnlyPhase) category = "LOAD";
  else if (isOnlyQuantity) category = "BUILDING_LOAD";

  const safeTargetName = (targetName && targetName !== "undefined" && targetName.trim() !== "") ? targetName.trim() : "Circuit";

  let safeBldg = (buildingName && buildingName !== "undefined" && buildingName.trim() !== "") ? buildingName.trim() : "";
  let safeFloor = (floorName && floorName !== "undefined" && floorName.trim() !== "") ? floorName.trim() : "";
  let safeCable = (cableName && cableName !== "undefined" && cableName.trim() !== "") ? cableName.trim() : "";

  const rawContext = (locationContext && locationContext !== "undefined") ? locationContext.trim() : "";
  const cleanedContext = rawContext.replace(/\bundefined\b/g, "").replace(/\s*·\s*$/, "").replace(/^\s*·\s*/, "").trim();

  // Deduce components from cleanedContext if not explicitly provided
  if (!safeCable && cleanedContext) {
    const cMatch = cleanedContext.match(/\bCable\s+([A-Za-z0-9_-]+)/i);
    if (cMatch) safeCable = cMatch[1];
  }
  if (!safeFloor && cleanedContext) {
    const fMatch = cleanedContext.match(/\b(Floor\s+\d+|Level\s+\d+)/i);
    if (fMatch) safeFloor = fMatch[1];
  }
  if (!safeBldg && cleanedContext) {
    const bMatch = cleanedContext.match(/\b(Tower\s+[A-Za-z0-9]+|Building\s+[A-Za-z0-9]+)/i);
    if (bMatch) safeBldg = bMatch[1];
  }

  let targetHeader = "";
  if (safeBldg && safeCable) {
    targetHeader = `"${safeBldg}" Cable ${safeCable} ("${safeTargetName}"${safeFloor ? `, ${safeFloor}` : ""})`;
  } else if (safeCable) {
    targetHeader = `Cable ${safeCable} ("${safeTargetName}"${safeFloor ? `, ${safeFloor}` : ""})`;
  } else if (safeBldg) {
    targetHeader = `"${safeBldg}" "${safeTargetName}"${safeFloor ? ` (${safeFloor})` : ""}`;
  } else if (cleanedContext) {
    targetHeader = `"${safeTargetName}" (${cleanedContext})`;
  } else {
    targetHeader = `"${safeTargetName}"`;
  }

  let description = `Updated ${targetHeader}`;

  if (changes.length === 0) {
    description = `Saved ${targetHeader} (no values modified)`;
  } else if (isOnlyCable) {
    if (changes.length === 1) {
      const ch = changes[0];
      description = `Updated ${targetHeader} ${ch.label} to ${ch.newDisplay}${ch.oldDisplay !== "None" ? ` (was ${ch.oldDisplay})` : ""}`;
    } else {
      const parts = changes.map((ch) => `${ch.label} (${ch.oldDisplay} → ${ch.newDisplay})`);
      description = `Updated ${changes.length} cable settings on ${targetHeader}: ${parts.join(", ")}`;
    }
  } else if (isOnlyBreaker) {
    const ch = changes[0];
    description = `Updated ${targetHeader} Breaker Size to ${ch.newDisplay}${ch.oldDisplay !== "None" ? ` (was ${ch.oldDisplay})` : ""}`;
  } else if (isOnlyPhase) {
    const ch = changes[0];
    description = `Assigned Phase ${ch.newDisplay} to ${targetHeader}`;
  } else if (isOnlyQuantity) {
    const ch = changes[0];
    description = `Updated Quantity to ${ch.newDisplay} for ${targetHeader}`;
  } else {
    const parts = changes.map((ch) => `${ch.label} (${ch.oldDisplay} → ${ch.newDisplay})`);
    description = `Updated ${changes.length} parameters on ${targetHeader}: ${parts.join(", ")}`;
  }

  return {
    category,
    description,
    changes,
    details: {
      targetName: safeTargetName,
      cableName: safeCable || null,
      cableTag: safeCable || null,
      buildingName: safeBldg || null,
      floorName: safeFloor || null,
      location: cleanedContext || null,
      changes,
      raw: updated,
    },
  };
}

/**
 * Helper to enrich legacy audit logs that have generic or technical descriptions.
 * Takes a raw log item and a pre-loaded map of breaker family ID -> name.
 */
export function enrichLegacyAuditLog(
  log: {
    id: string;
    description: string;
    entityType: string;
    details?: string | null;
    [key: string]: any;
  },
  familyNameMap: Map<string, string>
) {
  if (!log.details) return log;

  let parsed: any;
  try {
    parsed = JSON.parse(log.details);
  } catch {
    return log;
  }

  // 1. Sanitize any existing logs that ended up with "(undefined)" in the description
  let cleanedDescription = log.description || "";
  if (cleanedDescription.includes("(undefined)")) {
    const replacement = parsed?.cableName
      ? `(Cable ${parsed.cableName})`
      : parsed?.floorName
      ? `(${parsed.floorName})`
      : "";
    cleanedDescription = cleanedDescription
      .replace(/\s*\(undefined\)/g, replacement ? ` ${replacement}` : "")
      .trim();
    log = { ...log, description: cleanedDescription };
  }

  // 2. Enhance Incomer logs to include "Cable W_MDB"
  if (
    cleanedDescription.startsWith('Updated "') &&
    cleanedDescription.includes("Incomer") &&
    !cleanedDescription.includes("Cable W_MDB")
  ) {
    cleanedDescription = cleanedDescription.replace(
      /^Updated "([^"]+)" Incomer /,
      'Updated "$1" Cable W_MDB Incomer '
    );
    log = { ...log, description: cleanedDescription };
  }

  // 3. Enhance Circuit Cable logs that have the older patterns:
  // e.g. 'Updated Cable Length to 16m (was 14m) on "test3"'
  // or 'Updated Cable Material to aluminum (was copper) on "test3" (Cable Wf1c · Floor 1)'
  const oldCircuitMatch = cleanedDescription.match(
    /^Updated (?:Cable\s+)?([A-Za-z0-9\s]+?)\s+to\s+(.+?)\s+on\s+"([^"]+)"(?:\s*\(([^)]*)\))?$/
  );
  if (oldCircuitMatch) {
    const propName = oldCircuitMatch[1].trim();
    const valPart = oldCircuitMatch[2].trim();
    const circuitName = oldCircuitMatch[3].trim();
    const contextPart = oldCircuitMatch[4]?.trim() || "";

    const bldg = parsed?.buildingName || (contextPart.match(/Tower\s+[A-Za-z0-9]+|Building\s+[A-Za-z0-9]+/i)?.[0]) || "";
    let cable = parsed?.cableName || parsed?.cableTag || (contextPart.match(/Cable\s+([A-Za-z0-9_-]+)/i)?.[1]) || "";
    let floor = parsed?.floorName || (parsed?.floorNumber != null ? `Floor ${parsed.floorNumber}` : "") || (contextPart.match(/(Floor\s+\d+|Level\s+\d+)/i)?.[0]) || "";

    if (cable) {
      const fullTarget = bldg
        ? `"${bldg}" Cable ${cable} ("${circuitName}"${floor ? `, ${floor}` : ""})`
        : `Cable ${cable} ("${circuitName}"${floor ? `, ${floor}` : ""})`;
      cleanedDescription = `Updated ${fullTarget} ${propName.startsWith("Cable") ? propName : `Cable ${propName}`} to ${valPart}`;
      log = { ...log, description: cleanedDescription };
    }
  }

  // 4. Enhance Riser logs that have the old pattern:
  // e.g. '... on riser cable "Wsdb1" (Floor 1, Tower B)'
  const oldRiserMatch = cleanedDescription.match(
    /^Updated (.+?)\s+to\s+(.+?)\s+on riser cable "([^"]+)"\s*\(([^,]+),\s*([^)]+)\)$/
  );
  if (oldRiserMatch) {
    const propLabel = oldRiserMatch[1].trim();
    const valPart = oldRiserMatch[2].trim();
    const cableTag = oldRiserMatch[3].trim();
    const floorLabel = oldRiserMatch[4].trim();
    const bldgName = oldRiserMatch[5].trim();
    cleanedDescription = `Updated "${bldgName}" Cable ${cableTag} (${floorLabel}) ${propLabel} to ${valPart}`;
    log = { ...log, description: cleanedDescription };
  }

  // 5. Enhance Method descriptions (replace bare 'Method 1' or 'Method 4' with descriptive installation method names)
  cleanedDescription = cleanedDescription.replace(
    /\b(Incomer|Riser)?\s*(?:Installation\s+)?Method\s+to\s+(?:Method\s+)?([A-Za-z0-9_-]+)(?!\s*\((?!was\b))/gi,
    (_, prefix, mVal) => {
      const p = prefix ? `${prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase()} ` : "";
      return `${p}Installation Method to ${formatInstallationMethod(mVal)}`;
    }
  );
  cleanedDescription = cleanedDescription.replace(
    /\(was (?:Method\s+)?([A-Za-z0-9_-]+)\)/g,
    (match, mVal) => {
      const formatted = formatInstallationMethod(mVal);
      if (formatted !== mVal && formatted !== `Method ${mVal}`) {
        return `(was ${formatted})`;
      }
      return match;
    }
  );

  // If structured changes exist, also enhance installation method change chips & labels
  if (parsed?.changes && Array.isArray(parsed.changes)) {
    let modified = false;
    for (const c of parsed.changes) {
      if (c.field === "incomerInstallMethod" || c.field === "riserInstallMethod" || c.field === "installMethod") {
        c.label = ALL_FIELD_LABELS[c.field] || "Installation Method";
        if (c.newValue !== undefined && c.newValue !== null) {
          c.newDisplay = formatInstallationMethod(c.newValue);
        }
        if (c.oldValue !== undefined && c.oldValue !== null && c.oldValue !== "None") {
          c.oldDisplay = formatInstallationMethod(c.oldValue);
        }
        modified = true;
      }
    }
    return {
      ...log,
      description: cleanedDescription,
      details: modified ? JSON.stringify({ ...parsed, changes: parsed.changes }) : log.details,
    };
  }

  // Check 1: Legacy building update logs e.g. 'Updated building "Tower B" parameters (incomerCableLength)'
  const buildingMatch = log.description.match(/^Updated building "([^"]+)" parameters(?:\s*\(([^)]+)\))?/);
  const isBuildingLog = Boolean(buildingMatch) || Object.keys(parsed).some(k => k.startsWith("incomer")) || (log.entityType === "BUILDING" && !Object.keys(parsed).some(k => BREAKER_FAMILY_FIELDS.has(k)));
  if (isBuildingLog) {
    const bldgName = buildingMatch ? buildingMatch[1] : "Building";
    const changes: FieldChange[] = [];
    for (const [key, val] of Object.entries(parsed)) {
      if (key in ALL_FIELD_LABELS) {
        changes.push({
          field: key,
          label: ALL_FIELD_LABELS[key],
          oldValue: null,
          newValue: val,
          oldDisplay: "Previously Set",
          newDisplay: formatFieldValue(key, val, familyNameMap),
        });
      }
    }

    if (changes.length > 0) {
      const isCable = changes.some(c => INCOMER_CABLE_FIELDS.has(c.field) || CABLE_CIRCUIT_FIELDS.has(c.field));
      const isBreaker = changes.some(c => INCOMER_BREAKER_FIELDS.has(c.field) || c.field === "breakerSize");
      const enrichedEntityType = isCable ? "CABLE" : isBreaker ? "BREAKER" : log.entityType;

      let enrichedDescription = log.description;
      if (changes.length === 1) {
        const ch = changes[0];
        enrichedDescription = isCable
          ? `Updated "${bldgName}" Cable W_MDB ${ch.label} to ${ch.newDisplay}`
          : `Updated "${bldgName}" ${ch.label} to ${ch.newDisplay}`;
      } else {
        const parts = changes.map(c => `${c.label}: ${c.newDisplay}`);
        enrichedDescription = isCable
          ? `Updated "${bldgName}" Cable W_MDB incomer cable parameters (${parts.join(", ")})`
          : `Updated building "${bldgName}" parameters (${parts.join(", ")})`;
      }

      return {
        ...log,
        description: enrichedDescription,
        entityType: enrichedEntityType,
        details: JSON.stringify({
          changes,
          raw: parsed,
        }),
      };
    }
  }

  // Check 2: Legacy project update logs
  const isGenericDescription =
    log.description === "Updated project parameters" ||
    log.description.startsWith("Updated project parameters");

  if (!isGenericDescription && !parsed.defaultAcbFamilyId && !parsed.defaultMccbFamilyId && !parsed.defaultMcbFamilyId) {
    return log;
  }

  const changes: FieldChange[] = [];
  const breakerFields = ["defaultAcbFamilyId", "defaultMccbFamilyId", "defaultMcbFamilyId"];
  const hasBreakers = breakerFields.some((f) => f in parsed);

  for (const [key, val] of Object.entries(parsed)) {
    if (key in ALL_FIELD_LABELS) {
      const label = ALL_FIELD_LABELS[key];
      const newDisplay = formatFieldValue(key, val, familyNameMap);
      changes.push({
        field: key,
        label,
        oldValue: null,
        newValue: val,
        oldDisplay: "Previously Set",
        newDisplay,
      });
    }
  }

  let enrichedDescription = log.description;
  let enrichedEntityType = log.entityType;

  if (hasBreakers) {
    enrichedEntityType = "BREAKER";
    const breakerSummaries: string[] = [];
    if (parsed.defaultAcbFamilyId) {
      const name = familyNameMap.get(parsed.defaultAcbFamilyId) || parsed.defaultAcbFamilyId;
      breakerSummaries.push(`ACB: ${name}`);
    }
    if (parsed.defaultMccbFamilyId) {
      const name = familyNameMap.get(parsed.defaultMccbFamilyId) || parsed.defaultMccbFamilyId;
      breakerSummaries.push(`MCCB: ${name}`);
    }
    if (parsed.defaultMcbFamilyId) {
      const name = familyNameMap.get(parsed.defaultMcbFamilyId) || parsed.defaultMcbFamilyId;
      breakerSummaries.push(`MCB: ${name}`);
    }

    if (breakerSummaries.length > 0) {
      enrichedDescription = `Selected default breaker families (${breakerSummaries.join(", ")})`;
    }
  } else if (changes.length > 0) {
    const summary = changes.map((c) => `${c.label}: ${c.newDisplay}`).join(", ");
    enrichedDescription = `Updated project parameters (${summary})`;
  }

  return {
    ...log,
    description: enrichedDescription,
    entityType: enrichedEntityType,
    details: JSON.stringify({
      changes,
      raw: parsed,
    }),
  };
}
