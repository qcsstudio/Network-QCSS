import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

type PrismaGlobal = {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

const prismaGlobal = globalThis as typeof globalThis & PrismaGlobal;

export function getPrismaClient() {
  if (prismaGlobal.prisma) return prismaGlobal.prisma;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required when STORE_DRIVER=postgres.");
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  prismaGlobal.pgPool = pool;
  prismaGlobal.prisma = prisma;

  return prisma;
}
