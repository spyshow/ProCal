import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isRemoteDatabaseUrl, resolveDatabaseSsl } from "./db-ssl";

describe("db-ssl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DATABASE_SSL_REJECT_UNAUTHORIZED;
    delete process.env.DATABASE_SSL_CA;
    delete process.env.DATABASE_SSL_CA_FILE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isRemoteDatabaseUrl", () => {
    it("returns false for local database without sslmode", () => {
      expect(isRemoteDatabaseUrl("postgresql://user:pass@localhost:5432/procal")).toBe(false);
      expect(isRemoteDatabaseUrl("postgresql://user:pass@127.0.0.1:5432/procal")).toBe(false);
      expect(isRemoteDatabaseUrl(undefined)).toBe(false);
    });

    it("returns true for Supabase, Neon, Render, AWS, or sslmode", () => {
      expect(
        isRemoteDatabaseUrl(
          "postgresql://postgres.xxx:pass@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
        )
      ).toBe(true);
      expect(isRemoteDatabaseUrl("postgres://user:pass@dpg-xxx.render.com/db")).toBe(true);
      expect(isRemoteDatabaseUrl("postgresql://user:pass@ep-xxx.neon.tech/neondb")).toBe(true);
      expect(isRemoteDatabaseUrl("postgresql://user:pass@localhost:5432/db?sslmode=require")).toBe(true);
    });
  });

  describe("resolveDatabaseSsl", () => {
    const supabaseUrl =
      "postgresql://postgres.xxx:pass@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true";

    it("returns undefined for local db URLs", () => {
      expect(resolveDatabaseSsl("postgresql://user:pass@localhost:5432/procal")).toBeUndefined();
    });

    it("defaults rejectUnauthorized to false for cloud DBs without CA (preventing Vercel self-signed cert error)", () => {
      const ssl = resolveDatabaseSsl(supabaseUrl);
      expect(ssl).toBeDefined();
      expect(ssl?.rejectUnauthorized).toBe(false);
      expect(ssl?.ca).toBeUndefined();
    });

    it("respects DATABASE_SSL_REJECT_UNAUTHORIZED='true'", () => {
      process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = "true";
      const ssl = resolveDatabaseSsl(supabaseUrl);
      expect(ssl?.rejectUnauthorized).toBe(true);
    });

    it("uses inline CA and defaults rejectUnauthorized to true when CA is present", () => {
      process.env.DATABASE_SSL_CA = "-----BEGIN CERTIFICATE-----\\nMIIB...\\n-----END CERTIFICATE-----";
      const ssl = resolveDatabaseSsl(supabaseUrl);
      expect(ssl?.rejectUnauthorized).toBe(true);
      expect(ssl?.ca).toContain("-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----");
    });
  });
});
