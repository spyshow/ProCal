import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mocks = {
  user: null as null | { id: string; username: string; name: string; role: string },
  verifyProjectAccess: vi.fn(),
  userFindFirst: vi.fn(),
  memberFindMany: vi.fn(),
  memberFindUnique: vi.fn(),
  memberFindFirst: vi.fn(),
  memberCount: vi.fn(),
  inviteFindFirst: vi.fn(),
  inviteFindMany: vi.fn(),
  inviteCount: vi.fn(),
  inviteCreate: vi.fn(),
  logProjectActivity: vi.fn(),
  sendProjectInviteNotification: vi.fn(),
};

vi.mock("@/lib/project-auth", () => ({
  verifyProjectAccess: vi.fn(async (...args) => mocks.verifyProjectAccess(...args)),
}));

vi.mock("@/lib/audit-logger", () => ({
  logProjectActivity: vi.fn(async (...args) => mocks.logProjectActivity(...args)),
}));

vi.mock("@/lib/notify", () => ({
  sendProjectInviteNotification: vi.fn(async (...args) => mocks.sendProjectInviteNotification(...args)),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findFirst: vi.fn(async (...args) => mocks.userFindFirst(...args)),
    },
    projectMember: {
      findMany: vi.fn(async (...args) => mocks.memberFindMany(...args)),
      findUnique: vi.fn(async (...args) => mocks.memberFindUnique(...args)),
      count: vi.fn(async (...args) => mocks.memberCount(...args)),
    },
    projectInvite: {
      findFirst: vi.fn(async (...args) => mocks.inviteFindFirst(...args)),
      findMany: vi.fn(async (...args) => mocks.inviteFindMany(...args)),
      count: vi.fn(async (...args) => mocks.inviteCount(...args)),
      create: vi.fn(async (...args) => mocks.inviteCreate(...args)),
    },
  },
}));

async function getMembers(projectId: string) {
  const { GET } = await import("./route");
  return GET(new Request(`http://localhost/api/projects/${projectId}/members`), {
    params: Promise.resolve({ id: projectId }),
  });
}

async function postInvite(projectId: string, body: unknown) {
  const { POST } = await import("./route");
  return POST(
    new Request(`http://localhost/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    {
      params: Promise.resolve({ id: projectId }),
    }
  );
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();

  mocks.user = {
    id: "user-1",
    username: "pm_john",
    name: "John PM",
    role: "USER",
  };

  mocks.verifyProjectAccess.mockResolvedValue({
    project: { id: "proj-1", name: "Tower Alpha", userId: "user-1" },
    member: { role: "PROJECT_MANAGER", permissions: {} },
    user: mocks.user,
  });

  mocks.userFindFirst.mockResolvedValue(null);
  mocks.memberFindFirst = vi.fn().mockResolvedValue(null);
  mocks.memberFindUnique.mockResolvedValue(null);
  mocks.inviteFindFirst.mockResolvedValue(null);

  mocks.memberFindMany.mockResolvedValue([
    {
      id: "mem-1",
      userId: "user-1",
      role: "PROJECT_MANAGER",
      permissions: null,
      createdAt: new Date(),
      user: { id: "user-1", name: "John PM", email: "pm@example.com", username: "pm_john" },
    },
  ]);

  mocks.inviteFindMany.mockResolvedValue([]);
  mocks.memberCount.mockResolvedValue(1);
  mocks.inviteCount.mockResolvedValue(0);
  mocks.inviteCreate.mockImplementation(async ({ data }) => ({
    id: "inv-1",
    ...data,
    token: "hashed-token",
  }));
  mocks.sendProjectInviteNotification.mockResolvedValue({ ok: true, messageId: "msg-123" });
});

describe("GET /api/projects/[id]/members", () => {
  it("returns members, pending invites, and seat counts", async () => {
    const res = await getMembers("proj-1");
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.members).toHaveLength(1);
    expect(data.members[0].role).toBe("PROJECT_MANAGER");
    expect(data.usedSeats).toBe(1);
    expect(data.totalSeats).toBe(5);
  });
});

describe("POST /api/projects/[id]/members (Invite Member)", () => {
  it("successfully creates and emails an invite when seats are available", async () => {
    const res = await postInvite("proj-1", {
      name: "Alice Engineer",
      email: "alice@company.com",
      role: "ENGINEER",
      permissions: { cableSchedule: "EDIT", breakerSchedule: "VIEW" },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.emailDelivered).toBe(true);
    expect(mocks.inviteCreate).toHaveBeenCalled();
    expect(mocks.sendProjectInviteNotification).toHaveBeenCalled();
    expect(mocks.logProjectActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "INVITE",
        entityType: "TEAM",
      })
    );
  });

  it("rejects invitation when 5-seat limit is reached", async () => {
    mocks.memberCount.mockResolvedValue(3);
    mocks.inviteCount.mockResolvedValue(2); // 3 + 2 = 5 seats used

    const res = await postInvite("proj-1", {
      name: "Bob Candidate",
      email: "bob@company.com",
      role: "QA",
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/maximum seat limit/i);
    expect(mocks.inviteCreate).not.toHaveBeenCalled();
  });

  it("rejects invitation when invalid email is provided", async () => {
    const res = await postInvite("proj-1", {
      name: "Bob Candidate",
      email: "not-an-email",
      role: "ENGINEER",
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/valid email/i);
  });
});
