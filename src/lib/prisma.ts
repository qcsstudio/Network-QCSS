import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

type PrismaGlobal = {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

const prismaGlobal = globalThis as typeof globalThis & PrismaGlobal;

function connectionConfig(connectionString: string) {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get("sslmode");
  const schema = url.searchParams.get("schema")?.trim() || undefined;

  if (sslMode && ["prefer", "require", "verify-ca"].includes(sslMode)) {
    url.searchParams.set("sslmode", "verify-full");
  }

  url.searchParams.delete("schema");
  return { connectionString: url.toString(), schema };
}

export function getPrismaClient() {
  if (prismaGlobal.prisma) return prismaGlobal.prisma;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required when STORE_DRIVER=postgres.");
  }

  const config = connectionConfig(connectionString);
  const pool = new Pool({ connectionString: config.connectionString });
  const adapter = new PrismaPg(pool, { schema: config.schema });
  const prisma = new PrismaClient({ adapter });

  prismaGlobal.pgPool = pool;
  prismaGlobal.prisma = prisma;

  return prisma;
}
