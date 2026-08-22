import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getLogoAsset } from "@/lib/app-settings";

/**
 * GET /api/assets/[key] — serves a DB-backed uploaded asset (company logos).
 * Authenticated like the rest of the app so this cannot be abused as open
 * file hosting; <img> requests carry the session cookie same-origin.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key } = await params;
  const decoded = decodeURIComponent(key);
  const asset = await getLogoAsset(decoded);
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const bytes = Buffer.from(asset.data, "base64");
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": asset.mime,
      "Cache-Control": "private, max-age=300",
      "Content-Length": String(bytes.byteLength),
    },
  });
}
