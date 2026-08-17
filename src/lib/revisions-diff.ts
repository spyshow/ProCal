import type {
  SnapshotBuilding,
  SnapshotBuildingLoad,
  SnapshotFloorDesign,
  SnapshotItem,
  SnapshotLoadLibraryItem,
  SnapshotProject,
  SnapshotRoom,
  SnapshotTemplate,
} from "@/lib/revisions";

/**
 * Structural diff between two project snapshots (the live project or any two
 * revisions). Produces a flat, human-readable list of changes in the
 * `from → to` direction, so "diff(live, revision)" answers "what would a
 * restore change?". Pure functions only — safe to run in the browser.
 */

export type DiffKind = "added" | "removed" | "changed";
export type DiffCategory =
  | "project"
  | "building"
  | "floor"
  | "item"
  | "buildingLoad"
  | "template"
  | "room"
  | "loadLibraryItem";

export interface RevisionDiffChange {
  category: DiffCategory;
  kind: DiffKind;
  /** Human path label, e.g. `Building "Tower A" / Floor 5 / "F5 – Apt A"`. */
  label: string;
  /** Scalar field label for `changed` entries (e.g. "Breaker"). */
  field?: string;
  /** Display value in the base (from) state. */
  from?: string;
  /** Display value in the compared (to) state. */
  to?: string;
  /** Summary line for added/removed entries. */
  detail?: string;
}

type Scalar = string | number | boolean | null | undefined;

const norm = (v: Scalar): string | number | boolean | null =>
  v === undefined ? null : v;

const isSame = (a: Scalar, b: Scalar): boolean =>
  JSON.stringify(norm(a)) === JSON.stringify(norm(b));

const fmt = (v: Scalar): string => {
  const n = norm(v);
  if (n === null) return "—";
  if (typeof n === "number") {
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  }
  if (typeof n === "boolean") return n ? "Yes" : "No";
  return n;
};

function pushFieldChanges<T extends object>(
  from: T,
  to: T,
  fields: Record<string, string>,
  category: DiffCategory,
  label: string,
  out: RevisionDiffChange[]
) {
  for (const [field, fieldLabel] of Object.entries(fields)) {
    const a = from[field as keyof T] as unknown as Scalar | undefined;
    const b = to[field as keyof T] as unknown as Scalar | undefined;
    if (!isSame(a, b)) {
      out.push({
        category,
        kind: "changed",
        label,
        field: fieldLabel,
        from: fmt(a),
        to: fmt(b),
      });
    }
  }
}

/** Presence diffs (added/removed) plus a per-common-entity callback. */
function diffEntityLists<T extends { id: string }>(
  fromList: T[],
  toList: T[],
  category: DiffCategory,
  labelOf: (e: T) => string,
  detailOf: (e: T) => string,
  onBoth: (from: T, to: T, label: string) => void,
  out: RevisionDiffChange[]
) {
  const fromMap = new Map(fromList.map((e) => [e.id, e] as const));
  const toMap = new Map(toList.map((e) => [e.id, e] as const));
  for (const e of toList) {
    if (!fromMap.has(e.id)) {
      out.push({ category, kind: "added", label: labelOf(e), detail: detailOf(e) });
    }
  }
  for (const e of fromList) {
    if (!toMap.has(e.id)) {
      out.push({ category, kind: "removed", label: labelOf(e), detail: detailOf(e) });
    }
  }
  for (const [id, fe] of fromMap) {
    const te = toMap.get(id);
    if (te) onBoth(fe, te, labelOf(te));
  }
}

const PROJECT_FIELDS: Record<string, string> = {
  name: "Name",
  client: "Client",
  consultant: "Consultant",
  contractor: "Contractor",
  location: "Location",
  engineer: "Engineer",
  date: "Date",
  voltage: "Voltage (V)",
  frequency: "Frequency (Hz)",
  powerFactor: "Power factor",
  maxDemandFactor: "Max demand factor",
  transformerSize: "Transformer (kVA)",
  notes: "Notes",
  preferredManufacturer: "Preferred manufacturer",
  country: "Country",
  logoUrl: "Logo URL",
  calculationStandard: "Calculation standard",
  maxVoltageDropLighting: "Max voltage drop – lighting (%)",
  maxVoltageDropPower: "Max voltage drop – power (%)",
  ambientTemp: "Ambient temp (°C)",
  groupingCount: "Grouping count",
};

const BUILDING_FIELDS: Record<string, string> = {
  name: "Name",
  floors: "Floors",
  serviceFloors: "Service floors",
  apartmentsPerFloor: "Apartments/floor",
  mechanicalLoads: "Mechanical loads",
  generator: "Generator (kVA)",
  transformer: "Transformer (kVA)",
  supplyVoltage: "Supply voltage",
  earthingSystem: "Earthing system",
  lightningProtection: "Lightning protection",
};

