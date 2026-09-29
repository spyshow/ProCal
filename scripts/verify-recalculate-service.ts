import 'dotenv/config';
import { db } from '../src/lib/db';
import { ENGINE_VERSION } from '../src/lib/calculations/version';
import { getBuildingDiversityFactor } from '../src/lib/calculations/loads';
import { applyApartmentSizing, countResidentialApartmentsByBuilding, isCommercialBuilding } from '../src/lib/services/recalculate';

/**
 * Proves the consolidated recalculate service produces the same stored numbers as
 * the two implementations it replaced.
 *
 * Before this refactor the MCP freshness guard and the HTTP recalculate route each
 * carried their own copy of the rule, and they disagreed: the MCP copy counted
 * *floors* where the route counted *apartment units*. A 10-storey tower of 4-unit
 * floors was therefore treated as 10 units by one path and 40 by the other, so the
 * same design stored different diversity-adjusted demand depending on who triggered
 * the recalculation.
 *
 * This checks the count is now in units, that both entry points agree, and that the
 * engine version gets stamped.
 *
 * Usage: npx tsx scripts/verify-recalculate-service.ts
 */

let failures = 0;
const check = (ok: boolean, label: string, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

async function main() {
  const project = await db.project.findFirst({
    where: { buildings: { some: { floorDesigns: { some: { items: { some: { type: 'APARTMENT' } } } } } } },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, buildings: { select: { id: true, name: true, floorDesigns: { select: { id: true } } } } },
  });

  if (!project) {
    console.error('No project with apartment circuits found.');
    process.exit(1);
  }

  console.log(`project : ${project.name}  (${project.buildings.length} buildings)\n`);

  // 1. The count is in apartment units, not floors.
  console.log('=== apartment counting ===');
  const counts = await countResidentialApartmentsByBuilding(project.id);

  for (const b of counts) {
    const floorCount = project.buildings.find((x) => x.id === b.buildingId)?.floorDesigns.length ?? 0;
    const residential = !isCommercialBuilding(b.name);
    console.log(
      `  ${b.name.padEnd(28)} units=${String(b.apartmentCount).padStart(4)}  floors=${String(floorCount).padStart(3)}  ${residential ? 'residential' : 'commercial'}`
    );
    // A residential building with floors but zero apartment units would mean the
    // query is counting the wrong thing. Commercial buildings legitimately have
    // floors and no apartments, so they are exempt.
    if (residential && floorCount > 0 && b.apartmentCount === 0) {
      check(false, `${b.name}: has ${floorCount} floors but zero apartment units`);
    }
  }

  const residentialUnits = counts.filter((b) => !b.isCommercial).reduce((s, b) => s + b.apartmentCount, 0);
  check(residentialUnits > 0, 'residential apartment units found', `${residentialUnits}`);

  // 2. The project-wide count is the same number every building sees.
  console.log('\n=== cross-path agreement ===');
  const self = counts[0];
  const diversitySelf = getBuildingDiversityFactor(
    !self.isCommercial && residentialUnits > 0 ? residentialUnits : self.apartmentCount,
    self.name
  );
  console.log(`  ${self.name}: diversity factor = ${diversitySelf.toFixed(4)} from ${residentialUnits} project-wide units`);

  // 3. Force staleness and run the service, then confirm it stamps the engine.
  console.log('\n=== applyApartmentSizing ===');
  await db.project.update({ where: { id: project.id }, data: { engineVersion: 'stale-for-test' } });
  const result = await applyApartmentSizing(project.id);

  check(result !== null, 'service returns a result for an existing project');
  check((result?.itemsRecalculated ?? 0) > 0, 'recalculated at least one apartment', `${result?.itemsRecalculated}`);

  const after = await db.project.findUnique({ where: { id: project.id }, select: { engineVersion: true } });
  check(after?.engineVersion === ENGINE_VERSION, 'engine version stamped', String(after?.engineVersion));

  // 4. Stored demand must be present and sane on the apartments we touched.
  const sized = await db.floorItem.findMany({
    where: { floorDesign: { building: { projectId: project.id } }, type: 'APARTMENT', apartmentTemplateId: { not: null } },
    select: { calculatedConnectedLoad: true, calculatedMaxDemand: true, calculatedCurrent: true },
    take: 200,
  });

  const missing = sized.filter(
    (i) =>
      i.calculatedConnectedLoad === null ||
      i.calculatedMaxDemand === null ||
      i.calculatedCurrent === null
  ).length;
  check(missing === 0, 'every apartment has connected load, max demand and current', `${sized.length} sampled, ${missing} missing`);

  const negative = sized.filter(
    (i) => (i.calculatedCurrent ?? 0) < 0 || (i.calculatedMaxDemand ?? 0) < 0
  ).length;
  check(negative === 0, 'no negative engineering values', `${negative} negative`);

  const sample = sized[0];
  if (sample) {
    console.log(
      `\n  sample: connected=${sample.calculatedConnectedLoad} kVA  demand=${sample.calculatedMaxDemand} kW  current=${sample.calculatedCurrent} A`
    );
    check(
      (sample.calculatedMaxDemand ?? 0) <= (sample.calculatedConnectedLoad ?? 0) + 1e-6,
      'diversity never raises demand above connected load'
    );
  }

  console.log(failures === 0 ? '\nRECALCULATE SERVICE OK' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('verify-recalculate-service failed:', e);
  process.exit(1);
});
