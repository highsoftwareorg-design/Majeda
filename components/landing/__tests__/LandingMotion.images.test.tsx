import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";

/**
 * משימה 2.22 — parallax / חשיפת clip לתמונות (jsdom).
 * (א) תחת reduce לא נוצרים ScrollTriggers חדשים.
 * (ב) data-reduce-motion בזמן ריצה מסיר כל transform / clip-path / will-change inline מהתמונות.
 * (ג) אף tween/set אינו משתמש ב-x / xPercent (אין תנועה אופקית).
 * jsdom לא מחשב פריסה — getBoundingClientRect מדומה כך שתמונות האווירה "מתחת לקו הגלילה"
 * (כדי שהחשיפה תופעל) וה-Hero בראש הדף.
 */
const mq = vi.hoisted(() => {
  const state = { reduce: true };
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      // "no-preference" נבדק קודם: "prefers-reduced-motion" עצמו מכיל את המחרוזת "reduce" (2.22)
      matches: query.includes("no-preference") ? !state.reduce : query.includes("reduce") ? state.reduce : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
  return state;
});

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { LandingMotion } from "@/components/landing/LandingMotion";
import { LandingMotionSectionReady } from "@/components/landing/LandingMotionSectionReady";
import { Hero } from "@/components/landing/Hero";
import { SectionDivider } from "@/components/landing/SectionDivider";
import { AboutSection } from "@/components/landing/AboutSection";
import { haltLandingMotion, LANDING_MOTION_HALT_ATTR } from "@/lib/motion/landing-motion";

/** תחליף מינימלי לסקשן הטיפולים ה-streamed (Server Component אסינכרוני עם DB) — אותו מבנה תמונה. */
function FakeTreatmentsImage() {
  return (
    <LandingMotionSectionReady section="treatments">
      <section data-treatments>
        <div data-landing-image="treatments" className="frame-zoom relative aspect-landscape overflow-hidden">
          <div data-landing-parallax className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/stock/x.webp" alt="תמונת בדיקה" />
          </div>
        </div>
      </section>
    </LandingMotionSectionReady>
  );
}

function renderPage() {
  return render(
    <main dir="rtl" lang="he">
      <LandingMotion />
      <Hero />
      <FakeTreatmentsImage />
      <SectionDivider />
      <AboutSection />
    </main>,
  );
}

const realRect = Element.prototype.getBoundingClientRect;
function rect(top: number, height: number): DOMRect {
  return { top, bottom: top + height, height, left: 0, right: 360, width: 360, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
}

/** כל האלמנטים שקשורים לתמונות: המכל, שכבת ה-parallax וה-img. */
function imageNodes(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>("[data-landing-image], [data-landing-image] *"),
  );
}
const INLINE_MOTION = /transform|translate|scale|clip-path|will-change/;

beforeEach(() => {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this.matches?.("[data-hero], [data-landing-image='hero']")) return rect(0, 700);
    if (this.matches?.("[data-landing-image]")) return rect(4000, 400);
    return rect(0, 0);
  };
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = realRect;
  mq.reduce = true;
  document.documentElement.removeAttribute(LANDING_MOTION_HALT_ATTR);
  vi.restoreAllMocks();
});

