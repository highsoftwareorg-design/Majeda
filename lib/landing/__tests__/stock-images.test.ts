// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { STOCK_IMAGES, getStockImage, getStockImagesByRole } from "@/lib/landing/stock-images";

/**
 * משימה 2.19 — תמונות סטוק באירוח עצמי: קרדיטים, משקל, alt עברי ואיסור hotlinking.
 */
const ROOT = path.resolve(__dirname, "../../..");
const STOCK_DIR = path.join(ROOT, "public", "images", "stock");
const CREDITS = path.join(STOCK_DIR, "CREDITS.md");
const IMAGE_EXT = /\.(webp|avif|jpe?g|png|gif)$/i;
const MAX_BYTES = 400 * 1024;
const HEBREW = /[֐-׿]/;

const imageFiles = fs.readdirSync(STOCK_DIR).filter((f) => IMAGE_EXT.test(f));
const creditsText = fs.readFileSync(CREDITS, "utf8");

/** שורות טבלת הקבצים ב-CREDITS.md: | קובץ | URL | צלם | רישיון | תאריך | */
const creditRows = creditsText
  .split(/\r?\n/)
  .filter((line) => /^\|\s*[\w.-]+\.(webp|avif|jpe?g|png|gif)\s*\|/i.test(line))
  .map((line) => {
    const [file, url, photographer, license, checked] = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    return { file, url, photographer, license, checked };
  });

/** קריאת ממדים מכותרת WebP (VP8 / VP8L / VP8X) בלי תלות חיצונית. */
function webpSize(buf: Buffer): { width: number; height: number } {
  expect(buf.toString("ascii", 0, 4)).toBe("RIFF");
  expect(buf.toString("ascii", 8, 12)).toBe("WEBP");
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  }
  if (chunk === "VP8 ") {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  throw new Error(`Unknown WebP chunk ${chunk}`);
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(full);
    return [full];
  });
}

describe("public/images/stock + CREDITS.md (task 2.19)", () => {
  it("has 5–8 self-hosted images", () => {
    expect(imageFiles.length).toBeGreaterThanOrEqual(5);
    expect(imageFiles.length).toBeLessThanOrEqual(8);
  });

  it("CREDITS.md carries the PLACEHOLDER header and the integrity restrictions", () => {
    expect(creditsText).toContain("PLACEHOLDER — להחליף בתמונות אמיתיות מהקליניקה לפני פרודקשן");
    expect(creditsText).toMatch(/לפני\/אחרי/);
    expect(creditsText).toMatch(/צוות/);
  });

  it("every image file has a CREDITS row with source URL, photographer, license and check date", () => {
    for (const file of imageFiles) {
      const row = creditRows.find((r) => r.file === file);
      expect(row, `missing CREDITS row for ${file}`).toBeDefined();
      expect(row!.url).toMatch(/^https:\/\/(unsplash\.com\/photos\/|www\.pexels\.com\/photo\/)\S+$/);
      expect(row!.photographer.length).toBeGreaterThan(0);
      expect(row!.license).toMatch(/^(Unsplash License|Pexels License)$/);
      expect(row!.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("every CREDITS row maps to an existing file (no orphan credits)", () => {
    expect(creditRows.length).toBeGreaterThan(0);
    for (const row of creditRows) {
      expect(imageFiles, `CREDITS lists missing file ${row.file}`).toContain(row.file);
    }
  });

  it("no image exceeds 400KB", () => {
    for (const file of imageFiles) {
      const { size } = fs.statSync(path.join(STOCK_DIR, file));
      expect(size, `${file} is ${Math.round(size / 1024)}KB`).toBeLessThanOrEqual(MAX_BYTES);
    }
  });
});

describe("lib/landing/stock-images (task 2.19)", () => {
  const entries = Object.entries(STOCK_IMAGES);

  it("every entry has a non-empty Hebrew alt and placeholder: true", () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, image] of entries) {
      expect(image.alt.trim().length, key).toBeGreaterThan(0);
      expect(image.alt, key).toMatch(HEBREW);
      expect(image.placeholder, key).toBe(true);
    }
  });

  it("every entry points at a local file whose real dimensions match width/height", () => {
    for (const [key, image] of entries) {
      expect(image.src, key).toMatch(/^\/images\/stock\/[\w.-]+\.webp$/);
      const file = path.join(ROOT, "public", image.src);
      expect(fs.existsSync(file), `${key}: ${image.src} missing`).toBe(true);
      expect(webpSize(fs.readFileSync(file)), key).toEqual({
        width: image.width,
        height: image.height,
      });
    }
  });

  it("every image file is referenced by the data source", () => {
    const srcs = entries.map(([, image]) => path.basename(image.src));
    for (const file of imageFiles) expect(srcs, file).toContain(file);
  });

  it("has a hero image and accessor helpers", () => {
    expect(getStockImagesByRole("hero")).toHaveLength(1);
    expect(getStockImage("heroSteamRoom")).toBe(STOCK_IMAGES.heroSteamRoom);
  });
});

describe("no hotlinked / external image sources (task 2.19)", () => {
  const sourceFiles = ["components", "app", "lib"]
    .flatMap((dir) => walk(path.join(ROOT, dir)))
    .filter((f) => /\.(tsx?|jsx?|mjs|cjs|css)$/.test(f))
    .filter((f) => !/__tests__|\.test\.[tj]sx?$/.test(f));

  it("no source file references stock CDNs", () => {
    for (const file of sourceFiles) {
      const text = fs.readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/images\.unsplash\.com|plus\.unsplash\.com|images\.pexels\.com/);
    }
  });

  it("no src / url() points at an external domain", () => {
    const externalSrc = /\bsrc\s*[=:]\s*\{?\s*["'`]\s*(https?:)?\/\//;
    const externalCssUrl = /url\(\s*["']?\s*(https?:)?\/\//;
    for (const file of sourceFiles) {
      const text = fs.readFileSync(file, "utf8");
      expect(text, file).not.toMatch(externalSrc);
      expect(text, file).not.toMatch(externalCssUrl);
    }
  });
});
