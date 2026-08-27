// IEC 60364-5-52 Reference Data for Cable Sizing — installation methods,
// per-method ampacity tables, and ambient correction factors.

import { CABLE_CATALOG } from "./cablesData";

export type MethodCategory = 'conduit' | 'surface' | 'tray' | 'void' | 'ground';

export interface InstallationMethod {
  id: string;
  number: number;
  code: string;
  refMethod: string;
  name: string;
  description: string;
  category: MethodCategory;
}

export const INSTALLATION_METHODS: InstallationMethod[] = [
  // Page 1: Methods 1 - 21
  {
    id: '1',
    number: 1,
    code: 'A1',
    refMethod: 'A1',
    name: 'Method 1 (A1)',
    description: 'Insulated conductors or single-core cables in conduit in a thermally insulated wall',
    category: 'conduit',
  },
  {
    id: '2',
    number: 2,
    code: 'A2',
    refMethod: 'A2',
    name: 'Method 2 (A2)',
    description: 'Multi-core cables in conduit in a thermally insulated wall',
    category: 'conduit',
  },
  {
    id: '3',
    number: 3,
    code: 'A1',
    refMethod: 'A1',
    name: 'Method 3 (A1)',
    description: 'Multi-core cable direct in a thermally insulated wall',
    category: 'surface',
  },
  {
    id: '4',
    number: 4,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 4 (B1)',
    description: 'Insulated conductors or single-core cables in conduit on a wooden or masonry wall or spaced less than 0.3 × conduit diameter from it',
    category: 'conduit',
  },
  {
    id: '5',
    number: 5,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 5 (B2)',
    description: 'Multi-core cable in conduit on a wooden or masonry wall or spaced less than 0.3 × conduit diameter from it',
    category: 'conduit',
  },
  {
    id: '6',
    number: 6,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 6 (B1)',
    description: 'Insulated conductors or single-core cables in cable trunking on a wooden or masonry wall run horizontally or vertically',
    category: 'conduit',
  },
  {
    id: '8',
    number: 8,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 8 (B2)',
    description: 'Multi-core cable in cable trunking on a wooden or masonry wall run horizontally or vertically',
    category: 'conduit',
  },
  {
    id: '10',
    number: 10,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 10 (B1)',
    description: 'Insulated conductors or single-core cable in suspended cable trunking',
    category: 'conduit',
  },
  {
    id: '11',
    number: 11,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 11 (B2)',
    description: 'Multi-core cable in suspended cable trunking',
    category: 'conduit',
  },
  {
    id: '12',
    number: 12,
    code: 'A1',
    refMethod: 'A1',
    name: 'Method 12 (A1)',
    description: 'Insulated conductors or single-core cable run in mouldings',
    category: 'surface',
  },
  {
    id: '15',
    number: 15,
    code: 'A1',
    refMethod: 'A1',
    name: 'Method 15 (A1)',
    description: 'Insulated conductors in conduit or single-core or multi-core cable in architrave',
    category: 'surface',
  },
  {
    id: '16',
    number: 16,
    code: 'A1',
    refMethod: 'A1',
    name: 'Method 16 (A1)',
    description: 'Insulated conductors in conduit or single-core or multi-core cable in window frames',
    category: 'surface',
  },
  {
    id: '20',
    number: 20,
    code: 'C',
    refMethod: 'C',
    name: 'Method 20 (C)',
    description: 'Single-core or multi-core cables fixed on, or spaced less than 0.3 × cable diameter from a wooden or masonry wall',
    category: 'surface',
  },
  {
    id: '21',
    number: 21,
    code: 'C',
    refMethod: 'C',
    name: 'Method 21 (C)',
    description: 'Single-core or multi-core cables fixed directly under a wooden or masonry ceiling',
    category: 'surface',
  },

  // Page 2: Methods 22 - 36
  {
    id: '22',
    number: 22,
    code: 'E',
    refMethod: 'E',
    name: 'Method 22 (E)',
    description: 'Single-core or multi-core cables spaced from a ceiling',
    category: 'surface',
  },
  {
    id: '30',
    number: 30,
    code: 'C',
    refMethod: 'C',
    name: 'Method 30 (C)',
    description: 'Single-core or multi-core cables on unperforated tray run horizontally or vertically',
    category: 'tray',
  },
  {
    id: '31-F-touch',
    number: 31,
    code: 'F (touch.)',
    refMethod: 'F',
    name: 'Method 31 - F (Touching)',
    description: 'Single-core cable on perforated tray run horizontally or vertically (Touching)',
    category: 'tray',
  },
  {
    id: '31-F-tref',
    number: 31,
    code: 'F (tref.)',
    refMethod: 'F',
    name: 'Method 31 - F (Trefoil)',
    description: 'Single-core cable on perforated tray run horizontally or vertically (Trefoil)',
    category: 'tray',
  },
  {
    id: '31-E',
    number: 31,
    code: 'E',
    refMethod: 'E',
    name: 'Method 31 - E',
    description: 'Multi-core cable on perforated tray run horizontally or vertically',
    category: 'tray',
  },
  {
    id: '32-F-touch',
    number: 32,
    code: 'F (touch.)',
    refMethod: 'F',
    name: 'Method 32 - F (Touching)',
    description: 'Single-core cable on brackets or on a wire mesh tray run horizontally or vertically (Touching)',
    category: 'tray',
  },
  {
    id: '32-F-tref',
    number: 32,
    code: 'F (tref.)',
    refMethod: 'F',
    name: 'Method 32 - F (Trefoil)',
    description: 'Single-core cable on brackets or on a wire mesh tray run horizontally or vertically (Trefoil)',
    category: 'tray',
  },
  {
    id: '32-E',
    number: 32,
    code: 'E',
    refMethod: 'E',
    name: 'Method 32 - E',
    description: 'Multi-core cable on brackets or on a wire mesh tray run horizontally or vertically',
    category: 'tray',
  },
  {
    id: '33-F-touch',
    number: 33,
    code: 'F (touch.)',
    refMethod: 'F',
    name: 'Method 33 - F (Touching)',
    description: 'Single-core cable spaced more than 0.3 times cable diameter from a wall (Touching)',
    category: 'surface',
  },
  {
    id: '33-E',
    number: 33,
    code: 'E',
    refMethod: 'E',
    name: 'Method 33 - E',
    description: 'Multi-core cable spaced more than 0.3 times cable diameter from a wall',
    category: 'surface',
  },
  {
    id: '34-F-touch',
    number: 34,
    code: 'F (touch.)',
    refMethod: 'F',
    name: 'Method 34 - F (Touching)',
    description: 'Single-core cable on ladder (Touching)',
    category: 'tray',
  },
  {
    id: '34-F-tref',
    number: 34,
    code: 'F (tref.)',
    refMethod: 'F',
    name: 'Method 34 - F (Trefoil)',
    description: 'Single-core cable on ladder (Trefoil)',
    category: 'tray',
  },
  {
    id: '34-E',
    number: 34,
    code: 'E',
    refMethod: 'E',
    name: 'Method 34 - E',
    description: 'Multi-core cable on ladder',
    category: 'tray',
  },
  {
    id: '35-F-tref',
    number: 35,
    code: 'F (tref.)',
    refMethod: 'F',
    name: 'Method 35 - F (Trefoil)',
    description: 'Single-core cable suspended from or incorporating a support wire or harness (Trefoil)',
    category: 'surface',
  },
  {
    id: '35-E',
    number: 35,
    code: 'E',
    refMethod: 'E',
    name: 'Method 35 - E',
    description: 'Multi-core cable suspended from or incorporating a support wire or harness',
    category: 'surface',
  },
  {
    id: '36-G-H',
    number: 36,
    code: 'G (H)',
    refMethod: 'G',
    name: 'Method 36 - G (Horizontal)',
    description: 'Bare or insulated conductors on insulators (Spaced horizontally)',
    category: 'surface',
  },

  // Page 3: Methods 36(V) - 45
  {
    id: '36-G-V',
    number: 36,
    code: 'G (V)',
    refMethod: 'G',
    name: 'Method 36 - G (Vertical)',
    description: 'Bare or insulated conductors on insulators (Spaced vertically)',
    category: 'surface',
  },
  {
    id: '40-B2',
    number: 40,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 40 - B2',
    description: 'Single-core or multi-core cable in a building void (1.5 De ≤ V < 5 De)',
    category: 'void',
  },
  {
    id: '40-B1',
    number: 40,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 40 - B1',
    description: 'Single-core or multi-core cable in a building void (5 De ≤ V < 20 De)',
    category: 'void',
  },
  {
    id: '41-B2',
    number: 41,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 41 - B2',
    description: 'Insulated conductors in conduit in a building void (1.5 De ≤ V < 20 De)',
    category: 'void',
  },
  {
    id: '41-B1',
    number: 41,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 41 - B1',
    description: 'Insulated conductors in conduit in a building void (V ≥ 20 De)',
    category: 'void',
  },
  {
    id: '42-B2',
    number: 42,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 42 - B2',
    description: 'Single-core or multi-core cable in conduit in a building void (1.5 De ≤ V < 20 De)',
    category: 'void',
  },
  {
    id: '42-B1',
    number: 42,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 42 - B1',
    description: 'Single-core or multi-core cable in conduit in a building void (V ≥ 20 De)',
    category: 'void',
  },
  {
    id: '43-B2',
    number: 43,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 43 - B2',
    description: 'Insulated conductors ducting in a building void (1.5 De ≤ V < 20 De)',
    category: 'void',
  },
  {
    id: '43-B1',
    number: 43,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 43 - B1',
    description: 'Insulated conductors ducting in a building void (V ≥ 20 De)',
    category: 'void',
  },
  {
    id: '44-B2',
    number: 44,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 44 - B2',
    description: 'Single-core or multi-core cable ducting in a building void (1.5 De ≤ V < 20 De)',
    category: 'void',
  },
  {
    id: '44-B1',
    number: 44,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 44 - B1',
    description: 'Single-core or multi-core cable ducting in a building void (V ≥ 20 De)',
    category: 'void',
  },
  {
    id: '45-B2',
    number: 45,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 45 - B2',
    description: 'Insulated conductors ducting in masonry (thermal resistivity ≤ 2 K·m/W, 1.5 De ≤ V < 5 De)',
    category: 'void',
  },

  // Page 4: Methods 45(B1) - 55
  {
    id: '45-B1',
    number: 45,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 45 - B1',
    description: 'Insulated conductors ducting in masonry (thermal resistivity ≤ 2 K·m/W, 5 De ≤ V < 50 De)',
    category: 'void',
  },
  {
    id: '46-B2',
    number: 46,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 46 - B2',
    description: 'Single-core or multi-core cable in cable ducting in masonry (≤ 2 K·m/W, 1.5 De ≤ V < 20 De)',
    category: 'void',
  },
  {
    id: '46-B1',
    number: 46,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 46 - B1',
    description: 'Single-core or multi-core cable in cable ducting in masonry (≤ 2 K·m/W, V ≥ 20 De)',
    category: 'void',
  },
  {
    id: '47-B2',
    number: 47,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 47 - B2',
    description: 'Single-core or multi-core cable in a ceiling void or raised floor (1.5 De ≤ V < 5 De)',
    category: 'void',
  },
  {
    id: '47-B1',
    number: 47,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 47 - B1',
    description: 'Single-core or multi-core cable in a ceiling void or raised floor (5 De ≤ V < 50 De)',
    category: 'void',
  },
  {
    id: '50',
    number: 50,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 50 (B1)',
    description: 'Insulated conductors or single-core cable in flush cable trunking in the floor',
    category: 'conduit',
  },
  {
    id: '51',
    number: 51,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 51 (B2)',
    description: 'Multi-core cable in flush cable trunking in the floor',
    category: 'conduit',
  },
  {
    id: '52',
    number: 52,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 52 (B1)',
    description: 'Insulated conductors or single-core cables in flush cable trunking',
    category: 'conduit',
  },
  {
    id: '53',
    number: 53,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 53 (B2)',
    description: 'Multi-core cable in flush trunking',
    category: 'conduit',
  },
  {
    id: '54-B2',
    number: 54,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 54 - B2',
    description: 'Insulated conductors or single-core in conduit in unventilated cable channel (1.5 De ≤ V < 20 De)',
    category: 'conduit',
  },
  {
    id: '54-B1',
    number: 54,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 54 - B1',
    description: 'Insulated conductors or single-core in conduit in unventilated cable channel (V ≥ 20 De)',
    category: 'conduit',
  },
  {
    id: '55',
    number: 55,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 55 (B1)',
    description: 'Insulated conductors in conduit in an open or ventilated cable channel run horizontally or vertically',
    category: 'conduit',
  },

  // Page 5: Methods 56 - 73
  {
    id: '56',
    number: 56,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 56 (B1)',
    description: 'Single-core or multi-core cable in an open or ventilated cable channel run horizontally or vertically',
    category: 'conduit',
  },
  {
    id: '57',
    number: 57,
    code: 'C',
    refMethod: 'C',
    name: 'Method 57 (C)',
    description: 'Single-core or multi-core cable direct in masonry having a thermal resistivity not greater than 2 K·m/W',
    category: 'surface',
  },
  {
    id: '58',
    number: 58,
    code: 'C',
    refMethod: 'C',
    name: 'Method 58 (C)',
    description: 'Single-core or multi-core cable direct in masonry (thermal resistivity ≤ 2 K·m/W) with added mechanical protection',
    category: 'surface',
  },
  {
    id: '59',
    number: 59,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 59 (B1)',
    description: 'Insulated conductors or single-core cables in conduit in masonry',
    category: 'conduit',
  },
  {
    id: '60',
    number: 60,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 60 (B2)',
    description: 'Multi-core cables in conduit in masonry',
    category: 'conduit',
  },
  {
    id: '70',
    number: 70,
    code: 'D1',
    refMethod: 'D1',
    name: 'Method 70 (D1)',
    description: 'Multi-core cable in conduit or in cable ducting in the ground',
    category: 'ground',
  },
  {
    id: '71',
    number: 71,
    code: 'D1',
    refMethod: 'D1',
    name: 'Method 71 (D1)',
    description: 'Single-core cable in conduit or in cable ducting in the ground',
    category: 'ground',
  },
  {
    id: '72',
    number: 72,
    code: 'D2',
    refMethod: 'D2',
    name: 'Method 72 (D2)',
    description: 'Sheathed single-core or multi-core cables direct in the ground',
    category: 'ground',
  },
  {
    id: '73',
    number: 73,
    code: 'D2',
    refMethod: 'D2',
    name: 'Method 73 (D2)',
    description: 'Sheathed single-core or multi-core cables direct in the ground with added mechanical protection',
    category: 'ground',
  },
];