describe("LandingMotion — image parallax & clip reveal (task 2.22)", () => {
  it("every image has an inner [data-landing-parallax] layer inside an overflow-hidden container", () => {
    const { container } = renderPage();
    const wrappers = container.querySelectorAll<HTMLElement>("[data-landing-image]");
    expect(wrappers.length).toBe(4);
    wrappers.forEach((w) => {
      expect(w.className).toMatch(/(^|\s)overflow-hidden(\s|$)/);
      const layer = w.querySelector(":scope > [data-landing-parallax]");
      expect(layer, w.dataset.landingImage).not.toBeNull();
      expect(layer!.querySelector("img")).not.toBeNull();
    });
  });

  it("(a) under prefers-reduced-motion: reduce creates no ScrollTriggers and no inline motion styles", () => {
    mq.reduce = true;
    const before = ScrollTrigger.getAll().length;
    const { container, unmount } = renderPage();
    expect(ScrollTrigger.getAll().length).toBe(before);
    expect(imageNodes(container).map((el) => el.getAttribute("style") ?? "").filter((s) => INLINE_MOTION.test(s))).toEqual([]);
    unmount();
  });

  it("(a') with data-reduce-motion present before mount creates no ScrollTriggers", () => {
    mq.reduce = false;
    document.documentElement.setAttribute(LANDING_MOTION_HALT_ATTR, "true");
    const before = ScrollTrigger.getAll().length;
    const { unmount } = renderPage();
    expect(ScrollTrigger.getAll().length).toBe(before);
    unmount();
  });

  it("with no-preference: parallax on the inner layer only, clip on the container, never on the img", () => {
    mq.reduce = false;
    const before = ScrollTrigger.getAll().length;
    const { container, unmount } = renderPage();
    expect(ScrollTrigger.getAll().length).toBeGreaterThan(before);

    for (const kind of ["treatments", "divider", "about"]) {
      const wrapper = container.querySelector<HTMLElement>(`[data-landing-image="${kind}"]`)!;
      expect(wrapper.style.clipPath, kind).toMatch(/^inset\(/);
      expect(wrapper.style.transform, kind).toBe("");
      const layer = wrapper.querySelector<HTMLElement>("[data-landing-parallax]")!;
      expect(layer.style.transform, kind).toMatch(/scale\(1\.08/);
      expect(layer.style.transform, kind).not.toMatch(/translate\(\s*-?[1-9]/); // ציר x נשאר 0
      // לא נכתב transform על ה-img (שם פועל frame-zoom)
      expect(wrapper.querySelector("img")!.style.transform, kind).toBe("");
    }
    // ה-Hero: scale-on-scroll שמתחיל ב-1 (אין קפיצה בטעינה) ואין clip
    const heroWrapper = container.querySelector<HTMLElement>('[data-landing-image="hero"]')!;
    expect(heroWrapper.style.clipPath).toBe("");
    const heroLayer = heroWrapper.querySelector<HTMLElement>("[data-landing-parallax]")!;
    expect(heroLayer.style.transform).not.toMatch(/scale\(1\.\d*[1-9]/); // בטעינה scale 1 בדיוק
    unmount();
  });

  it("(b) setting data-reduce-motion at runtime removes every inline transform / clip-path from the images", async () => {
    mq.reduce = false;
    const before = ScrollTrigger.getAll().length;
    const { container, unmount } = renderPage();
    const styled = () => imageNodes(container).map((el) => el.getAttribute("style") ?? "").filter((s) => INLINE_MOTION.test(s));
    expect(styled().length).toBeGreaterThan(0); // sanity: התנועה אכן הופעלה

    await act(async () => {
      haltLandingMotion();
      await Promise.resolve();
    });

    expect(styled()).toEqual([]);
    expect(ScrollTrigger.getAll().length).toBe(before);
    unmount();
  });

  it("(c) no tween, set or timeline step uses x / xPercent", () => {
    mq.reduce = false;
    const calls: gsap.TweenVars[] = [];
    const record = (...args: unknown[]) => {
      for (const a of args) if (a && typeof a === "object" && !Array.isArray(a) && !(a instanceof Element)) calls.push(a as gsap.TweenVars);
    };
    for (const m of ["to", "from", "fromTo", "set"] as const) {
      const orig = gsap[m].bind(gsap) as (...a: unknown[]) => unknown;
      vi.spyOn(gsap, m).mockImplementation(((...a: unknown[]) => {
        record(...a.slice(1));
        return orig(...a);
      }) as never);
    }
    const proto = gsap.core.Timeline.prototype;
    for (const m of ["to", "from", "fromTo", "set"] as const) {
      const orig = proto[m] as (...a: unknown[]) => unknown;
      vi.spyOn(proto, m).mockImplementation(function (this: gsap.core.Timeline, ...a: unknown[]) {
        record(...a.slice(1));
        return orig.apply(this, a);
      } as never);
    }

    const { unmount } = renderPage();
    expect(calls.length).toBeGreaterThan(0);
    for (const vars of calls) {
      expect(vars).not.toHaveProperty("x");
      expect(vars).not.toHaveProperty("xPercent");
    }
    unmount();
  });
});
