import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { resolveDatabaseSsl } from "./db-ssl";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

const connectionString =
  process.env.DATABASE_URL || "postgresql://procal:procal@localhost:5432/procal";

function getPool(): Pool {
  const poolConfig = {
    connectionString,
    ssl: resolveDatabaseSsl(connectionString),
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };

  if (process.env.NODE_ENV === "production") {
    return new Pool(poolConfig);
  }
  if (!globalForPrisma.pool) {
    globalForPrisma.pool = new Pool(poolConfig);
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

