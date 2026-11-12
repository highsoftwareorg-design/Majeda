import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // Exclude the bundled Playwright example spec under .claude (it imports
    // @playwright/test, which isn't a project dependency) and any e2e specs.
    exclude: [...configDefaults.exclude, "**/.claude/**", "e2e/**"],
  },
});
