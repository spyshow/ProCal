export interface ComponentProperty {
  id: string;
  name: string;
  type: string;
  rating: string;
  voltage: string;
  current: string;
  power: string;
  cableSize?: string;
  connections: string[];
  upstream?: string[];
  downstream?: string[];
  floorNumber?: number;
  buildingName?: string;
}

export interface HierarchyItem {
  id: string;
  name: string;
  type: string;
  icon: 'zap' | 'cpu' | 'layers' | 'breaker' | 'plug';
  badge?: string;
  floorNumber?: number;
  children?: HierarchyItem[];
  data: ComponentProperty;
}
