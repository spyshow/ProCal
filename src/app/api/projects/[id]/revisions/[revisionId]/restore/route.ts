import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { PROJECT_SNAPSHOT_INCLUDE, REVISION_INCLUDE } from "@/lib/revisions";
import type {
  SnapshotBuilding,
  SnapshotLoadLibraryItem,
  SnapshotProject,
  SnapshotTemplate,
} from "@/lib/revisions";
import type { ProjectRevision } from "@/types";

function toRevisionDto(
  r: {
    id: string;
    projectId: string;
    rev: string;
    description: string;
    createdById: string;
    snapshotJson: string;
    createdAt: Date;
    createdBy: { username: string };
  }
): ProjectRevision {
  return {
    id: r.id,
    projectId: r.projectId,
    rev: r.rev,
    description: r.description,
    createdById: r.createdById,
    createdByUsername: r.createdBy.username,
    snapshotJson: r.snapshotJson,
    createdAt: r.createdAt.toISOString(),
  };
}

/** Delete live records whose ids are not in `keepIds`; returns how many were removed. */
async function deleteExtras<T extends { id: string }>(
  existing: T[],
  keepIds: Set<string>
): Promise<string[]> {
  return existing.filter((e) => !keepIds.has(e.id)).map((e) => e.id);
}

