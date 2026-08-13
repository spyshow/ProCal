import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '../src/lib/db';
import { sizeCableAndBreaker } from '../src/lib/calculations/cables';

async function main() {
  console.log('🚀 Starting Istanbul Mall & Four Towers Project Creation...');

  // 1. Find or create user "nabel"
  let user = await db.user.findUnique({
    where: { username: 'nabel' },
  });

  const passwordHash = await bcrypt.hash('123456', 10);

  if (!user) {
    user = await db.user.create({
      data: {
        username: 'nabel',
        passwordHash,
        name: 'Nabel',
        email: 'nabel@example.com',
        role: 'USER',
        credits: 100,
      },
    });
    console.log('✓ Created user "nabel" with password "123456"');
  } else {
    user = await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        credits: Math.max(user.credits, 50),
        disabled: false,
      },
    });
    console.log('✓ Updated user "nabel" with credentials');
  }

  // 2. Remove previous test project with same name if any
  const existingProjects = await db.project.findMany({
    where: {
      userId: user.id,
      name: 'Istanbul Grand Mall & Four Towers',
    },
  });

  for (const p of existingProjects) {
    await db.project.delete({ where: { id: p.id } });
  }

  // 3. Create Project
  const project = await db.project.create({
    data: {
      name: 'Istanbul Grand Mall & Four Towers',
      country: 'Turkey',
      voltage: 400,
      frequency: 50,
      powerFactor: 0.85,
      maxDemandFactor: 0.8,
      location: 'Istanbul, Turkey',
      client: 'Grand Mall Developments & Residences',
      consultant: 'ProCal Engineering Consultants',
      contractor: 'Mega Yapı Construction',
      engineer: 'Nabel',
      date: new Date().toISOString().split('T')[0],
      preferredManufacturer: 'SCHNEIDER',
      calculationStandard: 'IEC',
      maxVoltageDropLighting: 3,
      maxVoltageDropPower: 5,
      ambientTemp: 30,
      groupingCount: 1,
      userId: user.id,
    },
  });
  console.log(`✓ Created Project: ${project.name} (${project.id})`);

  // 4. Create Apartment Templates for Turkey Standards
  // Turkey Room Densities: Kitchen: 145, Bedroom: 78, Living: 98, Dining: 88, Bath: 58, Hall: 48
  // Template 1: Standard 3-Bed Flat (110 m²) for Towers 1 & 2
  const template1 = await db.apartmentTemplate.create({
    data: {
      name: 'Standard 3-Bedroom Flat (110m²)',
      phases: 3,
      projectId: project.id,
      rooms: {
        create: [
          { type: 'LIVING_ROOM', name: 'Living Room', area: 30, hasAc: true, acBtu: 18000, loadDensity: 98, connectedLoad: 30 * 98 + 5274 },
          { type: 'DINING_ROOM', name: 'Dining Room', area: 16, hasAc: false, loadDensity: 88, connectedLoad: 16 * 88 },
          { type: 'KITCHEN', name: 'Kitchen', area: 14, hasAc: false, loadDensity: 145, connectedLoad: 14 * 145 },
          { type: 'BEDROOM', name: 'Master Bedroom', area: 20, hasAc: true, acBtu: 12000, loadDensity: 78, connectedLoad: 20 * 78 + 3516 },
          { type: 'BEDROOM', name: 'Bedroom 2', area: 15, hasAc: true, acBtu: 9000, loadDensity: 78, connectedLoad: 15 * 78 + 2637 },
          { type: 'BEDROOM', name: 'Bedroom 3', area: 12, hasAc: false, loadDensity: 78, connectedLoad: 12 * 78 },
          { type: 'BATHROOM', name: 'Master Bathroom', area: 6, hasAc: false, loadDensity: 58, connectedLoad: 6 * 58 },
          { type: 'BATHROOM', name: 'Guest Bathroom', area: 4, hasAc: false, loadDensity: 58, connectedLoad: 4 * 58 },
          { type: 'HALL', name: 'Hall & Corridor', area: 10, hasAc: false, loadDensity: 48, connectedLoad: 10 * 48 },
        ],
      },
    },
    include: { rooms: true },
  });

  const t1ConnectedLoad = template1.rooms.reduce((s, r) => s + r.connectedLoad, 0);
  const t1MaxDemand = t1ConnectedLoad * 0.8;
  const t1Current = t1MaxDemand / (Math.sqrt(3) * 400 * 0.85); // 3-phase 400V
  console.log(`✓ Created Template 1 (3-Bed): ${t1ConnectedLoad.toFixed(0)} VA (${t1Current.toFixed(1)} A)`);

  // Template 2: Ultra-Luxury 5-Bed Flat (240 m²) for Towers 3 & 4
  const template2 = await db.apartmentTemplate.create({
    data: {
      name: 'Ultra-Luxury 5-Bedroom Flat (240m²)',
      phases: 3,
      projectId: project.id,
      rooms: {
        create: [
          { type: 'LIVING_ROOM', name: 'Grand Living Room', area: 55, hasAc: true, acBtu: 30000, loadDensity: 98, connectedLoad: 55 * 98 + 8790 },
          { type: 'DINING_ROOM', name: 'Formal Dining Room', area: 25, hasAc: true, acBtu: 12000, loadDensity: 88, connectedLoad: 25 * 88 + 3516 },
          { type: 'KITCHEN', name: "Chef's Kitchen", area: 22, hasAc: false, loadDensity: 145, connectedLoad: 22 * 145 },
          { type: 'BEDROOM', name: 'Master Suite Bedroom', area: 35, hasAc: true, acBtu: 18000, loadDensity: 78, connectedLoad: 35 * 78 + 5274 },
          { type: 'BEDROOM', name: 'Bedroom 2 (En-Suite)', area: 22, hasAc: true, acBtu: 12000, loadDensity: 78, connectedLoad: 22 * 78 + 3516 },
          { type: 'BEDROOM', name: 'Bedroom 3 (En-Suite)', area: 20, hasAc: true, acBtu: 12000, loadDensity: 78, connectedLoad: 20 * 78 + 3516 },
          { type: 'BEDROOM', name: 'Bedroom 4', area: 18, hasAc: true, acBtu: 12000, loadDensity: 78, connectedLoad: 18 * 78 + 3516 },
          { type: 'BEDROOM', name: 'Bedroom 5 / Guest Suite', area: 16, hasAc: true, acBtu: 9000, loadDensity: 78, connectedLoad: 16 * 78 + 2637 },
          { type: 'BATHROOM', name: 'Master Bathroom', area: 10, hasAc: false, loadDensity: 58, connectedLoad: 10 * 58 },
          { type: 'BATHROOM', name: 'Bathroom 2', area: 7, hasAc: false, loadDensity: 58, connectedLoad: 7 * 58 },
          { type: 'BATHROOM', name: 'Powder Room', area: 4, hasAc: false, loadDensity: 58, connectedLoad: 4 * 58 },
          { type: 'HALL', name: 'Entrance Foyer & Gallery', area: 20, hasAc: false, loadDensity: 48, connectedLoad: 20 * 48 },
        ],
      },
    },
    include: { rooms: true },
  });

  const t2ConnectedLoad = template2.rooms.reduce((s, r) => s + r.connectedLoad, 0);
  const t2MaxDemand = t2ConnectedLoad * 0.8;
  const t2Current = t2MaxDemand / (Math.sqrt(3) * 400 * 0.85); // 3-phase 400V
  console.log(`✓ Created Template 2 (5-Bed Luxury): ${t2ConnectedLoad.toFixed(0)} VA (${t2Current.toFixed(1)} A)`);

  // 5. Create Central Load Library Items for Mall & Complex
  const mallLoadsSpecs = [
    { name: 'Mall Central Chillers & HVAC', category: 'AC', power: 250, phase: 3, voltage: 400, pf: 0.85, df: 0.9 },
    { name: 'Mall Elevators & Escalators Bank', category: 'Elevator', power: 60, phase: 3, voltage: 400, pf: 0.85, df: 0.8 },
    { name: 'Domestic Water Booster Pumps', category: 'Pump', power: 22, phase: 3, voltage: 400, pf: 0.85, df: 0.85 },
    { name: 'Fire Fighting Main Pump', category: 'Pump', power: 75, phase: 3, voltage: 400, pf: 0.85, df: 1.0 },
    { name: 'Fire Fighting Jockey Pump', category: 'Pump', power: 5.5, phase: 3, voltage: 400, pf: 0.85, df: 1.0 },
    { name: 'Mall Common Area Lighting', category: 'Lighting', power: 35, phase: 3, voltage: 400, pf: 0.95, df: 1.0 },
  ];

  const createdMallLoadItems = [];
  for (const spec of mallLoadsSpecs) {
    const runningCurrent = (spec.power * 1000) / (Math.sqrt(3) * spec.voltage * spec.pf);
    const item = await db.loadLibraryItem.create({
      data: {
        name: spec.name,
        category: spec.category,
        power: spec.power,
        phase: spec.phase,
        voltage: spec.voltage,
        powerFactor: spec.pf,
        demandFactor: spec.df,
        runningCurrent,
        projectId: project.id,
      },
    });
    createdMallLoadItems.push(item);
  }
  console.log(`✓ Created ${createdMallLoadItems.length} Central Mall Equipment Items`);

  // 6. Create Buildings
  // Building 1: Mall Podium (3 Floors, Central building loads)
  const bMall = await db.building.create({
    data: {
      name: 'Mall Podium',
      floors: 3,
      serviceFloors: 1,
      apartmentsPerFloor: 0,
      supplyVoltage: '400V 3-Phase',
      earthingSystem: 'TN-S',
      lightningProtection: true,
      projectId: project.id,
      buildingLoads: {
        create: createdMallLoadItems.map((item, idx) => {
          const current = item.runningCurrent;
          const sized = sizeCableAndBreaker(current, true, {
            material: 'copper',
            insulation: 'XLPE',
            ambientTemp: 30,
            groupingCount: 1,
            installMethod: 'C',
            maxCableSize: 300,
          });
          return {
            loadLibraryItemId: item.id,
            quantity: 1,
            cableSize: sized.formattedCableSize,
            cableLength: 25 + idx * 10,
            installMethod: 'C',
            cableInsulation: 'XLPE',
            ambientTemp: 30,
            groupingCount: 1,
          };
        }),
      },
    },
  });

  // Create Mall Podium Floors
  for (let f = 1; f <= 3; f++) {
    await db.floorDesign.create({
      data: {
        floorNumber: f,
        hasFloorSubPanels: true,
        riserCableLength: 15 + (f - 1) * 8,
        riserCableSize: '70 mm²',
        riserBreakerSize: '160A',
        riserInstallMethod: 'C',
        riserCableInsulation: 'XLPE',
        riserAmbientTemp: 30,
        riserGroupingCount: 1,
        buildingId: bMall.id,
      },
    });
  }
  console.log('✓ Created Building 1: Mall Podium (3 Floors + Central Building Loads)');

  // Helper to create Tower
  async function createTower(
    name: string,
    numFloors: number,
    flatsPerFloor: number,
    template: typeof template1,
    flatCurrent: number,
    flatConnectedLoad: number,
    flatMaxDemand: number
  ) {
    const building = await db.building.create({
      data: {
        name,
        floors: numFloors,
        serviceFloors: 1,
        apartmentsPerFloor: flatsPerFloor,
        supplyVoltage: '400V 3-Phase',
        earthingSystem: 'TN-S',
        lightningProtection: true,
        projectId: project.id,
      },
    });

    const flatSizing = sizeCableAndBreaker(flatCurrent, true, {
      material: 'copper',
      insulation: 'XLPE',
      ambientTemp: 30,
      groupingCount: 1,
      installMethod: 'C',
      maxCableSize: 300,
    });

    for (let f = 1; f <= numFloors; f++) {
      const riserLen = 15 + (f - 1) * 3.5;
      const floorDesign = await db.floorDesign.create({
        data: {
          floorNumber: f,
          hasFloorSubPanels: true,
          riserCableLength: riserLen,
          riserInstallMethod: 'C',
          riserCableInsulation: 'XLPE',
          riserAmbientTemp: 30,
          riserGroupingCount: 1,
          buildingId: building.id,
        },
      });

      // Create Apartments on this floor
      for (let aptIdx = 1; aptIdx <= flatsPerFloor; aptIdx++) {
        await db.floorItem.create({
          data: {
            type: 'APARTMENT',
            name: `Apt ${f}0${aptIdx}`,
            apartmentTemplateId: template.id,
            floorDesignId: floorDesign.id,
            calculatedConnectedLoad: flatConnectedLoad,
            calculatedMaxDemand: flatMaxDemand,
            calculatedCurrent: flatCurrent,
            breakerSize: `${flatSizing.breakerSize}A`,
            cableSize: flatSizing.formattedCableSize,
            cableLength: 12 + aptIdx * 4,
            installMethod: 'C',
            cableInsulation: 'XLPE',
            ambientTemp: 30,
            groupingCount: 1,
          },
        });
      }

      // Calculate Riser Load for SDB
      const floorTotalConnected = flatConnectedLoad * flatsPerFloor;
      const floorMaxDemand = floorTotalConnected * 0.8;
      const floorCurrent = floorMaxDemand / (Math.sqrt(3) * 400 * 0.85);

      const riserSizing = sizeCableAndBreaker(floorCurrent, true, {
        material: 'copper',
        insulation: 'XLPE',
        ambientTemp: 30,
        groupingCount: 1,
        installMethod: 'C',
        maxCableSize: 300,
      });

      await db.floorDesign.update({
        where: { id: floorDesign.id },
        data: {
          riserCableSize: riserSizing.formattedCableSize,
          riserBreakerSize: `${riserSizing.breakerSize}A`,
        },
      });
    }

    console.log(`✓ Created ${name} (${numFloors} floors, ${flatsPerFloor} flats/floor)`);
    return building;
  }

  // Building 2: Tower 1 (12 Floors, 4 flats/floor of 110m²)
  await createTower('Tower 1 (Residential A)', 12, 4, template1, t1Current, t1ConnectedLoad, t1MaxDemand);

  // Building 3: Tower 2 (12 Floors, 4 flats/floor of 110m²)
  await createTower('Tower 2 (Residential B)', 12, 4, template1, t1Current, t1ConnectedLoad, t1MaxDemand);

  // Building 4: Tower 3 (12 Floors, 2 big flats/floor of 240m²)
  await createTower('Tower 3 (Luxury C)', 12, 2, template2, t2Current, t2ConnectedLoad, t2MaxDemand);

  // Building 5: Tower 4 (12 Floors, 2 big flats/floor of 240m²)
  await createTower('Tower 4 (Luxury D)', 12, 2, template2, t2Current, t2ConnectedLoad, t2MaxDemand);

  // Calculate Total Transformer Size (kVA)
  const allBuildings = await db.building.findMany({
    where: { projectId: project.id },
    include: {
      buildingLoads: { include: { loadLibraryItem: true } },
      floorDesigns: { include: { items: true } },
    },
  });

  let totalDemandVA = 0;
  for (const b of allBuildings) {
    for (const bl of b.buildingLoads) {
      if (bl.loadLibraryItem) {
        totalDemandVA += bl.loadLibraryItem.power * 1000 * (bl.loadLibraryItem.demandFactor || 0.8) * bl.quantity;
      }
    }
    for (const fd of b.floorDesigns) {
      for (const item of fd.items) {
        totalDemandVA += (item.calculatedMaxDemand || 0);
      }
    }
  }

  const transformerKVA = Math.ceil((totalDemandVA / 1000) / 100) * 100;
  await db.project.update({
    where: { id: project.id },
    data: {
      transformerSize: Math.max(transformerKVA, 1600),
    },
  });

  console.log(`\n🎉 Project Setup Complete!`);
  console.log(`- Project Name: ${project.name}`);
  console.log(`- User: nabel (password: 123456)`);
  console.log(`- Buildings: 5 (Mall Podium + 4 Towers)`);
  console.log(`- Sized Transformer: ${Math.max(transformerKVA, 1600)} kVA`);
  console.log(`- Generator: None (as requested)`);
}

main()
  .catch((e) => {
    console.error('Error seeding project:', e);
    process.exit(1);
  });
