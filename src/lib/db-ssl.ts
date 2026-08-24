import fs from "fs";

export interface SslConfig {
  rejectUnauthorized: boolean;
  ca?: string;
}

/**
 * True when the connection string targets a remote host that needs TLS.
 * Matches managed providers (Supabase direct + pooler, Neon, Render, AWS) and any URL that
 * explicitly opts into SSL via `sslmode=` or is in a non-local production environment.
 */
export function isRemoteDatabaseUrl(connectionString: string | undefined): boolean {
  if (!connectionString) return false;
  if (connectionString.includes("localhost") || connectionString.includes("127.0.0.1")) {
    return connectionString.includes("sslmode=require") || connectionString.includes("sslmode=verify-full");
  }
  return (
    connectionString.includes("supabase.co") ||
    connectionString.includes("supabase.com") ||
    connectionString.includes("pooler.supabase.com") ||
    connectionString.includes("neon.tech") ||
    connectionString.includes("render.com") ||
    connectionString.includes("amazonaws.com") ||
    connectionString.includes("sslmode=") ||
    process.env.NODE_ENV === "production"
  );
}

/**
 * Resolves TLS settings for remote database connections.
 *
 * Cloud managed databases (like Supabase connection poolers) often use self-signed
 * or intermediate certificates that fail Node's default root CA validation unless
 * a custom CA is supplied.
 *
 * Behavior:
 * 1. If DATABASE_SSL_CA_FILE or DATABASE_SSL_CA is provided:
 *    - Uses the CA and defaults rejectUnauthorized to true (full verification).
 * 2. If no custom CA is provided:
 *    - Defaults rejectUnauthorized to false (preventing "self-signed certificate in certificate chain" errors on Vercel / serverless).
 *    - Can be strictly overridden by setting DATABASE_SSL_REJECT_UNAUTHORIZED="true".
 */
export function resolveDatabaseSsl(connectionString: string | undefined): SslConfig | undefined {
  if (!isRemoteDatabaseUrl(connectionString)) return undefined;

  const caFile = process.env.DATABASE_SSL_CA_FILE;
  const caInline = process.env.DATABASE_SSL_CA;

  let ca: string | undefined;
  if (caFile) {
    try {
      ca = fs.readFileSync(caFile, "utf8");
    } catch {
      // ignore missing caFile
    }
  } else if (caInline) {
    ca = caInline.replace(/\\n/g, "\n");
  }

  // If explicitly configured, respect DATABASE_SSL_REJECT_UNAUTHORIZED
  if (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== undefined) {
    const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true";
    return { rejectUnauthorized, ...(ca ? { ca } : {}) };
  }

  // Default: If CA is provided, verify against it; otherwise false for seamless Supabase/Vercel connectivity
  const rejectUnauthorized = Boolean(ca);

  return { rejectUnauthorized, ...(ca ? { ca } : {}) };
}
