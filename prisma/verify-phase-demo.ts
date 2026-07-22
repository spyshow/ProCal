/**
 * Seed + verify: creates a 2-building demo project with 4 apartment templates
 * (2x3Φ, 2x1Φ), apartments, and building loads, then runs the real
 * phaseBalance + computeFeeders on the seeded data and prints the numbers so
 * the per-phase math can be checked by hand.
 *
 * Run:  npx tsx prisma/verify-phase-demo.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import { phaseBalance } from "../src/lib/calculations/phaseBalance";
import { computeFeeders, type FindBreaker, type FoundBreaker } from "../src/lib/calculations/feeders";
import type { FloorItem, Building, Project } from "../src/types";

const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
const db = new PrismaClient({ adapter });

// Exact replica of the item-current derivation in
// src/app/api/floors/[id]/items/route.ts (keeps seeded DB consistent with the app).
function aptCurrent(connectedLoadVA: number, phases: number, voltageKv: number) {
  const connectedKw = connectedLoadVA / 1000;
  const maxDemand = connectedKw * 0.4; // demand factor 0.4
  const current =
    phases === 3
      ? maxDemand / (Math.sqrt(3) * voltageKv)
      : maxDemand / voltageKv; // app uses voltageKv (0.4) for 1Φ too
  return { connectedKw, maxDemand, current };
}

function stubFinder(): FindBreaker {
  return (): FoundBreaker => ({
    model: null,
    manufacturer: null,
    familyName: null,
    ratedCurrent: null,
    fallback: false,
  });
}

const fmt = (n: number) => n.toFixed(2);

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);
  const user = await db.user.upsert({
    where: { username: "demo" },
    update: {},
    create: { username: "demo", name: "Demo Engineer", passwordHash },
  });

  // ---- Project ----
  const project = await db.project.create({
    data: {
      name: "Phase-Demo Tower Complex",
      client: "Demo Client",
      consultant: "ProCal",
      contractor: "Demo Co",
      location: "Demo City",
      engineer: "Demo Engineer",
      voltage: 400,
      frequency: 50,
      powerFactor: 0.85,
      country: "Syria",
      preferredManufacturer: "MIXED",
      maxVoltageDropLighting: 3,
      maxVoltageDropPower: 5,
      calculationStandard: "IEC",
      date: new Date().toISOString().split("T")[0],
      userId: user.id,
    },
  });
  const voltageKv = project.voltage / 1000; // 0.4

  // ---- 4 Templates (2x3Φ, 2x1Φ) ----
  const mkTpl = async (name: string, phases: number, roomLoadsVA: number[]) => {
    const rooms = roomLoadsVA.map((va, i) => ({
      type: ["BEDROOM", "LIVING_ROOM", "KITCHEN", "BATHROOM"][i % 4],
      name: `Room ${i + 1}`,
      area: 15 + i * 5,
      hasAc: i % 2 === 0,
      acBtu: 9000,
      loadDensity: 70,
      connectedLoad: va,
    }));
    return db.apartmentTemplate.create({
      data: { name, phases, rooms: { create: rooms }, projectId: project.id },
    });
  };

  // T1 3Φ ~12kW connected, T2 3Φ ~16kW, T3 1Φ ~6kW, T4 1Φ ~8kW
  const t1 = await mkTpl("2BR 3Φ", 3, [4000, 3000, 3000, 2000]);
  const t2 = await mkTpl("3BR 3Φ", 3, [5000, 4000, 4000, 3000]);
  const t3 = await mkTpl("Studio 1Φ", 1, [2500, 2000, 1500]);
  const t4 = await mkTpl("1BR 1Φ", 1, [3000, 2500, 2500]);

  // ---- Load library items for building loads ----
  const elevator = await db.loadLibraryItem.create({
    data: { name: "Elevator", category: "Elevator", power: 22, voltage: 400, phase: 3, powerFactor: 0.85, demandFactor: 1, quantity: 1, runningCurrent: 0, startingCurrent: null, notes: null, projectId: project.id },
  });
  const pump = await db.loadLibraryItem.create({
    data: { name: "Fire Pump", category: "Pump", power: 7.5, voltage: 400, phase: 3, powerFactor: 0.85, demandFactor: 1, quantity: 1, runningCurrent: 0, startingCurrent: null, notes: null, projectId: project.id },
  });
  const heater = await db.loadLibraryItem.create({
    data: { name: "1Φ Heater", category: "Other", power: 10, voltage: 230, phase: 1, powerFactor: 1, demandFactor: 1, quantity: 1, runningCurrent: 0, startingCurrent: null, notes: null, projectId: project.id },
  });

  // ---- Build FloorItems for a floor ----
  const mkAptItem = async (floorId: string, name: string, tplId: string, tplPhases: number) => {
    const tpl = tplId === t1.id ? t1 : tplId === t2.id ? t2 : tplId === t3.id ? t3 : t4;
    const rooms = await db.apartmentRoom.findMany({ where: { templateId: tpl.id } });
    const va = rooms.reduce((s, r: any) => s + r.connectedLoad, 0);
    const c = aptCurrent(va, tplPhases, voltageKv);
    return db.floorItem.create({
      data: {
        type: "APARTMENT",
        name,
        apartmentTemplateId: tplId,
        floorDesignId: floorId,
        calculatedConnectedLoad: c.connectedKw,
        calculatedMaxDemand: c.maxDemand,
        calculatedCurrent: c.current,
        breakerSize: `${Math.ceil(c.current)}A`,
        cableSize: "4",
        voltageDrop: 0.1,
      },
    });
  };

  // ---- Building A: Tower A ----
  const bA = await db.building.create({
    data: { name: "Tower A", floors: 2, serviceFloors: 0, apartmentsPerFloor: 4, supplyVoltage: "400V 3-Phase", earthingSystem: "TN-S", lightningProtection: false, generator: null, transformer: null, mechanicalLoads: null, projectId: project.id },
  });

  const fdA1 = await db.floorDesign.create({ data: { floorNumber: 1, hasFloorSubPanels: false, buildingId: bA.id } });
  await mkAptItem(fdA1.id, "A-101", t1.id, 3); // 3Φ
  await mkAptItem(fdA1.id, "A-102", t3.id, 1); // 1Φ
  await mkAptItem(fdA1.id, "A-103", t4.id, 1); // 1Φ

  const fdA2 = await db.floorDesign.create({ data: { floorNumber: 2, hasFloorSubPanels: true, buildingId: bA.id } });
  await mkAptItem(fdA2.id, "A-201", t2.id, 3); // 3Φ
  await mkAptItem(fdA2.id, "A-202", t3.id, 1); // 1Φ
  await mkAptItem(fdA2.id, "A-203", t3.id, 1); // 1Φ
  await mkAptItem(fdA2.id, "A-204", t4.id, 1); // 1Φ

  await db.buildingLoad.create({ data: { buildingId: bA.id, loadLibraryItemId: elevator.id, quantity: 1, cableSize: "10", installMethod: "C", cableInsulation: "XLPE" } });
  await db.buildingLoad.create({ data: { buildingId: bA.id, loadLibraryItemId: pump.id, quantity: 1, cableSize: "6", installMethod: "C", cableInsulation: "XLPE" } });

  // ---- Building B: Tower B (all 1Φ floor, to demo imbalance) ----
  const bB = await db.building.create({
    data: { name: "Tower B", floors: 1, serviceFloors: 0, apartmentsPerFloor: 4, supplyVoltage: "400V 3-Phase", earthingSystem: "TN-S", lightningProtection: false, generator: null, transformer: null, mechanicalLoads: null, projectId: project.id },
  });
  const fdB1 = await db.floorDesign.create({ data: { floorNumber: 1, hasFloorSubPanels: false, buildingId: bB.id } });
  await mkAptItem(fdB1.id, "B-101", t3.id, 1); // 1Φ
  await mkAptItem(fdB1.id, "B-102", t3.id, 1); // 1Φ
  await mkAptItem(fdB1.id, "B-103", t4.id, 1); // 1Φ
  await mkAptItem(fdB1.id, "B-104", t4.id, 1); // 1Φ
  await db.buildingLoad.create({ data: { buildingId: bB.id, loadLibraryItemId: heater.id, quantity: 1, cableSize: "6", installMethod: "C", cableInsulation: "XLPE" } });

  console.log(`\n=== Seeded project "${project.name}" (id=${project.id}) for user "demo" ===\n`);

  // ---- Load full project and verify ----
  const full = await db.project.findUnique({
    where: { id: project.id },
    include: {
      buildings: {
        include: {
          floorDesigns: { include: { items: { include: { apartmentTemplate: true, loadLibraryItem: true } } } },
          buildingLoads: { include: { loadLibraryItem: true } },
        },
      },
    },
  });

  const projTyped = full as unknown as Project;

  for (const bldg of full!.buildings) {
    const b = bldg as unknown as Building;
    console.log(`\n########## BUILDING: ${bldg.name} ##########`);

    // Building loads balance (separate board)
    const blBalance = phaseBalance(bldg.buildingLoads as any, projTyped);
    console.log(`  Building loads (${bldg.buildingLoads.length}): ` +
      `L=[${blBalance.phaseCurrent.map(fmt).join(", ")}]  N=${fmt(blBalance.neutralCurrent)}A  ` +
      `unbal=${fmt(blBalance.unbalancePct)}%  ${blBalance.imbalanced ? "IMBALANCED" : "ok"}`);

    for (const fd of bldg.floorDesigns) {
      const items = fd.items as unknown as FloorItem[];
      const bal = phaseBalance(items, projTyped);
      console.log(`\n  FLOOR ${fd.floorNumber} (sub-panel=${fd.hasFloorSubPanels}):`);
      console.log(`    L1=${fmt(bal.phaseCurrent[0])}  L2=${fmt(bal.phaseCurrent[1])}  L3=${fmt(bal.phaseCurrent[2])} A`);
      console.log(`    Neutral=${fmt(bal.neutralCurrent)}A  TotalKW=${fmt(bal.totalKw)}  MaxPhase=${fmt(bal.maxPhaseCurrent)}A`);
      console.log(`    Unbalance=${fmt(bal.unbalancePct)}% (limit ${bal.unbalanceLimitPct}%)  ${bal.imbalanced ? "IMBALANCED" : "ok"}  ${bal.internalImbalanceNotModeled ? "[3Φ-apt int.imbal not modeled]" : ""}`);
      console.log(`    Assignments:`);
      for (const a of bal.assignments) {
        const it = fd.items.find((x) => x.id === a.id)!;
        const tag = a.phaseCount === 3 ? "3Φ" : `1Φ→L${a.assignedPhase}`;
        const nm = (it as any).name;
        const I = (it as any).calculatedCurrent.toFixed(2);
        console.log(`      ${nm.padEnd(8)} ${tag.padEnd(8)} I=${I}A`);
      }
    }

    // computeFeeders (MDB schedule)
    const feeders = computeFeeders(b as any, projTyped, stubFinder());
    console.log(`\n  MDB FEEDERS (${feeders.mdbFeeders.length}):`);
    for (const f of feeders.mdbFeeders) {
      const pc = f.phaseCurrent ? `L=[${f.phaseCurrent.map(fmt).join(",")}] N=${fmt(f.neutralCurrent ?? 0)}` : "n/a";
      console.log(`    ${f.name.padEnd(14)} ${f.type.padEnd(6)} ${f.isThreePhase ? "3Φ" : "1Φ"}  ${pc}  unbal=${f.unbalancePct != null ? fmt(f.unbalancePct) + "%" : "-"}  ${f.imbalanced ? "IMB" : ""}`);
    }
  }

  console.log("\n=== Done. Open in UI: select project, view /calculator, /panel, /cable-schedule ===\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