// ===========================================================================
// NEC / NEMA (NFPA 70) Wiring & Installation Methods
// ===========================================================================
export const NEC_INSTALLATION_METHODS: InstallationMethod[] = [
  {
    id: 'NEC-1',
    number: 1,
    code: 'Raceway',
    refMethod: '310.16',
    name: 'Conduit / Raceway in Air (EMT / RMC / IMC)',
    description: 'Insulated conductors in metallic or nonmetallic conduit/raceway in free air (NEC Table 310.16)',
    category: 'conduit',
  },
  {
    id: 'NEC-2',
    number: 2,
    code: 'Conduit in Wall',
    refMethod: '310.16',
    name: 'Conduit / Tubing in Insulated Wall or Ceiling',
    description: 'Conductors in conduit installed in thermally insulated walls or building envelopes (NEC Table 310.16)',
    category: 'conduit',
  },
  {
    id: 'NEC-3',
    number: 3,
    code: 'Wireway',
    refMethod: '310.16',
    name: 'Surface Metallic / Nonmetallic Wireway & Raceway',
    description: 'Surface-mounted raceway, wireway, or auxiliary gutter (NEC Article 376/386, Table 310.16)',
    category: 'conduit',
  },
  {
    id: 'NEC-4',
    number: 4,
    code: 'Cable Tray',
    refMethod: '392.80(A)',
    name: 'Ladder / Ventilated Cable Tray (Multiconductor Cable)',
    description: 'Multiconductor cables in ladder or ventilated trough cable tray (NEC 392.80(A)(1), Table 310.16)',
    category: 'tray',
  },
  {
    id: 'NEC-5',
    number: 5,
    code: 'Tray (Spaced)',
    refMethod: '310.17',
    name: 'Single Conductors in Ventilated Tray with Spacing (≥1 Dia)',
    description: 'Single-conductor cables spaced ≥1 cable diameter in ventilated tray (NEC 392.80(B)(1)(a), Table 310.17 Free Air)',
    category: 'tray',
  },
  {
    id: 'NEC-6',
    number: 6,
    code: 'Tray (Touching)',
    refMethod: '392.80(B)',
    name: 'Single Conductors in Ventilated Tray (Touching / Unspaced)',
    description: 'Single-conductor cables touching in ventilated cable tray without spacing (NEC 392.80(B)(1)(b), 65% of Table 310.17)',
    category: 'tray',
  },
  {
    id: 'NEC-7',
    number: 7,
    code: 'Solid Bottom Tray',
    refMethod: '392.80(A)',
    name: 'Solid Bottom Cable Tray (Multiconductor Cables)',
    description: 'Multiconductor cables in solid bottom cable tray (NEC 392.80(A)(1)(a), 95% of Table 310.16)',
    category: 'tray',
  },
  {
    id: 'NEC-8',
    number: 8,
    code: 'Free Air',
    refMethod: '310.17',
    name: 'Single Insulated Conductors in Free Air / Messengers',
    description: 'Single insulated conductors supported in free air or on messengers (NEC Table 310.17)',
    category: 'surface',
  },
  {
    id: 'NEC-9',
    number: 9,
    code: 'Open Wiring',
    refMethod: '310.17',
    name: 'Open Wiring on Insulators / Cleated',
    description: 'Open conductors supported on porcelain or polymeric insulators in free air (NEC Article 398, Table 310.17)',
    category: 'surface',
  },
  {
    id: 'NEC-10',
    number: 10,
    code: 'Direct Buried',
    refMethod: '310.16',
    name: 'Directly Buried in Earth (Single or Multiconductor Cable)',
    description: 'Cables directly buried in earth trench without conduit (NEC Table 310.16 / Table 310.20)',
    category: 'ground',
  },
  {
    id: 'NEC-11',
    number: 11,
    code: 'Duct Bank',
    refMethod: '310.20',
    name: 'Underground Duct Bank / Encased Conduits in Earth',
    description: 'Underground conduit bank or duct bank encased in earth or concrete (NEC Table 310.20 / Table 310.60)',
    category: 'ground',
  },
  {
    id: 'NEC-12',
    number: 12,
    code: 'Building Void',
    refMethod: '310.16',
    name: 'Cable / Conduit in Building Void or Drop Ceiling',
    description: 'Cables in drop ceiling spaces, environmental air voids, or hollow building walls (NEC Table 310.16, Art. 300.22)',
    category: 'void',
  },
  {
    id: 'NEC-13',
    number: 13,
    code: 'MC/TC Surface',
    refMethod: '310.16',
    name: 'Type MC / AC / TC Cable Clipped Directly to Surface',
    description: 'Metal-clad, armored, or tray cable run exposed and clipped directly to surface (NEC Table 310.16)',
    category: 'surface',
  },
];

