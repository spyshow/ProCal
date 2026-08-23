import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signJWT, getSessionUser } from "@/lib/auth";
import { logProjectActivity } from "@/lib/audit-logger";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, password, confirmPassword, name, username } = body;

    if (!token) {
      return NextResponse.json({ error: "Invitation token is required" }, { status: 400 });
    }

    const invite = await db.projectInvite.findUnique({
      where: { token },
      include: {
        project: { select: { id: true, name: true } },
      },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invalid invitation token" }, { status: 404 });
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
        { error: "This invitation link has expired" },
        { status: 400 }
      );
    }

    const emailTrim = invite.email.toLowerCase().trim();
    const existingUser = await db.user.findFirst({
      where: { email: emailTrim },
    });

    const currentUser = await getSessionUser();

    let targetUser: { id: string; username: string; name: string; role: string };

    if (existingUser) {
      // User already exists in the system
      if (currentUser && currentUser.id === existingUser.id) {
        targetUser = existingUser;
      } else {
        // Invitee is not logged in as the existing user: verify provided password
        if (!password) {
          return NextResponse.json(
            { error: "An account with this email already exists. Please enter your password to accept." },
            { status: 401 }
          );
        }

        const validPassword = await bcrypt.compare(password, existingUser.passwordHash);
        if (!validPassword) {
          return NextResponse.json(
            { error: "Invalid password for existing account" },
            { status: 401 }
          );
        }

        targetUser = existingUser;
      }
    } else {
      // Brand new user registration
      if (!password || password.length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters" },
          { status: 400 }
        );
      }

      if (confirmPassword && password !== confirmPassword) {
        return NextResponse.json(
          { error: "Passwords do not match" },
          { status: 400 }
        );
      }

      const displayName = (name || invite.name || emailTrim.split("@")[0]).trim();
      const passwordHash = await bcrypt.hash(password, 10);

      // Determine requested username (respect provided username or invite.username)
      const rawUsername = (username || invite.username || emailTrim.split("@")[0]).trim();
      let baseUsername = rawUsername.replace(/[^a-zA-Z0-9_-]/g, "");
      if (baseUsername.length < 3) baseUsername = `user_${baseUsername}`;
      let candidateUsername = baseUsername;
      let counter = 1;

      while (await db.user.findUnique({ where: { username: candidateUsername } })) {
        candidateUsername = `${baseUsername}${counter++}`;
      }

      targetUser = await db.user.create({
        data: {
          username: candidateUsername,
          name: displayName,
          email: emailTrim,
          passwordHash,
          role: "USER",
          credits: 0,
        },
        select: { id: true, username: true, name: true, role: true },
      });
    }

    // Join user to project
    await db.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId: invite.projectId,
          userId: targetUser.id,
        },
      },
      update: {
        role: invite.role,
        permissions: invite.permissions,
      },
      create: {
        projectId: invite.projectId,
        userId: targetUser.id,
        role: invite.role,
        permissions: invite.permissions,
      },
    });

    // Mark invitation accepted
    await db.projectInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED" },
    });

    // Log audit event
    await logProjectActivity({
      projectId: invite.projectId,
      userId: targetUser.id,
      userName: targetUser.name || targetUser.username,
      userRole: invite.role,
      action: "INVITE",
      entityType: "TEAM",
      entityId: targetUser.id,
      description: `${targetUser.name || targetUser.username} joined the project as ${invite.role}`,
      details: {
        email: emailTrim,
        role: invite.role,
      },
    });

    // Issue session JWT token and cookie
    const sessionToken = await signJWT({
      userId: targetUser.id,
      username: targetUser.username,
      role: targetUser.role,
    });

    const response = NextResponse.json({
      success: true,
      projectId: invite.projectId,
      projectName: invite.project.name,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        username: targetUser.username,
      },
    });

    response.cookies.set("session_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("POST Accept Invite Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
