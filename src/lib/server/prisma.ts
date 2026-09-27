import { PrismaClient } from "@prisma/client";

/**
 * Singleton PrismaClient — Next.js dev hot-reload re-executes modules on
 * every edit, which without this caching would exhaust the database's
 * connection pool by creating a new client (and new connections) per
 * reload. Standard Next.js + Prisma pattern.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
