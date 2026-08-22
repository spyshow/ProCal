import 'dotenv/config';
import { db } from '../src/lib/db';
import { getApartmentDiversityFactor } from '../src/lib/calculations/loads';

/**
 * Migration / Maintenance script:
 * Iterates through all buildings across all projects in the database and
 * recalculates apartment connected loads, building-wide diversity factors,
 * max demands, and per-phase current loads based on the latest formula standards.
 *
 * Usage:
 *   npx tsx scripts/recalculate-all-projects.ts
 */
async function main() {
  console.log('🔄 Starting full-database recalculation migration...\n');

  const buildings = await db.building.findMany({
    include: {
      project: true,
      floorDesigns: {
        include: {
          items: {
            include: {
              apartmentTemplate: {
                include: { rooms: true },
              },
            },
          },
        },
      },
    },
  });

  console.log(`Found ${buildings.length} building(s) across database.`);

  let totalUpdated = 0;

  for (const building of buildings) {
    const project = building.project;
    const voltageKv = project.voltage / 1000;
    const powerFactor = project.powerFactor || 0.85;

    const aptItems = building.floorDesigns.flatMap((fd) =>
      fd.items.filter((item) => item.type === 'APARTMENT' && item.apartmentTemplate)
    );

    if (aptItems.length === 0) continue;

    const apartmentCount = aptItems.length;
    const diversityFactor = getApartmentDiversityFactor(apartmentCount);

    const updates = [];
    for (const item of aptItems) {
      if (!item.apartmentTemplate) continue;
      const template = item.apartmentTemplate;
      const totalConnectedLoadVA = template.rooms.reduce(
        (sum, room) => sum + room.connectedLoad,
        0
      );

      const calculatedConnectedLoad = totalConnectedLoadVA / 1000;
      const calculatedMaxDemand = calculatedConnectedLoad * diversityFactor;
      const isThreePhase = template.phases === 3;

      let calculatedCurrent: number;
      if (isThreePhase) {
        calculatedCurrent = calculatedMaxDemand / (Math.sqrt(3) * voltageKv * powerFactor);
      } else {
        calculatedCurrent = calculatedMaxDemand / ((voltageKv / Math.sqrt(3)) * powerFactor);
      }

      updates.push(
        db.floorItem.update({
          where: { id: item.id },
          data: {
            calculatedConnectedLoad,
            calculatedMaxDemand,
            calculatedCurrent: parseFloat(calculatedCurrent.toFixed(2)),
          },
        })
      );
    }

    if (updates.length > 0) {
      await db.$transaction(updates);
      totalUpdated += updates.length;
      console.log(
        `  ✓ Building "${building.name}" (${project.name}): Recalculated ${updates.length} apartments (DF: ${diversityFactor}).`
      );
    }
  }

  console.log(`\n🎉 Completed recalculation migration! Total apartment records updated: ${totalUpdated}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