/**
 * Resolves any method identifier (e.g. '31-E', '4', 'NEC-1', 'NEC-4', 'F (touch.)', or legacy 'C')
 * to its standard Reference Method code.
 */
export function resolveReferenceMethod(methodId: string, calculationStandard?: string | null): string {
  if (!methodId) return calculationStandard === 'NEMA' ? '310.16' : 'C';

  const isNema = calculationStandard === 'NEMA';

  // Check NEC methods directly
  const foundNec = NEC_INSTALLATION_METHODS.find((m) => m.id === methodId || m.name === methodId || m.code === methodId);
  if (foundNec) return isNema ? foundNec.refMethod : (foundNec.category === 'tray' ? 'E' : foundNec.category === 'ground' ? 'D1' : 'C');

  if (methodId.toUpperCase().startsWith('NEC-') || methodId.toUpperCase().startsWith('NEC')) {
    const num = methodId.replace(/\D/g, '');
    const matched = NEC_INSTALLATION_METHODS.find((m) => String(m.number) === num);
    if (matched) return isNema ? matched.refMethod : (matched.category === 'tray' ? 'E' : matched.category === 'ground' ? 'D1' : 'C');
    return isNema ? '310.16' : 'C';
  }

  // Direct match by method ID in the IEC catalogue
  const found = INSTALLATION_METHODS.find((m) => m.id === methodId);
  if (found) {
    if (isNema) {
      if (found.category === 'tray') return '392.80(A)';
      if (found.category === 'ground') return '310.20';
      if (found.refMethod === 'G') return '310.17';
      return '310.16';
    }
    return found.refMethod;
  }

  // Direct match by number (e.g. if passed as numeric string '4' or '31')
  const foundByNumber = INSTALLATION_METHODS.find((m) => String(m.number) === methodId);
  if (foundByNumber) {
    if (isNema) {
      if (foundByNumber.category === 'tray') return '392.80(A)';
      if (foundByNumber.category === 'ground') return '310.20';
      if (foundByNumber.refMethod === 'G') return '310.17';
      return '310.16';
    }
    return foundByNumber.refMethod;
  }

  // Check if standard reference code directly
  const upper = methodId.toUpperCase();
  if (['310.16', '310.17', '310.20', '392.80(A)', '392.80(B)'].includes(upper)) {
    return upper;
  }
  if (['A1', 'A2', 'B1', 'B2', 'C', 'D1', 'D2', 'E', 'F', 'G'].includes(upper)) {
    if (isNema) {
      if (upper === 'E' || upper === 'F') return '392.80(A)';
      if (upper === 'G') return '310.17';
      if (upper === 'D1' || upper === 'D2') return '310.20';
      return '310.16';
    }
    return upper;
  }

  // If contains reference code prefix/suffix
  if (upper.startsWith('A1')) return isNema ? '310.16' : 'A1';
  if (upper.startsWith('A2')) return isNema ? '310.16' : 'A2';
  if (upper.startsWith('B1')) return isNema ? '310.16' : 'B1';
  if (upper.startsWith('B2')) return isNema ? '310.16' : 'B2';
  if (upper.startsWith('D1')) return isNema ? '310.20' : 'D1';
  if (upper.startsWith('D2')) return isNema ? '310.20' : 'D2';
  if (upper.startsWith('F')) return isNema ? '392.80(A)' : 'F';
  if (upper.startsWith('G')) return isNema ? '310.17' : 'G';
  if (upper.startsWith('E')) return isNema ? '392.80(A)' : 'E';
  if (upper.startsWith('C')) return isNema ? '310.16' : 'C';

  return isNema ? '310.16' : 'C';
}

