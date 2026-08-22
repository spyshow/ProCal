import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";

/**
 * Durable key/value application settings backed by the AppSetting table.
 *
 * Serverless filesystems are ephemeral: data/company.json and public/uploads
 * survive neither deploys nor invocations there. The DB is the source of
 * truth once the AppSetting migration is applied; until then every accessor
 * falls back to the legacy file behavior so nothing crashes mid-rollout.
 * Fallbacks log one warning — if you see them in production, run
 * `npx prisma migrate deploy`.
 */

export interface CompanySettings {
  companyName: string;
  logoUrl: string;
}

export interface LogoAsset {
  mime: string;
  /** Base64 payload. */
  data: string;
  createdAt: string;
}

const COMPANY_KEY = "company";
const CONFIG_DIR = path.join(process.cwd(), "data");
const COMPANY_FILE = path.join(CONFIG_DIR, "company.json");
export const LOGO_KEY_PREFIX = "logo:";

function warnFallback(scope: string, error: unknown): void {
  console.warn(
    `[app-settings] ${scope} fell back to legacy storage (AppSetting table unavailable?). Run 'npx prisma migrate deploy'. Cause:`,
    error instanceof Error ? error.message : error
  );
}

// --- Company profile -------------------------------------------------------

export async function getCompanySettings(): Promise<CompanySettings> {
  try {
    const row = await db.appSetting.findUnique({ where: { key: COMPANY_KEY } });
    if (row) {
      const parsed = JSON.parse(row.value) as Partial<CompanySettings>;
      return { companyName: parsed.companyName ?? "", logoUrl: parsed.logoUrl ?? "" };
    }
  } catch (error) {
    warnFallback("GET company", error);
  }

  // Legacy fallback: pre-migration installs kept branding in data/company.json.
  try {
    const raw = await readFile(legacyCompanyFile(), "utf-8");
    const parsed = JSON.parse(raw) as Partial<CompanySettings>;
    return { companyName: parsed.companyName ?? "", logoUrl: parsed.logoUrl ?? "" };
  } catch {
    return { companyName: "", logoUrl: "" };
  }
}

/** Legacy path kept only for the read/write fallback above. */
function legacyCompanyFile(): string {
  return path.join(CONFIG_DIR, "company.json");
}

export async function saveCompanySettings(settings: CompanySettings): Promise<void> {
  const value = JSON.stringify(settings);
  try {
    await db.appSetting.upsert({
      where: { key: COMPANY_KEY },
      update: { value },
      create: { key: COMPANY_KEY, value },
    });
  } catch (error) {
    warnFallback("SAVE company", error);
    await mkdir(CONFIG_DIR, { recursive: true });
    await writeFile(COMPANY_FILE, value, "utf-8");
  }
}

// --- Logo assets -----------------------------------------------------------

/**
 * Stores a logo image durably and returns its serving URL (/api/assets/<key>).
 * Falls back to writing public/uploads (ephemeral on serverless) when the
 * table is missing, returning the legacy static URL.
 */
export async function saveLogoAsset(mime: string, bytes: Uint8Array): Promise<string> {
  const asset: LogoAsset = {
    mime,
    data: Buffer.from(bytes).toString("base64"),
    createdAt: new Date().toISOString(),
  };
  try {
    const key = `${LOGO_KEY_PREFIX}${randomBytes(12).toString("hex")}`;
    await db.appSetting.upsert({
      where: { key },
      update: { value: JSON.stringify(asset) },
      create: { key, value: JSON.stringify(asset) },
    });
    return `/api/assets/${encodeURIComponent(key)}`;
  } catch (error) {
    warnFallback("SAVE logo", error);
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const ext = mime === "image/svg+xml" ? "svg" : mime.split("/")[1] || "png";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
    await writeFile(path.join(dir, filename), Buffer.from(bytes));
    return `/uploads/${filename}`;
  }
}

export async function getLogoAsset(key: string): Promise<LogoAsset | null> {
  if (!key.startsWith(LOGO_KEY_PREFIX)) return null;
  try {
    const row = await db.appSetting.findUnique({ where: { key } });
    if (!row) return null;
    const parsed = JSON.parse(row.value) as LogoAsset;
    if (!parsed?.mime || !parsed?.data) return null;
    return parsed;
  } catch {
    return null;
  }
}
