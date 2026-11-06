import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { axe } from "jest-axe";
import fs from "fs";
import path from "path";

/**
 * משימה 2.20 (tester) — הדף המלא אחרי ה-Hero השיווקי: h1 יחיד = הכותרת השיווקית,
 * המותג ב-alt הלוגו, axe נקי כולל תוסף הנגישות, אין תמונה חיצונית, ועצירת האנימציות
 * לא משאירה סגנון inline מסתיר על שכבות התמונה/scrim.
 * getTreatments מדומה — נתוני בדיקה מומצאים בלבד.
 */
const mq = vi.hoisted(() => {
  const state = { reduce: false };
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

const FAKE_TREATMENTS = vi.hoisted(() =>
  ["א", "ב"].map((s, i) => ({
    id: `t${i + 1}`,
    name: `טיפול בדיקה ${s}`,
    description: `תיאור ${s}`,
    price: 200 + i * 50,
    durationMinutes: 45,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  })),
);
vi.mock("@/lib/db/treatments", () => ({ getTreatments: async () => FAKE_TREATMENTS }));

import { Hero } from "@/components/landing/Hero";
import { TreatmentsSection } from "@/components/landing/TreatmentsSection";
import { ContactFormSectionContainer } from "@/components/landing/ContactFormSectionContainer";
import { LandingMotion } from "@/components/landing/LandingMotion";
import { BeforeAfterSection } from "@/components/landing/BeforeAfterSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { AboutSection } from "@/components/landing/AboutSection";
import { ContactInfoSection } from "@/components/landing/ContactInfoSection";
import { Footer } from "@/components/landing/Footer";
import { WhatsAppFloatingButton } from "@/components/landing/WhatsAppFloatingButton";
import { AccessibilityWidget } from "@/components/accessibility/AccessibilityWidget";
import { HERO_CONTENT } from "@/lib/landing/hero-content";
import { haltLandingMotion, LANDING_MOTION_HALT_ATTR } from "@/lib/motion/landing-motion";

async function renderFullPage() {
  const treatments = await TreatmentsSection();
  const contactForm = await ContactFormSectionContainer();
  return render(
    <>
      <main dir="rtl" lang="he" className="flex min-h-screen w-full flex-col bg-ink text-champagne">
        <LandingMotion />
        <Hero />
        {treatments}
        <BeforeAfterSection />
        <TestimonialsSection />
        <AboutSection />
        {contactForm}
        <ContactInfoSection />
        <Footer />
        <WhatsAppFloatingButton />
      </main>
      <AccessibilityWidget />
    </>,
  );
}

afterEach(() => {
  document.documentElement.removeAttribute(LANDING_MOTION_HALT_ATTR);
  mq.reduce = false;
});

describe("Full landing page after 2.20", () => {
  it("has exactly one h1, and it is the marketing headline", async () => {
    await renderFullPage();
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent?.trim()).toBe(HERO_CONTENT.title);
    expect(HERO_CONTENT.title).toBe("הרגע השקט שלך מתחיל כאן");
  });

  it("logo alt carries MAJIDA, the CTA links to an existing #booking target", async () => {
    const { container } = await renderFullPage();
    const logo = container.querySelector('[data-hero-media] [data-slot="logo"] img');
    expect(logo?.getAttribute("alt")).toMatch(/MAJIDA/);
    expect(screen.getByRole("link", { name: HERO_CONTENT.ctaLabel })).toHaveAttribute("href", "#booking");
    expect(container.querySelectorAll("#booking")).toHaveLength(1);
  });

  it("has 0 axe violations, including the accessibility widget", async () => {
    const { container } = await renderFullPage();
    expect(await axe(document.body)).toHaveNoViolations();
    expect(container).toBeTruthy();
  });

  it("every rendered <img> is local (no hotlinking)", async () => {
    await renderFullPage();
    const imgs = Array.from(document.querySelectorAll("img"));
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) {
      const src = decodeURIComponent(img.getAttribute("src") ?? "");
      const srcset = decodeURIComponent(img.getAttribute("srcset") ?? "");
      expect(src, src).not.toMatch(/^(https?:)?\/\//);
      expect(srcset).not.toMatch(/url=(https?:)?\/\//);
    }
  });

  it("stop animations (haltLandingMotion) leaves no hiding inline style on the hero image/scrim or copy", async () => {
    const { container } = await renderFullPage();
    await act(async () => {
      haltLandingMotion();
      await Promise.resolve();
    });
    expect(document.documentElement.getAttribute(LANDING_MOTION_HALT_ATTR)).toBe("true");
    for (const sel of ["[data-hero-image]", "[data-hero-image] img", "[data-hero-scrim]", "[data-hero-title]", "[data-hero-cta]"]) {
      const style = container.querySelector(sel)?.getAttribute("style") ?? "";
      expect(style, sel).not.toMatch(/opacity:\s*0|visibility:\s*hidden|transform/);
    }
    expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

describe("No external image sources in source code (2.20 / 2.19)", () => {
  it("components/, app/ and lib/ reference no remote image host", () => {
    const root = path.resolve(__dirname, "..", "..", "..");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name !== "__tests__" && e.name !== "node_modules") walk(p);
        } else if (/\.(tsx?|css)$/.test(e.name) && !/\.test\./.test(e.name)) files.push(p);
      }
    };
    ["components", "app", "lib", "styles"].forEach((d) => walk(path.join(root, d)));
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/images\.(unsplash|pexels)\.com|src=\{?["'`]https?:\/\//);
    }
    expect(fs.readFileSync(path.join(root, "next.config.ts"), "utf8")).not.toMatch(/remotePatterns|domains\s*:/);
  });
});
