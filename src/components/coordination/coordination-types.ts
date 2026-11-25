import type { PanelFeeder } from '@/types';

export type SelectivityStatus = 'FULL' | 'PARTIAL' | 'NONE';

export interface ProjectFeederItem extends PanelFeeder {
  id: string;
  buildingId: string;
  buildingName: string;
  floor: number;
}

export interface BreakerSettingRecord {
  id?: string;
  projectId?: string;
  breakerId?: string;
  model?: string | null;
  manufacturer?: string | null;
  frameSize?: string | null;
  ir?: number | null;
  tr?: number | null;
  isd?: number | null;
  tsd?: number | null;
  i2t?: boolean | null;
  ii?: number | null;
  ig?: number | null;
  tg?: number | null;
  [key: string]: unknown;
}
