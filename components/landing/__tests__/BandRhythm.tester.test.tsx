import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import fs from "node:fs";
import path from "node:path";

/**
 * משימה 2.21 — בדיקות משלימות שכתב ה-tester (פערים שלא כוסו ב-BandRhythm.test.tsx):
 * 1. axe לדף המלא יחד עם ווידג׳ט הנגישות — סגור ופתוח.
 * 2. שלד הטעינה של הטיפולים (app/page.tsx) על הרצועה הבהירה משתמש רק בטוקנים בהירים.
 * 3. גבולות/קווים/אייקונים/טבעות פוקוס ברצועות הבהירות לא משתמשים בטוקני זהב בהירים
 *    (gold / gold-light / gold-antique: 1.1–3.1:1 על champagne/sand/porcelain).
 * 4. כפתור WhatsApp הצף עובר גם מעל הרצועות הבהירות — טבעת הפוקוס שלו חייבת ≥3:1 גם שם.
 * getTreatments מדומה — נתוני בדיקה מומצאים בלבד.
 */
const getTreatmentsMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/treatments", () => ({ getTreatments: () => getTreatmentsMock() }));

import { Hero } from "@/components/landing/Hero";
import { TreatmentsSection } from "@/components/landing/TreatmentsSection";
import { BeforeAfterSection } from "@/components/landing/BeforeAfterSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { SectionDivider } from "@/components/landing/SectionDivider";
import { AboutSection } from "@/components/landing/AboutSection";
import { ContactFormSectionContainer } from "@/components/landing/ContactFormSectionContainer";
import { ContactInfoSection } from "@/components/landing/ContactInfoSection";
import { Footer } from "@/components/landing/Footer";
import { WhatsAppFloatingButton } from "@/components/landing/WhatsAppFloatingButton";
import { LandingMotion } from "@/components/landing/LandingMotion";
import { AccessibilityWidget } from "@/components/accessibility/AccessibilityWidget";