const FLOOR_FIELDS: Record<string, string> = {
  floorNumber: "Floor number",
  hasFloorSubPanels: "Sub-panels",
  riserCableLength: "Riser length (m)",
  riserCableSize: "Riser cable",
  riserBreakerSize: "Riser breaker",
  riserInstallMethod: "Riser method",
  riserCableInsulation: "Riser insulation",
  riserCableMaterial: "Riser material",
  riserAmbientTemp: "Riser ambient temp (°C)",
  riserGroupingCount: "Riser grouping",
};

const ITEM_FIELDS: Record<string, string> = {
  name: "Name",
  type: "Type",
  breakerSize: "Breaker",
  cableSize: "Cable",
  cableLength: "Length (m)",
  voltageDrop: "Voltage drop (%)",
  calculatedConnectedLoad: "Connected load (W)",
  calculatedMaxDemand: "Max demand (W)",
  calculatedCurrent: "Current (A)",
  installMethod: "Installation method",
  cableInsulation: "Insulation",
  cableMaterial: "Material",
  ambientTemp: "Ambient temp (°C)",
  groupingCount: "Grouping",
  assignedPhase: "Phase",
};

const BUILDING_LOAD_FIELDS: Record<string, string> = {
  quantity: "Quantity",
  cableSize: "Cable",
  cableLength: "Length (m)",
  installMethod: "Installation method",
  cableInsulation: "Insulation",
  cableMaterial: "Material",
  ambientTemp: "Ambient temp (°C)",
  groupingCount: "Grouping",
  assignedPhase: "Phase",
};

const TEMPLATE_FIELDS: Record<string, string> = {
  name: "Name",
  phases: "Phases",
};

const ROOM_FIELDS: Record<string, string> = {
  type: "Type",
  name: "Name",
  area: "Area (m²)",
  hasAc: "Has AC",
  acBtu: "AC (BTU)",
  loadDensity: "Load density (VA/m²)",
  connectedLoad: "Connected load (W)",
};

const LIBRARY_FIELDS: Record<string, string> = {
  name: "Name",
  category: "Category",
  power: "Power (kW)",
  voltage: "Voltage (V)",
  phase: "Phase",
  powerFactor: "Power factor",
  demandFactor: "Demand factor",
  quantity: "Quantity",
  runningCurrent: "Running current (A)",
  startingCurrent: "Starting current (A)",
  notes: "Notes",
};

function diffItems(
  fromItems: SnapshotItem[],
  toItems: SnapshotItem[],
  floorLabel: string,
  out: RevisionDiffChange[]
) {
  diffEntityLists<SnapshotItem>(
    fromItems,
    toItems,
    "item",
    (it) => `${floorLabel} / “${it.name}”`,
    (it) => `${it.type} · ${fmt(it.breakerSize)} / ${fmt(it.cableSize)}`,
    (fi, ti, label) => {
      pushFieldChanges(fi, ti, ITEM_FIELDS, "item", label, out);
      // Referenced template / library load: compare resolved names.
      const tplFrom = fi.apartmentTemplate?.name;
      const tplTo = ti.apartmentTemplate?.name;
      if (!isSame(tplFrom, tplTo)) {
        out.push({
          category: "item",
          kind: "changed",
          label,
          field: "Apartment template",
          from: fmt(tplFrom),
          to: fmt(tplTo),
        });
      }
      const libFrom = fi.loadLibraryItem?.name;
      const libTo = ti.loadLibraryItem?.name;
      if (!isSame(libFrom, libTo)) {
        out.push({
          category: "item",
          kind: "changed",
          label,
          field: "Load",
          from: fmt(libFrom),
          to: fmt(libTo),
        });
      }
    },
    out
  );
}

function diffFloors(
  fromFloors: SnapshotFloorDesign[],
  toFloors: SnapshotFloorDesign[],
  buildingLabel: string,
  out: RevisionDiffChange[]
) {
  diffEntityLists<SnapshotFloorDesign>(
    fromFloors,
    toFloors,
    "floor",
    (fd) => `${buildingLabel} / Floor ${fd.floorNumber}`,
    (fd) =>
      `Sub-panels: ${fd.hasFloorSubPanels ? "Yes" : "No"} · ${(fd.items ?? []).length} circuits`,
    (ff, tf, label) => {
      pushFieldChanges(ff, tf, FLOOR_FIELDS, "floor", label, out);
      diffItems(ff.items ?? [], tf.items ?? [], label, out);
    },
    out
  );
}

