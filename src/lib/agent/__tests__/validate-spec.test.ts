import { describe, it, expect } from "vitest";
import { validateProjectSpec } from "../validate-spec";

describe("validateProjectSpec pre-flight validator", () => {
  const minimalValidSpec = {
    name: "Al Marina Tower",
    country: "United Arab Emirates",
    apartmentTemplates: [
      {
        name: "Type A - 2BR",
        phases: 1 as const,
        rooms: [
          { name: "Living Room", type: "LIVING_ROOM" as const, areaM2: 30, hasAc: true },
          { name: "Master Bedroom", type: "BEDROOM" as const, areaM2: 20, hasAc: true },
          { name: "Kitchen", type: "KITCHEN" as const, areaM2: 12, hasAc: true },
        ],
      },
    ],
    buildings: [
      {
        name: "Tower 1",
        floors: 5,
        floorAssignments: [
          { floorNumber: 1, templateName: "Type A - 2BR", count: 4 },
          { floorNumber: 2, templateName: "Type A - 2BR", count: 4 },
        ],
      },
    ],
  };

  it("detects missing voltage/frequency/room densities and requests confirmation", () => {
    const res = validateProjectSpec(minimalValidSpec);

    expect(res.valid).toBe(true);
    expect(res.readyToCreate).toBe(false);
    expect(res.requiresConfirmation).toBe(true);
    expect(res.missingOrAssumedFields.length).toBeGreaterThan(0);
    expect(res.confirmationPrompt).toContain("Al Marina Tower");
    expect(res.confirmationPrompt).toContain("400V");
    expect(res.confirmationPrompt).toContain("50Hz");
    expect(res.estimatedTotals.totalApartments).toBe(8);
    expect(res.estimatedTotals.totalConnectedKw).toBeGreaterThan(0);
    expect(res.estimatedTotals.suggestedMainBreakerAmps).toBeGreaterThan(0);
  });

  it("marks readyToCreate when isConfirmedByUser is explicitly true", () => {
    const confirmedSpec = {
      ...minimalValidSpec,
      isConfirmedByUser: true,
      voltage: 400,
      frequency: 50,
    };

    const res = validateProjectSpec(confirmedSpec);
    expect(res.valid).toBe(true);
    expect(res.readyToCreate).toBe(true);
    expect(res.requiresConfirmation).toBe(false);
  });

  it("validates explicit electrical load overrides in kW and kVA", () => {
    const specWithExplicitLoads = {
      ...minimalValidSpec,
      isConfirmedByUser: true,
      apartmentTemplates: [
        {
          name: "Penthouse",
          phases: 3 as const,
          rooms: [
            { name: "Main Salon", areaM2: 100, explicitLoadKw: 15.0 },
            { name: "Server Room", areaM2: 20, explicitLoadKva: 8.0 },
          ],
        },
      ],
      buildings: [
        {
          name: "Tower 1",
          floors: 1,
          floorAssignments: [
            { floorNumber: 1, templateName: "Penthouse", count: 1 },
          ],
        },
      ],
    };

    const res = validateProjectSpec(specWithExplicitLoads);
    expect(res.valid).toBe(true);
    // 15 kW + (8 kVA * 0.85 PF = 6.8 kW) = 21.8 kW
    expect(res.estimatedTotals.totalConnectedKw).toBeCloseTo(21.8, 1);
  });

  it("flags unknown template references in floor assignments as errors", () => {
    const invalidSpec = {
      ...minimalValidSpec,
      buildings: [
        {
          name: "Tower 1",
          floors: 1,
          floorAssignments: [
            { floorNumber: 1, templateName: "NonExistentTemplate", count: 2 },
          ],
        },
      ],
    };

    const res = validateProjectSpec(invalidSpec);
    expect(res.valid).toBe(false);
    expect(res.readyToCreate).toBe(false);
    expect(res.errors?.[0]).toContain('references unknown template "NonExistentTemplate"');
  });
});