// Ambient-temperature correction for GROUND methods (D1/D2), whose ampacity
// tables are referenced to 20 °C soil rather than 30 °C air (IEC 60364-5-52
// Table B.52.15 / BS 7671 Table 4B2). Applying the air table to buried cables
// mis-derates them by up to ~7 % at typical ambients.
export const GROUND_TEMP_DERATING: Record<string, Record<number, number>> = {
  PVC: {
    10: 1.10,
    15: 1.05,
    20: 1.00,
    25: 0.95,
    30: 0.90,
    35: 0.84,
    40: 0.79,
    45: 0.74,
    50: 0.68,
    55: 0.62,
    60: 0.55,
  },
  XLPE: {
    10: 1.07,
    15: 1.04,
    20: 1.00,
    25: 0.96,
    30: 0.93,
    35: 0.89,
    40: 0.85,
    45: 0.80,
    50: 0.76,
    55: 0.71,
    60: 0.65,
  },
};

/** Linear interpolation over a correction-factor table keyed by number. */
function interpolateFactor(table: Record<number, number>, x: number): number {
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (keys.length === 0) return 1.0;
  if (x <= keys[0]) return table[keys[0]];
  if (x >= keys[keys.length - 1]) return table[keys[keys.length - 1]];
  for (let i = 0; i < keys.length - 1; i++) {
    const k1 = keys[i];
    const k2 = keys[i + 1];
    if (x <= k2) {
      const f1 = table[k1];
      const f2 = table[k2];
      return f1 + (f2 - f1) * ((x - k1) / (k2 - k1));
    }
  }
  return table[keys[keys.length - 1]];
}

/**
 * True when the resolved reference method is a ground installation (D1/D2 or NEC underground/direct buried),
 * whose ambient correction must use the 20 °C-soil table instead of the 30 °C
 * air table.
 */
export function isGroundMethod(methodInput?: string, calculationStandard?: string | null): boolean {
  if (!methodInput) return false;
  const upper = String(methodInput).toUpperCase();
  if (upper.includes('NEC-10') || upper.includes('NEC-11')) return true;
  const ref = resolveReferenceMethod(methodInput, calculationStandard);
  return ref === 'D1' || ref === 'D2' || ref === '310.20';
}

