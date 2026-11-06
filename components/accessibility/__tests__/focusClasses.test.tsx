import { describe, it, expect, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fs from "node:fs";
import path from "node:path";
import { compile } from "@tailwindcss/node";
import { AccessibilityWidget } from "@/components/accessibility/AccessibilityWidget";

/**
 * משימה 2.18 (fix 1) — רגרסיה ל-WCAG 2.4.7.
 *
 * ב-Tailwind v4 `outline-none`/`outline-hidden` קובעים `--tw-outline-style: none`, ו-`focus-visible:outline-2`
 * כותב `outline-style: var(--tw-outline-style)` — כך שה-outline נשאר `none` ובלתי נראה, אלא אם
 * נוסף סגנון מפורש (`focus-visible:outline-solid` וכד׳) או `focus-visible:outline` (ללא ערך).
 */

const ROOT = path.resolve(__dirname, "../../..");
const RESET = /(^|\s)outline-(none|hidden)(\s|$)/;
const FOCUS_WIDTH = /(^|\s)focus-visible:outline-(\d+|\[[^\]]+\])(\s|$)/;
const FOCUS_STYLE = /(^|\s)focus-visible:outline(-(solid|dashed|dotted|double))?(\s|$)/;

/** true = שילוב שבור: איפוס outline + רוחב בפוקוס בלי סגנון. */
function hasInvisibleFocusOutline(classes: string) {
  return RESET.test(classes) && FOCUS_WIDTH.test(classes) && !FOCUS_STYLE.test(classes);
}

afterEach(() => cleanup());

describe("hasInvisibleFocusOutline (helper sanity)", () => {
  it("flags the original broken pattern and accepts the fixed ones", () => {
    expect(
      hasInvisibleFocusOutline(
        "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light",
      ),
    ).toBe(true);
    expect(
      hasInvisibleFocusOutline(
        "outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-gold-light",
      ),
    ).toBe(false);
    expect(hasInvisibleFocusOutline("outline-none focus-visible:outline focus-visible:outline-2")).toBe(false);
    // ללא איפוס — המשתנה נשאר בערך ההתחלתי solid (@property), ולכן תקין.
    expect(hasInvisibleFocusOutline("focus-visible:outline-2 focus-visible:outline-gold-light")).toBe(false);
  });
});

describe("AccessibilityWidget — focus indicator classes", () => {
  it("every widget control draws a solid 2px gold-light focus outline with offset", async () => {
    const user = userEvent.setup();
    render(
      <main dir="rtl" lang="he">
        <AccessibilityWidget />
      </main>,
    );
    const trigger = screen.getByRole("button", { name: "פתיחת תפריט נגישות" });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "התאמות נגישות" });

    const controls = [
      trigger,
      ...within(dialog).getAllByRole("button"),
      ...within(dialog).getAllByRole("link"),
    ];
    // trigger + close + 2 steppers + 6 options + reset + statement link
    expect(controls.length).toBeGreaterThanOrEqual(12);

    for (const el of controls) {
      const cls = el.getAttribute("class") ?? "";
      expect(hasInvisibleFocusOutline(cls), cls).toBe(false);
      expect(cls).toMatch(/(^|\s)focus-visible:outline-solid(\s|$)/);
      expect(cls).toMatch(/(^|\s)focus-visible:outline-2(\s|$)/);
      expect(cls).toMatch(/(^|\s)focus-visible:outline-offset-2(\s|$)/);
      expect(cls).toMatch(/(^|\s)focus-visible:outline-gold-light(\s|$)/);
      expect(cls).not.toMatch(/(^|\s)outline-none(\s|$)/);
    }

    // כפתור ההפעלה צף גם מעל רקע בהיר — הילת ink (ring, לא shadow — ראו fix 2) מבטיחה ניגודיות ≥3:1.
    const triggerCls = trigger.getAttribute("class") ?? "";
    expect(triggerCls).toMatch(/(^|\s)focus-visible:ring-6(\s|$)/);
    expect(triggerCls).toMatch(/(^|\s)focus-visible:ring-ink(\s|$)/);
    expect(triggerCls).not.toMatch(/focus-visible:shadow-\[/);
  });
});

