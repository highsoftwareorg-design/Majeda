// Bootstrap script: creates (or updates) the single demo/admin user used by
// the basic Auth.js login (task 1.11). Reads credentials from environment
// variables only — never hardcode or log the plaintext password.
//
// Required env vars (set in .env.local, never committed):
//   DEMO_USER_EMAIL     — login email for the demo user
//   DEMO_USER_PASSWORD  — plaintext password, hashed before storage
// Optional:
//   DEMO_USER_NAME      — display name (defaults to "משתמש דמו")
//
// Usage: npm run seed:user
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const email = process.env.DEMO_USER_EMAIL;
const password = process.env.DEMO_USER_PASSWORD;
const name = process.env.DEMO_USER_NAME ?? "משתמש דמו";

if (!email || !password) {
  console.error(
    "Missing DEMO_USER_EMAIL and/or DEMO_USER_PASSWORD environment variables. " +
      "Set them in .env.local before running this script."
  );
  process.exit(1);
}

try {
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: passwordHash, name },
    create: { email, password: passwordHash, name, role: "admin" },
  });

  console.log(`Demo user ready: ${user.email} (id: ${user.id}, role: ${user.role})`);
} catch (err) {
  console.error("Failed to seed demo user:", err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
