import { PrismaClient } from "@prisma/client";

// Standard Next.js singleton pattern to avoid exhausting DB connections
// in development due to hot-reloading.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