const ROOT = path.resolve(__dirname, "../../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const FAKE = [1, 2, 3].map((i) => ({
  id: `t${i}`,
  name: `טיפול בדיקה ${i}`,
  description: `תיאור ${i}`,
  price: 200 + i,
  durationMinutes: 30 * i,
  createdAt: new Date(0),
  updatedAt: new Date(0),
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

async function renderPageWithWidget() {
  getTreatmentsMock.mockResolvedValue(FAKE);
  const treatments = await TreatmentsSection();
  const form = await ContactFormSectionContainer();
  return render(
    <main dir="rtl" lang="he" className="flex min-h-screen w-full flex-col bg-ink text-champagne">
      <LandingMotion />
      <Hero />
      {treatments}
      <BeforeAfterSection />
      <TestimonialsSection />
      <SectionDivider />
      <AboutSection />
      {form}
      <ContactInfoSection />
      <Footer />
      <WhatsAppFloatingButton />
      <AccessibilityWidget />
    </main>,
  );
}

// WCAG relative luminance
const lin = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const lum = (h: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const tokens = read("styles/tokens.css");
const token = (name: string) => {
  const m = tokens.match(new RegExp(`--color-${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!m) throw new Error(`token ${name} not found`);
  return m[1];
};
const LIGHT_SURFACES = ["champagne", "sand", "porcelain"];

describe("2.21 (tester) — full page + accessibility widget, axe", () => {
  it("has no axe violations with the widget closed", async () => {
    const { container } = await renderPageWithWidget();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no axe violations with the widget panel open", async () => {
    const user = userEvent.setup();
    await renderPageWithWidget();
    await user.click(screen.getByRole("button", { name: "פתיחת תפריט נגישות" }));
    await screen.findByRole("dialog", { name: "התאמות נגישות" });
    expect(await axe(document.body)).toHaveNoViolations();
  });
});

describe("2.21 (tester) — light-band tokens beyond body text", () => {
  it("the treatments loading skeleton in app/page.tsx sits on the light band with light-surface text only", () => {
    const src = read("app/page.tsx");
    const fn = src.slice(src.indexOf("function TreatmentsSectionFallback"), src.indexOf("function ContactFormSectionFallback"));
    expect(fn).toMatch(/bg-champagne-wash/);
    expect(fn).not.toMatch(/text-(gold-pale|champagne-muted|champagne|gold|gold-light)(?=[\s"])/);
    // taupe על קצה ה-sand של השטיפה — 5.18:1
    expect(ratio(token("taupe"), token("sand"))).toBeGreaterThanOrEqual(4.5);
  });

  it("light bands never use light-gold borders/outlines/rings/icons (gold, gold-light, gold-antique < 3.2:1 there)", async () => {
    const { container } = await renderPageWithWidget();
    const bands = container.querySelectorAll('main > [data-band="light"]');
    expect(bands.length).toBeGreaterThanOrEqual(3);
    const bad = /(^|\s)(?:[a-z-]+:)*(?:border(?:-[setbxy])?|outline|ring|text|fill|stroke|divide)-(gold|gold-light|gold-antique)(?:\/\d+)?(?=\s|$)/;
    for (const band of bands) {
      band.querySelectorAll("[class]").forEach((el) => {
        expect(el.getAttribute("class") ?? "", `${band.id}: ${el.outerHTML.slice(0, 80)}`).not.toMatch(bad);
      });
    }
    // sanity: these tokens really fail on light surfaces, so the rule above matters
    for (const s of LIGHT_SURFACES) expect(ratio(token("gold"), token(s))).toBeLessThan(3);
  });

  it("the gold-dark testimonial rule is ≥3:1 on sand and gold-dark is never used on blush", () => {
    expect(ratio(token("gold-dark"), token("sand"))).toBeGreaterThanOrEqual(3); // 4.96
    for (const f of ["TreatmentsSection", "BeforeAfterSection", "TestimonialsSection", "AboutSection", "SectionDivider"]) {
      const code = read(`components/landing/${f}.tsx`);
      const blushEls = code.match(/className="[^"]*\bbg-blush\b[^"]*"/g) ?? [];
      blushEls.forEach((c) => expect(c).not.toMatch(/gold-dark/));
    }
  });
});

describe("2.21 (tester) — floating WhatsApp button over the new light bands", () => {
  it("its focus indicator reaches ≥3:1 against every light band it floats over (WCAG 1.4.11 / 2.4.7)", () => {
    render(<WhatsAppFloatingButton />);
    const link = screen.getByRole("link", { name: "צור קשר בוואטסאפ (בקרוב)" });
    const cls = (link.getAttribute("class") ?? "").split(/\s+/);
    const outline = cls.find((c) => /^focus-visible:outline-(gold|gold-light|gold-deep|gold-dark|ink|charcoal)$/.test(c));
    const ring = cls.find((c) => /^focus-visible:ring-(gold|gold-light|gold-deep|gold-dark|ink|charcoal)$/.test(c));
    const ringOffset = cls.find((c) => /^focus-visible:ring-offset-(ink|charcoal)$/.test(c));
    // צבע הפוקוס שנוגע ברקע הדף = השכבה החיצונית ביותר (גאומטריה, לא סדר עדיפויות):
    // ring משתרע עד ringOffsetW + ringW; outline משתרע עד outlineOffset + outlineW.
    const num = (re: RegExp, dflt: number) => {
      const c = cls.find((x) => re.test(x));
      return c ? Number(c.match(re)![1]) : dflt;
    };
    const ringW = ring ? num(/^focus-visible:ring-(\d+)$/, 1) : 0;
    const ringOffW = ringOffset ? num(/^focus-visible:ring-offset-(\d+)$/, 0) : 0;
    const outlineW = outline ? num(/^focus-visible:outline-(\d+)$/, 1) : 0;
    const outlineOff = outline ? num(/^focus-visible:outline-offset-(\d+)$/, 0) : 0;
    const ringOuter = ringOffW + ringW;
    const outlineOuter = outlineOff + outlineW;
    const colourOf = (c: string | undefined) => (c ?? "").replace(/^focus-visible:(outline|ring|ring-offset)-/, "");
    let touching = "";
    if (outline && outlineOuter >= ringOuter) touching = colourOf(outline);
    else if (ring && ringW > 0) touching = colourOf(ring);
    else if (ringOffset) touching = colourOf(ringOffset);
    expect(touching, "no recognised focus colour").not.toBe("");
    // אם יש פער בין ה-outline לשכבות ה-ring, הרקע של הדף נראה בפער — ה-outline לבדו נוגע ברקע משני צדדיו
    if (outline && outlineOff > ringOuter) expect(outlineOff, "gap between ring and outline").toBeLessThanOrEqual(ringOuter);
    for (const s of LIGHT_SURFACES) {
      expect(ratio(token(touching), token(s)), `focus ${touching} on ${s}`).toBeGreaterThanOrEqual(3);
    }
  });
});
