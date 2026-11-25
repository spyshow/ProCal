import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { getCompanySettings, getLogoAsset } from "@/lib/app-settings";
import { getCachedEquipmentCatalog } from "@/lib/catalog-cache";
import { renderReportHtml } from "@/lib/reports/render-report-html";
import type { Project, ProjectRevision } from "@/types";
import type { EquipmentItem } from "@/lib/calculations/feeders";

/**
 * Inlines relative image URLs (such as /api/assets/logo:... and /uploads/...)
 * as self-contained Base64 data URIs so that Headless Chromium running on about:blank
 * can render the logo and images without needing a network roundtrip or session cookies.
 */
export async function inlineImagesInHtml(html: string): Promise<string> {
  let result = html;

  // 1. Scan for all img src attributes
  const srcMatches = Array.from(html.matchAll(/src=["']([^"']+)["']/g));
  for (const match of srcMatches) {
    const src = match[1];
    if (src.startsWith("data:")) continue;

    try {
      if (src.includes("/api/assets/")) {
        const rawKey = src.split("/api/assets/")[1]?.split("?")[0]?.split("#")[0] || "";
        const decodedKey = decodeURIComponent(rawKey);
        const asset = await getLogoAsset(decodedKey);
        if (asset?.mime && asset?.data) {
          const dataUri = `data:${asset.mime};base64,${asset.data}`;
          result = result.replaceAll(src, dataUri);
          continue;
        }
      }

      if (src.startsWith("/uploads/") || src.includes("/uploads/")) {
        const cleanPath = src.split("?")[0]?.split("#")[0] || "";
        const relativeUpload = cleanPath.startsWith("/") ? cleanPath.slice(1) : cleanPath;
        const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
        const filePath = path.resolve(process.cwd(), "public", relativeUpload);
        if (!filePath.startsWith(uploadsRoot + path.sep)) continue;
        if (fs.existsSync(filePath)) {
          const bytes = await fs.promises.readFile(filePath);
          const ext = path.extname(filePath).toLowerCase();
          const mime =
            ext === ".svg"
              ? "image/svg+xml"
              : ext === ".jpg" || ext === ".jpeg"
                ? "image/jpeg"
                : "image/png";
          result = result.replaceAll(src, `data:${mime};base64,${bytes.toString("base64")}`);
          continue;
        }
      }
    } catch (err) {
      console.warn("inlineImagesInHtml failed for src:", src, err);
    }
  }

  // 2. Cross-reference company logo URL in database settings
  try {
    const company = await getCompanySettings();
    if (company?.logoUrl && company.logoUrl.includes("/api/assets/")) {
      const rawKey = company.logoUrl.split("/api/assets/")[1]?.split("?")[0]?.split("#")[0] || "";
      const decodedKey = decodeURIComponent(rawKey);
      const asset = await getLogoAsset(decodedKey);
      if (asset?.mime && asset?.data) {
        const dataUri = `data:${asset.mime};base64,${asset.data}`;
        result = result.replaceAll(company.logoUrl, dataUri);
        result = result.replaceAll(decodeURIComponent(company.logoUrl), dataUri);
        result = result.replaceAll(encodeURI(company.logoUrl), dataUri);
      }
    }
  } catch (err) {
    console.warn("inlineImagesInHtml company logo check error:", err);
  }

  return result;
}

/**
 * Loads full project relations, catalog equipment, breaker settings, and company branding,
 * and renders the authoritative 8-section executive engineering HTML package with inlined assets.
 */
export async function loadProjectReportHtml(
  projectId: string,
  options?: { buildingId?: string; manufacturer?: string }
): Promise<{ projectName: string; isTrial: boolean; html: string } | null> {
  const [project, company, rawRevisions, rawEquipment, breakerSettings] = await Promise.all([
    db.project.findUnique({
      where: { id: projectId },
      include: {
        buildings: {
          include: {
            floorDesigns: {
              include: {
                items: {
                  include: {
                    apartmentTemplate: {
                      include: { rooms: true },
                    },
                    loadLibraryItem: true,
                  },
                },
              },
            },
            buildingLoads: {
              include: {
                loadLibraryItem: true,
              },
            },
          },
        },
        apartmentTemplates: {
          include: { rooms: true },
        },
        loadLibraryItems: true,
      },
    }),
    getCompanySettings().catch(() => null),
    (db.projectRevision?.findMany
      ?.({
        where: { projectId },
        include: {
          createdBy: { select: { username: true } },
        },
        orderBy: { createdAt: "desc" },
      })
      .catch(() => []) ?? Promise.resolve([])),
    getCachedEquipmentCatalog().catch(() => []),
    (db.breakerSettings?.findMany
      ?.({
        orderBy: { model: "asc" },
      })
      .catch(() => []) ?? Promise.resolve([])),
  ]);

  if (!project) return null;

  const revisions = (rawRevisions ?? []).map((r) => ({
    id: r.id,
    projectId: r.projectId,
    rev: r.rev,
    description: r.description,
    createdById: r.createdById,
    createdByUsername: r.createdBy?.username,
    createdAt:
      r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt ?? ""),
  }));

  const equipment = (rawEquipment ?? []).map((e) => ({
    ...e,
    familyId: e.family?.id ?? null,
    familyName: e.family?.name ?? null,
  }));

  const rawHtml = renderReportHtml({
    project: project as unknown as Project,
    buildingId: options?.buildingId,
    manufacturer: options?.manufacturer,
    equipment: equipment as unknown as EquipmentItem[],
    breakerSettings: breakerSettings ?? [],
    revisions: revisions as unknown as ProjectRevision[],
    companyName: company?.companyName || "ProCal — Low Voltage Electrical Design , Solved",
    companyLogoUrl: company?.logoUrl || undefined,
  });

  const html = await inlineImagesInHtml(rawHtml);

  return {
    projectName: project.name,
    isTrial: Boolean((project as { isTrial?: boolean }).isTrial),
    html,
  };
}
