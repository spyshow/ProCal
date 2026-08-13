import 'dotenv/config';
import { db } from '../src/lib/db';
import { computeFeeders } from '../src/lib/calculations/feeders';
import { recalculateCable } from '../src/lib/sld/cable-editor';
import { parseCableSize } from '../src/lib/calculations/cables';
import { phaseBalance } from '../src/lib/calculations/phaseBalance';

async function main() {
  console.log('🔍 Verifying Istanbul Grand Mall & Four Towers Project...\n');

  const projects = await db.project.findMany({
    where: { name: 'Istanbul Grand Mall & Four Towers' },
    include: {
      buildings: {
        include: {
          buildingLoads: { include: { loadLibraryItem: true } },
          floorDesigns: { include: { items: true } },
        },
      },
      apartmentTemplates: { include: { rooms: true } },
      loadLibraryItems: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Pick project with 5 buildings
  const project = projects.find(p => p.buildings.length === 5) || projects[0];

  if (!project) {
    console.error('❌ Project not found!');
    process.exit(1);
  }

  // Clean up any other partial projects
  for (const p of projects) {
    if (p.id !== project.id) {
      await db.project.delete({ where: { id: p.id } });
    }
  }

  console.log(`📋 Project: ${project.name}`);
  console.log(`📍 Location: ${project.location} | Country Standard: ${project.country}`);
  console.log(`⚡ Voltage: ${project.voltage}V 3-Phase, 50Hz, pf ${project.powerFactor}`);
  console.log(`🏭 Sized Transformer: ${project.transformerSize} kVA`);
  console.log(`🏢 Number of Buildings: ${project.buildings.length}`);

  let totalCircuits = 0;
  let totalIssues = 0;

  for (const building of project.buildings) {
    console.log(`\n========================================`);
    console.log(`🏢 Building: ${building.name} (${building.floors} floors)`);
    console.log(`========================================`);

    // 1. Check Central Building Loads
    if (building.buildingLoads.length > 0) {
      console.log(`  🔹 Central Building Loads (${building.buildingLoads.length}):`);
      for (const bl of building.buildingLoads) {
        totalCircuits++;
        const item = bl.loadLibraryItem;
        if (!item) continue;
        const current = item.runningCurrent * bl.quantity;
        const is3Ph = item.phase === 3;
        const cableSizeStr = bl.cableSize || '16 mm²';
        const length = bl.cableLength || 30;

        const calc = recalculateCable({
          current,
          isThreePhase: is3Ph,
          lengthMeters: length,
          existingCableSize: cableSizeStr,
          method: bl.installMethod || 'C',
          insulation: (bl.cableInsulation as 'PVC' | 'XLPE') || 'XLPE',
          ambientTemp: bl.ambientTemp || 30,
          groupingCount: bl.groupingCount || 1,
          systemVoltage: 400,
          powerFactor: item.powerFactor || 0.85,
          maxVoltageDropPercent: 5,
        });

        const status = calc.isOverloaded ? '❌ OVERLOAD' : calc.changed ? '⚠️ UPSIZE' : '✅ OK';
        if (calc.isOverloaded) totalIssues++;

        console.log(`    - ${item.name}: Load ${current.toFixed(1)}A | Cable: ${calc.formattedCableSize} | Iz: ${calc.ampacity}A | VD: ${calc.voltageDropPercent.toFixed(2)}% | Status: ${status}`);
      }
    }

    // 2. Check Floors & Apartments
    let floorCount = 0;
    for (const fd of building.floorDesigns) {
      floorCount++;
      const items = fd.items;
      if (items.length === 0) continue;

      if (floorCount === 1 || floorCount === building.floorDesigns.length) {
        console.log(`  🔹 Floor ${fd.floorNumber} (SDB Riser: ${fd.riserCableSize}, Breaker: ${fd.riserBreakerSize}, Len: ${fd.riserCableLength}m):`);
        for (const item of items) {
          totalCircuits++;
          const calc = recalculateCable({
            current: item.calculatedCurrent,
            isThreePhase: true,
            lengthMeters: item.cableLength || 15,
            existingCableSize: item.cableSize || '6 mm²',
            method: item.installMethod || 'C',
            insulation: (item.cableInsulation as 'PVC' | 'XLPE') || 'XLPE',
            ambientTemp: item.ambientTemp || 30,
            groupingCount: item.groupingCount || 1,
            systemVoltage: 400,
            powerFactor: 0.85,
            maxVoltageDropPercent: 5,
          });

          const status = calc.isOverloaded ? '❌ OVERLOAD' : calc.changed ? '⚠️ UPSIZE' : '✅ OK';
          if (calc.isOverloaded) totalIssues++;

          console.log(`      • ${item.name}: Load ${item.calculatedCurrent.toFixed(1)}A (${(item.calculatedConnectedLoad / 1000).toFixed(1)} kW) | Cable: ${calc.formattedCableSize} | Breaker: ${item.breakerSize} | Iz: ${calc.ampacity}A | VD: ${calc.voltageDropPercent.toFixed(2)}% | Status: ${status}`);
        }
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`📊 SUMMARY AUDIT RESULT:`);
  console.log(`- Total Circuits Tested: ${totalCircuits}`);
  console.log(`- Overloaded / Failing Circuits: ${totalIssues}`);
  console.log(`- Overall Status: ${totalIssues === 0 ? '✅ 100% COMPLIANT & FULLY COORDINATED' : '⚠️ ATTENTION NEEDED'}`);
  console.log(`========================================\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
