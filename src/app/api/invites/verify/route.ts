import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Invitation token is required" }, { status: 400 });
    }

    const invite = await db.projectInvite.findUnique({
      where: { token },
      include: {
        project: { select: { id: true, name: true } },
        invitedBy: { select: { name: true, username: true } },
      },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invalid invitation link" }, { status: 404 });
    }

    if (invite.status === "ACCEPTED") {
      return NextResponse.json(
        { error: "This invitation has already been accepted" },
        { status: 400 }
      );
    }

    if (invite.status === "REVOKED") {
      return NextResponse.json(
        { error: "This invitation has been revoked by the project manager" },
        { status: 400 }
      );
    }

    if (new Date() > invite.expiresAt) {
      return NextResponse.json(
        { error: "This invitation link has expired (links are valid for 7 days)" },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findFirst({
      where: { email: invite.email },
      select: { id: true, name: true, username: true },
    });

    const currentUser = await getSessionUser();

    return NextResponse.json({
      valid: true,
      invite: {
        id: invite.id,
        email: invite.email,
        name: invite.name,
        username: invite.username || existingUser?.username || invite.email.split("@")[0],
        role: invite.role,
        projectId: invite.project.id,
        projectName: invite.project.name,
        invitedBy: invite.invitedBy.name || invite.invitedBy.username,
        isExistingUser: !!existingUser,
        isLoggedIn: !!currentUser,
        isLoggedInAsInvitee: currentUser?.email?.toLowerCase() === invite.email.toLowerCase(),
      },
    });
  } catch (error) {
    console.error("GET Verify Invite Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
