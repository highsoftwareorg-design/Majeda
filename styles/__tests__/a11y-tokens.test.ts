// @vitest-environment node
/**
 * משימה 2.18 — כללי ה-CSS של תוסף הנגישות ב-styles/tokens.css:
 * כל מאפיין data-* שהווידג׳ט מגדיר מטופל ב-CSS, הניגודיות הגבוהה מוגדרת כדריסת טוקנים בלבד
 * (ללא hex חדש), ועצירת האנימציות מבטלת transitions/animations ו-frame-zoom.
 */
import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";

const root = path.resolve(__dirname, "..", "..");
const css = fs.readFileSync(path.join(root, "styles", "tokens.css"), "utf8");

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `missing rule: ${selector}`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

const MOTION = 'html[data-reduce-motion]:not([data-reduce-motion="false"])';

describe("tokens.css — accessibility widget rules (2.18)", () => {
  it("defines text-size levels -1..3 on the root font-size (max 130%)", () => {
    expect(block('html[data-a11y-text="-1"]')).toContain("font-size: 90%");
    expect(block('html[data-a11y-text="1"]')).toContain("font-size: 110%");
    expect(block('html[data-a11y-text="2"]')).toContain("font-size: 120%");
    expect(block('html[data-a11y-text="3"]')).toContain("font-size: 130%");
  });

  it("high contrast only re-points tokens to existing brand tokens (no new hex)", () => {
    const hc = block('html[data-a11y-contrast="high"]');
    expect(hc).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|oklch\(/i);
    for (const v of ["--color-champagne-muted", "--color-taupe", "--color-gold-dark", "--muted-foreground"]) {
      expect(hc).toContain(`${v}:`);
    }
  });

  it("grayscale is applied on <html> (keeps fixed buttons anchored to the viewport)", () => {
    expect(block('html[data-a11y-grayscale="true"]')).toContain("filter: grayscale(1)");
  });

  it("readable font re-uses Assistant (--font-body) for headings, no new font-family", () => {
    const rf = block('html[data-a11y-font="readable"]');
    expect(rf).toContain("--font-heading: var(--font-body)");
    expect(css).not.toMatch(/font-family\s*:/);
  });

  it("stop animations disables transitions/animations and frame-zoom under data-reduce-motion", () => {
    const all = block(`${MOTION} *,\n${MOTION} *::before,\n${MOTION} *::after`);
    expect(all).toContain("animation: none !important");
    expect(all).toContain("transition: none !important");
    expect(block(`${MOTION} .frame-zoom :where(img, [data-frame-media])`)).toContain(
      "transform: none !important",
    );
    expect(block(MOTION)).toContain("scroll-behavior: auto !important");
  });
});
