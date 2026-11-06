/**
 * Prisma 6 configuration file.
 * Provides the datasource URL for migrate commands when using the classic engine.
 * See: https://pris.ly/d/config-datasource
 */
import { defineConfig } from "prisma/config";

export default defineConfig({
  engine: "classic",
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