/**
 * Ground (20 °C soil) ambient correction factor, linearly interpolated between
 * the tabulated 5 °C steps like its air counterpart.
 */
export function groundTemperatureDeratingFactor(
  insulation: 'PVC' | 'XLPE',
  soilTemp: number
): number {
  const table = GROUND_TEMP_DERATING[insulation];
  if (!table) return 1.0;
  return interpolateFactor(table, soilTemp);
}

// Ampacity multipliers relative to Method C were REMOVED — a single flat
// multiplier cannot represent methods whose ratio to C varies strongly with
// conductor size (e.g. D2/C ranges 0.95 at 16 mm² down to 0.77 at 300 mm²).
// Sizing now reads the published per-method tables directly via getAmpacity().

// Ampacity tables (A) for copper cables at standard ambient (30°C in air, 20°C in ground)
//
// The 400/500 mm² entries are extrapolated, not published: IEC 60364-5-52
// B.52.x stops at 300 mm². Each table scales its own 300 mm² value by the
// size-scaling exponent fitted from its own upper range (ampacity ≈ S^0.63,
// i.e. ×1.199 at 400 and ×1.380 at 500) — Method C matches the catalog rows
// in cablesData.ts exactly. Replace with published annex values if adopted.

// Method A1 - Insulated conductors in conduit in insulated wall
export const AMPACITY_A1_PVC_3PH: Record<number, number> = {
  1.5: 11, 2.5: 15, 4: 20, 6: 25, 10: 35, 16: 48, 25: 63, 35: 78,
  50: 95, 70: 121, 95: 147, 120: 170, 150: 194, 185: 221, 240: 260, 300: 298,
  400: 357, 500: 411,
};

export const AMPACITY_A1_XLPE_3PH: Record<number, number> = {
  1.5: 16, 2.5: 22, 4: 29, 6: 37, 10: 51, 16: 69, 25: 89, 35: 110,
  50: 134, 70: 172, 95: 209, 120: 242, 150: 277, 185: 316, 240: 371, 300: 426,
  400: 511, 500: 588,
};

export const AMPACITY_A1_PVC_1PH: Record<number, number> = {
  1.5: 12, 2.5: 17, 4: 23, 6: 29, 10: 40, 16: 54, 25: 71, 35: 88,
  50: 107, 70: 137, 95: 166, 120: 192, 150: 219, 185: 250, 240: 294, 300: 337,
  400: 404, 500: 465,
};

export const AMPACITY_A1_XLPE_1PH: Record<number, number> = {
  1.5: 18, 2.5: 25, 4: 33, 6: 42, 10: 58, 16: 79, 25: 102, 35: 125,
  50: 153, 70: 198, 95: 240, 120: 278, 150: 318, 185: 363, 240: 426, 300: 490,
  400: 588, 500: 676,
};

// Method A2 - Multi-core cables in conduit in insulated wall
export const AMPACITY_A2_PVC_3PH: Record<number, number> = {
  1.5: 11, 2.5: 15, 4: 20, 6: 25, 10: 35, 16: 48, 25: 63, 35: 78,
  50: 95, 70: 121, 95: 147, 120: 170, 150: 194, 185: 221, 240: 260, 300: 298,
  400: 357, 500: 411,
};

export const AMPACITY_A2_XLPE_3PH: Record<number, number> = {
  1.5: 16, 2.5: 22, 4: 29, 6: 37, 10: 51, 16: 69, 25: 89, 35: 110,
  50: 134, 70: 172, 95: 209, 120: 242, 150: 277, 185: 316, 240: 371, 300: 426,
  400: 511, 500: 588,
};

// Method B1 - Insulated conductors in conduit on wall / trunking
export const AMPACITY_B1_PVC_3PH: Record<number, number> = {
  1.5: 12, 2.5: 16.5, 4: 22, 6: 28, 10: 39, 16: 53, 25: 70, 35: 86,
  50: 105, 70: 134, 95: 162, 120: 187, 150: 213, 185: 243, 240: 286, 300: 328,
  400: 393, 500: 453,
};

export const AMPACITY_B1_XLPE_3PH: Record<number, number> = {
  1.5: 17, 2.5: 24, 4: 32, 6: 41, 10: 56, 16: 76, 25: 98, 35: 120,
  50: 146, 70: 190, 95: 230, 120: 268, 150: 300, 185: 342, 240: 403, 300: 464,
  400: 556, 500: 640,
};

export const AMPACITY_B1_PVC_1PH: Record<number, number> = {
  1.5: 13.5, 2.5: 18.5, 4: 25, 6: 32, 10: 44, 16: 60, 25: 79, 35: 97,
  50: 119, 70: 152, 95: 184, 120: 213, 150: 241, 185: 276, 240: 325, 300: 373,
  400: 447, 500: 515,
};

export const AMPACITY_B1_XLPE_1PH: Record<number, number> = {
  1.5: 19, 2.5: 27, 4: 37, 6: 47, 10: 64, 16: 87, 25: 112, 35: 138,
  50: 168, 70: 218, 95: 264, 120: 307, 150: 344, 185: 392, 240: 462, 300: 532,
  400: 638, 500: 734,
};

// Method B2 - Multi-core cables in conduit on wall / trunking
export const AMPACITY_B2_PVC_3PH: Record<number, number> = {
  1.5: 12, 2.5: 16.5, 4: 22, 6: 28, 10: 39, 16: 53, 25: 70, 35: 86,
  50: 105, 70: 134, 95: 162, 120: 187, 150: 213, 185: 243, 240: 286, 300: 328,
  400: 393, 500: 453,
};

export const AMPACITY_B2_XLPE_3PH: Record<number, number> = {
  1.5: 17, 2.5: 24, 4: 32, 6: 41, 10: 56, 16: 76, 25: 98, 35: 120,
  50: 146, 70: 190, 95: 230, 120: 268, 150: 300, 185: 342, 240: 403, 300: 464,
  400: 556, 500: 640,
};

// Method C - Clipped directly (reference method)
export const AMPACITY_C_PVC_3PH: Record<number, number> = {
  1.5: 15.5, 2.5: 21, 4: 28, 6: 36, 10: 50, 16: 68, 25: 89, 35: 110,
  50: 134, 70: 171, 95: 207, 120: 239, 150: 272, 185: 310, 240: 364, 300: 419,
  400: 502, 500: 578,
};

