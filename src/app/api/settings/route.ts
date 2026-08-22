import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getEffectiveCountrySettings, saveCountryOverride } from "@/lib/country-overrides";
import { getCompanySettings, saveCompanySettings } from "@/lib/app-settings";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const company = await getCompanySettings();
    const countrySettings = await getEffectiveCountrySettings();
    return NextResponse.json({ countrySettings, company });
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

    // Handle country settings update — durable in AppSetting; degrades to
    // in-memory (previous behavior) when the table is not migrated yet.
    if (data.country && data.settings) {
      if (!data.settings.roomDensities || !data.settings.acSizingRules) {
        return NextResponse.json({ error: "Invalid settings structure" }, { status: 400 });
      }
      await saveCountryOverride(data.country, data.settings);
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
