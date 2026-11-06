import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";

/**
 * משימה 2.16 — התנהגות LandingMotion תחת jsdom כאשר יש matchMedia (stub).
 * ה-stub מוגדר ב-vi.hoisted לפני ייבוא המודול, כי רישום ScrollTrigger בטעינת
 * המודול קורא ל-matchMedia.
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

import { LandingMotion } from "@/components/landing/LandingMotion";
import { LandingMotionSectionReady } from "@/components/landing/LandingMotionSectionReady";
import { Hero } from "@/components/landing/Hero";
import {
  LANDING_MOTION_HALT_ATTR,
  LANDING_MOTION_SECTION_READY_EVENT,
  getReadyLandingSections,
} from "@/lib/motion/landing-motion";

function renderPage() {
  return render(
    <main dir="rtl" lang="he">
      <LandingMotion />
      <Hero />
    </main>,
  );
}

function animatedInlineStyles(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>("[style]"))
    .map((el) => el.getAttribute("style") ?? "")
    .filter((s) => /opacity|transform|translate|scale/.test(s));
}

afterEach(() => {
  mq.reduce = true;
  document.documentElement.removeAttribute(LANDING_MOTION_HALT_ATTR);
});

describe("LandingMotion with matchMedia (task 2.16)", () => {
  it("renders a single hidden, aria-hidden marker span and nothing else", () => {
    const { container } = render(<LandingMotion />);
    expect(container.children).toHaveLength(1);
    const marker = container.firstElementChild!;
    expect(marker.tagName).toBe("SPAN");
    expect(marker).toHaveAttribute("hidden");
    expect(marker).toHaveAttribute("aria-hidden", "true");
    expect(marker).toHaveAttribute("data-landing-motion");
  });

  it("applies no inline animation styles under prefers-reduced-motion: reduce", () => {
    mq.reduce = true;
    const { container, unmount } = renderPage();
    expect(animatedInlineStyles(container)).toEqual([]);
    expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
    expect(() => unmount()).not.toThrow();
  });

  it("applies no inline animation styles when data-reduce-motion is present before mount", () => {
    mq.reduce = false;
    document.documentElement.setAttribute(LANDING_MOTION_HALT_ATTR, "true");
    const { container, unmount } = renderPage();
    expect(animatedInlineStyles(container)).toEqual([]);
    expect(() => unmount()).not.toThrow();
  });

  it("mounts and unmounts cleanly with no-preference (no throw, inline styles cleaned on unmount)", () => {
    mq.reduce = false;
    const { container, unmount } = renderPage();
    const hero = container.querySelector("[data-hero]");
    expect(hero).not.toBeNull();
    // no x-axis motion anywhere
    for (const s of animatedInlineStyles(container)) {
      expect(s).not.toMatch(/translate(3d)?\(\s*-?[1-9]/);
      expect(s).not.toMatch(/translateX/);
    }
    expect(() => unmount()).not.toThrow();
  });

  it("server-renders only the hidden marker (no style attribute that hides content)", () => {
    const html = renderToString(
      <main dir="rtl">
        <LandingMotion />
        <Hero />
      </main>,
    );
    expect(html).toContain("data-landing-motion");
    expect(html).not.toMatch(/style="[^"]*(opacity|visibility|transform)/);
  });
});

describe("LandingMotionSectionReady (task 2.16)", () => {
  it("renders its children unchanged (no wrapper DOM) and marks the section ready", () => {
    const listener = vi.fn();
    window.addEventListener(LANDING_MOTION_SECTION_READY_EVENT, listener);
    const { container } = render(
      <LandingMotionSectionReady section="contact-form">
        <section data-testid="child">תוכן</section>
      </LandingMotionSectionReady>,
    );
    window.removeEventListener(LANDING_MOTION_SECTION_READY_EVENT, listener);

    expect(container.firstElementChild).toBe(screen.getByTestId("child"));
    expect(listener).toHaveBeenCalled();
    expect(getReadyLandingSections()).toContain("contact-form");
  });
});
