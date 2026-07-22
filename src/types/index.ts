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
  apartmentTemplateId?: string | null;
  apartmentTemplate?: ApartmentTemplate | null;
  loadLibraryItemId?: string | null;
  loadLibraryItem?: LoadLibraryItem | null;
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
  items: FloorItem[];
}

export interface BuildingLoad {
  id: string;
  buildingId: string;
  loadLibraryItemId: string | null;
  loadLibraryItem: LoadLibraryItem | null;
  quantity: number;
  cableSize?: string | null;
  cableLength?: number | null;
  installMethod?: string | null;
  cableInsulation?: string | null;
  // Per-phase balancing: assigned phase 1=L1, 2=L2, 3=L3 for a single-phase
  // building load. null = unassigned → phaseBalance computes greedy LPT on-read.
  // Ignored for 3-phase loads. Lockstep with Prisma.
  assignedPhase?: number | null;
}

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
  country: string;
  preferredManufacturer: string;
  defaultAcbFamilyId?: string | null;
  defaultMccbFamilyId?: string | null;
  defaultMcbFamilyId?: string | null;
  logoUrl?: string | null;
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
}

export type ReportTab = 'bom' | 'mdb' | 'cable' | 'vd' | 'summary';
