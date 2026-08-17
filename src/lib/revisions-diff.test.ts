import { describe, it, expect } from "vitest";
import { diffProjectSnapshots, summarizeChanges } from "./revisions-diff";
import type { SnapshotProject } from "./revisions";

function baseProject(): SnapshotProject {
  return {
    id: "p1",
    name: "Test Tower",
    client: "ABC Corp",
    consultant: "",
    contractor: "",
    location: "Dubai",
    engineer: "John Smith",
    date: "2026-07-22",
    voltage: 400,
    frequency: 50,
    powerFactor: 0.85,
    maxDemandFactor: 0.8,
    transformerSize: 630,
    notes: null,
    preferredManufacturer: "SCHNEIDER",
    defaultAcbFamilyId: "fam-acb",
    defaultMccbFamilyId: null,
    defaultMcbFamilyId: null,
    country: "UAE",
    logoUrl: null,
    calculationStandard: "IEC",
    maxVoltageDropLighting: 3,
    maxVoltageDropPower: 5,
    ambientTemp: 30,
    groupingCount: 1,
    buildings: [
      {
        id: "b1",
        name: "Tower A",
        floors: 8,
        serviceFloors: 1,
        apartmentsPerFloor: 4,
        mechanicalLoads: null,
        generator: null,
        transformer: null,
        supplyVoltage: "400V 3-Phase",
        earthingSystem: "TN-S",
        lightningProtection: true,
        floorDesigns: [
          {
            id: "fd1",
            floorNumber: 1,
            hasFloorSubPanels: false,
            riserCableLength: null,
            riserCableSize: null,
            riserBreakerSize: null,
            riserInstallMethod: "C",
            riserCableInsulation: "XLPE",
            riserCableMaterial: "copper",
            riserAmbientTemp: 30,
            riserGroupingCount: 1,
            items: [
              {
                id: "i1",
                type: "APARTMENT",
                name: "Apt A (1F)",
                apartmentTemplateId: "t1",
                loadLibraryItemId: null,
                apartmentTemplate: { id: "t1", name: "Standard", phases: 1, rooms: [] },
                loadLibraryItem: null,
                calculatedConnectedLoad: 9000,
                calculatedMaxDemand: 4000,
                calculatedCurrent: 17.4,
                breakerSize: "20A",
                cableSize: "2.5 mm²",
                cableLength: 25,
                voltageDrop: 1.2,
                installMethod: "C",
                cableInsulation: "XLPE",
                cableMaterial: "copper",
                ambientTemp: 30,
                groupingCount: 1,
                assignedPhase: null,
              },
            ],
          },
        ],
        buildingLoads: [
          {
            id: "bl1",
            loadLibraryItemId: "lli1",
            loadLibraryItem: { id: "lli1", name: "Water Pump", category: "Pump", power: 5.5, voltage: 400, phase: 3, powerFactor: 0.8, demandFactor: 1, quantity: 2, runningCurrent: 9.9, startingCurrent: 60, notes: null },
            quantity: 2,
            cableSize: "6 mm²",
            cableLength: 40,
            installMethod: "C",
            cableInsulation: "XLPE",
            cableMaterial: "copper",
            ambientTemp: 30,
            groupingCount: 1,
            assignedPhase: null,
          },
        ],
      },
    ],
    apartmentTemplates: [
      {
        id: "t1",
        name: "Standard",
        phases: 1,
        rooms: [
          { id: "r1", type: "BEDROOM", name: "Master", area: 18, hasAc: false, acBtu: null, loadDensity: 100, connectedLoad: 1800 },
        ],
      },
    ],
    loadLibraryItems: [
      { id: "lli1", name: "Water Pump", category: "Pump", power: 5.5, voltage: 400, phase: 3, powerFactor: 0.8, demandFactor: 1, quantity: 2, runningCurrent: 9.9, startingCurrent: 60, notes: null },
    ],
  };
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

describe("diffProjectSnapshots", () => {
  it("returns no changes for identical snapshots", () => {
    const a = baseProject();
    expect(diffProjectSnapshots(a, clone(a))).toEqual([]);
  });

  it("ignores ids, timestamps, and relation metadata (no spurious changes)", () => {
    const a = baseProject();
    const b = clone(a);
    // Only ids/createdAt differ — not part of the compared shape anyway.
    b.id = "p2";
    expect(diffProjectSnapshots(a, b)).toEqual([]);
  });

  it("flags project scalar changes", () => {
    const a = baseProject();
    const b = clone(a);
    b.voltage = 415;
    b.transformerSize = null;
    const changes = diffProjectSnapshots(a, b);
    expect(changes).toContainEqual(
      expect.objectContaining({
        category: "project",
        kind: "changed",
        label: "Project",
        field: "Voltage (V)",
        from: "400",
        to: "415",
      })
    );
    expect(changes).toContainEqual(
      expect.objectContaining({
        category: "project",
        kind: "changed",
        field: "Transformer (kVA)",
        from: "630",
        to: "—",
      })
    );
  });

  it("flags added and removed buildings", () => {
    const a = baseProject();
    const b = clone(a);
    b.buildings!.push({
      id: "b2",
      name: "Tower B",
      floors: 4,
      serviceFloors: 0,
      apartmentsPerFloor: 3,
      mechanicalLoads: null,
      generator: null,
      transformer: null,
      supplyVoltage: "400V 3-Phase",
      earthingSystem: "TN-S",
      lightningProtection: false,
      floorDesigns: [],
      buildingLoads: [],
    });
    b.buildings![0].name = "Tower A Renamed";

    const changes = diffProjectSnapshots(a, b);
    expect(changes).toContainEqual(
      expect.objectContaining({
        category: "building",
        kind: "added",
        label: 'Building “Tower B”',
      })
    );
    expect(changes).toContainEqual(
      expect.objectContaining({
        category: "building",
        kind: "changed",
        label: 'Building “Tower A Renamed”',
        field: "Name",
        from: "Tower A",
        to: "Tower A Renamed",
      })
    );

    // Removing is the mirror image.
    const c = baseProject();
    c.buildings!.pop();
    const removed = diffProjectSnapshots(a, c);
    expect(removed).toContainEqual(
      expect.objectContaining({
        category: "building",
        kind: "removed",
        label: 'Building “Tower A”',
      })
    );
  });

  it("flags item scalar changes with a full path label", () => {
    const a = baseProject();
    const b = clone(a);
    const item = b.buildings![0].floorDesigns![0].items![0];
    item.breakerSize = "32A";
    item.cableSize = "4 mm²";
    item.apartmentTemplate = {
      id: "t1",
      name: "Standard Plus",
      phases: 1,
      rooms: [],
    };

    const changes = diffProjectSnapshots(a, b);
    expect(changes).toContainEqual(
      expect.objectContaining({
        category: "item",
        kind: "changed",
        label: 'Building “Tower A” / Floor 1 / “Apt A (1F)”',
        field: "Breaker",
        from: "20A",
        to: "32A",
      })
    );
    expect(changes).toContainEqual(
      expect.objectContaining({
        category: "item",
        kind: "changed",
        field: "Apartment template",
        from: "Standard",
        to: "Standard Plus",
      })
    );
  });

  it("flags added/removed floor items", () => {
    const a = baseProject();
    const b = clone(a);
    b.buildings![0].floorDesigns![0].items = [];
    const changes = diffProjectSnapshots(a, b);
    expect(changes).toContainEqual(
      expect.objectContaining({
        category: "item",
        kind: "removed",
        label: 'Building “Tower A” / Floor 1 / “Apt A (1F)”',
      })
    );
  });

  it("flags building-load quantity and cable changes", () => {
    const a = baseProject();
    const b = clone(a);
    b.buildings![0].buildingLoads![0].quantity = 4;
    b.buildings![0].buildingLoads![0].cableSize = "10 mm²";
    const changes = diffProjectSnapshots(a, b);
    expect(changes).toContainEqual(
      expect.objectContaining({
        category: "buildingLoad",
        kind: "changed",
        label: 'Building “Tower A” / Load “Water Pump”',
        field: "Quantity",
        from: "2",
        to: "4",
      })
    );
    expect(changes).toContainEqual(
      expect.objectContaining({
        category: "buildingLoad",
        kind: "changed",
        field: "Cable",
        from: "6 mm²",
        to: "10 mm²",
      })
    );
  });

  it("flags template and room changes", () => {
    const a = baseProject();
    const b = clone(a);
    b.apartmentTemplates![0].phases = 3;
    b.apartmentTemplates![0].rooms!.push({
      id: "r2",
      type: "LIVING_ROOM",
      name: "Living",
      area: 22,
      hasAc: true,
      acBtu: 12000,
      loadDensity: 100,
      connectedLoad: 4200,
    });
    const changes = diffProjectSnapshots(a, b);
    expect(changes).toContainEqual(
      expect.objectContaining({
        category: "template",
        kind: "changed",
        label: 'Template “Standard”',
        field: "Phases",
        from: "1",
        to: "3",
      })
    );
    expect(changes).toContainEqual(
      expect.objectContaining({
        category: "room",
        kind: "added",
        label: 'Template “Standard” / Room “Living”',
      })
    );
  });

  it("flags load-library item changes", () => {
    const a = baseProject();
    const b = clone(a);
    b.loadLibraryItems![0].power = 7.5;
    const changes = diffProjectSnapshots(a, b);
    expect(changes).toContainEqual(
      expect.objectContaining({
        category: "loadLibraryItem",
        kind: "changed",
        label: 'Load Library “Water Pump”',
        field: "Power (kW)",
        from: "5.5",
        to: "7.5",
      })
    );
  });

  it("summarizes counts per kind", () => {
    const a = baseProject();
    const b = clone(a);
    b.voltage = 415;
    b.buildings!.push({ ...clone(b.buildings![0]), id: "b2" });
    b.buildings![0].floorDesigns![0].items = [];
    const changes = diffProjectSnapshots(a, b);
    const summary = summarizeChanges(changes);
    expect(summary.added).toBe(1);
    expect(summary.removed).toBe(1);
    expect(summary.changed).toBeGreaterThan(0);
  });
});
