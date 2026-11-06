import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { Hero } from "@/components/landing/Hero";
import { HERO_CONTENT, HERO_IMAGE } from "@/lib/landing/hero-content";
import { STOCK_IMAGES } from "@/lib/landing/stock-images";

/**
 * משימה 2.12 — Hero אחרי העיצוב המחודש.
 * מוודא שהתוכן (כותרת, משפט הבטחה, CTA וקישור העוגן) לא השתנה לעומת משימה 2.2,
 * ושהמבנה הנגיש (h1 יחיד, alt ללוגו) נשמר.
 * משימה 2.20: ה-h1 הוא הכותרת השיווקית (HERO_CONTENT), המותג נישא ע"י alt הלוגו,
 * ותמונת הסטוק מגיעה ממקור הנתונים עם priority/fetchpriority גבוה בתוך [data-hero-image].
 */
function renderInRtl() {
  return render(
    <main dir="rtl" lang="he">
      <Hero />
    </main>
  );
}

describe("Hero (tasks 2.12, 2.20)", () => {
  it("renders exactly one h1 — the marketing headline (task 2.20), not the brand name", () => {
    renderInRtl();
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(HERO_CONTENT.title);
    expect(headings[0].textContent?.trim()).toBe(HERO_CONTENT.title);
    expect(headings[0]).not.toHaveTextContent(/MAJIDA/);
  });

  it("labels the section by the headline (aria-labelledby)", () => {
    renderInRtl();
    const section = screen.getByRole("region", { name: HERO_CONTENT.title });
    expect(section).toHaveAttribute("aria-labelledby", "hero-title");
    expect(within(section).getByRole("heading", { level: 1 })).toHaveAttribute(
      "id",
      "hero-title"
    );
  });

  it("renders the unchanged promise sentence", () => {
    renderInRtl();
    expect(screen.getByText("יופי נצחי, בנגיעה אישית")).toBeInTheDocument();
  });

  it("renders the CTA as a link to #booking with the unchanged text", () => {
    renderInRtl();
    const cta = screen.getByRole("link", { name: "לקביעת תור" });
    expect(cta.tagName).toBe("A");
    expect(cta).toHaveAttribute("href", "#booking");
  });

  it("has exactly one link (no anchors were added or removed)", () => {
    renderInRtl();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["#booking"]);
  });

  it("renders the logo image with the brand alt text", () => {
    renderInRtl();
    const img = screen.getByRole("img", { name: /MAJIDA/ });
    expect(img.getAttribute("alt")).toContain("MAJIDA");
    expect(img.getAttribute("src")).toContain("majida_logo.svg");
  });

  it("keeps the deliberate logo scale fix (scale-[1.4]) inside the arch", () => {
    const { container } = renderInRtl();
    const logo = container.querySelector('[data-hero-media] [data-slot="logo"]');
    expect(logo?.className).toContain("scale-[1.4]");
  });

  it("hides the decorative gilded rule from assistive tech", () => {
    const { container } = renderInRtl();
    const rule = container.querySelector("[data-hero-rule]");
    expect(rule).not.toBeNull();
    expect(rule).toHaveAttribute("aria-hidden", "true");
  });

  it("exposes the data-hero-* animation anchors documented in PLAN.md", () => {
    const { container } = renderInRtl();
    for (const sel of [
      "[data-hero]",
      "[data-hero-media]",
      "[data-hero-copy]",
      "[data-hero-title]",
      "[data-hero-rule]",
      "[data-hero-promise]",
      "[data-hero-cta]",
      '[data-hero-media] [data-slot="logo"]',
      "[data-hero-image]",
      "[data-hero-scrim]",
    ]) {
      expect(container.querySelector(sel), sel).not.toBeNull();
    }
  });

  it("is rendered inside an RTL context", () => {
    renderInRtl();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.closest("[dir]")).toHaveAttribute("dir", "rtl");
  });

  it("uses logical (not physical left/right) direction classes", () => {
    const { container } = renderInRtl();
    const physical =
      /(^|\s)(?:[a-z]+:)*-?(?:ml|mr|pl|pr|left|right|text-left|text-right|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|float-left|float-right)(?:-|$|\s)/;
    container.querySelectorAll("[class]").forEach((el) => {
      expect(el.getAttribute("class") ?? "", el.outerHTML.slice(0, 80)).not.toMatch(
        physical
      );
    });
  });

  it("keeps the CTA text color class (cn/tailwind-merge conflict workaround)", () => {
    renderInRtl();
    const cta = screen.getByRole("link", { name: "לקביעת תור" });
    expect(cta.className).toMatch(/(^|\s)text-ink(\s|$)/);
    expect(cta.className).toMatch(/(^|\s)bg-gold(\s|$)/);
    expect(cta.querySelector("span.text-body")).not.toBeNull();
  });

  it("renders the hero stock image from the data source, prioritised as the LCP", () => {
    const { container } = renderInRtl();
    const wrapper = container.querySelector("[data-hero-image]");
    expect(wrapper).not.toBeNull();
    expect(wrapper?.className).toMatch(/(^|\s)overflow-hidden(\s|$)/);
    const img = wrapper?.querySelector("img");
    expect(img).not.toBeNull();
    expect(HERO_IMAGE).toBe(STOCK_IMAGES.heroSteamRoom);
    expect(img).toHaveAttribute("alt", HERO_IMAGE.alt);
    expect(decodeURIComponent(img?.getAttribute("src") ?? "")).toContain(
      "hero-steam-room-warm-light.webp"
    );
    // priority: לא lazy, ו-fetchpriority גבוה (ב-Next 16 priority לבדו אינו מוסיף fetchpriority)
    expect(img).not.toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("fetchpriority", "high");
    expect(img).toHaveAttribute("sizes", "100vw");
  });

  it("does not give the logo priority any more (the hero image is the LCP)", () => {
    renderInRtl();
    const logo = screen.getByRole("img", { name: /MAJIDA/ });
    expect(logo).toHaveAttribute("loading", "lazy");
    expect(logo).not.toHaveAttribute("fetchpriority", "high");
  });

  it("hides the scrim layer from assistive tech and uses the token utility", () => {
    const { container } = renderInRtl();
    const scrim = container.querySelector("[data-hero-scrim]");
    expect(scrim).toHaveAttribute("aria-hidden", "true");
    expect(scrim?.className).toContain("bg-scrim-hero");
  });

  it("has no axe violations", async () => {
    const { container } = renderInRtl();
    expect(await axe(container)).toHaveNoViolations();
  });
});
