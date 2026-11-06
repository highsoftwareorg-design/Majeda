import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";

/**
 * Tester — task 2.22 independent checks (jsdom):
 * 1. matchMedia stub diagnosis: the exact query GSAP passes contains "reduce", so the
 *    pre-2.22 stub (reduce-first) inverted the branches. Truth table old vs new.
 * 2. Halt *mid-reveal* (clip tween running) and *mid-parallax* → no inline transform /
 *    clip-path / will-change / opacity:0 on any image node, 0 extra ScrollTriggers.
 * 3. focusin on a still-clipped image container settles it (clip-path removed).
 */
const mq = vi.hoisted(() => {
  const state = { reduce: false };
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
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
import { Hero } from "@/components/landing/Hero";
import { SectionDivider } from "@/components/landing/SectionDivider";
import { AboutSection } from "@/components/landing/AboutSection";
import { haltLandingMotion, LANDING_MOTION_HALT_ATTR } from "@/lib/motion/landing-motion";

const NO_PREF = "(prefers-reduced-motion: no-preference)";
const REDUCE = "(prefers-reduced-motion: reduce)";
const oldStub = (q: string, reduce: boolean) =>
  q.includes("reduce") ? reduce : q.includes("no-preference") ? !reduce : false;
const newStub = (q: string, reduce: boolean) =>
  q.includes("no-preference") ? !reduce : q.includes("reduce") ? reduce : false;

const realRect = Element.prototype.getBoundingClientRect;
let imagesTop = 4000;
function rect(top: number, height: number): DOMRect {
  return { top, bottom: top + height, height, left: 0, right: 360, width: 360, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
}

function renderPage() {
  return render(
    <main dir="rtl" lang="he">
      <LandingMotion />
      <Hero />
      <SectionDivider />
      <AboutSection />
    </main>,
  );
}
const INLINE_MOTION = /transform|translate|scale|clip-path|will-change|opacity:\s*0[;\s]|visibility:\s*hidden/;
const imageNodes = (c: HTMLElement) =>
  Array.from(c.querySelectorAll<HTMLElement>("[data-landing-image], [data-landing-image] *"));
const styled = (c: HTMLElement) =>
  imageNodes(c)
    .map((el) => el.getAttribute("style") ?? "")
    .filter((s) => INLINE_MOTION.test(s));

beforeEach(() => {
  imagesTop = 4000;
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this.matches?.("[data-hero], [data-landing-image='hero']")) return rect(0, 700);
    if (this.matches?.("[data-landing-image]")) return rect(imagesTop, 400);
    return rect(0, 0);
  };
});
afterEach(() => {
  Element.prototype.getBoundingClientRect = realRect;
  mq.reduce = false;
  document.documentElement.removeAttribute(LANDING_MOTION_HALT_ATTR);
  vi.restoreAllMocks();
});

/** Brings the images into view and lets ScrollTrigger fire the once-only batch onEnter. */
async function scrollImagesIntoView() {
  imagesTop = 100;
  await act(async () => {
    ScrollTrigger.refresh();
    ScrollTrigger.update();
    window.dispatchEvent(new Event("scroll"));
    await new Promise((r) => setTimeout(r, 120));
  });
}

describe("tester 2.22 — matchMedia stub diagnosis", () => {
  it("the GSAP no-preference query contains the substring 'reduce'", () => {
    expect(NO_PREF.includes("reduce")).toBe(true);
  });
  it("old stub inverted the no-preference branch; new stub does not", () => {
    // old: the no-preference branch matched when the test said "reduce", and not otherwise
    expect(oldStub(NO_PREF, true)).toBe(true);
    expect(oldStub(NO_PREF, false)).toBe(false);
    // new: correct
    expect(newStub(NO_PREF, true)).toBe(false);
    expect(newStub(NO_PREF, false)).toBe(true);
    expect(newStub(REDUCE, true)).toBe(true);
    expect(newStub(REDUCE, false)).toBe(false);
    expect(newStub("(min-width: 64rem)", false)).toBe(false);
  });
  it("with the new stub, no-preference really runs the branch and reduce really does not", () => {
    mq.reduce = true;
    const base = ScrollTrigger.getAll().length;
    const a = renderPage();
    expect(ScrollTrigger.getAll().length).toBe(base);
    a.unmount();
    mq.reduce = false;
    const b = renderPage();
    expect(ScrollTrigger.getAll().length).toBeGreaterThan(base);
    b.unmount();
    expect(ScrollTrigger.getAll().length).toBe(base);
  });
});

describe("tester 2.22 — runtime halt", () => {
  it("before reveal: images are clipped below the fold, parallax layers carry will-change", () => {
    const { container, unmount } = renderPage();
    for (const kind of ["divider", "about"]) {
      const w = container.querySelector<HTMLElement>(`[data-landing-image="${kind}"]`)!;
      expect(w.style.clipPath, kind).toMatch(/^inset\(/);
      expect(w.style.opacity, kind).toBe(""); // image reveal uses clip only, never opacity:0
    }
    const willChange = imageNodes(container).filter((el) => el.style.willChange);
    // exactly the parallax layers (3 here: hero, divider, about) — nothing else
    expect(willChange.every((el) => el.hasAttribute("data-landing-parallax"))).toBe(true);
    expect(willChange.length).toBe(3);
    unmount();
  });

  it("halt mid-reveal leaves no inline motion styles, images visible, ScrollTriggers back to base", async () => {
    const base = ScrollTrigger.getAll().length;
    const { container, unmount } = renderPage();
    await scrollImagesIntoView();
    const divider = container.querySelector<HTMLElement>('[data-landing-image="divider"]')!;
    // genuinely mid-reveal: clip tween running, inset partway between 22% and 0%
    expect(gsap.isTweening(divider)).toBe(true);
    expect(divider.style.clipPath).toMatch(/^inset\(/);
    expect(divider.style.clipPath).not.toBe("inset(22% 0% 22% 0%)");

    await act(async () => {
      haltLandingMotion();
      await Promise.resolve();
    });
    expect(styled(container)).toEqual([]);
    expect(ScrollTrigger.getAll().length).toBe(base);
    for (const el of container.querySelectorAll<HTMLElement>("[data-landing-image]")) {
      expect(el.style.clipPath).toBe("");
      expect(el.style.opacity).toBe("");
    }
    unmount();
  });

  it("the reveal tween really starts when images enter the viewport (mid-reveal is reachable)", async () => {
    const { container, unmount } = renderPage();
    await scrollImagesIntoView();
    const about = container.querySelector<HTMLElement>('[data-landing-image="about"]')!;
    // either still tweening, or finished and settled (clip-path removed) — never stuck at the from-inset
    const stuck = about.style.clipPath === "inset(10% 8% 10% 8%)";
    expect(gsap.isTweening(about) || !stuck).toBe(true);
    unmount();
  });

  it("focusin inside a still-clipped image container settles it immediately", () => {
    const { container, unmount } = renderPage();
    const about = container.querySelector<HTMLElement>('[data-landing-image="about"]')!;
    expect(about.style.clipPath).toMatch(/^inset\(/);
    const probe = document.createElement("button");
    probe.textContent = "בדיקה";
    about.appendChild(probe);
    act(() => probe.focus());
    expect(about.style.clipPath).toBe("");
    expect(about.style.opacity).toBe("");
    probe.remove();
    unmount();
  });
});
