import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

// GET /api/admin/stats — admin-gated snapshot + weekly users/projects trends.
// weeklySeries is exercised directly (it's exported) plus through the route.

let gateResult: unknown = null;
const groupBy = vi.fn();
const projectCount = vi.fn();
const userAggregate = vi.fn();
const catalogCount = vi.fn();
const contactCount = vi.fn();
const userFindMany = vi.fn();
const projectFindMany = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(async () => gateResult),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: { groupBy, aggregate: userAggregate, findMany: userFindMany },
    project: { count: projectCount, findMany: projectFindMany },
    equipmentCatalog: { count: catalogCount },
    contactRequest: { count: contactCount },
  },
}));

const ADMIN = { id: "a1", username: "boss", name: "Boss", role: "ADMIN", credits: 99, email: "boss@procal.io" };

const day = (offset: number) => new Date(Date.UTC(2026, 7, 20 - offset, 12));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(Date.UTC(2026, 7, 20, 12)));
  vi.resetModules();
  vi.clearAllMocks();
  gateResult = ADMIN;
  groupBy.mockResolvedValue([
    { disabled: false, role: "ADMIN", _count: { id: 1 } },
    { disabled: false, role: "ENGINEER", _count: { id: 3 } },
    { disabled: true, role: "ENGINEER", _count: { id: 1 } },
  ]);
  projectCount.mockResolvedValue(7);
  userAggregate.mockResolvedValue({ _sum: { credits: 120 } });
  catalogCount.mockResolvedValue(42);
  contactCount.mockResolvedValue(3);
  userFindMany.mockResolvedValue([{ createdAt: day(0) }, { createdAt: day(7) }]);
  projectFindMany.mockResolvedValue([{ createdAt: day(0) }, { createdAt: day(1) }, { createdAt: day(30) }]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("weeklySeries", () => {
  it("returns 12 zero-filled trailing weeks with counts at the right buckets", async () => {
    const { weeklySeries } = await import("./route");
    const series = weeklySeries([day(0), day(0), day(7), day(21)], 12);
    expect(series).toHaveLength(12);
    expect(series[11]).toEqual({ week: "2026-08-17", count: 2 });
    expect(series[10]).toEqual({ week: "2026-08-10", count: 1 });
    expect(series[8]).toEqual({ week: "2026-07-27", count: 1 });
    // Zero-filled middle weeks
    expect(series[9].count).toBe(0);
    expect(series[0].count).toBe(0);
  });

  it("anchors weeks on Mondays", async () => {
    const { weeklySeries } = await import("./route");
    const series = weeklySeries([day(5)], 12); // Saturday 2026-08-15 -> Monday 2026-08-10
    expect(series[10]).toEqual({ week: "2026-08-10", count: 1 });
  });
});

describe("GET /api/admin/stats", () => {
  it("returns 401 when unauthed", async () => {
    gateResult = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when non-admin", async () => {
    gateResult = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns the snapshot plus weekly trends", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.users).toEqual({ total: 5, enabled: 4, disabled: 1, admins: 1 });
    expect(data.projects).toBe(7);
    expect(data.creditsHeld).toBe(120);
    expect(data.catalogItems).toBe(42);
    expect(data.openLeads).toBe(3);
    expect(data.usersTrend).toHaveLength(12);
    expect(data.projectsTrend).toHaveLength(12);
    // users: today + one week ago -> two populated buckets
    expect(data.usersTrend[11].count).toBe(1);
    expect(data.usersTrend[10].count).toBe(1);
    // projects: today, yesterday, and 30 days ago
    expect(data.projectsTrend[11].count).toBe(2);
    expect(data.projectsTrend[7].count).toBe(1);
  });
});