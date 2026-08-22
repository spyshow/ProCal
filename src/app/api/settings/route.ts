import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { COUNTRY_DEFAULTS, CountryConfig } from "@/lib/country-defaults";
import { getCompanySettings, saveCompanySettings } from "@/lib/app-settings";

// In-memory storage for country settings
const globalSettings: Record<string, CountryConfig> = { ...COUNTRY_DEFAULTS };

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const company = await getCompanySettings();
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

    // Handle company settings update — durable in AppSetting; legacy file
    // fallback keeps pre-migration installs working.
    if (data.company) {
      await saveCompanySettings({
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
