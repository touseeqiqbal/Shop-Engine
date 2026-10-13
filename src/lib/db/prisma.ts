import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { dbPoolMax } from "./config";

/** Singleton Prisma client (reused across hot reloads in development). */
const g = globalThis as unknown as { __urkoPrisma?: PrismaClient };

function create() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "", max: dbPoolMax });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = g.__urkoPrisma ?? create();
if (process.env.NODE_ENV !== "production") g.__urkoPrisma = prisma;
