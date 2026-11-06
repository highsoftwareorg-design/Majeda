import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

/**
 * משימה 2.17 — רגרסיית RTL לאנימציות 2.16: אין תנועה אופקית, והקו המוזהב ב-Hero
 * "נמתח" מקצה ה-inline-start (ימין ב-RTL) בדסקטופ — לא מברירת המחדל LTR (שמאל).
 * matchMedia מדומה לפני ייבוא המודול: no-preference + דסקטופ (min-width: 64rem).
 * jsdom לא ממפה dir="rtl" ל-direction, ולכן direction מוגדר גם כ-style מפורש.
 */
vi.hoisted(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes("no-preference") || query.includes("min-width"),
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
import { Hero } from "@/components/landing/Hero";

function renderHero(direction: "rtl" | "ltr") {
  // ה-Hero "בתוך ה-viewport" — אחרת ה-timeline לא נוצר (jsdom מחזיר מלבן אפס)
  const original = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-hero")) {
      return { top: 0, bottom: 800, left: 0, right: 1280, width: 1280, height: 800, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    }
    return original.call(this);
  });
  return render(
    <main dir={direction} lang="he" style={{ direction }}>
      <LandingMotion />
      <Hero />
    </main>,
  );
}

describe("LandingMotion — RTL direction (task 2.17)", () => {
  it("anchors the Hero gilded rule's scaleX at inline-start (right) under RTL, with no horizontal motion", () => {
    const { container, unmount } = renderHero("rtl");
    const rule = container.querySelector<HTMLElement>("[data-hero-rule]")!;
    expect(rule.style.transformOrigin).toBe("100% 50%");

    // שום אלמנט מונפש לא מוזז אופקית (translateX / translate(x≠0, …))
    container.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
      const t = el.style.transform;
      expect(t).not.toMatch(/translateX/);
      expect(t).not.toMatch(/translate(3d)?\(\s*-?[0-9.]*[1-9]/);
    });
    unmount();
    vi.restoreAllMocks();
  });

  it("derives the origin from the document direction (LTR control → left)", () => {
    const { container, unmount } = renderHero("ltr");
    const rule = container.querySelector<HTMLElement>("[data-hero-rule]")!;
    expect(rule.style.transformOrigin).toBe("0% 50%");
    unmount();
    vi.restoreAllMocks();
  });
});
