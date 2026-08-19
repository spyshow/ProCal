import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = {
  verifyProjectAccess: vi.fn(),
  reviewItemFindMany: vi.fn(),
  reviewItemCreate: vi.fn(),
  logProjectActivity: vi.fn(),
};

vi.mock("@/lib/project-auth", () => ({
  verifyProjectAccess: vi.fn(async (...args) => mocks.verifyProjectAccess(...args)),
}));

vi.mock("@/lib/audit-logger", () => ({
  logProjectActivity: vi.fn(async (...args) => mocks.logProjectActivity(...args)),
}));

vi.mock("@/lib/db", () => ({
  db: {
    projectReviewItem: {
      findMany: vi.fn(async (...args) => mocks.reviewItemFindMany(...args)),
      create: vi.fn(async (...args) => mocks.reviewItemCreate(...args)),
    },
  },
}));

async function getReviewItems(projectId: string, query = "") {
  const { GET } = await import("./route");
  const url = `http://localhost/api/projects/${projectId}/review-items${query ? `?${query}` : ""}`;
  return GET(new Request(url), {
    params: Promise.resolve({ id: projectId }),
  });
}

async function postReviewItem(projectId: string, body: unknown) {
  const { POST } = await import("./route");
  return POST(
    new Request(`http://localhost/api/projects/${projectId}/review-items`, {
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

  mocks.verifyProjectAccess.mockResolvedValue({
    project: { id: "proj-1", name: "Tower Alpha" },
    member: { role: "QA" },
    user: { id: "user-qa", name: "Sara QA", username: "sara_qa" },
  });

  mocks.reviewItemFindMany.mockResolvedValue([
    {
      id: "item-1",
      projectId: "proj-1",
      pageKey: "cableSchedule",
      severity: "CRITICAL",
      title: "Voltage drop exceeds limit",
      description: "Feeder cable F2 voltage drop is 4.8% (max 3%)",
      status: "OPEN",
      createdBy: { id: "user-qa", name: "Sara QA", username: "sara_qa" },
    },
  ]);

  mocks.reviewItemCreate.mockImplementation(async ({ data }) => ({
    id: "item-new",
    ...data,
    createdBy: { id: "user-qa", name: "Sara QA", username: "sara_qa" },
  }));
});

describe("GET & POST /api/projects/[id]/review-items", () => {
  it("GET: returns review items list with filters", async () => {
    const res = await getReviewItems("proj-1", "pageKey=cableSchedule");
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].severity).toBe("CRITICAL");
    expect(mocks.reviewItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: "proj-1",
          pageKey: "cableSchedule",
        }),
      })
    );
  });

  it("POST: successfully creates a review note and records audit activity", async () => {
    const res = await postReviewItem("proj-1", {
      pageKey: "cableSchedule",
      severity: "CRITICAL",
      title: "Feeder F3 undersized",
      description: "Upgrade breaker to 250A and cable to 70mm²",
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mocks.reviewItemCreate).toHaveBeenCalled();
    expect(mocks.logProjectActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE",
        entityType: "QA_NOTE",
      })
    );
  });

  it("POST: rejects creation when title is empty", async () => {
    const res = await postReviewItem("proj-1", {
      pageKey: "cableSchedule",
      title: "   ",
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/title is required/i);
    expect(mocks.reviewItemCreate).not.toHaveBeenCalled();
  });
});
