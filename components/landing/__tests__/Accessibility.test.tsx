import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";

// 2.17: רכיבי ה-Server שתלויים ב-DB נבדקים עם getTreatments מדומה (נתוני בדיקה מומצאים בלבד).
const FAKE_TREATMENTS = vi.hoisted(() =>
  ["א", "ב", "ג"].map((suffix, i) => ({
    id: `t${i + 1}`,
    name: `טיפול בדיקה ${suffix}`,
    description: i === 1 ? null : `תיאור ${suffix}`,
    price: 250 + i * 50,
    durationMinutes: 45 + i * 15,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  })),
);
vi.mock("@/lib/db/treatments", () => ({
  getTreatments: async () => FAKE_TREATMENTS,
}));

import { Hero } from "@/components/landing/Hero";
import { TreatmentsSection } from "@/components/landing/TreatmentsSection";
import { ContactFormSectionContainer } from "@/components/landing/ContactFormSectionContainer";
import { LandingMotion } from "@/components/landing/LandingMotion";
import { BeforeAfterSection } from "@/components/landing/BeforeAfterSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { AboutSection } from "@/components/landing/AboutSection";
import { SectionDivider } from "@/components/landing/SectionDivider";
import { ContactFormSection } from "@/components/landing/ContactFormSection";
import { ContactInfoSection } from "@/components/landing/ContactInfoSection";
import { Footer } from "@/components/landing/Footer";
import { WhatsAppFloatingButton } from "@/components/landing/WhatsAppFloatingButton";

/**
 * בדיקת נגישות בסיסית (משימה 2.10, FR-LP-08) — מריצה axe-core על כל אחד
 * מרכיבי דף הנחיתה שניתנים לרינדור ישיר ב-jsdom (ללא רכיבי Server
 * שתלויים ב-DB, כמו TreatmentsSection/ContactFormSectionContainer — אלו
 * עוטפים את ContactFormSection/כרטיסי טיפול שכבר נבדקים כאן בנפרד או
 * במבחנים ייעודיים אחרים).
 *
 * הבדיקה מאתרת הפרות נגישות מבניות (תוויות טופס חסרות, alt חסר, שימוש
 * שגוי בתפקידי ARIA, כפילות מזהים וכו׳). בדיקת ניגודיות צבעים אמיתית
 * (color-contrast) אינה אמינה ב-jsdom (אין רינדור CSS אמיתי של Tailwind),
 * ולכן בוצעה בנפרד כחישוב ידני מול ה-tokens המוגדרים (ראו סיכום המשימה) —
 * זהו תחליף סביר בשלב זה, לא תביעה לעמידה מלאה ב-WCAG/ת"י 5568.
 */
