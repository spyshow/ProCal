import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { sendProjectInviteNotification } from "@/lib/notify";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; inviteId: string }> }
) {
  try {
    const { id: projectId, inviteId } = await params;
    const auth = await verifyProjectAccess(projectId, { requiredRole: "PROJECT_MANAGER" });
    if (auth instanceof NextResponse) return auth;

    const invite = await db.projectInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite || invite.projectId !== projectId || invite.status !== "PENDING") {
      return NextResponse.json({ error: "Pending invitation not found" }, { status: 404 });
    }

    // Refresh expiration to 7 days from now
    const nextExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.projectInvite.update({
      where: { id: inviteId },
      data: { expiresAt: nextExpires },
    });

    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const acceptUrl = `${protocol}://${host}/invite/accept?token=${invite.token}`;

    const sendRes = await sendProjectInviteNotification({
      toEmail: invite.email,
      inviteeName: invite.name,
      inviterName: auth.user.name || auth.user.username,
      projectName: (auth.project.name as string) || "ProCal Project",
      role: invite.role,
      acceptUrl,
    });

    return NextResponse.json({
      success: true,
      emailDelivered: sendRes.ok,
      acceptUrl,
    });
  } catch (error) {
    console.error("POST Resend Invite Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; inviteId: string }> }
) {
  try {
    const { id: projectId, inviteId } = await params;
    const auth = await verifyProjectAccess(projectId, { requiredRole: "PROJECT_MANAGER" });
    if (auth instanceof NextResponse) return auth;

    const invite = await db.projectInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite || invite.projectId !== projectId) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    await db.projectInvite.update({
      where: { id: inviteId },
      data: { status: "REVOKED" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Revoke Invite Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
