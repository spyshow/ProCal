import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({
  url: "file:./dev.db",
});
const db = new PrismaClient({ adapter });

async function main() {
  console.log("Creating test project...");

  // Get or create user
  let user = await db.user.findFirst({ where: { username: "engineer" } });
  if (!user) {
    const passwordHash = await bcrypt.hash("password123", 10);
    user = await db.user.create({
      data: {
        username: "engineer",
        name: "Lead Electrical Engineer",
        passwordHash,
      },
    });
  }

  // Create project
  const project = await db.project.create({
    data: {
      name: "Test Project - Mixed Use Complex",
      client: "ABC Development Corp",
      consultant: "XYZ Engineering Consultants",
      contractor: "Build It Construction",
      location: "Dubai, UAE",
      engineer: "John Smith",
      date: "2026-07-22",
      voltage: 400,
      frequency: 50,
      powerFactor: 0.85,
      maxDemandFactor: 0.8,
      transformerSize: 1000,
      country: "UAE",
      calculationStandard: "IEC",
      maxVoltageDropLighting: 3,
      maxVoltageDropPower: 5,
      userId: user.id,
    },
  });
  console.log("Project created:", project.name);

  // Create apartment templates (1-phase and 3-phase)
  const studio1p = await db.apartmentTemplate.create({
    data: {
      name: "Studio Apartment (1-Phase)",
      phases: 1,
      projectId: project.id,
      rooms: {
        create: [
          { type: "LIVING_ROOM", name: "Living Area", area: 25, hasAc: true, loadDensity: 100, connectedLoad: 2.5 },
          { type: "KITCHEN", name: "Kitchen", area: 8, hasAc: false, loadDensity: 150, connectedLoad: 1.2 },
          { type: "BATHROOM", name: "Bathroom", area: 5, hasAc: false, loadDensity: 200, connectedLoad: 1.0 },
        ],
      },
    },
  });

  const br1_3p = await db.apartmentTemplate.create({
    data: {
      name: "1 Bedroom (3-Phase)",
      phases: 3,
      projectId: project.id,
      rooms: {
        create: [
          { type: "LIVING_ROOM", name: "Living Room", area: 30, hasAc: true, loadDensity: 100, connectedLoad: 3.0 },
          { type: "BEDROOM", name: "Bedroom", area: 15, hasAc: true, loadDensity: 100, connectedLoad: 1.5 },
          { type: "KITCHEN", name: "Kitchen", area: 12, hasAc: false, loadDensity: 150, connectedLoad: 1.8 },
          { type: "BATHROOM", name: "Bathroom", area: 6, hasAc: false, loadDensity: 200, connectedLoad: 1.2 },
        ],
      },
    },
  });

  const br2_3p = await db.apartmentTemplate.create({
    data: {
      name: "2 Bedroom (3-Phase)",
      phases: 3,
      projectId: project.id,
      rooms: {
        create: [
          { type: "LIVING_ROOM", name: "Living Room", area: 40, hasAc: true, loadDensity: 100, connectedLoad: 4.0 },
          { type: "BEDROOM", name: "Master Bedroom", area: 20, hasAc: true, loadDensity: 100, connectedLoad: 2.0 },
          { type: "BEDROOM", name: "Bedroom 2", area: 15, hasAc: true, loadDensity: 100, connectedLoad: 1.5 },
          { type: "KITCHEN", name: "Kitchen", area: 15, hasAc: false, loadDensity: 150, connectedLoad: 2.25 },
          { type: "BATHROOM", name: "Bathroom 1", area: 6, hasAc: false, loadDensity: 200, connectedLoad: 1.2 },
          { type: "BATHROOM", name: "Bathroom 2", area: 5, hasAc: false, loadDensity: 200, connectedLoad: 1.0 },
        ],
      },
    },
  });

  const br3_1p = await db.apartmentTemplate.create({
    data: {
      name: "3 Bedroom (1-Phase)",
      phases: 1,
      projectId: project.id,
      rooms: {
        create: [
          { type: "LIVING_ROOM", name: "Living Room", area: 50, hasAc: true, loadDensity: 100, connectedLoad: 5.0 },
          { type: "BEDROOM", name: "Master Bedroom", area: 25, hasAc: true, loadDensity: 100, connectedLoad: 2.5 },
          { type: "BEDROOM", name: "Bedroom 2", area: 18, hasAc: true, loadDensity: 100, connectedLoad: 1.8 },
          { type: "BEDROOM", name: "Bedroom 3", area: 15, hasAc: true, loadDensity: 100, connectedLoad: 1.5 },
          { type: "KITCHEN", name: "Kitchen", area: 18, hasAc: false, loadDensity: 150, connectedLoad: 2.7 },
          { type: "BATHROOM", name: "Master Bath", area: 8, hasAc: false, loadDensity: 200, connectedLoad: 1.6 },
          { type: "BATHROOM", name: "Bath 2", area: 5, hasAc: false, loadDensity: 200, connectedLoad: 1.0 },
        ],
      },
    },
  });

  console.log("Apartment templates created");

  // Create load library items
  const loadItems = await Promise.all([
    db.loadLibraryItem.create({
      data: {
        name: "Elevator",
        category: "Elevator",
        power: 15,
        voltage: 400,
        phase: 3,
        powerFactor: 0.85,
        demandFactor: 0.7,
        quantity: 2,
        runningCurrent: 26.9,
        projectId: project.id,
      },
    }),
    db.loadLibraryItem.create({
      data: {
        name: "Fire Pump",
        category: "Pump",
        power: 22,
        voltage: 400,
        phase: 3,
        powerFactor: 0.8,
        demandFactor: 1.0,
        quantity: 1,
        runningCurrent: 39.7,
        projectId: project.id,
      },
    }),
    db.loadLibraryItem.create({
      data: {
        name: "Water Pump",
        category: "Pump",
        power: 7.5,
        voltage: 400,
        phase: 3,
        powerFactor: 0.8,
        demandFactor: 0.8,
        quantity: 2,
        runningCurrent: 13.5,
        projectId: project.id,
      },
    }),
    db.loadLibraryItem.create({
      data: {
        name: "Central AC (Chiller)",
        category: "AC",
        power: 100,
        voltage: 400,
        phase: 3,
        powerFactor: 0.85,
        demandFactor: 0.6,
        quantity: 1,
        runningCurrent: 170.1,
        projectId: project.id,
      },
    }),
    db.loadLibraryItem.create({
      data: {
        name: "Lighting - Common Area",
        category: "Lighting",
        power: 5,
        voltage: 230,
        phase: 1,
        powerFactor: 0.9,
        demandFactor: 0.9,
        quantity: 1,
        runningCurrent: 24.2,
        projectId: project.id,
      },
    }),
    db.loadLibraryItem.create({
      data: {
        name: "Emergency Generator",
        category: "Generator",
        power: 500,
        voltage: 400,
        phase: 3,
        powerFactor: 0.8,
        demandFactor: 1.0,
        quantity: 1,
        runningCurrent: 902.1,
        projectId: project.id,
      },
    }),
  ]);
  console.log("Load library items created");

  // Create Building 1: Residential Tower A (19 floors, apartments)
  const building1 = await db.building.create({
    data: {
      name: "Residential Tower A",
      floors: 19,
      serviceFloors: 2,
      apartmentsPerFloor: 4,
      supplyVoltage: "400V 3-Phase",
      earthingSystem: "TN-S",
      projectId: project.id,
    },
  });

  // Create floors for Building 1
  for (let floor = 1; floor <= 19; floor++) {
    const fd = await db.floorDesign.create({
      data: {
        floorNumber: floor,
        hasFloorSubPanels: floor % 5 === 0, // SDB every 5 floors
        riserCableLength: floor * 3, // 3m per floor
        riserCableSize: "120 mm²",
        buildingId: building1.id,
      },
    });

    // Add apartments to each floor
    const templates = [studio1p, br1_3p, br2_3p, br3_1p];
    for (let apt = 0; apt < 4; apt++) {
      const template = templates[apt];
      const isThreePhase = template.phases === 3;
      const connectedLoad = 15 + Math.random() * 10; // 15-25 kW
      const maxDemand = connectedLoad * 0.7;
      const current = maxDemand / (Math.sqrt(3) * 0.4 * 0.85);

      await db.floorItem.create({
        data: {
          type: "APARTMENT",
          name: `Apt ${String.fromCharCode(65 + apt)} (${floor}F)`,
          apartmentTemplateId: template.id,
          floorDesignId: fd.id,
          calculatedConnectedLoad: connectedLoad,
          calculatedMaxDemand: maxDemand,
          calculatedCurrent: current,
          breakerSize: "32A",
          cableSize: "10 mm²",
          cableLength: 8 + Math.random() * 7, // 8-15m
          installMethod: "C",
          cableInsulation: "XLPE",
          assignedPhase: isThreePhase ? null : (apt % 3) + 1,
        },
      });
    }
  }

  // Add building loads to Building 1
  for (const load of loadItems) {
    await db.buildingLoad.create({
      data: {
        buildingId: building1.id,
        loadLibraryItemId: load.id,
        quantity: load.quantity,
        cableSize: "95 mm²",
        cableLength: 50,
        installMethod: "F",
        cableInsulation: "XLPE",
      },
    });
  }
  console.log("Building 1 (Residential Tower A) created with 19 floors");

  // Create Building 2: Residential Tower B (12 floors)
  const building2 = await db.building.create({
    data: {
      name: "Residential Tower B",
      floors: 12,
      serviceFloors: 1,
      apartmentsPerFloor: 3,
      supplyVoltage: "400V 3-Phase",
      earthingSystem: "TN-S",
      projectId: project.id,
    },
  });

  for (let floor = 1; floor <= 12; floor++) {
    const fd = await db.floorDesign.create({
      data: {
        floorNumber: floor,
        hasFloorSubPanels: floor % 4 === 0,
        riserCableLength: floor * 3,
        riserCableSize: "70 mm²",
        buildingId: building2.id,
      },
    });

    const templates = [br1_3p, br2_3p, br3_1p];
    for (let apt = 0; apt < 3; apt++) {
      const template = templates[apt];
      const isThreePhase = template.phases === 3;
      const connectedLoad = 18 + Math.random() * 12; // 18-30 kW
      const maxDemand = connectedLoad * 0.7;
      const current = isThreePhase
        ? maxDemand / (Math.sqrt(3) * 0.4 * 0.85)
        : maxDemand / (0.23 * 0.85);

      await db.floorItem.create({
        data: {
          type: "APARTMENT",
          name: `Apt ${String.fromCharCode(65 + apt)} (${floor}F)`,
          apartmentTemplateId: template.id,
          floorDesignId: fd.id,
          calculatedConnectedLoad: connectedLoad,
          calculatedMaxDemand: maxDemand,
          calculatedCurrent: current,
          breakerSize: isThreePhase ? "40A" : "32A",
          cableSize: isThreePhase ? "16 mm²" : "10 mm²",
          cableLength: 10 + Math.random() * 10,
          installMethod: "C",
          cableInsulation: "XLPE",
          assignedPhase: isThreePhase ? null : (apt % 3) + 1,
        },
      });
    }
  }

  // Add building loads to Building 2
  for (const load of loadItems.slice(0, 4)) {
    await db.buildingLoad.create({
      data: {
        buildingId: building2.id,
        loadLibraryItemId: load.id,
        quantity: load.quantity,
        cableSize: "70 mm²",
        cableLength: 40,
        installMethod: "F",
        cableInsulation: "XLPE",
      },
    });
  }
  console.log("Building 2 (Residential Tower B) created with 12 floors");

  // Create Building 3: Mall (5 floors)
  const building3 = await db.building.create({
    data: {
      name: "Shopping Mall",
      floors: 5,
      serviceFloors: 1,
      apartmentsPerFloor: 0,
      supplyVoltage: "400V 3-Phase",
      earthingSystem: "TN-S",
      projectId: project.id,
    },
  });

  // Mall floors with different loads
  const mallLoads = [
    { name: "Ground Floor - Retail", power: 150, type: "SERVICE_PANEL" },
    { name: "First Floor - Retail", power: 120, type: "SERVICE_PANEL" },
    { name: "Second Floor - Food Court", power: 200, type: "SERVICE_PANEL" },
    { name: "Third Floor - Cinema", power: 180, type: "SERVICE_PANEL" },
    { name: "Fourth Floor - Parking", power: 80, type: "SERVICE_PANEL" },
  ];

  for (let floor = 1; floor <= 5; floor++) {
    const fd = await db.floorDesign.create({
      data: {
        floorNumber: floor,
        hasFloorSubPanels: true,
        riserCableLength: floor * 4, // 4m per floor for mall
        riserCableSize: "185 mm²",
        buildingId: building3.id,
      },
    });

    const load = mallLoads[floor - 1];
    const current = load.power / (Math.sqrt(3) * 0.4 * 0.85);

    await db.floorItem.create({
      data: {
        type: load.type,
        name: load.name,
        floorDesignId: fd.id,
        calculatedConnectedLoad: load.power,
        calculatedMaxDemand: load.power * 0.8,
        calculatedCurrent: current,
        breakerSize: "400A",
        cableSize: "185 mm²",
        cableLength: 15,
        installMethod: "F",
        cableInsulation: "XLPE",
      },
    });
  }

  // Add mall building loads
  const mallBuildingLoads = [
    { name: "HVAC System", power: 250, category: "AC" },
    { name: "Escalator", power: 30, category: "Elevator" },
    { name: "Emergency Lighting", power: 20, category: "Lighting" },
    { name: "Fire Alarm System", power: 5, category: "Other" },
    { name: "CCTV System", power: 3, category: "Other" },
  ];

  for (const bl of mallBuildingLoads) {
    const lib = await db.loadLibraryItem.create({
      data: {
        name: bl.name,
        category: bl.category,
        power: bl.power,
        voltage: 400,
        phase: 3,
        powerFactor: 0.85,
        demandFactor: 0.9,
        quantity: 1,
        runningCurrent: bl.power / (Math.sqrt(3) * 0.4 * 0.85),
        projectId: project.id,
      },
    });

    await db.buildingLoad.create({
      data: {
        buildingId: building3.id,
        loadLibraryItemId: lib.id,
        quantity: 1,
        cableSize: "95 mm²",
        cableLength: 60,
        installMethod: "F",
        cableInsulation: "XLPE",
      },
    });
  }
  console.log("Building 3 (Shopping Mall) created with 5 floors");

  console.log("\n=== Test Project Summary ===");
  console.log(`Project: ${project.name}`);
  console.log(`Buildings: 3`);
  console.log(`- Residential Tower A: 19 floors, 76 apartments`);
  console.log(`- Residential Tower B: 12 floors, 36 apartments`);
  console.log(`- Shopping Mall: 5 floors, commercial spaces`);
  console.log(`Total floors: 36`);
  console.log(`Total apartments: 112`);
  console.log(`\nLogin credentials:`);
  console.log(`Username: engineer`);
  console.log(`Password: password123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
