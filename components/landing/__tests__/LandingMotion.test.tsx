import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * משימה 2.16 — LandingMotion חייב לא לקרוס כש-window.matchMedia חסר
 * (ברירת המחדל של jsdom; PLAN.md 2.16 Notes: "ב-jsdom אין matchMedia ולכן הרכיב יוצא מוקדם").
 * הייבוא נעשה דינמית בתוך הבדיקה כדי שכשל בזמן טעינת המודול (רישום פלאגינים) ייתפס כאן.
 */
describe("LandingMotion without window.matchMedia (task 2.16)", () => {
  it("imports and renders without crashing when window.matchMedia is missing", async () => {
    expect(typeof window.matchMedia).not.toBe("function");

    const { LandingMotion } = await import("@/components/landing/LandingMotion");
    const { Hero } = await import("@/components/landing/Hero");

    const { container, unmount } = render(
      <main dir="rtl" lang="he">
        <LandingMotion />
        <Hero />
      </main>,
    );
    const marker = container.querySelector("[data-landing-motion]");
    expect(marker).not.toBeNull();
    expect(marker).toHaveAttribute("hidden");
    expect(marker).toHaveAttribute("aria-hidden", "true");
    const animated = Array.from(container.querySelectorAll("[style]"))
      .map((el) => el.getAttribute("style") ?? "")
      .filter((s) => /opacity|transform|translate|scale/.test(s));
    expect(animated).toEqual([]);
    expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
    expect(() => unmount()).not.toThrow();
  });
});
