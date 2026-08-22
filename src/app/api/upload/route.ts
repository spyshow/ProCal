import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { saveLogoAsset } from "@/lib/app-settings";

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 2MB)" }, { status: 400 });
    }

    // Stored durably in the AppSetting table and served by /api/assets/[key].
    // Falls back to public/uploads (ephemeral on serverless) when the table
    // has not been migrated yet.
    const buffer = new Uint8Array(await file.arrayBuffer());
    const url = await saveLogoAsset(file.type, buffer);

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Upload Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
