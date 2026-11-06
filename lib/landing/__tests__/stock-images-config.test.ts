// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * משימה 2.19 (tester) — השלמת פער: הבדיקה הקיימת סורקת רק components/app/lib.
 * כאן מוודאים שגם next.config.ts ו-styles/ לא פותחים דומיין תמונות חיצוני.
 */
const ROOT = path.resolve(__dirname, "../../..");

describe("no external image config (task 2.19)", () => {
  it("next.config.ts has no remotePatterns / images.domains and no stock CDN", () => {
    const text = fs.readFileSync(path.join(ROOT, "next.config.ts"), "utf8");
    expect(text).not.toMatch(/remotePatterns/);
    expect(text).not.toMatch(/\bdomains\s*:/);
    expect(text).not.toMatch(/unsplash|pexels/i);
  });

  it("styles/*.css have no external url() and no stock CDN", () => {
    const dir = path.join(ROOT, "styles");
    const cssFiles = fs.readdirSync(dir).filter((f) => f.endsWith(".css"));
    expect(cssFiles.length).toBeGreaterThan(0);
    for (const f of cssFiles) {
      const text = fs.readFileSync(path.join(dir, f), "utf8");
      expect(text, f).not.toMatch(/url\(\s*["']?\s*(https?:)?\/\//);
      expect(text, f).not.toMatch(/images\.unsplash\.com|images\.pexels\.com/);
    }
  });
});
