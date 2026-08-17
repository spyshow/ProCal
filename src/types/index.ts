export interface ApartmentRoom {
  id: string;
  type: string; // KITCHEN, BEDROOM, LIVING_ROOM, DINING_ROOM, BATHROOM, HALL, OTHER
  name: string;
  area: number;
  hasAc: boolean;
  acBtu: number | null;
  loadDensity: number;
  connectedLoad: number;
}

export interface ApartmentTemplate {
  id: string;
  name: string;
  phases: number;
  rooms: ApartmentRoom[];
  createdAt: string;
  updatedAt: string;
}

export interface FloorItem {
  id: string;
  name: string;
  type: string;
  calculatedConnectedLoad: number;
  calculatedMaxDemand: number;
  calculatedCurrent: number;
  breakerSize: string;
  cableSize: string;
  cableLength?: number | null;
  voltageDrop: number | null;
  installMethod?: string | null;
  cableInsulation?: string | null;
  cableMaterial?: string | null; // "copper" | "aluminum"
  ambientTemp?: number | null;
  groupingCount?: number | null;
  apartmentTemplateId?: string | null;
  apartmentTemplate?: ApartmentTemplate | null;
  loadLibraryItemId?: string | null;
  loadLibraryItem?: LoadLibraryItem | null;
  floorDesignId?: string;
  // Per-phase balancing: assigned phase 1=L1, 2=L2, 3=L3 for a single-phase item.
  // null = unassigned → phaseBalance computes greedy LPT assignment on-read.
  // Ignored for 3-phase items (they draw from all three). Lockstep with Prisma.
  assignedPhase?: number | null;
}

export interface FloorDesign {
  id: string;
  floorNumber: number;
  hasFloorSubPanels: boolean;
  riserCableLength?: number | null; // meters — riser cable from MDB to SDB
  riserCableSize?: string | null; // e.g., "120 mm²"
  riserBreakerSize?: string | null; // e.g., "630A"
  riserInstallMethod?: string | null; // IEC 60364-5-52 method (B1, B2, C, E, F, G) — SDB only
  riserCableInsulation?: string | null; // "PVC" or "XLPE" — SDB only
  riserCableMaterial?: string | null; // "copper" or "aluminum" — SDB only
  riserAmbientTemp?: number | null;
  riserGroupingCount?: number | null;
  items: FloorItem[];
}

export interface BuildingLoad {
  id: string;
  buildingId: string;
  loadLibraryItemId: string | null;
  loadLibraryItem: LoadLibraryItem | null;
  quantity: number;
  breakerSize?: string | null;
  cableSize?: string | null;
  cableLength?: number | null;
  installMethod?: string | null;
  cableInsulation?: string | null;
  cableMaterial?: string | null; // "copper" | "aluminum"
  ambientTemp?: number | null;
  groupingCount?: number | null;
  // Per-phase balancing: assigned phase 1=L1, 2=L2, 3=L3 for a single-phase
  // building load. null = unassigned → phaseBalance computes greedy LPT on-read.
  // Ignored for 3-phase loads. Lockstep with Prisma.
  assignedPhase?: number | null;
}

export type EarthingSystem = 'TN-S' | 'TN-C' | 'TN-C-S' | 'TT' | 'IT';

export interface Building {
  id: string;
  name: string;
  floors: number;
  serviceFloors: number;
  apartmentsPerFloor: number;
  supplyVoltage: string;
  earthingSystem: string;
  lightningProtection: boolean;
  mechanicalLoads?: string | null;
  generator?: number | null;
  transformer?: number | null;
  floorDesigns: FloorDesign[];
  buildingLoads: BuildingLoad[];
}

export interface Project {
  id: string;
  name: string;
  client: string;
  consultant: string;
  contractor: string;
  location: string;
  engineer: string;
  date: string;
  voltage: number;
  frequency: number;
  powerFactor: number;
  transformerSize?: number | null; // kVA — sized transformer (Prisma: Float?)
  country: string;
  preferredManufacturer: string;
  defaultAcbFamilyId?: string | null;
  defaultMccbFamilyId?: string | null;
  defaultMcbFamilyId?: string | null;
  logoUrl?: string | null;
  ambientTemp?: number | null;
  groupingCount?: number | null;
  // Per-phase balancing: calculation standard selects the current-unbalance
  // limit + label (IEC/EN 50160 vs NEMA). Default IEC. Lockstep with Prisma
  // (stored as String, narrowed here).
  calculationStandard?: CalculationStandard;
  maxVoltageDropLighting: number;
  maxVoltageDropPower: number;
  buildings: Building[];
  apartmentTemplates: ApartmentTemplate[];
  loadLibraryItems: LoadLibraryItem[];
}

