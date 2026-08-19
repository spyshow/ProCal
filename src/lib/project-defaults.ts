import { db } from "@/lib/db";
import { getCountryDefaults, calculateRoomLoad } from "@/lib/country-defaults";

export async function seedDefaultProjectTemplates(projectId: string, country: string = "Syria") {
  const defaults = getCountryDefaults(country);
  const densities = defaults.roomDensities;
  const acRules = defaults.acSizingRules;

  const defaultTemplates = [
    {
      name: "Type A – 2BR Apartment (1Φ)",
      phases: 1,
      rooms: [
        { type: "LIVING_ROOM", name: "Living Room", area: 24, hasAc: true, densityKey: "livingRoom" as const },
        { type: "BEDROOM", name: "Master Bedroom", area: 18, hasAc: true, densityKey: "bedroom" as const },
        { type: "BEDROOM", name: "Bedroom 2", area: 14, hasAc: true, densityKey: "bedroom" as const },
        { type: "KITCHEN", name: "Kitchen", area: 12, hasAc: false, densityKey: "kitchen" as const },
        { type: "DINING_ROOM", name: "Dining Room", area: 12, hasAc: false, densityKey: "diningRoom" as const },
        { type: "BATHROOM", name: "Bathroom", area: 6, hasAc: false, densityKey: "bathroom" as const },
        { type: "HALL", name: "Corridor / Hall", area: 8, hasAc: false, densityKey: "hall" as const },
      ],
    },
    {
      name: "Type B – 3BR Apartment (3Φ)",
      phases: 3,
      rooms: [
        { type: "LIVING_ROOM", name: "Living Room", area: 32, hasAc: true, densityKey: "livingRoom" as const },
        { type: "BEDROOM", name: "Master Bedroom", area: 22, hasAc: true, densityKey: "bedroom" as const },
        { type: "BEDROOM", name: "Bedroom 2", area: 16, hasAc: true, densityKey: "bedroom" as const },
        { type: "BEDROOM", name: "Bedroom 3", area: 14, hasAc: true, densityKey: "bedroom" as const },
        { type: "KITCHEN", name: "Kitchen", area: 16, hasAc: true, densityKey: "kitchen" as const },
        { type: "DINING_ROOM", name: "Dining Room", area: 16, hasAc: false, densityKey: "diningRoom" as const },
        { type: "BATHROOM", name: "Guest Bathroom", area: 4, hasAc: false, densityKey: "bathroom" as const },
        { type: "BATHROOM", name: "Master Bathroom", area: 8, hasAc: false, densityKey: "bathroom" as const },
        { type: "HALL", name: "Hallway", area: 12, hasAc: false, densityKey: "hall" as const },
      ],
    },
    {
      name: "Type C – Studio / 1BR (1Φ)",
      phases: 1,
      rooms: [
        { type: "LIVING_ROOM", name: "Living & Bed Area", area: 26, hasAc: true, densityKey: "livingRoom" as const },
        { type: "KITCHEN", name: "Kitchenette", area: 8, hasAc: false, densityKey: "kitchen" as const },
        { type: "BATHROOM", name: "Bathroom", area: 5, hasAc: false, densityKey: "bathroom" as const },
      ],
    },
  ];

  const createdTemplates = [];

  for (const tpl of defaultTemplates) {
    const created = await db.apartmentTemplate.create({
      data: {
        name: tpl.name,
        phases: tpl.phases,
        projectId,
        rooms: {
          create: tpl.rooms.map((r) => {
            const density = densities[r.densityKey] || 80;
            const connectedLoad = calculateRoomLoad(r.area, density, r.hasAc, acRules);
            const acRule = r.hasAc
              ? acRules.find((rule) => r.area <= rule.maxArea) || acRules[acRules.length - 1]
              : null;
            return {
              type: r.type,
              name: r.name,
              area: r.area,
              hasAc: r.hasAc,
              acBtu: acRule?.btu || null,
              loadDensity: density,
              connectedLoad,
            };
          }),
        },
      },
      include: { rooms: true },
    });
    createdTemplates.push(created);
  }

  return createdTemplates;
}

export async function seedDefaultLoadLibrary(projectId: string) {
  const defaultLoads = [
    { name: "Passenger Elevator (8 Persons)", category: "Elevator", power: 11, voltage: 400, phase: 3, powerFactor: 0.85, demandFactor: 1.0, quantity: 1, runningCurrent: 18.68, notes: "Main vertical transport" },
    { name: "Water Booster Pump Set", category: "Pump", power: 7.5, voltage: 400, phase: 3, powerFactor: 0.85, demandFactor: 1.0, quantity: 2, runningCurrent: 12.74, notes: "Domestic water supply" },
    { name: "Fire Fighting Pump", category: "Pump", power: 37, voltage: 400, phase: 3, powerFactor: 0.85, demandFactor: 1.0, quantity: 1, runningCurrent: 62.84, notes: "Emergency life safety feeder" },
    { name: "Corridor & Staircase Lighting", category: "Lighting", power: 3, voltage: 230, phase: 1, powerFactor: 0.95, demandFactor: 1.0, quantity: 1, runningCurrent: 13.73, notes: "Common area lighting" },
    { name: "Roof HVAC Package Unit", category: "AC", power: 25, voltage: 400, phase: 3, powerFactor: 0.85, demandFactor: 0.9, quantity: 1, runningCurrent: 38.21, notes: "Common ventilation / AC" },
  ];

  for (const load of defaultLoads) {
    await db.loadLibraryItem.create({
      data: {
        ...load,
        projectId,
      },
    });
  }
}