export const AMPACITY_C_XLPE_3PH: Record<number, number> = {
  1.5: 22, 2.5: 30, 4: 40, 6: 52, 10: 71, 16: 96, 25: 119, 35: 147,
  50: 179, 70: 229, 95: 278, 120: 322, 150: 371, 185: 424, 240: 500, 300: 576,
  400: 690, 500: 794,
};

export const AMPACITY_C_PVC_1PH: Record<number, number> = {
  1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 76, 25: 101, 35: 125,
  50: 151, 70: 192, 95: 232, 120: 269, 150: 300, 185: 341, 240: 400, 300: 460,
  400: 551, 500: 635,
};

export const AMPACITY_C_XLPE_1PH: Record<number, number> = {
  1.5: 24, 2.5: 33, 4: 45, 6: 58, 10: 80, 16: 107, 25: 135, 35: 169,
  50: 207, 70: 268, 95: 328, 120: 382, 150: 441, 185: 506, 240: 599, 300: 693,
  400: 830, 500: 955,
};

// Method E - Spaced from surface / Perforated tray multicore
export const AMPACITY_E_PVC_3PH: Record<number, number> = {
  1.5: 17, 2.5: 23, 4: 30, 6: 39, 10: 54, 16: 73, 25: 96, 35: 119,
  50: 144, 70: 184, 95: 223, 120: 258, 150: 293, 185: 334, 240: 392, 300: 451,
  400: 541, 500: 622,
};

export const AMPACITY_E_XLPE_3PH: Record<number, number> = {
  1.5: 24, 2.5: 32, 4: 43, 6: 56, 10: 76, 16: 103, 25: 128, 35: 158,
  50: 193, 70: 247, 95: 300, 120: 347, 150: 400, 185: 457, 240: 540, 300: 621,
  400: 745, 500: 857,
};

// Method F - On perforated tray single-core
export const AMPACITY_F_PVC_3PH: Record<number, number> = {
  1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 77, 25: 100, 35: 124,
  50: 150, 70: 192, 95: 232, 120: 269, 150: 305, 185: 348, 240: 409, 300: 472,
  400: 566, 500: 651,
};

export const AMPACITY_F_XLPE_3PH: Record<number, number> = {
  1.5: 25, 2.5: 34, 4: 46, 6: 59, 10: 80, 16: 108, 25: 133, 35: 165,
  50: 201, 70: 257, 95: 311, 120: 361, 150: 415, 185: 475, 240: 560, 300: 645,
  400: 773, 500: 890,
};

// Method G - On ladder / insulators
export const AMPACITY_G_PVC_3PH: Record<number, number> = {
  1.5: 18, 2.5: 25, 4: 33, 6: 42, 10: 58, 16: 79, 25: 103, 35: 128,
  50: 155, 70: 198, 95: 240, 120: 278, 150: 316, 185: 361, 240: 424, 300: 488,
  400: 585, 500: 673,
};

export const AMPACITY_G_XLPE_3PH: Record<number, number> = {
  1.5: 26, 2.5: 36, 4: 48, 6: 62, 10: 84, 16: 113, 25: 140, 35: 173,
  50: 210, 70: 269, 95: 326, 120: 378, 150: 435, 185: 497, 240: 586, 300: 674,
  400: 808, 500: 930,
};

// Method D1 - In ground conduit / duct
export const AMPACITY_D1_PVC_3PH: Record<number, number> = {
  1.5: 18, 2.5: 24, 4: 31, 6: 39, 10: 52, 16: 67, 25: 86, 35: 103,
  50: 122, 70: 151, 95: 179, 120: 203, 150: 230, 185: 258, 240: 297, 300: 336,
  400: 403, 500: 464,
};

export const AMPACITY_D1_XLPE_3PH: Record<number, number> = {
  1.5: 22, 2.5: 29, 4: 38, 6: 47, 10: 63, 16: 81, 25: 104, 35: 125,
  50: 148, 70: 183, 95: 216, 120: 246, 150: 278, 185: 312, 240: 361, 300: 408,
  400: 489, 500: 563,
};

// Method D2 - Direct buried in ground
export const AMPACITY_D2_PVC_3PH: Record<number, number> = {
  1.5: 21, 2.5: 28, 4: 36, 6: 45, 10: 60, 16: 78, 25: 99, 35: 119,
  50: 140, 70: 173, 95: 204, 120: 231, 150: 261, 185: 292, 240: 336, 300: 379,
  400: 454, 500: 523,
};

export const AMPACITY_D2_XLPE_3PH: Record<number, number> = {
  1.5: 25, 2.5: 33, 4: 43, 6: 53, 10: 71, 16: 91, 25: 116, 35: 139,
  50: 164, 70: 203, 95: 239, 120: 271, 150: 306, 185: 343, 240: 395, 300: 446,
  400: 535, 500: 615,
};

// ===========================================================================
// NEC (NFPA 70) Standard Ampacity Tables (Reference 30°C Ambient)
// ===========================================================================

// NEC Table 310.16 — Allowable Ampacities in Raceway, Cable, or Earth (up to 3 current-carrying conductors)
export const AMPACITY_NEC_310_16_CU_90C: Record<number, number> = {
  1.5: 25, 2.5: 30, 4: 40, 6: 55, 10: 75, 16: 95, 25: 130, 35: 150,
  50: 170, 70: 195, 95: 225, 120: 260, 150: 320, 185: 350, 240: 430, 300: 475,
  400: 535, 500: 615,
};

export const AMPACITY_NEC_310_16_CU_75C: Record<number, number> = {
  1.5: 20, 2.5: 25, 4: 35, 6: 50, 10: 65, 16: 85, 25: 115, 35: 130,
  50: 150, 70: 175, 95: 200, 120: 230, 150: 285, 185: 310, 240: 380, 300: 420,
  400: 475, 500: 545,
};

export const AMPACITY_NEC_310_16_AL_90C: Record<number, number> = {
  1.5: 20, 2.5: 25, 4: 35, 6: 45, 10: 60, 16: 75, 25: 100, 35: 115,
  50: 135, 70: 150, 95: 175, 120: 205, 150: 255, 185: 280, 240: 350, 300: 385,
  400: 435, 500: 500,
};

export const AMPACITY_NEC_310_16_AL_75C: Record<number, number> = {
  1.5: 15, 2.5: 20, 4: 30, 6: 40, 10: 50, 16: 65, 25: 90, 35: 100,
  50: 120, 70: 135, 95: 155, 120: 180, 150: 230, 185: 250, 240: 310, 300: 340,
  400: 385, 500: 445,
};

