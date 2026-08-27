import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { MAX_PROJECT_MEMBERS, parseMemberPermissions, type ProjectRole } from "@/lib/project-permissions";
import { sendProjectInviteNotification } from "@/lib/notify";
import { logProjectActivity } from "@/lib/audit-logger";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const auth = await verifyProjectAccess(projectId);
    if (auth instanceof NextResponse) return auth;

    const [members, invites] = await Promise.all([
      db.projectMember.findMany({
        where: { projectId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      db.projectInvite.findMany({
        where: { projectId, status: "PENDING" },
        include: {
          invitedBy: {
            select: { name: true, username: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const formattedMembers = members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      username: m.user.username,
      role: m.role,
      permissions: parseMemberPermissions(m.permissions, m.role),
      createdAt: m.createdAt,
      isOwner: auth.project.userId === m.userId,
    }));

    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");

    const formattedInvites = invites.map((inv) => ({
      id: inv.id,
      email: inv.email,
      name: inv.name,
      username: inv.username,
      role: inv.role,
      permissions: parseMemberPermissions(inv.permissions, inv.role),
      status: inv.status,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
      invitedBy: inv.invitedBy.name || inv.invitedBy.username,
      acceptUrl: `${protocol}://${host}/invite/accept?token=${inv.token}`,
    }));

    return NextResponse.json({
      members: formattedMembers,
      invites: formattedInvites,
      totalSeats: MAX_PROJECT_MEMBERS,
      usedSeats: formattedMembers.length + formattedInvites.length,
    });
  } catch (error) {
    console.error("GET Project Members Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const auth = await verifyProjectAccess(projectId, { requiredRole: "PROJECT_MANAGER" });
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { email, name, username, role, permissions } = body;

    let trimmedEmail = (email || "").trim().toLowerCase();
    let trimmedName = (name || "").trim();
    const trimmedUsername = (username || "").trim();

    let matchedUser = null;
    if (trimmedUsername) {
      matchedUser = await db.user.findFirst({
        where: { username: { equals: trimmedUsername, mode: "insensitive" }, disabled: false },
        select: { id: true, username: true, name: true, email: true },
      });

      if (matchedUser) {
        if (!trimmedName && matchedUser.name) trimmedName = matchedUser.name;
        if (!trimmedEmail && matchedUser.email) trimmedEmail = matchedUser.email.toLowerCase().trim();
      } else if (!trimmedEmail) {
        return NextResponse.json(
          { error: `User "${trimmedUsername}" was not found. Please check the username or enter an email address.` },
          { status: 404 }
        );
      }
    }

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
    }

    if (!trimmedName) {
      trimmedName = matchedUser?.name || trimmedUsername || trimmedEmail.split("@")[0];
    }

    const assignedRole: ProjectRole =
      role === "PROJECT_MANAGER" || role === "QA" ? role : "ENGINEER";

    // 1. Check current member count + pending invites
    const [memberCount, pendingInviteCount] = await Promise.all([
      db.projectMember.count({ where: { projectId } }),
      db.projectInvite.count({ where: { projectId, status: "PENDING" } }),
    ]);

    if (memberCount + pendingInviteCount >= MAX_PROJECT_MEMBERS) {
      return NextResponse.json(
        {
          error: `Project has reached the maximum seat limit (${MAX_PROJECT_MEMBERS} members). Upgrade or remove an existing member to invite more.`,
        },
        { status: 400 }
      );
    }

    // 2. Check if user is project owner or already an active member of the project
    const existingUser = matchedUser || await db.user.findFirst({
      where: { email: trimmedEmail },
      select: { id: true, username: true, name: true },
    });

    if (existingUser) {
      if (auth.project.userId === existingUser.id) {
        return NextResponse.json(
          { error: "This user is already the owner of this project" },
          { status: 400 }
        );
      }

      const existingMember = await db.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: existingUser.id,
          },
        },
      });

      if (existingMember) {
        return NextResponse.json(
          { error: `"${existingUser.name || existingUser.username}" is already a member of this project` },
          { status: 400 }
        );
      }
    }

    // 3. Check if an active invite already exists for this email
    const existingInvite = await db.projectInvite.findFirst({
      where: {
        projectId,
        email: trimmedEmail,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: "An active invitation has already been sent to this email" },
        { status: 400 }
      );
    }

    // Email-sending gate: 10 invites/hour per inviter. Keyed by user id —
    // strictly more reliable than spoofable X-Forwarded-IP for an
    // authenticated action. Sits after the validation checks so legitimate
    // 4xx responses don't burn quota, and before create/send/log so a
    // rejected request leaves no invite row, email, or audit entry.
    const rl = rateLimit(`invite:${auth.user.id}`, 10, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many invitations sent. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    // 4. Generate crypto token and create invite
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const permissionsString = permissions ? JSON.stringify(permissions) : null;

    const invite = await db.projectInvite.create({
      data: {
        projectId,
        email: trimmedEmail,
        name: trimmedName,
        username: trimmedUsername || null,
        role: assignedRole,
        permissions: permissionsString,
        token,
        invitedById: auth.user.id,
        expiresAt,
        status: "PENDING",
      },
    });

    // 5. Send invitation email
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const acceptUrl = `${protocol}://${host}/invite/accept?token=${token}`;

    const sendRes = await sendProjectInviteNotification({
      toEmail: trimmedEmail,
      inviteeName: trimmedName,
      inviterName: auth.user.name || auth.user.username,
      projectName: (auth.project.name as string) || "ProCal Project",
      role: assignedRole,
      acceptUrl,
    });

    // 6. Log audit event
    await logProjectActivity({
      projectId,
      userId: auth.user.id,
      userName: auth.user.name || auth.user.username,
      userRole: auth.member.role,
      action: "INVITE",
      entityType: "TEAM",
      entityId: invite.id,
      description: `Sent invitation to ${trimmedName}${trimmedUsername ? ` (@${trimmedUsername})` : ""} (${trimmedEmail}) as ${assignedRole}`,
      details: {
        email: trimmedEmail,
        name: trimmedName,
        username: trimmedUsername || null,
        role: assignedRole,
        emailDelivered: sendRes.ok,
      },
    });

    return NextResponse.json({
      success: true,
      invite: {
        id: invite.id,
        email: invite.email,
        name: invite.name,
        username: invite.username,
        role: invite.role,
        status: invite.status,
        expiresAt: invite.expiresAt,
        acceptUrl,
      },
      emailDelivered: sendRes.ok,
      emailError: !sendRes.ok ? sendRes.error : undefined,
    });
  } catch (error) {
    console.error("POST Project Member Invite Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
