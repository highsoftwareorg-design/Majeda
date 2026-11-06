import { describe, it, expect, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { gsap } from "gsap";

/**
 * משימה 2.16 (תיקון שלישי) — פוקוס על כפתור השליחה לפני שנחשף.
 *
 * באג: הסרת opacity:0 ו-transition:none באותו שינוי סגנון גרמה ל-transition-all של
 * Button להנפיש opacity 0→1 (~180ms) — הכפתור הממוקד היה שקוף ברגע הפוקוס.
 * jsdom לא מריץ CSS transitions, ולכן הבדיקה מאמתת את סדר הכתיבות:
 * opacity:1 + transition:none → flush (getBoundingClientRect) → clearProps,
 * ובסוף אין inline opacity/transform/transition.
 */
vi.hoisted(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes("no-preference"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

import { LandingMotion } from "@/components/landing/LandingMotion";
import { markLandingSectionReady } from "@/lib/motion/landing-motion";

type LogEntry =
  | { kind: "set"; vars: Record<string, unknown>; opacity: string; transition: string; transform: string }
  | { kind: "flush" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LandingMotion — focus before reveal (task 2.16, fix 3)", () => {
  it("writes opacity:1 + transition:none, flushes, then clears — never handing off to a CSS transition", () => {
    const { container, unmount } = render(
      <main dir="rtl" lang="he">
        <LandingMotion />
        <form data-contact-form="">
          <button type="submit" data-contact-form-submit="" className="transition-all">
            שליחה
          </button>
        </form>
      </main>,
    );
    const button = container.querySelector<HTMLButtonElement>("[data-contact-form-submit]")!;

    const log: LogEntry[] = [];
    // מתחת לקו הגלילה → יוסתר ע"י reveal; כל קריאה נרשמת כ-"flush"
    button.getBoundingClientRect = () => {
      log.push({ kind: "flush" });
      return { top: 5000, bottom: 5040, left: 0, right: 100, width: 100, height: 40, x: 0, y: 5000, toJSON: () => ({}) } as DOMRect;
    };

    act(() => markLandingSectionReady("contact-form"));

    // מצב התחלה: הכפתור עדיין לא נחשף
    expect(button.style.opacity).toBe("0");
    expect(button.style.transition).toBe("none");

    const originalSet = gsap.set.bind(gsap);
    vi.spyOn(gsap, "set").mockImplementation(((targets: gsap.TweenTarget, vars: gsap.TweenVars) => {
      const result = originalSet(targets, vars);
      log.push({
        kind: "set",
        vars: { ...vars },
        opacity: button.style.opacity,
        transition: button.style.transition,
        transform: button.style.transform,
      });
      return result;
    }) as typeof gsap.set);
    log.length = 0;

    act(() => button.focus());
    expect(document.activeElement).toBe(button);

    // 1) כתיבת מצב סיום מפורש עם transition:none
    const endWrite = log.findIndex((e) => e.kind === "set" && e.vars.opacity === 1 && e.vars.transition === "none");
    expect(endWrite).toBeGreaterThanOrEqual(0);
    const endEntry = log[endWrite] as Extract<LogEntry, { kind: "set" }>;
    expect(endEntry.opacity).toBe("1");
    expect(endEntry.transition).toBe("none");
    // 2.17: transform מוסר כבר בשלב 1 (לא נכתב translate(0px,0px) שהסרתו הייתה מתחילה transition)
    expect(endEntry.transform).toBe("");

    // 2) flush לפני ההסרה, 3) clearProps אחרי
    const flush = log.findIndex((e, i) => i > endWrite && e.kind === "flush");
    const clear = log.findIndex((e, i) => i > endWrite && e.kind === "set" && "clearProps" in e.vars);
    expect(flush).toBeGreaterThan(endWrite);
    expect(clear).toBeGreaterThan(flush);

    // אף כתיבה לפני מצב הסיום לא הסירה את transition:none כש-opacity עדיין 0
    for (const e of log.slice(0, endWrite)) {
      if (e.kind === "set") expect(e.transition === "" && e.opacity !== "1").toBe(false);
    }

    // מצב סופי: אין inline opacity/transform/transition — ה-CSS של הרכיב חוזר לשלוט
    expect(button.style.opacity).toBe("");
    expect(button.style.transform).toBe("");
    expect(button.style.transition).toBe("");
    expect(button.style.transformOrigin).toBe("");

    expect(() => unmount()).not.toThrow();
  });
});