/**
 * Re-applies an issued revision's snapshot to the live project. The restore is
 * a two-way sync by id: records in the snapshot are upserted (keeping their
 * original ids so references hold), and records added since issue are removed —
 * the project becomes exactly the issued state again.
 *
 * Safety: the current live state is snapshotted as a new auto-revision inside
 * the same transaction first, so every restore is itself undoable.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; revisionId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, revisionId } = await params;

    const project = await db.project.findUnique({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const revision = await db.projectRevision.findUnique({
      where: { id: revisionId },
      include: REVISION_INCLUDE,
    });
    if (!revision || revision.projectId !== id) {
      return NextResponse.json({ error: "Revision not found" }, { status: 404 });
    }

    let snapshot: SnapshotProject;
    try {
      snapshot = JSON.parse(revision.snapshotJson) as SnapshotProject;
    } catch {
      return NextResponse.json(
        { error: "Revision snapshot is corrupt and cannot be restored" },
        { status: 400 }
      );
    }
    if (
      !snapshot ||
      typeof snapshot !== "object" ||
      !Array.isArray(snapshot.buildings) ||
      !Array.isArray(snapshot.apartmentTemplates) ||
      !Array.isArray(snapshot.loadLibraryItems)
    ) {
      return NextResponse.json(
        { error: "Revision snapshot is invalid and cannot be restored" },
        { status: 400 }
      );
    }

    // Narrowed aliases — the Array.isArray checks above don't persist into the
    // transaction closure, so bind the validated arrays here.
    const buildings = snapshot.buildings as SnapshotBuilding[];
    const apartmentTemplates = snapshot.apartmentTemplates as SnapshotTemplate[];
    const loadLibraryItems = snapshot.loadLibraryItems as SnapshotLoadLibraryItem[];

    // Full project sync touches every entity in sequence; give the interactive
    // transaction headroom (default timeout is 5s, which large projects exceed).
    const result = await db.$transaction(async (tx) => {
      // --- 0. Guard catalog-family references: the snapshot may reference a
      // BreakerFamily that was deleted from the catalog since issue. Null those.
      const [acbFamily, mccbFamily, mcbFamily] = await Promise.all([
        snapshot.defaultAcbFamilyId
          ? tx.breakerFamily.findUnique({
              where: { id: snapshot.defaultAcbFamilyId },
              select: { id: true },
            })
          : null,
        snapshot.defaultMccbFamilyId
          ? tx.breakerFamily.findUnique({
              where: { id: snapshot.defaultMccbFamilyId },
              select: { id: true },
            })
          : null,
        snapshot.defaultMcbFamilyId
          ? tx.breakerFamily.findUnique({
              where: { id: snapshot.defaultMcbFamilyId },
              select: { id: true },
            })
          : null,
      ]);

      // --- 1. Project scalars
      await tx.project.update({
        where: { id },
        data: {
          name: snapshot.name,
          client: snapshot.client,
          consultant: snapshot.consultant,
          contractor: snapshot.contractor,
          location: snapshot.location,
          engineer: snapshot.engineer,
          date: snapshot.date,
          voltage: snapshot.voltage,
          frequency: snapshot.frequency,
          powerFactor: snapshot.powerFactor,
          maxDemandFactor: snapshot.maxDemandFactor,
          transformerSize: snapshot.transformerSize,
          notes: snapshot.notes,
          preferredManufacturer: snapshot.preferredManufacturer,
          defaultAcbFamilyId: acbFamily ? snapshot.defaultAcbFamilyId : null,
          defaultMccbFamilyId: mccbFamily ? snapshot.defaultMccbFamilyId : null,
          defaultMcbFamilyId: mcbFamily ? snapshot.defaultMcbFamilyId : null,
          country: snapshot.country,
          logoUrl: snapshot.logoUrl,
          calculationStandard: snapshot.calculationStandard ?? "IEC",
          maxVoltageDropLighting: snapshot.maxVoltageDropLighting,
          maxVoltageDropPower: snapshot.maxVoltageDropPower,
          ambientTemp: snapshot.ambientTemp,
          groupingCount: snapshot.groupingCount,
        },
      });

      // --- 2. Safety: snapshot the current live state so this restore is undoable.
      const currentCount = await tx.projectRevision.count({
        where: { projectId: id },
      });
      const currentState = await tx.project.findUnique({
        where: { id },
        include: PROJECT_SNAPSHOT_INCLUDE,
      });
      const autoRevision = await tx.projectRevision.create({
        data: {
          projectId: id,
          rev: `R${currentCount}`,
          description: `Auto-snapshot before restoring ${revision.rev} — ${revision.description}`,
          createdById: user.id,
          snapshotJson: JSON.stringify(currentState),
        },
        include: REVISION_INCLUDE,
      });

      // --- 3. Two-way sync by id (delete extras first so cascades clear children).
      const keepLoadIds = new Set(loadLibraryItems.map((li) => li.id));
      const existingLoads = await tx.loadLibraryItem.findMany({
        where: { projectId: id },
        select: { id: true },
      });
      const extraLoadIds = await deleteExtras(existingLoads, keepLoadIds);
      if (extraLoadIds.length > 0) {
        await tx.loadLibraryItem.deleteMany({
          where: { projectId: id, id: { in: extraLoadIds } },
        });
      }
      for (const li of loadLibraryItems) {
        await tx.loadLibraryItem.upsert({
          where: { id: li.id },
          create: {
            id: li.id,
            projectId: id,
            name: li.name,
            category: li.category,
            power: li.power,
            voltage: li.voltage,
            phase: li.phase,
            powerFactor: li.powerFactor,
            demandFactor: li.demandFactor,
            quantity: li.quantity,
            runningCurrent: li.runningCurrent,
            startingCurrent: li.startingCurrent,
            notes: li.notes,
          },
          update: {
            name: li.name,
            category: li.category,
            power: li.power,
            voltage: li.voltage,
            phase: li.phase,
            powerFactor: li.powerFactor,
            demandFactor: li.demandFactor,
            quantity: li.quantity,
            runningCurrent: li.runningCurrent,
            startingCurrent: li.startingCurrent,
            notes: li.notes,
          },
        });
      }

      const keepTemplateIds = new Set(
        apartmentTemplates.map((t) => t.id)
      );
      const existingTemplates = await tx.apartmentTemplate.findMany({
        where: { projectId: id },
        select: { id: true },
      });
      const extraTemplateIds = await deleteExtras(existingTemplates, keepTemplateIds);
      if (extraTemplateIds.length > 0) {
        await tx.apartmentTemplate.deleteMany({
          where: { projectId: id, id: { in: extraTemplateIds } },
        });
      }
      for (const tpl of apartmentTemplates) {
        await tx.apartmentTemplate.upsert({
          where: { id: tpl.id },
          create: {
            id: tpl.id,
            projectId: id,
            name: tpl.name,
            phases: tpl.phases,
          },
          update: { name: tpl.name, phases: tpl.phases },
        });
        // Rooms: sync by id within the template.
        const keepRoomIds = new Set((tpl.rooms ?? []).map((r) => r.id));
        const existingRooms = await tx.apartmentRoom.findMany({
          where: { templateId: tpl.id },
          select: { id: true },
        });
        const extraRoomIds = await deleteExtras(existingRooms, keepRoomIds);
        if (extraRoomIds.length > 0) {
          await tx.apartmentRoom.deleteMany({
            where: { templateId: tpl.id, id: { in: extraRoomIds } },
          });
        }
        for (const room of tpl.rooms ?? []) {
          await tx.apartmentRoom.upsert({
            where: { id: room.id },
            create: {
              id: room.id,
              templateId: tpl.id,
              type: room.type,
              name: room.name,
              area: room.area,
              hasAc: room.hasAc,
              acBtu: room.acBtu,
              loadDensity: room.loadDensity,
              connectedLoad: room.connectedLoad,
            },
            update: {
              type: room.type,
              name: room.name,
              area: room.area,
              hasAc: room.hasAc,
              acBtu: room.acBtu,
              loadDensity: room.loadDensity,
              connectedLoad: room.connectedLoad,
            },
          });
        }
      }

      let deletedBuildings = 0;
      let deletedFloorDesigns = 0;
      let deletedItems = 0;
      let deletedBuildingLoads = 0;

      const keepBuildingIds = new Set(buildings.map((b) => b.id));
      const existingBuildings = await tx.building.findMany({
        where: { projectId: id },
        select: { id: true },
      });
      const extraBuildingIds = await deleteExtras(existingBuildings, keepBuildingIds);
      if (extraBuildingIds.length > 0) {
        const del = await tx.building.deleteMany({
          where: { projectId: id, id: { in: extraBuildingIds } },
        });
        deletedBuildings = del.count;
      }

      for (const bldg of buildings) {
        await tx.building.upsert({
          where: { id: bldg.id },
          create: {
            id: bldg.id,
            projectId: id,
            name: bldg.name,
            floors: bldg.floors,
            serviceFloors: bldg.serviceFloors,
            apartmentsPerFloor: bldg.apartmentsPerFloor,
            mechanicalLoads: bldg.mechanicalLoads,
            generator: bldg.generator,
            transformer: bldg.transformer,
            supplyVoltage: bldg.supplyVoltage,
            earthingSystem: bldg.earthingSystem,
            lightningProtection: bldg.lightningProtection,
          },
          update: {
            name: bldg.name,
            floors: bldg.floors,
            serviceFloors: bldg.serviceFloors,
            apartmentsPerFloor: bldg.apartmentsPerFloor,
            mechanicalLoads: bldg.mechanicalLoads,
            generator: bldg.generator,
            transformer: bldg.transformer,
            supplyVoltage: bldg.supplyVoltage,
            earthingSystem: bldg.earthingSystem,
            lightningProtection: bldg.lightningProtection,
          },
        });

        // Building loads: delete extras, then upsert.
        const keepLoadIdsHere = new Set(
          (bldg.buildingLoads ?? []).map((bl) => bl.id)
        );
        const existingLoadsHere = await tx.buildingLoad.findMany({
          where: { buildingId: bldg.id },
          select: { id: true },
        });
        const extraLoadIdsHere = await deleteExtras(existingLoadsHere, keepLoadIdsHere);
        if (extraLoadIdsHere.length > 0) {
          const del = await tx.buildingLoad.deleteMany({
            where: { buildingId: bldg.id, id: { in: extraLoadIdsHere } },
          });
          deletedBuildingLoads += del.count;
        }
        for (const bl of bldg.buildingLoads ?? []) {
          await tx.buildingLoad.upsert({
            where: { id: bl.id },
            create: {
              id: bl.id,
              buildingId: bldg.id,
              loadLibraryItemId: bl.loadLibraryItemId,
              quantity: bl.quantity,
              cableSize: bl.cableSize,
              cableLength: bl.cableLength,
              installMethod: bl.installMethod,
              cableInsulation: bl.cableInsulation,
              cableMaterial: bl.cableMaterial,
              ambientTemp: bl.ambientTemp,
              groupingCount: bl.groupingCount,
              assignedPhase: bl.assignedPhase,
            },
            update: {
              loadLibraryItemId: bl.loadLibraryItemId,
              quantity: bl.quantity,
              cableSize: bl.cableSize,
              cableLength: bl.cableLength,
              installMethod: bl.installMethod,
              cableInsulation: bl.cableInsulation,
              cableMaterial: bl.cableMaterial,
              ambientTemp: bl.ambientTemp,
              groupingCount: bl.groupingCount,
              assignedPhase: bl.assignedPhase,
            },
          });
        }

        // Floor designs: delete extras (cascades items), then upsert with items.
        const keepFloorIds = new Set(
          (bldg.floorDesigns ?? []).map((fd) => fd.id)
        );
        const existingFloors = await tx.floorDesign.findMany({
          where: { buildingId: bldg.id },
          select: { id: true },
        });
        const extraFloorIds = await deleteExtras(existingFloors, keepFloorIds);
        if (extraFloorIds.length > 0) {
          const del = await tx.floorDesign.deleteMany({
            where: { buildingId: bldg.id, id: { in: extraFloorIds } },
          });
          deletedFloorDesigns += del.count;
        }

        for (const fd of bldg.floorDesigns ?? []) {
          await tx.floorDesign.upsert({
            where: { id: fd.id },
            create: {
              id: fd.id,
              buildingId: bldg.id,
              floorNumber: fd.floorNumber,
              hasFloorSubPanels: fd.hasFloorSubPanels,
              riserCableLength: fd.riserCableLength,
              riserCableSize: fd.riserCableSize,
              riserBreakerSize: fd.riserBreakerSize,
              riserInstallMethod: fd.riserInstallMethod,
              riserCableInsulation: fd.riserCableInsulation,
              riserCableMaterial: fd.riserCableMaterial,
              riserAmbientTemp: fd.riserAmbientTemp,
              riserGroupingCount: fd.riserGroupingCount,
            },
            update: {
              floorNumber: fd.floorNumber,
              hasFloorSubPanels: fd.hasFloorSubPanels,
              riserCableLength: fd.riserCableLength,
              riserCableSize: fd.riserCableSize,
              riserBreakerSize: fd.riserBreakerSize,
              riserInstallMethod: fd.riserInstallMethod,
              riserCableInsulation: fd.riserCableInsulation,
              riserCableMaterial: fd.riserCableMaterial,
              riserAmbientTemp: fd.riserAmbientTemp,
              riserGroupingCount: fd.riserGroupingCount,
            },
          });

          // Items: delete extras, then upsert.
          const keepItemIds = new Set((fd.items ?? []).map((it) => it.id));
          const existingItems = await tx.floorItem.findMany({
            where: { floorDesignId: fd.id },
            select: { id: true },
          });
          const extraItemIds = await deleteExtras(existingItems, keepItemIds);
          if (extraItemIds.length > 0) {
            const del = await tx.floorItem.deleteMany({
              where: { floorDesignId: fd.id, id: { in: extraItemIds } },
            });
            deletedItems += del.count;
          }
          for (const item of fd.items ?? []) {
            await tx.floorItem.upsert({
              where: { id: item.id },
              create: {
                id: item.id,
                floorDesignId: fd.id,
                type: item.type,
                name: item.name,
                apartmentTemplateId: item.apartmentTemplateId,
                loadLibraryItemId: item.loadLibraryItemId,
                calculatedConnectedLoad: item.calculatedConnectedLoad,
                calculatedMaxDemand: item.calculatedMaxDemand,
                calculatedCurrent: item.calculatedCurrent,
                breakerSize: item.breakerSize,
                cableSize: item.cableSize,
                cableLength: item.cableLength,
                voltageDrop: item.voltageDrop,
                installMethod: item.installMethod,
                cableInsulation: item.cableInsulation,
                cableMaterial: item.cableMaterial,
                ambientTemp: item.ambientTemp,
                groupingCount: item.groupingCount,
                assignedPhase: item.assignedPhase,
              },
              update: {
                type: item.type,
                name: item.name,
                apartmentTemplateId: item.apartmentTemplateId,
                loadLibraryItemId: item.loadLibraryItemId,
                calculatedConnectedLoad: item.calculatedConnectedLoad,
                calculatedMaxDemand: item.calculatedMaxDemand,
                calculatedCurrent: item.calculatedCurrent,
                breakerSize: item.breakerSize,
                cableSize: item.cableSize,
                cableLength: item.cableLength,
                voltageDrop: item.voltageDrop,
                installMethod: item.installMethod,
                cableInsulation: item.cableInsulation,
                cableMaterial: item.cableMaterial,
                ambientTemp: item.ambientTemp,
                groupingCount: item.groupingCount,
                assignedPhase: item.assignedPhase,
              },
            });
          }
        }
      }

      return {
        autoRevision,
        counts: {
          buildingsUpserted: buildings.length,
          buildingsDeleted: deletedBuildings,
          floorDesignsDeleted: deletedFloorDesigns,
          itemsDeleted: deletedItems,
          buildingLoadsDeleted: deletedBuildingLoads,
          templatesUpserted: apartmentTemplates.length,
          loadLibraryItemsUpserted: loadLibraryItems.length,
        },
      };
    }, { timeout: 60000, maxWait: 15000 });

    return NextResponse.json({
      revision: toRevisionDto(result.autoRevision),
      counts: result.counts,
    });
  } catch (error) {
    console.error("POST Restore Revision Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
