import fs from "fs";

export interface SslConfig {
  rejectUnauthorized: boolean;
  ca?: string;
}

/**
 * True when the connection string targets a remote host that needs TLS.
 * Matches managed providers (Supabase direct + pooler) and any URL that
 * explicitly opts into SSL via `sslmode=`.
 */
export function isRemoteDatabaseUrl(connectionString: string | undefined): boolean {
  if (!connectionString) return false;
  return (
    connectionString.includes("supabase.co") ||
    connectionString.includes("supabase.com") ||
    connectionString.includes("pooler.supabase.com") ||
    connectionString.includes("sslmode=")
  );
}

/**
 * Resolves TLS settings for remote database connections.
 *
 * Verification is ON by default (rejectUnauthorized: true). Managed providers
 * whose CA is not in Node's trust store — Supabase signs with its own root
 * CA — have two supported opt-outs:
 *
 * 1. DATABASE_SSL_CA_FILE / DATABASE_SSL_CA
 *    Path to (or inline PEM of) the provider's root CA. Verification STAYS ON;
 *    the provider's chain validates against the supplied CA. Preferred.
 *    Supabase: https://supabase.com/certificates — download your project's CA.
 * 2. DATABASE_SSL_REJECT_UNAUTHORIZED=false
 *    Disables verification entirely (previous behavior; MITM-exposed).
 *    Acceptable for local/dev, discouraged for production data.
 */
export function resolveDatabaseSsl(connectionString: string | undefined): SslConfig | undefined {
  if (!isRemoteDatabaseUrl(connectionString)) return undefined;

  const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";
  const caFile = process.env.DATABASE_SSL_CA_FILE;
  const caInline = process.env.DATABASE_SSL_CA;

  let ca: string | undefined;
  if (caFile) {
    ca = fs.readFileSync(caFile, "utf8");
  } else if (caInline) {
    ca = caInline.replace(/\\n/g, "\n");
  }

  return { rejectUnauthorized, ...(ca ? { ca } : {}) };
}