describe("Landing page accessibility (axe)", () => {
  it("Hero has no accessibility violations", async () => {
    const { container } = render(<Hero />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("BeforeAfterSection has no accessibility violations", async () => {
    const { container } = render(<BeforeAfterSection />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("TestimonialsSection has no accessibility violations", async () => {
    const { container } = render(<TestimonialsSection />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("AboutSection has no accessibility violations", async () => {
    const { container } = render(<AboutSection />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("ContactFormSection has no accessibility violations", async () => {
    const { container } = render(
      <ContactFormSection
        treatments={[{ id: "1", name: "טיפול פנים" }]}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("ContactInfoSection has no accessibility violations", async () => {
    const { container } = render(<ContactInfoSection />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Footer has no accessibility violations", async () => {
    const { container } = render(<Footer />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("SectionDivider (2.21) has no accessibility violations", async () => {
    const { container } = render(<SectionDivider />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("WhatsAppFloatingButton has no accessibility violations", async () => {
    const { container } = render(<WhatsAppFloatingButton />);
    expect(await axe(container)).toHaveNoViolations();
  });

  // ---- 2.17: רגרסיה אחרי 2.11–2.16 ----

  it("TreatmentsSection (mocked getTreatments) has no accessibility violations", async () => {
    const ui = await TreatmentsSection();
    const { container } = render(<>{ui}</>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("ContactFormSectionContainer (mocked getTreatments) has no accessibility violations", async () => {
    const ui = await ContactFormSectionContainer();
    const { container } = render(<>{ui}</>);
    expect(await axe(container)).toHaveNoViolations();
  });
});

/**
 * 2.17 — הדף המלא כפי שהוא מורכב ב-app/page.tsx (הסקשנים ה-async נפתרים מראש, כי
 * jsdom/React בצד לקוח לא מרנדר Server Components אסינכרוניים בתוך Suspense).
 * תופס בעיות שלא נראות ברכיב בודד: מזהים כפולים בין סקשנים, סדר כותרות, landmarks.
 */
async function renderLandingPage() {
  const treatments = await TreatmentsSection();
  const contactForm = await ContactFormSectionContainer();
  return render(
    <main dir="rtl" className="flex min-h-screen w-full flex-col bg-ink text-champagne">
      <LandingMotion />
      <Hero />
      {treatments}
      <BeforeAfterSection />
      <TestimonialsSection />
      <SectionDivider />
      <AboutSection />
      {contactForm}
      <ContactInfoSection />
      <Footer />
      <WhatsAppFloatingButton />
    </main>,
  );
}

describe("Landing page composition — accessibility + RTL regression (2.17)", () => {
  it("the full page has no accessibility violations", async () => {
    const { container } = await renderLandingPage();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has unique ids, and the Hero CTA target #booking exists exactly once inside the contact form section", async () => {
    const { container } = await renderLandingPage();
    const ids = Array.from(container.querySelectorAll("[id]")).map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);

    const cta = container.querySelector('a[href="#booking"]');
    expect(cta).not.toBeNull();
    const targets = container.querySelectorAll("#booking");
    expect(targets).toHaveLength(1);

    // ה-id הקיים של הסקשן וה-aria-labelledby לא שונו
    const section = container.querySelector("section#contact-form");
    expect(section).not.toBeNull();
    expect(section).toContainElement(targets[0] as HTMLElement);
    expect(section).toHaveAttribute("aria-labelledby", "contact-form-heading");
    expect(targets[0]).toContainElement(container.querySelector("#contact-form-heading") as HTMLElement);
    expect(targets[0].className).toMatch(/(^|\s)scroll-mbs-/);
  });

  it("stays RTL: the root is dir=rtl and only the phone input opts into LTR", async () => {
    const { container } = await renderLandingPage();
    expect(container.querySelector("main")).toHaveAttribute("dir", "rtl");
    const ltr = Array.from(container.querySelectorAll('[dir="ltr"]'));
    expect(ltr).toHaveLength(1);
    expect(ltr[0]).toHaveAttribute("type", "tel");
  });

  it("uses logical inline classes only — no physical left/right or LTR-flipping order hacks", async () => {
    const { container } = await renderLandingPage();
    const physical =
      /(^|\s)(?:[a-z0-9-]+:)*-?(?:ml|mr|pl|pr|left|right|text-left|text-right|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|float-left|float-right|scroll-ml|scroll-mr)(?:-|$|\s)/;
    // היפוך כיוון ידני (שבור ב-RTL אוטומטי). `order-*` מותר: הוא לוגי (לא תלוי כיוון) —
    // ב-Hero `lg:order-last` מציב את הקשת בקצה ה-inline-end בדסקטופ (שמאל ב-RTL) בכוונה.
    const flipping = /(^|\s)(?:[a-z0-9-]+:)*(?:flex-row-reverse|flex-col-reverse|space-x-reverse|rtl:|ltr:)/;
    container.querySelectorAll("[class]").forEach((el) => {
      const cls = el.getAttribute("class") ?? "";
      expect(cls, el.outerHTML.slice(0, 100)).not.toMatch(physical);
      expect(cls, el.outerHTML.slice(0, 100)).not.toMatch(flipping);
    });
  });
});
