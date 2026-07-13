import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { COUNTRY_DEFAULTS, CountryConfig } from "@/lib/country-defaults";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

// In-memory storage for country settings
const globalSettings: Record<string, CountryConfig> = { ...COUNTRY_DEFAULTS };

// File-based storage for company settings (persists across restarts)
const CONFIG_DIR = path.join(process.cwd(), "data");
const COMPANY_FILE = path.join(CONFIG_DIR, "company.json");

interface CompanySettings {
  companyName: string;
  logoUrl: string;
}

async function loadCompany(): Promise<CompanySettings> {
  try {
    const data = await readFile(COMPANY_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return { companyName: "", logoUrl: "" };
  }
}

async function saveCompany(data: CompanySettings) {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(COMPANY_FILE, JSON.stringify(data, null, 2));
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const company = await loadCompany();
    return NextResponse.json({ countrySettings: globalSettings, company });
  } catch (error) {
    console.error("GET Settings Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();

    // Handle country settings update
    if (data.country && data.settings) {
      if (!data.settings.roomDensities || !data.settings.acSizingRules) {
        return NextResponse.json({ error: "Invalid settings structure" }, { status: 400 });
      }
      globalSettings[data.country] = data.settings;
    }

    // Handle company settings update
    if (data.company) {
      await saveCompany({
        companyName: data.company.companyName ?? "",
        logoUrl: data.company.logoUrl ?? "",
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST Settings Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
