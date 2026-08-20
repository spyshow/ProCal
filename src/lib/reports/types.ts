import type { Project } from "@/types";

/**
 * A single BOM line for cable or breaker procurement.
 */
export interface BOMRow {
  size: number;
  cores?: number;
  phase?: number;
  description?: string;
  rating: number;
  count: number;
  totalLength: number;
}

/**
 * Per-row Brand of Materials cables and breakers.
 */
export interface BOMResult {
  cables: BOMRow[];
  breakers: BOMRow[];
}

/**
 * Feeder row ready for the printable MDB schedule.
 */
export interface FeederRow {
  index: number;
  buildingName: string;
  buildingId: string;
  floor: number;
  feeder: string;
  type: string;
  demandKw: number;
  current: number;
  breakerAmps: number;
  cableMm2: number;
  breakerModel: string;
  isThreePhase: boolean;
  isSubPanel: boolean;
}

/**
 * Cable row ready for the printable cable schedule.
 */
export interface CableRow {
  circuit: string;
  buildingName: string;
  floor: number;
  phase: number;
  current: number;
  breakerAmps: number;
  cableMm2: number;
  method: string;
  insulation: 'PVC' | 'XLPE';
  material?: 'copper' | 'aluminum';
}

/**
 * Breaker row ready for the printable breaker schedule.
 */
export interface BreakerRow {
  feeder: string;
  buildingName: string;
  buildingId: string;
  floor: number;
  type: string;
  current: number;
  breakerAmps: number;
  cableMm2: number;
  breakerModel: string;
  isThreePhase: boolean;
}

/**
 * Voltage-drop row ready for the printable voltage-drop schedule.
 */
export interface VoltageDropRow {
  circuit: string;
  buildingName: string;
  floor: number;
  current: number;
  cableMm2: number;
  lengthMeters: number;
  voltageDropPercent: number;
  status: 'OK' | 'WARNING' | 'FAIL';
}

/**
 * Load analysis and phase balancing row.
 */
export interface LoadRow {
  buildingName: string;
  buildingId: string;
  floor: number;
  name: string;
  type: string;
  connectedLoadKw: number;
  demandFactor: number;
  maxDemandKw: number;
  maxDemandKva: number;
  phase: number;
  currentL1: number;
  currentL2: number;
  currentL3: number;
  powerFactor: number;
}

/**
 * Short-circuit analysis row per feeder / distribution board.
 */
export interface ShortCircuitRow {
  feeder: string;
  buildingName: string;
  buildingId: string;
  floor: number;
  type: string;
  cableLengthM: number;
  cableSizeMm2: number;
  threePhaseIscKa: number;
  twoPhaseIscKa: number;
  breakerIcuKa?: number;
  status: 'SAFE' | 'MARGINAL' | 'OVERLOAD';
}

/**
 * Complete set of report schedules derived from a project.
 */
export interface ReportData {
  project: Project;
  bom: BOMResult;
  feeders: FeederRow[];
  cables: CableRow[];
  breakers: BreakerRow[];
  voltageDrops: VoltageDropRow[];
  loads?: LoadRow[];
  shortCircuits?: ShortCircuitRow[];
}

/**
 * Report sections that can be toggled individually.
 */
export type ReportSection =
  | 'cover'
  | 'loads'
  | 'mdb'
  | 'cable'
  | 'breaker'
  | 'vd'
  | 'shortCircuit'
  | 'bom';

/**
 * Options controlling the generated report output.
 */
export interface ReportOptions {
  sections: ReportSection[];
  includeLogo: boolean;
  includeTimestamp: boolean;
}
