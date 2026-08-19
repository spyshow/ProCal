import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = {
  sessionUser: null as null | { id: string; username: string },
  userFindFirst: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => mocks.sessionUser),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findFirst: vi.fn(async (...args) => mocks.userFindFirst(...args)),
    },
  },
}));

async function lookupUser(username: string) {
  const { GET } = await import("./route");
  return GET(new Request(`http://localhost/api/users/lookup?username=${encodeURIComponent(username)}`));
}

describe("GET /api/users/lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessionUser = { id: "u-1", username: "pm_user" };
    mocks.userFindFirst.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.sessionUser = null;
    const res = await lookupUser("engineer_1");
    expect(res.status).toBe(401);
  });

  it("returns 400 when username is missing", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/users/lookup"));
    expect(res.status).toBe(400);
  });

  it("returns found: false when user is not found", async () => {
    const res = await lookupUser("non_existent");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.found).toBe(false);
  });

  it("returns user details when user is found", async () => {
    mocks.userFindFirst.mockResolvedValue({
      id: "u-2",
      username: "engineer_ahmad",
      name: "Ahmad Eng",
      email: "ahmad@company.com",
    });

    const res = await lookupUser("engineer_ahmad");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.found).toBe(true);
    expect(data.user.username).toBe("engineer_ahmad");
    expect(data.user.name).toBe("Ahmad Eng");
    expect(data.user.email).toBe("ahmad@company.com");
  });
});
