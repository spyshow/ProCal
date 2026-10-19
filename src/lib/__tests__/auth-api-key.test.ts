import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateApiKey,
  hashApiKey,
  signReportDownloadToken,
  verifyReportDownloadToken,
  getSessionUser,
  getUserByApiKey,
} from "../auth";

const { mockDb, mockCookiesStore, mockHeadersStore } = vi.hoisted(() => {
  return {
    mockDb: {
      user: {
        findUnique: vi.fn(),
      },
      apiKey: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
    },
    mockCookiesStore: new Map<string, string>(),
    mockHeadersStore: new Map<string, string>(),
  };
});

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const val = mockCookiesStore.get(name);
      return val ? { value: val } : undefined;
    },
  })),
  headers: vi.fn(async () => ({
    get: (name: string) => mockHeadersStore.get(name.toLowerCase()) || null,
  })),
}));

describe("API Key generation & hashing", () => {
  it("generates a procal_sk_ prefixed key with consistent SHA-256 hash and truncated prefix", () => {
    const { rawKey, keyPrefix, keyHash } = generateApiKey();

    expect(rawKey.startsWith("procal_sk_")).toBe(true);
    expect(rawKey.length).toBe("procal_sk_".length + 48); // 24 bytes hex = 48 chars
    expect(keyPrefix).toBe(rawKey.slice(0, 16) + "...");
    expect(keyHash).toBe(hashApiKey(rawKey));
    expect(keyHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("Report Download Token (1-hour scoped JWT)", () => {
  it("signs and successfully verifies valid token for matching projectId", async () => {
    const token = await signReportDownloadToken("proj-123", "user-456");
    expect(typeof token).toBe("string");

    const payload = await verifyReportDownloadToken(token, "proj-123");
    expect(payload).not.toBeNull();
    expect(payload?.projectId).toBe("proj-123");
    expect(payload?.userId).toBe("user-456");
    expect(payload?.purpose).toBe("report-pdf");
  });

  it("rejects token when projectId does not match", async () => {
    const token = await signReportDownloadToken("proj-123", "user-456");
    const payload = await verifyReportDownloadToken(token, "proj-999");
    expect(payload).toBeNull();
  });

  it("rejects invalid/tampered token", async () => {
    const payload = await verifyReportDownloadToken("invalid.jwt.token", "proj-123");
    expect(payload).toBeNull();
  });
});

describe("getSessionUser() with API Key and Cookie Auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookiesStore.clear();
    mockHeadersStore.clear();
  });

  it("authenticates via Bearer procal_sk_... header when cookie is absent", async () => {
    const { rawKey, keyHash } = generateApiKey();
    mockHeadersStore.set("authorization", `Bearer ${rawKey}`);

    const mockUser = {
      id: "u-1",
      username: "engineer",
      name: "Lead Engineer",
      role: "ENGINEER",
      credits: 10,
      email: "eng@example.com",
      theme: "dark",
      disabled: false,
    };

    mockDb.apiKey.findUnique.mockResolvedValueOnce({
      id: "key-1",
      keyHash,
      revokedAt: null,
      lastUsedAt: null,
      user: mockUser,
    });

    const user = await getSessionUser();
    expect(user).toEqual(mockUser);
    expect(mockDb.apiKey.findUnique).toHaveBeenCalledWith({
      where: { keyHash },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            role: true,
            credits: true,
            email: true,
            theme: true,
            disabled: true,
          },
        },
      },
    });
  });

  it("authenticates via x-api-key header when Bearer header is absent", async () => {
    const { rawKey, keyHash } = generateApiKey();
    mockHeadersStore.set("x-api-key", rawKey);

    const mockUser = {
      id: "u-2",
      username: "bot",
      name: "AI Agent",
      role: "USER",
      credits: 5,
      email: "bot@example.com",
      theme: "light",
      disabled: false,
    };

    mockDb.apiKey.findUnique.mockResolvedValueOnce({
      id: "key-2",
      keyHash,
      revokedAt: null,
      lastUsedAt: null,
      user: mockUser,
    });

    const user = await getSessionUser();
    expect(user).toEqual(mockUser);
  });

  it("rejects revoked API key", async () => {
    const { rawKey, keyHash } = generateApiKey();
    mockHeadersStore.set("authorization", `Bearer ${rawKey}`);

    mockDb.apiKey.findUnique.mockResolvedValueOnce({
      id: "key-3",
      keyHash,
      revokedAt: new Date(),
      lastUsedAt: null,
      user: { id: "u-3", disabled: false },
    });

    const user = await getSessionUser();
    expect(user).toBeNull();
  });

  it("rejects API key belonging to a disabled user", async () => {
    const { rawKey, keyHash } = generateApiKey();
    mockHeadersStore.set("authorization", `Bearer ${rawKey}`);

    mockDb.apiKey.findUnique.mockResolvedValueOnce({
      id: "key-4",
      keyHash,
      revokedAt: null,
      lastUsedAt: null,
      user: { id: "u-4", disabled: true },
    });

    const user = await getSessionUser();
    expect(user).toBeNull();
  });
});

describe("getUserByApiKey() direct resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null immediately for invalid or missing key prefix", async () => {
    expect(await getUserByApiKey("")).toBeNull();
    expect(await getUserByApiKey("sk_invalid_prefix_12345")).toBeNull();
    expect(mockDb.apiKey.findUnique).not.toHaveBeenCalled();
  });

  it("resolves user and returns user object for valid active key", async () => {
    const { rawKey, keyHash } = generateApiKey();
    const activeUser = {
      id: "u-direct-1",
      username: "gemini_user",
      name: "Gemini User",
      role: "USER",
      credits: 50,
      email: "gemini@example.com",
      theme: "dark",
      disabled: false,
    };

    mockDb.apiKey.findUnique.mockResolvedValueOnce({
      id: "key-direct-1",
      keyHash,
      revokedAt: null,
      lastUsedAt: null,
      user: activeUser,
    });

    const user = await getUserByApiKey(rawKey);
    expect(user).toEqual(activeUser);
  });

  it("returns null for revoked key or disabled user", async () => {
    const { rawKey, keyHash } = generateApiKey();

    mockDb.apiKey.findUnique.mockResolvedValueOnce({
      id: "key-revoked",
      keyHash,
      revokedAt: new Date(),
      lastUsedAt: null,
      user: { id: "u-revoked", disabled: false },
    });

    expect(await getUserByApiKey(rawKey)).toBeNull();

    mockDb.apiKey.findUnique.mockResolvedValueOnce({
      id: "key-disabled",
      keyHash,
      revokedAt: null,
      lastUsedAt: null,
      user: { id: "u-disabled", disabled: true },
    });

    expect(await getUserByApiKey(rawKey)).toBeNull();
  });
});