// NEC Table 310.17 — Allowable Ampacities of Single Insulated Conductors in Free Air
export const AMPACITY_NEC_310_17_CU_90C: Record<number, number> = {
  1.5: 30, 2.5: 35, 4: 40, 6: 55, 10: 80, 16: 105, 25: 140, 35: 190,
  50: 260, 70: 300, 95: 350, 120: 405, 150: 505, 185: 570, 240: 700, 300: 780,
  400: 885, 500: 1025,
};

export const AMPACITY_NEC_310_17_CU_75C: Record<number, number> = {
  1.5: 25, 2.5: 30, 4: 35, 6: 45, 10: 60, 16: 80, 25: 105, 35: 140,
  50: 195, 70: 225, 95: 260, 120: 300, 150: 375, 185: 420, 240: 515, 300: 575,
  400: 650, 500: 755,
};

export const AMPACITY_NEC_310_17_AL_90C: Record<number, number> = {
  1.5: 25, 2.5: 30, 4: 35, 6: 45, 10: 60, 16: 80, 25: 110, 35: 150,
  50: 205, 70: 235, 95: 275, 120: 315, 150: 395, 185: 445, 240: 545, 300: 610,
  400: 690, 500: 800,
};

export const AMPACITY_NEC_310_17_AL_75C: Record<number, number> = {
  1.5: 20, 2.5: 25, 4: 30, 6: 35, 10: 50, 16: 65, 25: 85, 35: 115,
  50: 155, 70: 180, 95: 215, 120: 245, 150: 305, 185: 345, 240: 425, 300: 475,
  400: 535, 500: 620,
};

// NEC Table 310.20 — Underground Electrical Ducts
export const AMPACITY_NEC_310_20_CU_90C: Record<number, number> = {
  1.5: 26, 2.5: 32, 4: 41, 6: 54, 10: 73, 16: 94, 25: 125, 35: 148,
  50: 175, 70: 205, 95: 238, 120: 271, 150: 318, 185: 352, 240: 416, 300: 465,
  400: 520, 500: 590,
};

export const AMPACITY_NEC_310_20_CU_75C: Record<number, number> = {
  1.5: 22, 2.5: 28, 4: 36, 6: 47, 10: 63, 16: 82, 25: 109, 35: 129,
  50: 152, 70: 178, 95: 207, 120: 236, 150: 277, 185: 307, 240: 362, 300: 405,
  400: 453, 500: 514,
};

export const AMPACITY_NEC_310_20_AL_90C: Record<number, number> = {
  1.5: 20, 2.5: 25, 4: 32, 6: 42, 10: 57, 16: 73, 25: 97, 35: 115,
  50: 136, 70: 160, 95: 186, 120: 211, 150: 248, 185: 274, 240: 324, 300: 363,
  400: 406, 500: 460,
};

export const AMPACITY_NEC_310_20_AL_75C: Record<number, number> = {
  1.5: 17, 2.5: 22, 4: 28, 6: 37, 10: 49, 16: 64, 25: 85, 35: 101,
  50: 119, 70: 139, 95: 161, 120: 184, 150: 216, 185: 239, 240: 282, 300: 316,
  400: 353, 500: 401,
};

// Derived 1-phase tables. The IEC publishes separate "2 loaded conductors"
// columns for every method; this catalog only carries explicit ones for
// A1/B1/C. The rest are reconstructed from their published 3-phase table
// scaled by the per-size 1PH/3PH ratio of Method C (same insulation), which
// preserves the standard's size-dependent shape instead of silently returning
// the higher 3-phase value.
const DERIVED_ONE_PHASE_TABLES = new Map<string, Record<number, number>>();

/**
 * Exact per-size aluminum/copper ampacity ratio taken from the Method C
 * catalog columns (alXlpe3Ph / copperXlpe3Ph, etc.). Applied to every
 * method's copper table so aluminum values stay consistent with — and for
 * Method C exactly equal to — the published catalog columns.
 */
function aluminumRatio(
  insulation: 'PVC' | 'XLPE',
  isThreePhase: boolean,
  size: number
): number {
  const spec = CABLE_CATALOG.find((c) => c.size === size);
  if (!spec) return 0.85;
  const copper = isThreePhase
    ? (insulation === 'PVC' ? spec.copperPvc3Ph : spec.copperXlpe3Ph)
    : (insulation === 'PVC' ? spec.copperPvc1Ph : spec.copperXlpe1Ph);
  const al = isThreePhase
    ? (insulation === 'PVC' ? spec.alPvc3Ph : spec.alXlpe3Ph)
    : (insulation === 'PVC' ? spec.alPvc1Ph : spec.alXlpe1Ph);
  return copper > 0 ? al / copper : 0.85;
}

function onePhaseRatio(insulation: 'PVC' | 'XLPE', size: number): number {
  const c3 = insulation === 'PVC' ? AMPACITY_C_PVC_3PH : AMPACITY_C_XLPE_3PH;
  const c1 = insulation === 'PVC' ? AMPACITY_C_PVC_1PH : AMPACITY_C_XLPE_1PH;
  return c3[size] ? c1[size] / c3[size] : 1;
}

function deriveOnePhaseTable(
  threeTable: Record<number, number>,
  insulation: 'PVC' | 'XLPE'
): Record<number, number> {
  const out: Record<number, number> = {};
  for (const sizeStr of Object.keys(threeTable)) {
    const size = Number(sizeStr);
    out[size] = Math.round(threeTable[size] * onePhaseRatio(insulation, size));
  }
  return out;
}

/**
 * Get ampacity for a given cable size, method, insulation, and phase count
 */
