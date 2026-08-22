/**
 * Central environment access with production fail-fast semantics.
 *
 * A missing JWT_SECRET must never silently fall back to a known constant in
 * production — anyone who reads the public repo could forge session cookies.
 * Dev keeps the historical default so local setups keep working.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET is not set. Refusing to sign or verify sessions with a default secret in production."
    );
  }
  return secret || "procal-jwt-secret-key-default-development";
}
