import { db } from "@/lib/db";
import { resolveBreakerRating } from "@/lib/sld/generator";
import { codeOf } from "@/lib/calculations/codes";
import { assertMcpProjectAccess } from "@/lib/project-auth";

export async function getProjectBOM(
  projectId: string,
  user?: { id: string; role?: string }
) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      buildings: {
        include: {
          floorDesigns: {
            include: {
              items: true,
            },
          },
          buildingLoads: {
            include: {
              loadLibraryItem: true,
            },
          },
        },
      },
    },
  });

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  if (user) {
    await assertMcpProjectAccess(project, user, { requireWrite: false });
  }

  const breakersMap = new Map<string, { category: string; rating: string; quantity: number }>();
  const cablesMap = new Map<string, { size: string; material: string; totalLengthM: number; count: number }>();

  function recordBreaker(rating: string | null | undefined, category: string) {
    if (!rating) return;
    const clean = rating.trim();
    const key = `${category}:${clean}`;
    const curr = breakersMap.get(key) || { category, rating: clean, quantity: 0 };
    curr.quantity += 1;
    breakersMap.set(key, curr);
  }

  function recordCable(size: string | null | undefined, length: number | null | undefined, material = "copper") {
    if (!size) return;
    const clean = size.trim();
    const len = length && length > 0 ? length : 20;
    const key = `${clean}:${material}`;
    const curr = cablesMap.get(key) || { size: clean, material, totalLengthM: 0, count: 0 };
    curr.totalLengthM += len;
    curr.count += 1;
    cablesMap.set(key, curr);
  }

  for (const bldg of project.buildings) {
    for (const fd of bldg.floorDesigns) {
      if (fd.riserBreakerSize) {
        recordBreaker(fd.riserBreakerSize, "MCCB");
      }
      if (fd.riserCableSize) {
        recordCable(fd.riserCableSize, fd.riserCableLength, fd.riserCableMaterial || "copper");
      }

      for (const item of fd.items) {
        recordBreaker(item.breakerSize, "MCB");
        recordCable(item.cableSize, item.cableLength, item.cableMaterial || "copper");
      }
    }

    for (const bload of bldg.buildingLoads) {
      const lib = bload.loadLibraryItem;
      const runningCurrent =
        lib?.runningCurrent ||
        (lib?.power
          ? (lib.power * bload.quantity) /
            (Math.sqrt(3) * (project.voltage / 1000) * (lib.powerFactor || 0.85))
          : 0);
      const bkrRating = resolveBreakerRating(
        null,
        runningCurrent,
        codeOf(project.calculationStandard)
      );
      recordBreaker(bkrRating, "MCCB");
      recordCable(bload.cableSize, bload.cableLength, bload.cableMaterial || "copper");
    }
  }

  return {
    projectId: project.id,
    projectName: project.name,
    switchgearTakeoff: Array.from(breakersMap.values()).sort((a, b) => a.category.localeCompare(b.category)),
    cablesTakeoff: Array.from(cablesMap.values()).sort((a, b) => a.size.localeCompare(b.size)),
  };
}