export function getAmpacity(
  cableSize: number,
  methodInput: string,
  insulation: 'PVC' | 'XLPE',
  isThreePhase: boolean,
  material: 'copper' | 'aluminum' = 'copper',
  calculationStandard?: string | null
): number {
  const isNema = calculationStandard === 'NEMA' || (typeof methodInput === 'string' && methodInput.toUpperCase().startsWith('NEC'));

  if (isNema) {
    const is90C = insulation === 'XLPE';
    const isCu = material === 'copper';
    const methodUpper = String(methodInput || '').toUpperCase();

    // Table 310.17 (Free Air): NEC-5 (spaced tray), NEC-8, NEC-9, or explicit 310.17 / G
    if (
      methodUpper.includes('NEC-5') ||
      methodUpper.includes('NEC-8') ||
      methodUpper.includes('NEC-9') ||
      methodUpper.includes('310.17') ||
      methodUpper === 'G'
    ) {
      const table = isCu
        ? (is90C ? AMPACITY_NEC_310_17_CU_90C : AMPACITY_NEC_310_17_CU_75C)
        : (is90C ? AMPACITY_NEC_310_17_AL_90C : AMPACITY_NEC_310_17_AL_75C);
      return table[cableSize] || 0;
    }

    // NEC-6 (Single conductors touching in tray, NEC 392.80(B)(1)(b)): 65% of Table 310.17
    if (methodUpper.includes('NEC-6') || methodUpper.includes('TOUCHING')) {
      const table = isCu
        ? (is90C ? AMPACITY_NEC_310_17_CU_90C : AMPACITY_NEC_310_17_CU_75C)
        : (is90C ? AMPACITY_NEC_310_17_AL_90C : AMPACITY_NEC_310_17_AL_75C);
      return Math.round((table[cableSize] || 0) * 0.65);
    }

    // Table 310.20 (Underground duct bank): NEC-11, 310.20, D1, or D2
    if (methodUpper.includes('NEC-11') || methodUpper.includes('310.20') || methodUpper === 'D1') {
      const table = isCu
        ? (is90C ? AMPACITY_NEC_310_20_CU_90C : AMPACITY_NEC_310_20_CU_75C)
        : (is90C ? AMPACITY_NEC_310_20_AL_90C : AMPACITY_NEC_310_20_AL_75C);
      return table[cableSize] || 0;
    }

    // NEC-7 (Solid bottom cable tray, NEC 392.80(A)(1)(a)): 95% of Table 310.16
    if (methodUpper.includes('NEC-7') || methodUpper.includes('SOLID')) {
      const table = isCu
        ? (is90C ? AMPACITY_NEC_310_16_CU_90C : AMPACITY_NEC_310_16_CU_75C)
        : (is90C ? AMPACITY_NEC_310_16_AL_90C : AMPACITY_NEC_310_16_AL_75C);
      return Math.round((table[cableSize] || 0) * 0.95);
    }

    // Default: Table 310.16 (Raceway, Conduit, Tray Multiconductor NEC-4, Direct Buried NEC-10, Surface NEC-13, B1, B2, C, E, etc.)
    const table = isCu
      ? (is90C ? AMPACITY_NEC_310_16_CU_90C : AMPACITY_NEC_310_16_CU_75C)
      : (is90C ? AMPACITY_NEC_310_16_AL_90C : AMPACITY_NEC_310_16_AL_75C);
    return table[cableSize] || 0;
  }

  // IEC 60364-5-52 Lookup
  const refMethod = resolveReferenceMethod(methodInput, calculationStandard);

  const tables: Record<string, Record<number, number>> = {
    'A1_PVC_3PH': AMPACITY_A1_PVC_3PH,
    'A1_XLPE_3PH': AMPACITY_A1_XLPE_3PH,
    'A1_PVC_1PH': AMPACITY_A1_PVC_1PH,
    'A1_XLPE_1PH': AMPACITY_A1_XLPE_1PH,
    'A2_PVC_3PH': AMPACITY_A2_PVC_3PH,
    'A2_XLPE_3PH': AMPACITY_A2_XLPE_3PH,
    'B1_PVC_3PH': AMPACITY_B1_PVC_3PH,
    'B1_XLPE_3PH': AMPACITY_B1_XLPE_3PH,
    'B1_PVC_1PH': AMPACITY_B1_PVC_1PH,
    'B1_XLPE_1PH': AMPACITY_B1_XLPE_1PH,
    'B2_PVC_3PH': AMPACITY_B2_PVC_3PH,
    'B2_XLPE_3PH': AMPACITY_B2_XLPE_3PH,
    'C_PVC_3PH': AMPACITY_C_PVC_3PH,
    'C_XLPE_3PH': AMPACITY_C_XLPE_3PH,
    'C_PVC_1PH': AMPACITY_C_PVC_1PH,
    'C_XLPE_1PH': AMPACITY_C_XLPE_1PH,
    'E_PVC_3PH': AMPACITY_E_PVC_3PH,
    'E_XLPE_3PH': AMPACITY_E_XLPE_3PH,
    'F_PVC_3PH': AMPACITY_F_PVC_3PH,
    'F_XLPE_3PH': AMPACITY_F_XLPE_3PH,
    'G_PVC_3PH': AMPACITY_G_PVC_3PH,
    'G_XLPE_3PH': AMPACITY_G_XLPE_3PH,
    'D1_PVC_3PH': AMPACITY_D1_PVC_3PH,
    'D1_XLPE_3PH': AMPACITY_D1_XLPE_3PH,
    'D2_PVC_3PH': AMPACITY_D2_PVC_3PH,
    'D2_XLPE_3PH': AMPACITY_D2_XLPE_3PH,
  };

  const key = `${refMethod}_${insulation}_${isThreePhase ? '3PH' : '1PH'}`;
  let table = tables[key];
  if (!table && !isThreePhase) {
    const threeKey = `${refMethod}_${insulation}_3PH`;
    if (tables[threeKey]) {
      const cacheKey = `${refMethod}_${insulation}`;
      let derived = DERIVED_ONE_PHASE_TABLES.get(cacheKey);
      if (!derived) {
        derived = deriveOnePhaseTable(tables[threeKey], insulation);
        DERIVED_ONE_PHASE_TABLES.set(cacheKey, derived);
      }
      table = derived;
    }
  }
  if (!table) return 0;
  const copperAmpacity = table[cableSize] || 0;
  if (copperAmpacity === 0) return 0;

  // The per-method tables above are COPPER only. Aluminum scales by the exact
  // per-size aluminum/copper ratio of the Method C catalog columns (cablesData
  // derives alXlpe3Ph/alXlpe1Ph/alPvc3Ph/alPvc1Ph there) — the ratio drifts
  // between ~0.82 and ~0.86 across the size range, so a single flat factor
  // missed published values by up to ±2 A and disagreed with Method C sizing.
  if (material === 'aluminum') {
    return Math.round(copperAmpacity * aluminumRatio(insulation, isThreePhase, cableSize));
  }
  return copperAmpacity;
}
