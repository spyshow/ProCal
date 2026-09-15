import { describe, it, expect, vi } from "vitest";
import {
  computeProjectDiff,
  computeBuildingDiff,
  computeFloorDiff,
  computeCableCircuitDiff,
  enrichLegacyAuditLog,
} from "./audit-diff";

const mockBreakerFamilies = [
  { id: "fam-acb-1", name: "Emax 2", manufacturer: "ABB", category: "ACB" },
  { id: "fam-acb-2", name: "Masterpact MTZ", manufacturer: "Schneider", category: "ACB" },
  { id: "fam-mccb-1", name: "Tmax XT", manufacturer: "ABB", category: "MCCB" },
  { id: "fam-mccb-2", name: "ComPacT NSXm", manufacturer: "Schneider", category: "MCCB" },
  { id: "fam-mcb-1", name: "Acti9 iC60", manufacturer: "Schneider", category: "MCB" },
  { id: "fam-mcb-2", name: "Acti9 iC60N", manufacturer: "Schneider", category: "MCB" },
];

vi.mock("./db", () => ({
  db: {
    breakerFamily: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => {
        const ids = new Set(where.id.in);
        return mockBreakerFamilies.filter((f) => ids.has(f.id));
      }),
    },
  },
}));

describe("audit-diff engine", () => {
  const baseProject = {
    id: "proj-1",
    name: "Tower Alpha",
    voltage: 400,
    frequency: 50,
    powerFactor: 0.85,
    maxDemandFactor: 0.8,
    preferredManufacturer: "ABB",
    defaultAcbFamilyId: "fam-acb-1",
    defaultMccbFamilyId: "fam-mccb-1",
    defaultMcbFamilyId: "fam-mcb-1",
  };

  it("detects single breaker family change and resolves names", async () => {
    const updated = {
      ...baseProject,
      defaultMcbFamilyId: "fam-mcb-2",
    };

    const diff = await computeProjectDiff(baseProject, updated);

    expect(diff.category).toBe("BREAKER");
    expect(diff.changes).toHaveLength(1);
    expect(diff.changes[0].field).toBe("defaultMcbFamilyId");
    expect(diff.changes[0].label).toBe("MCB Family");
    expect(diff.changes[0].oldDisplay).toBe("Schneider Acti9 iC60");
    expect(diff.changes[0].newDisplay).toBe("Schneider Acti9 iC60N");
    expect(diff.description).toBe(
      'Updated MCB Family to "Schneider Acti9 iC60N" (was "Schneider Acti9 iC60")'
    );
  });

  it("detects multiple breaker family changes", async () => {
    const updated = {
      ...baseProject,
      defaultMccbFamilyId: "fam-mccb-2",
      defaultMcbFamilyId: "fam-mcb-2",
    };

    const diff = await computeProjectDiff(baseProject, updated);

    expect(diff.category).toBe("BREAKER");
    expect(diff.changes).toHaveLength(2);
    expect(diff.description).toContain('MCCB ("Schneider ComPacT NSXm")');
    expect(diff.description).toContain('MCB ("Schneider Acti9 iC60N")');
  });

  it("detects electrical parameter updates with formatted units", async () => {
    const updated = {
      ...baseProject,
      voltage: 380,
      powerFactor: 0.9,
    };

    const diff = await computeProjectDiff(baseProject, updated);

    expect(diff.category).toBe("PROJECT");
    expect(diff.changes).toHaveLength(2);
    expect(diff.description).toContain("System Voltage (400V → 380V)");
    expect(diff.description).toContain("Power Factor (0.85 → 0.90)");
  });

  it("handles identical values without false positives", async () => {
    const updated = {
      ...baseProject,
      voltage: 400.0,
      powerFactor: "0.85",
    };

    const diff = await computeProjectDiff(baseProject, updated);
    expect(diff.changes).toHaveLength(0);
    expect(diff.description).toBe("Saved project parameters (no values modified)");
  });

  it("enriches legacy audit logs that contained raw breaker IDs", () => {
    const familyMap = new Map([
      ["fam-acb-2", "Schneider Masterpact MTZ"],
      ["fam-mccb-2", "Schneider ComPacT NSXm"],
      ["fam-mcb-2", "Schneider Acti9 iC60N"],
    ]);

    const legacyLog = {
      id: "log-legacy-1",
      description: "Updated project parameters",
      entityType: "PROJECT",
      details: JSON.stringify({
        defaultAcbFamilyId: "fam-acb-2",
        defaultMccbFamilyId: "fam-mccb-2",
        defaultMcbFamilyId: "fam-mcb-2",
      }),
    };

    const enriched = enrichLegacyAuditLog(legacyLog, familyMap);

    expect(enriched.entityType).toBe("BREAKER");
    expect(enriched.description).toBe(
      "Selected default breaker families (ACB: Schneider Masterpact MTZ, MCCB: Schneider ComPacT NSXm, MCB: Schneider Acti9 iC60N)"
    );

    const parsedDetails = JSON.parse(enriched.details!);
    expect(parsedDetails.changes).toHaveLength(3);
    expect(parsedDetails.changes[0].newDisplay).toBe("Schneider Masterpact MTZ");
  });

  describe("computeBuildingDiff (Incomer Cable & Building)", () => {
    const baseBuilding = {
      id: "bldg-1",
      name: "Tower B",
      floors: 10,
      incomerCableLength: 15,
      incomerCableInsulation: "PVC",
      incomerCableSize: "3 × 185 mm²",
      incomerIr: 320,
      incomerIn: 400,
    };

    it("logs incomer insulation change under CABLE category in a friendly way with cable name", () => {
      const diff = computeBuildingDiff("Tower B", baseBuilding, { incomerCableInsulation: "XLPE" });
      expect(diff.category).toBe("CABLE");
      expect(diff.changes).toHaveLength(1);
      expect(diff.changes[0].label).toBe("Incomer Insulation");
      expect(diff.changes[0].oldDisplay).toBe("PVC");
      expect(diff.changes[0].newDisplay).toBe("XLPE");
      expect(diff.description).toBe('Updated "Tower B" Cable W_MDB Incomer Insulation to XLPE (was PVC)');
    });

    it("logs incomer cable length change with meters unit and CABLE category with cable name", () => {
      const diff = computeBuildingDiff("Tower B", baseBuilding, { incomerCableLength: 20 });
      expect(diff.category).toBe("CABLE");
      expect(diff.changes).toHaveLength(1);
      expect(diff.changes[0].label).toBe("Incomer Cable Length");
      expect(diff.changes[0].oldDisplay).toBe("15m");
      expect(diff.changes[0].newDisplay).toBe("20m");
      expect(diff.description).toBe('Updated "Tower B" Cable W_MDB Incomer Cable Length to 20m (was 15m)');
    });

    it("logs incomer breaker change under BREAKER category", () => {
      const diff = computeBuildingDiff("Tower B", baseBuilding, { incomerIr: 360 });
      expect(diff.category).toBe("BREAKER");
      expect(diff.changes[0].label).toBe("Incomer Ir (Trip)");
      expect(diff.changes[0].newDisplay).toBe("360A");
    });
  });

  describe("computeFloorDiff (Riser Cable & Subpanels)", () => {
    const baseFloor = {
      id: "f-1",
      name: "Level 2",
      riserCableLength: 20,
      riserCableInsulation: "PVC",
      hasFloorSubPanels: false,
    };

    it("logs riser cable insulation change under CABLE category with building and cable name", () => {
      const diff = computeFloorDiff("Level 2", "Tower B", baseFloor, { riserCableInsulation: "XLPE" });
      expect(diff.category).toBe("CABLE");
      expect(diff.changes[0].label).toBe("Riser Insulation");
      expect(diff.changes[0].oldDisplay).toBe("PVC");
      expect(diff.changes[0].newDisplay).toBe("XLPE");
      expect(diff.description).toBe('Updated "Tower B" Cable Wsdb (Level 2) Riser Insulation to XLPE (was PVC)');
    });

    it("logs subpanel toggle under PANEL category", () => {
      const diff = computeFloorDiff("Level 2", "Tower B", baseFloor, { hasFloorSubPanels: true });
      expect(diff.category).toBe("PANEL");
      expect(diff.description).toContain('Enabled floor sub-panels (SDB) on floor "Level 2" in "Tower B"');
    });
  });

  describe("computeCableCircuitDiff (Floor Items & Building Loads)", () => {
    const baseItem = {
      id: "item-1",
      name: "Apt 201",
      cableLength: 15,
      cableInsulation: "PVC",
      cableMaterial: "copper",
      cableSize: "10 mm²",
      breakerSize: 20,
    };

    it("logs cable insulation change on floor item under CABLE category", () => {
      const diff = computeCableCircuitDiff("Apt 201", "Level 2", baseItem, { cableInsulation: "XLPE" });
      expect(diff.category).toBe("CABLE");
      expect(diff.changes[0].label).toBe("Cable Insulation");
      expect(diff.changes[0].oldDisplay).toBe("PVC");
      expect(diff.changes[0].newDisplay).toBe("XLPE");
      expect(diff.description).toBe('Updated "Apt 201" (Level 2) Cable Insulation to XLPE (was PVC)');
    });

    it("logs cable length change on floor item under CABLE category", () => {
      const diff = computeCableCircuitDiff("Apt 201", "Level 2", baseItem, { cableLength: 25 });
      expect(diff.category).toBe("CABLE");
      expect(diff.changes[0].label).toBe("Cable Length");
      expect(diff.changes[0].oldDisplay).toBe("15m");
      expect(diff.changes[0].newDisplay).toBe("25m");
      expect(diff.description).toBe('Updated "Apt 201" (Level 2) Cable Length to 25m (was 15m)');
    });

    it("includes building name and cable name when provided", () => {
      const diff = computeCableCircuitDiff("test3", "Cable Wf1c · Floor 1", baseItem, { cableMaterial: "aluminum" }, "Wf1c", "Tower A", "Floor 1");
      expect(diff.category).toBe("CABLE");
      expect(diff.description).toBe('Updated "Tower A" Cable Wf1c ("test3", Floor 1) Cable Material to aluminum (was copper)');
      expect(diff.details.cableName).toBe("Wf1c");
      expect(diff.details.buildingName).toBe("Tower A");
    });

    it("includes cable name when locationContext contains cable tag", () => {
      const diff = computeCableCircuitDiff("test3", "Cable Wf1c · Floor 1", baseItem, { cableMaterial: "aluminum" }, "Wf1c");
      expect(diff.category).toBe("CABLE");
      expect(diff.description).toBe('Updated Cable Wf1c ("test3", Floor 1) Cable Material to aluminum (was copper)');
      expect(diff.details.cableName).toBe("Wf1c");
    });

    it("prevents '(undefined)' when locationContext is undefined or 'undefined'", () => {
      const diff1 = computeCableCircuitDiff("test3", undefined, baseItem, { cableLength: 14 });
      expect(diff1.description).toBe('Updated "test3" Cable Length to 14m (was 15m)');
      expect(diff1.description).not.toContain("undefined");

      const diff2 = computeCableCircuitDiff("test3", "undefined", baseItem, { cableLength: 14 });
      expect(diff2.description).toBe('Updated "test3" Cable Length to 14m (was 15m)');
      expect(diff2.description).not.toContain("undefined");
    });
  });

  describe("enrichLegacyAuditLog for Building & Cable logs", () => {
    it("enriches raw incomerCableLength logs into friendly CABLE entries with units and cable name", () => {
      const legacyLog = {
        id: "log-bldg-legacy",
        description: 'Updated building "Tower B" parameters (incomerCableLength)',
        entityType: "BUILDING",
        details: JSON.stringify({
          incomerCableLength: 20,
        }),
      };

      const enriched = enrichLegacyAuditLog(legacyLog, new Map());
      expect(enriched.entityType).toBe("CABLE");
      expect(enriched.description).toBe('Updated "Tower B" Cable W_MDB Incomer Cable Length to 20m');

      const parsed = JSON.parse(enriched.details!);
      expect(parsed.changes).toHaveLength(1);
      expect(parsed.changes[0].label).toBe("Incomer Cable Length");
      expect(parsed.changes[0].newDisplay).toBe("20m");
    });

    it("enriches incomer logs to include Cable W_MDB", () => {
      const log1 = {
        id: "log-inc-1",
        description: 'Updated "Tower B" Incomer Cable Size to 240 mm² (was 120 mm²)',
        entityType: "CABLE",
        details: JSON.stringify({
          changes: [{ field: "incomerCableSize", label: "Incomer Cable Size", oldValue: "120 mm²", newValue: "240 mm²" }]
        }),
      };
      expect(enrichLegacyAuditLog(log1, new Map()).description).toBe(
        'Updated "Tower B" Cable W_MDB Incomer Cable Size to 240 mm² (was 120 mm²)'
      );
    });

    it("sanitizes legacy logs that previously contained '(undefined)' and adds building & cable name", () => {
      const legacyLog = {
        id: "log-undefined-cleanup",
        description: 'Updated Cable Material to aluminum (was copper) on "test3" (undefined)',
        entityType: "CABLE",
        details: JSON.stringify({
          cableName: "Wf1c",
          buildingName: "Tower B",
          floorName: "Floor 1",
          changes: [
            { field: "cableMaterial", label: "Cable Material", oldValue: "copper", newValue: "aluminum" }
          ],
        }),
      };

      const enriched = enrichLegacyAuditLog(legacyLog, new Map());
      expect(enriched.description).toBe('Updated "Tower B" Cable Wf1c ("test3", Floor 1) Cable Material to aluminum (was copper)');
      expect(enriched.description).not.toContain("undefined");

      // Without cableName in details, removes (undefined) cleanly
      const legacyLogNoName = {
        id: "log-undefined-cleanup-2",
        description: 'Updated Cable Material to aluminum (was copper) on "test3" (undefined)',
        entityType: "CABLE",
        details: JSON.stringify({
          changes: [
            { field: "cableMaterial", label: "Cable Material", oldValue: "copper", newValue: "aluminum" }
          ],
        }),
      };
      const enrichedNoName = enrichLegacyAuditLog(legacyLogNoName, new Map());
      expect(enrichedNoName.description).toBe('Updated Cable Material to aluminum (was copper) on "test3"');
      expect(enrichedNoName.description).not.toContain("undefined");
    });

    it("enriches bare method logs (e.g. 'Incomer Method to Method 1') into descriptive installation method names", () => {
      const logIncomerMethod = {
        id: "log-inc-method",
        description: 'Updated "Tower B" Incomer Method to Method 1',
        entityType: "CABLE",
        details: JSON.stringify({
          changes: [
            { field: "incomerInstallMethod", label: "Incomer Method", oldValue: null, newValue: "1" }
          ],
        }),
      };

      const enriched = enrichLegacyAuditLog(logIncomerMethod, new Map());
      expect(enriched.description).toBe(
        'Updated "Tower B" Cable W_MDB Incomer Installation Method to Method 1 (A1 - Conduit in insulated wall)'
      );

      const parsed = JSON.parse(enriched.details!);
      expect(parsed.changes[0].label).toBe("Incomer Installation Method");
      expect(parsed.changes[0].newDisplay).toBe("Method 1 (A1 - Conduit in insulated wall)");
    });

    it("enriches riser method logs with previous and new method names", () => {
      const logRiserMethod = {
        id: "log-riser-method",
        description: 'Updated Riser Method to Method 4 (was Method C) on riser cable "Wsdb10" (Floor 10, tower A)',
        entityType: "CABLE",
        details: JSON.stringify({
          changes: [
            { field: "riserInstallMethod", label: "Riser Method", oldValue: "C", newValue: "4" }
          ],
        }),
      };

      const enriched = enrichLegacyAuditLog(logRiserMethod, new Map());
      expect(enriched.description).toBe(
        'Updated "tower A" Cable Wsdb10 (Floor 10) Riser Installation Method to Method 4 (B1 - Conduit on wall) (was Method C (Clipped direct))'
      );

      const parsed = JSON.parse(enriched.details!);
      expect(parsed.changes[0].label).toBe("Riser Installation Method");
      expect(parsed.changes[0].newDisplay).toBe("Method 4 (B1 - Conduit on wall)");
      expect(parsed.changes[0].oldDisplay).toBe("Method C (Clipped direct)");
    });
  });
});