function diffBuildingLoads(
  fromLoads: SnapshotBuildingLoad[],
  toLoads: SnapshotBuildingLoad[],
  buildingLabel: string,
  out: RevisionDiffChange[]
) {
  const loadName = (l: SnapshotBuildingLoad) =>
    l.loadLibraryItem?.name ?? (l.loadLibraryItemId ? "Load" : "Unassigned load");
  diffEntityLists<SnapshotBuildingLoad>(
    fromLoads,
    toLoads,
    "buildingLoad",
    (l) => `${buildingLabel} / Load “${loadName(l)}”`,
    (l) => `${loadName(l)} × ${l.quantity} · ${fmt(l.cableSize)}`,
    (fl, tl, label) => {
      pushFieldChanges(fl, tl, BUILDING_LOAD_FIELDS, "buildingLoad", label, out);
      const libFrom = fl.loadLibraryItem?.name;
      const libTo = tl.loadLibraryItem?.name;
      if (!isSame(libFrom, libTo)) {
        out.push({
          category: "buildingLoad",
          kind: "changed",
          label,
          field: "Load",
          from: fmt(libFrom),
          to: fmt(libTo),
        });
      }
    },
    out
  );
}

function diffBuildings(
  fromBuildings: SnapshotBuilding[],
  toBuildings: SnapshotBuilding[],
  out: RevisionDiffChange[]
) {
  diffEntityLists<SnapshotBuilding>(
    fromBuildings,
    toBuildings,
    "building",
    (b) => `Building “${b.name}”`,
    (b) => `${b.floors} floors · ${b.supplyVoltage} · ${b.earthingSystem}`,
    (fb, tb, label) => {
      pushFieldChanges(fb, tb, BUILDING_FIELDS, "building", label, out);
      diffBuildingLoads(fb.buildingLoads ?? [], tb.buildingLoads ?? [], label, out);
      diffFloors(fb.floorDesigns ?? [], tb.floorDesigns ?? [], label, out);
    },
    out
  );
}

function diffTemplates(
  fromTemplates: SnapshotTemplate[],
  toTemplates: SnapshotTemplate[],
  out: RevisionDiffChange[]
) {
  diffEntityLists<SnapshotTemplate>(
    fromTemplates,
    toTemplates,
    "template",
    (t) => `Template “${t.name}”`,
    (t) => `${t.phases === 3 ? "3-phase" : "1-phase"} · ${(t.rooms ?? []).length} rooms`,
    (ft, tt, label) => {
      pushFieldChanges(ft, tt, TEMPLATE_FIELDS, "template", label, out);
      diffEntityLists<SnapshotRoom>(
        ft.rooms ?? [],
        tt.rooms ?? [],
        "room",
        (r) => `${label} / Room “${r.name}”`,
        (r) => `${r.type} · ${r.area} m²`,
        (fr, tr, roomLabel) => {
          pushFieldChanges(fr, tr, ROOM_FIELDS, "room", roomLabel, out);
        },
        out
      );
    },
    out
  );
}

function diffLibrary(
  fromLib: SnapshotLoadLibraryItem[],
  toLib: SnapshotLoadLibraryItem[],
  out: RevisionDiffChange[]
) {
  diffEntityLists<SnapshotLoadLibraryItem>(
    fromLib,
    toLib,
    "loadLibraryItem",
    (l) => `Load Library “${l.name}”`,
    (l) => `${l.category} · ${l.power} kW`,
    (fl, tl, label) => {
      pushFieldChanges(fl, tl, LIBRARY_FIELDS, "loadLibraryItem", label, out);
    },
    out
  );
}

/**
 * Diffs `from` (base state) against `to` (compared state). For a restore
 * preview call `diffProjectSnapshots(liveProject, revisionSnapshot)` — the
 * result lists exactly what applying the snapshot would change.
 */
export function diffProjectSnapshots(
  from: SnapshotProject,
  to: SnapshotProject
): RevisionDiffChange[] {
  const out: RevisionDiffChange[] = [];

  pushFieldChanges(from, to, PROJECT_FIELDS, "project", "Project", out);
  diffBuildings(from.buildings ?? [], to.buildings ?? [], out);
  diffTemplates(from.apartmentTemplates ?? [], to.apartmentTemplates ?? [], out);
  diffLibrary(from.loadLibraryItems ?? [], to.loadLibraryItems ?? [], out);

  return out;
}

/** Counts per kind — handy for summary chips. */
export function summarizeChanges(changes: RevisionDiffChange[]): {
  added: number;
  removed: number;
  changed: number;
} {
  return {
    added: changes.filter((c) => c.kind === "added").length,
    removed: changes.filter((c) => c.kind === "removed").length,
    changed: changes.filter((c) => c.kind === "changed").length,
  };
}
