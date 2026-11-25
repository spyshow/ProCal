import type { CountryConfig } from '@/lib/country-defaults';

export interface ProjectFloorDesign {
  id: string;
  floorNumber: number;
  hasFloorSubPanels: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
}

export interface ProjectBuildingLoad {
  id: string;
  buildingId: string;
  loadLibraryItem: {
    id: string;
    name: string;
    category: string;
    power: number;
    phase: number;
    voltage: number;
    powerFactor: number;
  } | null;
  quantity: number;
  assignedPhase?: number | null;
}

export interface ProjectBuilding {
  id: string;
  name: string;
  floors: number;
  serviceFloors: number;
  apartmentsPerFloor: number;
  supplyVoltage: string;
  earthingSystem: string;
  lightningProtection: boolean;
  generator: number | null;
  transformer: number | null;
  mechanicalLoads: string | null;
  floorDesigns: ProjectFloorDesign[];
  buildingLoads: ProjectBuildingLoad[];
}

export interface ProjectDetailModel {
  id: string;
  name: string;
  client: string;
  consultant: string;
  contractor: string;
  location: string;
  engineer: string;
  voltage: number;
  frequency: number;
  powerFactor: number;
  maxDemandFactor: number;
  maxVoltageDropLighting: number;
  maxVoltageDropPower: number;
  preferredManufacturer: string;
  country: string;
  countryDefaults?: CountryConfig;
  logoUrl: string | null;
  calculationStandard?: string;
  isTrial?: boolean;
  isOwner?: boolean;
  buildings: ProjectBuilding[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apartmentTemplates: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadLibraryItems: any[];
}

export type ProjectDetailTab = 'buildings' | 'templates' | 'loads' | 'team' | 'qa' | 'activity' | 'settings';