/**
 * משימה 2.18 (fix 2) — קומפילציה של רשימת המחלקות המלאה של כפתור ההפעלה יחד.
 *
 * הבאג: `focus-visible:shadow-[0_0_0_6px_var(--color-ink)]` מתקמפל ל-
 * `var(--tw-shadow-color, var(--color-ink))`, ו-`shadow-black/30` של אותו כפתור קובע
 * `--tw-shadow-color` — ההילה יצאה שחור 30% (2.06–2.10:1). כאן מוודאים שההילה בפועל היא ink אטום.
 */
describe("Tailwind v4 compile — trigger's full class list yields an opaque ink halo", () => {
  const hex = (h: string) =>
    [1, 3, 5]
      .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const lum = (h: string) => {
    const [r, g, b] = hex(h);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  it("ring-based halo resolves to opaque ink, independent of shadow-black/30; outline stays solid gold-light", async () => {
    const user = userEvent.setup();
    render(
      <main dir="rtl" lang="he">
        <AccessibilityWidget />
      </main>,
    );
    const trigger = screen.getByRole("button", { name: "פתיחת תפריט נגישות" });
    await user.click(trigger); // ודא שהמחלקות הן אלה של הכפתור החי (Radix מוסיף data-state בלבד)
    const classes = (trigger.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
    expect(classes).toContain("shadow-black/30"); // התנאי שגרם לבאג עדיין קיים — והבדיקה חייבת לעבור למרות זאת

    const compiler = await compile('@import "tailwindcss";\n@import "./styles/tokens.css";', {
      base: ROOT,
      onDependency: () => {},
    });
    const css = compiler.build(classes);
    const utilStart = css.indexOf("@layer utilities");
    expect(utilStart).toBeGreaterThan(-1);
    const utilities = css.slice(utilStart, css.indexOf("\n}\n", utilStart));

    const rule = (selector: string) => {
      const start = utilities.indexOf(selector);
      expect(start, `missing rule ${selector}`).toBeGreaterThan(-1);
      return utilities.slice(start, utilities.indexOf("}", utilities.indexOf("{", start)) + 1);
    };
    const token = (name: string) => {
      const m = css.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})\\s*;`));
      expect(m, `token ${name} must resolve to an opaque #RRGGBB`).not.toBeNull();
      return m![1];
    };

    // ההילה: ring של 6px בצבע --tw-ring-color, שנכנס ל-box-shadow — ללא תלות ב---tw-shadow-color.
    const ring = rule(".focus-visible\\:ring-6:focus-visible");
    expect(ring).toMatch(
      /--tw-ring-shadow:\s*var\(--tw-ring-inset,\s*\)\s*0 0 0 calc\(6px \+ var\(--tw-ring-offset-width\)\) var\(--tw-ring-color,/,
    );
    expect(ring).toMatch(/box-shadow:[^;]*var\(--tw-ring-shadow\)/);
    expect(ring).not.toContain("--tw-shadow-color");

    // הצבע היחיד שנקבע ל-ring הוא ink; אף מחלקה לא קובעת offset/inset שיזיזו את ההילה.
    expect([...utilities.matchAll(/--tw-ring-color:\s*([^;]+);/g)].map((m) => m[1].trim())).toEqual([
      "var(--color-ink)",
    ]);
    expect(rule(".focus-visible\\:ring-ink:focus-visible")).toMatch(/--tw-ring-color:\s*var\(--color-ink\)/);
    expect(utilities).not.toMatch(/--tw-ring-offset-width:/);
    expect(utilities).not.toMatch(/--tw-ring-inset:/);
    expect(css).toMatch(/@property --tw-ring-offset-width\s*{[^}]*initial-value:\s*0px/);

    // shadow-black/30 משפיע רק על --tw-shadow (הצל הדקורטיבי), לא על ההילה.
    expect(rule(".shadow-black\\/30")).toMatch(/--tw-shadow-color:/);
    expect(utilities).not.toMatch(/var\(--tw-shadow-color,\s*var\(--color-ink\)\)/);

    // outline: solid 2px gold-light, offset 2px (נצבע מעל פס ה-ink שבין 0 ל-6px).
    expect(rule(".outline-hidden")).toMatch(/--tw-outline-style:\s*none/);
    const solid = rule(".focus-visible\\:outline-solid:focus-visible");
    expect(solid).toMatch(/--tw-outline-style:\s*solid/);
    expect(solid).toMatch(/outline-style:\s*solid/);
    expect(rule(".focus-visible\\:outline-2:focus-visible")).toMatch(/outline-width:\s*2px/);
    expect(rule(".focus-visible\\:outline-offset-2:focus-visible")).toMatch(/outline-offset:\s*2px/);
    expect(rule(".focus-visible\\:outline-gold-light:focus-visible")).toMatch(
      /outline-color:\s*var\(--color-gold-light\)/,
    );

    // ink אטום (11,11,11) וניגודיות ≥3:1.
    const ink = token("--color-ink");
    expect(ink.toUpperCase()).toBe("#0B0B0B");
    const goldLight = token("--color-gold-light");
    expect(ratio(goldLight, ink)).toBeGreaterThanOrEqual(3);
    for (const band of ["--color-champagne", "--color-sand", "--color-blush", "--color-porcelain", "--color-white"]) {
      expect(ratio(ink, token(band)), `ink halo vs ${band}`).toBeGreaterThanOrEqual(3);
    }
    for (const band of ["--color-ink", "--color-ink-raised", "--color-charcoal"]) {
      expect(ratio(goldLight, token(band)), `gold-light outline vs ${band}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("repo scan — no invisible focus outlines in components/ and app/", () => {
  function collect(dir: string, out: string[] = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      // __tests__ מוחרגים: הם מכילים את הדפוס השבור בכוונה (כקלט לבדיקה).
      if (entry.name === "node_modules" || entry.name === "__tests__" || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) collect(full, out);
      else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  it("no string literal combines outline-none/hidden with focus-visible:outline-<width> without a style", () => {
    const files = [...collect(path.join(ROOT, "components")), ...collect(path.join(ROOT, "app"))];
    const offenders: string[] = [];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(/"([^"\n]*)"|`([^`]*)`|'([^'\n]*)'/g)) {
        const literal = m[1] ?? m[2] ?? m[3] ?? "";
        if (hasInvisibleFocusOutline(literal)) offenders.push(`${path.relative(ROOT, file)}: ${literal}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("Tailwind v4 compile — the fixed focus classes yield outline-style: solid", () => {
  it("focus-visible:outline-solid sets --tw-outline-style/outline-style to solid, outline-hidden resets to none", async () => {
    const compiler = await compile('@import "tailwindcss";', {
      base: ROOT,
      onDependency: () => {},
    });
    const css = compiler.build([
      "outline-hidden",
      "focus-visible:outline-solid",
      "focus-visible:outline-2",
      "focus-visible:outline-offset-2",
    ]);

    const rule = (selector: string) => {
      const start = css.indexOf(selector);
      expect(start, `missing rule ${selector}`).toBeGreaterThan(-1);
      return css.slice(start, css.indexOf("}", css.indexOf("{", start)) + 1);
    };

    // הסיבה לבאג: האיפוס מאפס גם את המשתנה.
    expect(rule(".outline-hidden")).toMatch(/--tw-outline-style:\s*none/);
    // התיקון: במצב פוקוס המשתנה והסגנון חוזרים ל-solid.
    const solid = rule(".focus-visible\\:outline-solid");
    expect(solid).toMatch(/--tw-outline-style:\s*solid/);
    expect(solid).toMatch(/outline-style:\s*solid/);
    // הרוחב צורך את המשתנה — ולכן ללא outline-solid היה נשאר none.
    const width = rule(".focus-visible\\:outline-2");
    expect(width).toMatch(/outline-style:\s*var\(--tw-outline-style\)/);
    expect(width).toMatch(/outline-width:\s*2px/);
  });
});
