import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

const connectionString =
  process.env.DATABASE_URL || "postgresql://procal:procal@localhost:5432/procal";

const isRemoteDb =
  connectionString.includes("supabase.co") ||
  connectionString.includes("pooler.supabase.com") ||
  connectionString.includes("sslmode=");

function getPool(): Pool {
  if (process.env.NODE_ENV === "production") {
    return new Pool({
      connectionString,
      ssl: isRemoteDb ? { rejectUnauthorized: false } : undefined,
    });
  }
  if (!globalForPrisma.pool) {
    globalForPrisma.pool = new Pool({
      connectionString,
      ssl: isRemoteDb ? { rejectUnauthorized: false } : undefined,
    });
  }
  return globalForPrisma.pool;
}

let prismaInstance: PrismaClient;

if (process.env.NODE_ENV === "production") {
  const pool = getPool();
  const adapter = new PrismaPg(pool);
  prismaInstance = new PrismaClient({ adapter });
} else {
  if (!globalForPrisma.prisma) {
    const pool = getPool();
    const adapter = new PrismaPg(pool);
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  prismaInstance = globalForPrisma.prisma;
}

export const db = prismaInstance;

