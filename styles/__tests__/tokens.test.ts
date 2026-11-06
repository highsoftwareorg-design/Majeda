// @vitest-environment node
/**
 * משימה 2.11 — בדיקות רגרסיה לטוקני העיצוב:
 * כל טוקן צבע מוגדר גם כמשתנה CSS ב-:root וגם כרשומת @theme inline,
 * רכיבי דף הנחיתה ללא צבעים קשיחים / font-family, ו-frame-zoom מכבד prefers-reduced-motion.
 */
import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";

const root = path.resolve(__dirname, "..", "..");
const tokensCss = fs.readFileSync(path.join(root, "styles", "tokens.css"), "utf8");

const rootBlock = tokensCss.slice(tokensCss.indexOf(":root {"), tokensCss.indexOf("@theme inline {"));
const themeStart = tokensCss.indexOf("@theme inline {");
const themeBlock = tokensCss.slice(themeStart, tokensCss.indexOf("\n}", themeStart));

const NEW_COLORS = [
  "gold-pale",
  "gold-deep",
  "gold-antique",
  "champagne-muted",
  "ink-raised",
  "ink-elevated",
  "porcelain",
  "sand",
  "blush",
  "whatsapp",
  "hairline-dark",
  "hairline-light",
];

describe("tokens.css — 2.11 palette extension", () => {
  it.each(NEW_COLORS)("--color-%s is defined in :root and in @theme inline", (name) => {
    expect(rootBlock).toMatch(new RegExp(`--color-${name}:\\s*[^;]+;`));
    expect(themeBlock).toContain(`--color-${name}: var(--color-${name});`);
  });

  it("every --color-* in :root has a matching @theme entry", () => {
    const rootColors = [...rootBlock.matchAll(/--color-([a-z-]+):/g)].map((m) => m[1]);
    const missing = rootColors.filter((c) => !themeBlock.includes(`--color-${c}: var(--color-${c});`));
    expect(missing).toEqual([]);
  });

  it("does not declare any font-family", () => {
    expect(tokensCss).not.toMatch(/font-family/);
  });

  it("frame-zoom disables transition and transform under prefers-reduced-motion", () => {
    const start = tokensCss.indexOf("@utility frame-zoom");
    expect(start).toBeGreaterThan(-1);
    const block = tokensCss.slice(start);
    const rm = block.slice(block.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(rm).toMatch(/transition:\s*none/);
    expect(rm).toMatch(/transform:\s*none/);
  });
});

describe("components/landing — no hardcoded colors or fonts", () => {
  const dir = path.join(root, "components", "landing");
  const files = fs.readdirSync(dir).filter((f) => /\.(tsx?|css)$/.test(f));

  it.each(files)("%s has no #hex / rgb() / hsl() / font-family", (file) => {
    const src = fs.readFileSync(path.join(dir, file), "utf8");
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).not.toMatch(/\b(rgba?|hsla?)\(/);
    expect(src).not.toMatch(/font-family|fontFamily/);
  });
});
