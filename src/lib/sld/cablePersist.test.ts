import { describe, it, expect } from 'vitest';
import { cablePatchUrl, upsizeBody, fieldEditBody, CableKind } from './cablePersist';

describe('cable persistence dispatch', () => {
  // The regression this guards: SDB risers live on FloorDesign (id "sdb-<fdId>"),
  // and their fields are riserCable*/riserInstall* — NOT cableSize/installMethod on
  // /api/floor-items. A missing sdb branch silently 404s and edits don't persist.
  describe('cablePatchUrl', () => {
    it('routes SDB to /api/floors with the sdb- prefix stripped', () => {
      expect(cablePatchUrl('sdb', 'sdb-abc123')).toBe('/api/floors/abc123');
    });
    it('routes floor circuits to /api/floor-items', () => {
      expect(cablePatchUrl('floor', 'item-42')).toBe('/api/floor-items/item-42');
    });
    it('routes building loads to /api/building-loads', () => {
      expect(cablePatchUrl('building', 'bl-7')).toBe('/api/building-loads/bl-7');
    });
    it('routes incomer to /api/buildings with the incomer- prefix stripped', () => {
      expect(cablePatchUrl('incomer', 'incomer-bldg-99')).toBe('/api/buildings/bldg-99');
    });
  });

  describe('upsizeBody', () => {
    it('uses incomerCableSize for incomer', () => {
      expect(upsizeBody(300, 'incomer')).toEqual({ incomerCableSize: '300' });
      expect(upsizeBody('6 × 600 kcmil', 'incomer')).toEqual({ incomerCableSize: '6 × 600 kcmil' });
    });
    it('uses riserCableSize for SDB', () => {
      expect(upsizeBody(240, 'sdb')).toEqual({ riserCableSize: '240' });
      expect(upsizeBody('2 × 240 mm²', 'sdb')).toEqual({ riserCableSize: '2 × 240 mm²' });
    });
    it('uses cableSize for floor and building', () => {
      expect(upsizeBody(16, 'floor')).toEqual({ cableSize: '16' });
      expect(upsizeBody(25, 'building')).toEqual({ cableSize: '25' });
      expect(upsizeBody('2 × 240 mm²', 'building')).toEqual({ cableSize: '2 × 240 mm²' });
    });
  });

  describe('fieldEditBody', () => {
    const k: CableKind[] = ['floor', 'building', 'sdb', 'incomer'];
    const fields = ['length', 'method', 'insulation', 'material', 'ambientTemp', 'groupingCount'] as const;
    it('incomer maps every field to its incomer* key', () => {
      const incomerBodies = fields.map((f) => fieldEditBody('incomer', f, f === 'length' ? 25 : f === 'ambientTemp' ? 40 : f === 'groupingCount' ? 1 : f === 'material' ? 'copper' : 'F'));
      expect(incomerBodies).toEqual([
        { incomerCableLength: 25 },
        { incomerInstallMethod: 'F' },
        { incomerCableInsulation: 'F' },
        { incomerCableMaterial: 'copper' },
        { incomerAmbientTemp: 40 },
        { incomerGroupingCount: 1 },
      ]);
    });
    // The SDB field-name matrix differs per field — pin every cell.
    it('SDB maps every field to its riser* key (incl. material→riserCableMaterial)', () => {
      const sdbBodies = fields.map((f) => fieldEditBody('sdb', f, f === 'length' ? 30 : f === 'ambientTemp' ? 45 : f === 'groupingCount' ? 3 : f === 'material' ? 'aluminum' : 'E'));
      expect(sdbBodies).toEqual([
        { riserCableLength: 30 },
        { riserInstallMethod: 'E' },
        { riserCableInsulation: 'E' },
        { riserCableMaterial: 'aluminum' },
        { riserAmbientTemp: 45 },
        { riserGroupingCount: 3 },
      ]);
    });
    it('floor/building share cableLength/installMethod/cableInsulation/cableMaterial/ambientTemp/groupingCount keys', () => {
      for (const kind of k.filter((x) => x !== 'sdb' && x !== 'incomer')) {
        expect(Object.keys(fieldEditBody(kind, 'length', 30))[0]).toBe('cableLength');
        expect(Object.keys(fieldEditBody(kind, 'method', 'C'))[0]).toBe('installMethod');
        expect(Object.keys(fieldEditBody(kind, 'insulation', 'XLPE'))[0]).toBe('cableInsulation');
        expect(Object.keys(fieldEditBody(kind, 'material', 'aluminum'))[0]).toBe('cableMaterial');
        expect(Object.keys(fieldEditBody(kind, 'ambientTemp', 40))[0]).toBe('ambientTemp');
        expect(Object.keys(fieldEditBody(kind, 'groupingCount', 2))[0]).toBe('groupingCount');
      }
    });
  });
});