/**
 * An issued revision of a project's engineering state. Carries a JSON snapshot
 * of the project at issue time so the revision stays reproducible after the
 * live project changes. See `ProjectRevision` in prisma/schema.prisma.
 */
export interface ProjectRevision {
  id: string;
  projectId: string;
  /** "R0", "R1", … — auto-incremented per project. */
  rev: string;
  description: string;
  createdById: string;
  /** Username of the engineer who issued the revision. */
  createdByUsername: string;
  /** Full serialized project state at issue time. */
  snapshotJson: string;
  createdAt: string;
}

/**
 * Per-phase balancing calculation standard. Selects the current-unbalance
 * limit + the label shown (NOT the VUF/LVUR definition — ProCal computes a
 * current-unbalance proxy; see design doc "Engineering Review" §D4).
 *   IEC → EN 50160 framing (default, roadmap leans Middle-East)
 *   NEMA → American framing
 */
export type CalculationStandard = "IEC" | "NEMA";

/**
 * Assigned phase for a single-phase load: 1=L1, 2=L2, 3=L3.
 * null = unassigned → phaseBalance greedy-assigns on-read.
 */
export type AssignedPhase = 1 | 2 | 3;

export interface LoadLibraryItem {
  id: string;
  name: string;
  category: string;
  power: number;
  voltage: number;
  phase: number;
  powerFactor: number;
  demandFactor: number;
  quantity: number;
  runningCurrent: number;
  startingCurrent: number | null;
  notes: string | null;
}

export type FallbackType = 'SAME_FAMILY' | 'OTHER_FAMILY' | 'OTHER_BRAND' | 'GENERIC_SPEC';

export interface GenericBreakerSpec {
  ratingAmps: number;
  category: 'ACB' | 'MCCB' | 'MCB';
  poles: number;
  requiredIcuKa: number;
  tripUnitType: string;
  standard: string;
  procurementNotes?: string;
}

export interface PanelFeeder {
  name: string;
  type: string;
  current: number;
  breakerSize: number;
  cableSize: number;
  breakerModel: string;
  manufacturer: string | null;
  familyName: string | null;
  fallback: boolean;
  fallbackType?: FallbackType;
  genericSpec?: GenericBreakerSpec;
  isThreePhase: boolean;
  // Per-phase balancing fields (T4/T6). For 1-phase items, assignedPhase is the
  // resolved L1/L2/L3 phase (1/2/3). For SMDB risers, phaseCurrent/phaseKw reflect
  // the aggregated floor board, and neutralCurrent/unbalancePct track imbalance.
  assignedPhase?: number | null;
  phaseCurrent?: [number, number, number];
  phaseKw?: [number, number, number];
  neutralCurrent?: number;
  unbalancePct?: number;
  imbalanced?: boolean;
  neutralOversized?: boolean;
  internalImbalanceNotModeled?: boolean;
  // Protection hierarchy & selectivity fields
  parentFeederName?: string | null;
  faultCurrentKa?: number;
  selectivityStatus?: 'FULL' | 'PARTIAL' | 'NONE' | null;
  /** Selectivity limit in kA (not A) — only meaningful for PARTIAL; FULL/NONE carry null. */
  selectivityLimitKa?: number | null;
  cableDamageOk?: boolean;
  cableIz?: number;
  isUnderProtected?: boolean;
  parallelRuns?: number;
  formattedCableSize?: string;
  recommendedCableSize?: number;
  recommendedCableSizeFormatted?: string;
  selectivityReason?: string | null;
  suggestedAlternative?: string | null;
  alternativeSuggestions?: BreakerAlternativeSuggestion[];
  itemId?: string;
  floorDesignId?: string;
  buildingLoadId?: string;
  baseBreakerSize?: number;
  isBreakerUpsized?: boolean;
  upsizeReason?: string;
  // Breaking capacity (Icu, kA) of the selected device and whether it can
  // interrupt the prospective fault current at its location (Ic >= Isc).
  breakingCapacityKa?: number | null;
  icuOk?: boolean;
}

export interface BreakerAlternativeSuggestion {
  id: string;
  type: 'UPSTREAM_UPGRADE' | 'DOWNSTREAM_RESIZE' | 'ELECTRONIC_TRIP_UNIT' | 'SETTINGS_ADJUSTMENT' | 'DIRECT_MDB_FEED';
  badge: string;
  title: string;
  description: string;
  suggestedModel?: string;
  suggestedFrameSize?: number;
  fallbackType?: FallbackType;
  genericSpec?: GenericBreakerSpec;
  suggestedSettings?: { ir?: number; tr?: number; isd?: number; tsd?: number; ii?: number };
  expectedSelectivity: 'FULL' | 'PARTIAL';
  expectedLimitKa?: number;
  actionText?: string;
}

export type ReportTab = 'bom' | 'mdb' | 'cable' | 'vd' | 'summary';
