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
  voltageDrop: number | null;
  apartmentTemplateId?: string | null;
  apartmentTemplate?: ApartmentTemplate | null;
  loadLibraryItemId?: string | null;
  loadLibraryItem?: { name: string; category: string; power: number } | null;
}

export interface FloorDesign {
  id: string;
  floorNumber: number;
  hasFloorSubPanels: boolean;
  items: FloorItem[];
}

export interface Building {
  id: string;
  name: string;
  floors: number;
  serviceFloors: number;
  apartmentsPerFloor: number;
  elevators: number;
  waterPumps: number;
  firePump: boolean;
  splitAc: number;
  centralAc: number;
  supplyVoltage: string;
  earthingSystem: string;
  lightningProtection: boolean;
  mechanicalLoads?: string | null;
  generator?: number | null;
  transformer?: number | null;
  floorDesigns: FloorDesign[];
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
  logoUrl?: string | null;
  maxVoltageDropLighting: number;
  maxVoltageDropPower: number;
  buildings: Building[];
  apartmentTemplates: ApartmentTemplate[];
  loadLibraryItems: LoadLibraryItem[];
}

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
}

export type ReportTab = 'bom' | 'mdb' | 'cable' | 'vd' | 'summary';
