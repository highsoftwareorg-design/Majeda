// @vitest-environment node
/**
 * משימה 2.20 (tester) — scrim של ה-Hero: טוקנים בלבד, ניגודיות WCAG במקרה הגרוע
 * (תמונה לבנה לגמרי מתחת לרצפת ה-ink השקופה), והסתרת התמונה/scrim בניגודיות גבוהה
 * וב-forced-colors. הערכים נקראים מ-styles/tokens.css — לא מועתקים לבדיקה.
 */
import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { compile } from "@tailwindcss/node";

const ROOT = path.resolve(__dirname, "..", "..");
const css = fs.readFileSync(path.join(ROOT, "styles", "tokens.css"), "utf8");
const heroSrc = fs.readFileSync(path.join(ROOT, "components", "landing", "Hero.tsx"), "utf8");

function hexToken(name: string): [number, number, number] {
  const m = css.match(new RegExp(`--color-${name}:\\s*#([0-9A-Fa-f]{6})\\s*;`));
  expect(m, `token --color-${name}`).not.toBeNull();
  const h = m![1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]: number[]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a: number[], b: number[]) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const over = (fg: number[], alpha: number, bg: number[]) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));

function softScrimAlpha(): number {
  const m = css.match(/--scrim-ink-soft:\s*color-mix\(in oklab,\s*var\(--color-ink\)\s*(\d+(?:\.\d+)?)%,\s*transparent\)/);
  expect(m, "--scrim-ink-soft must be color-mix of --color-ink with transparent").not.toBeNull();
  return Number(m![1]) / 100;
}

describe("Hero scrim tokens (2.20)", () => {
  it("defines soft/strong scrims from --color-ink only (no new hex) and a utility using the gradient token", () => {
    expect(css).toMatch(/--scrim-ink-strong:\s*color-mix\(in oklab,\s*var\(--color-ink\)\s*\d+%,\s*transparent\)/);
    const grad = css.slice(css.indexOf("--gradient-scrim-hero:"), css.indexOf(";", css.indexOf("--gradient-scrim-hero:")));
    expect(grad).not.toMatch(/#[0-9a-f]{3,8}\b|rgb|hsl|oklch/i);
    // the uniform soft floor is the last (bottom-most) layer, under the whole image
    expect(grad).toMatch(/linear-gradient\(var\(--scrim-ink-soft\),\s*var\(--scrim-ink-soft\)\)\s*$/);
    expect(css).toMatch(/@utility bg-scrim-hero\s*\{\s*background-image:\s*var\(--gradient-scrim-hero\);/);
  });

  it("Hero.tsx contains no hard-coded colours (hex/rgb/hsl/oklch/arbitrary colour classes)", () => {
    expect(heroSrc).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(heroSrc).not.toMatch(/\b(rgba?|hsla?|oklch|oklab|color-mix)\(/);
    expect(heroSrc).not.toMatch(/(bg|text|from|via|to|border|ring|shadow)-\[(#|rgb|hsl|color)/);
    expect(heroSrc).not.toMatch(/(^|\s|")(bg|text|from|via|to)-(black|white|gray|neutral|zinc|stone|slate)(\/|\s|")/);
  });
});

describe("WCAG contrast over the worst case — pure white image under the soft scrim (2.20)", () => {
  const ink = hexToken("ink");
  const bg = over(ink, softScrimAlpha(), [255, 255, 255]);

  it("h1 (gold-pale, large text) ≥ 3:1 — and in fact ≥ 4.5:1", () => {
    const r = ratio(hexToken("gold-pale"), bg);
    expect(r).toBeGreaterThanOrEqual(3);
    expect(r).toBeGreaterThanOrEqual(4.5);
  });

  it("promise subline (champagne) ≥ 4.5:1", () => {
    expect(ratio(hexToken("champagne"), bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("CTA text (ink on opaque gold, and on gold-light hover) ≥ 4.5:1 — independent of the image", () => {
    expect(ratio(ink, hexToken("gold"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(ink, hexToken("gold-light"))).toBeGreaterThanOrEqual(4.5);
  });

  it("CTA boundary / gilded rule (gold graphic) ≥ 3:1 against the scrim", () => {
    expect(ratio(hexToken("gold"), bg)).toBeGreaterThanOrEqual(3);
  });

  it("floating controls over the hero keep ≥3:1 boundaries (WhatsApp green, a11y trigger gold border)", () => {
    expect(ratio(hexToken("whatsapp"), bg)).toBeGreaterThanOrEqual(3);
    expect(ratio(hexToken("gold"), bg)).toBeGreaterThanOrEqual(3);
  });
});

describe("High contrast (2.18) and forced-colors hide the hero image + scrim (2.20)", () => {
  it("source rules set display:none on both layers", () => {
    const hc = css.indexOf('html[data-a11y-contrast="high"] :where([data-hero-image], [data-hero-scrim])');
    expect(hc).toBeGreaterThan(-1);
    expect(css.slice(hc, css.indexOf("}", hc))).toMatch(/display:\s*none/);
    const fc = css.indexOf("@media (forced-colors: active)");
    expect(fc).toBeGreaterThan(-1);
    const fcBlock = css.slice(fc, css.indexOf("}\n}", fc) + 3);
    expect(fcBlock).toMatch(/\[data-hero-image\],\s*\[data-hero-scrim\]/);
    expect(fcBlock).toMatch(/display:\s*none/);
  });

  it("the hero layer classes set no display value that could override the hide rule (compiled Tailwind)", async () => {
    const classes = (name: string) => {
      const m = heroSrc.match(new RegExp(`<div data-hero-${name}\\b[^>]*?className="([^"]+)"`));
      expect(m, `layer ${name}`).not.toBeNull();
      return m![1].split(/\s+/);
    };
    const layerClasses = [...classes("image"), ...classes("scrim")];
    const compiler = await compile('@import "tailwindcss";\n@import "./styles/tokens.css";', {
      base: ROOT,
      onDependency: () => {},
    });
    const out = compiler.build(layerClasses);
    // each hero-layer utility rule — none sets display
    for (const cls of layerClasses) {
      const esc = cls.replace(/[-[\]/.:]/g, (c) => `\\${c}`);
      const i = out.indexOf(`.${esc} {`);
      if (i === -1) continue;
      expect(out.slice(i, out.indexOf("}", i)), cls).not.toMatch(/display:/);
    }
    expect(out).toMatch(/\.bg-scrim-hero\s*\{\s*background-image:\s*var\(--gradient-scrim-hero\)/);
    // the hide rule survives compilation
    expect(out).toMatch(/html\[data-a11y-contrast="high"\]\s*:where\(\[data-hero-image\],\s*\[data-hero-scrim\]\)/);
  });
});
