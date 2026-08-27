// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import MDBSchedule from "./MDBSchedule";
import type { EquipmentItem } from "@/lib/calculations/feeders";
import type { Project, Building, FloorItem } from "@/types";

// ---------------------------------------------------------------------------
// Fixtures — a ~2000 A demand whose catalog match lands on a 2500 A ACB frame.
// The incomer cable must then be re-sized to the frame (Iz >= 2500 A) with
// parallel runs, which is exactly what the Main Incomer row must surface.
// ---------------------------------------------------------------------------

const equipment: EquipmentItem[] = [
  {
    id: 'acb1', category: 'ACB', manufacturer: 'Schneider', familyId: 'f_acb',
    familyName: 'Masterpact', series: 'Masterpact MTZ1', model: 'MTZ1 H1 2500',
    ratedCurrent: 2500, poles: 3, breakingCapacity: 65, tripUnit: null, settingsJson: null,
  },
];

function item(overrides: Partial<FloorItem> = {}): FloorItem {
  return {
    id: 'i1', name: 'Mech', type: 'SERVICE_PANEL',
    calculatedConnectedLoad: 2000, calculatedMaxDemand: 1177.8, calculatedCurrent: 2000,
    breakerSize: '', cableSize: '', voltageDrop: 0.1,
    ...overrides,
  };
}

function building(overrides: Partial<Building> = {}): Building {
  return {
    id: 'b1', name: 'Tower A', floors: 1, serviceFloors: 0, apartmentsPerFloor: 0,
    supplyVoltage: '400', earthingSystem: 'TN-S', lightningProtection: false,
    floorDesigns: [{ id: 'f1', floorNumber: 1, hasFloorSubPanels: false, items: [item()] }],
    buildingLoads: [],
    ...overrides,
  };
}

const project: Project = {
  id: 'p1', name: 'Test', client: '', consultant: '', contractor: '', location: '',
  engineer: '', date: '',
  voltage: 400, frequency: 50, powerFactor: 0.85, country: 'US',
  preferredManufacturer: 'Schneider',
  logoUrl: null, maxVoltageDropLighting: 3, maxVoltageDropPower: 5,
  transformerSize: 1000, // deterministic transformer-terminal Isc (26.24 kA)
  buildings: [building()],
  apartmentTemplates: [], loadLibraryItems: [],
};

// MDBSchedule fetches the equipment catalog in a useEffect; stub that fetch.
const fetchMock = vi.fn();
(globalThis as any).fetch = fetchMock;
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () =>
    new Response(JSON.stringify(equipment), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
});

describe("MDBSchedule main incomer row", () => {
  it("shows the catalog-frame breaker, the cable with parallel runs, and Iz >= In", async () => {
    render(<MDBSchedule project={project} showHeader={false} />);
    // Wait for the equipment fetch → computeFeeders → table render.
    await screen.findByText("Main Incomer");

    const table = document.querySelector("table");
    expect(table).not.toBeNull();

    // The new Iz column is present.
    const headers = Array.from(table!.querySelectorAll("thead th")).map((th) =>
      th.textContent!.trim(),
    );
    expect(headers).toContain("Iz (A)");

    // Locate the Main Incomer row (row 1 of the schedule).
    const rows = Array.from(table!.querySelectorAll("tbody tr"));
    const incomerRow = rows.find((r) => r.textContent?.includes("Main Incomer"));
    expect(incomerRow).toBeDefined();

    const cells = Array.from(incomerRow!.querySelectorAll("td")).map((td) =>
      td.textContent!.trim(),
    );
    // Column order: # | Building | Floor | Feeder | Type | Demand | Current | Breaker | Cable | Iz
    expect(cells[1]).toBe("Tower A");
    expect(cells[2]).toBe("—");
    expect(cells[3]).toBe("Main Incomer");
    expect(cells[4]).toBe("ACB");

    // The breaker is the catalog frame (2500 A), not the load-based 2000 A
    // standard rating — same device the panel / breaker-schedule pages show.
    expect(cells[7]).toBe("2500A");

    // Cable cell surfaces the parallel runs and the derated ampacity (Iz >= In).
    expect(cells[8]).toBe("5 × 240 mm²");
    expect(cells[9]).toBe("2500");

    // Parse the displayed values.
    const inAmps = parseInt(cells[7].replace(/[^\d]/g, ""), 10);
    const iz = parseInt(cells[9], 10);
    expect(Number.isFinite(inAmps)).toBe(true);
    expect(Number.isFinite(iz)).toBe(true);
    expect(iz).toBeGreaterThanOrEqual(inAmps);
  });
});
