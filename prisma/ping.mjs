// Simple connectivity check against the Neon DB referenced by DATABASE_URL.
// Never logs the connection string itself.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  await prisma.$queryRaw`SELECT 1`;
  console.log("Database connection OK");
} catch (err) {
  console.error("Database connection FAILED:", err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
