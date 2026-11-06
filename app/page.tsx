import type { Metadata } from "next";
import { Suspense } from "react";
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
import { LandingMotionSectionReady } from "@/components/landing/LandingMotionSectionReady";

/**
 * שלד טעינה לסקשן הטיפולים, מוצג בזמן ש-TreatmentsSection שולף נתונים מה-DB.
 * נדרש כדי לאפשר Prerendering של ה-shell הסטטי של העמוד (Next.js Cache Components).
 */
function TreatmentsSectionFallback() {
  return (
    <section
      dir="rtl"
      className="flex w-full flex-col items-center justify-center gap-4 bg-champagne-wash px-gutter py-section text-charcoal"
      aria-busy="true"
      aria-live="polite"
    >
      {/* משימה 2.21: אותה רצועה בהירה כמו הסקשן עצמו (taupe על champagne/sand 5.85/5.18) */}
      <p className="text-lead text-taupe">טוען טיפולים...</p>
    </section>
  );
}

/**
 * שלד טעינה לטופס השארת הפרטים, מוצג בזמן ש-ContactFormSectionContainer
 * שולף את רשימת הטיפולים מה-DB (נדרש כדי לאפשר Prerendering סטטי של העמוד).
 */
function ContactFormSectionFallback() {
  return (
    <section
      dir="rtl"
      className="flex w-full flex-col items-center justify-center gap-4 bg-ink px-gutter py-section text-champagne"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="text-lead text-champagne-muted">טוען טופס יצירת קשר...</p>
    </section>
  );
}

const PAGE_TITLE = "MAJIDA Beauté Center | יופי נצחי, בנגיעה אישית";
const PAGE_DESCRIPTION =
  "MAJIDA Beauté Center — מרפאת יופי וטיפולים אסתטיים. יופי נצחי, בנגיעה אישית. גלו את הטיפולים שלנו וקבעו תור עוד היום.";

/**
 * משימה 2.9 — SEO בסיסי לדף הנחיתה: title, meta description ותגיות Open Graph
 * (כולל og:image מבוסס קובץ הלוגו הקיים). מכסה: FR-LP-06.
 * ה-OG image מצביע על הלוגו הטרנספרנטי הקיים תחת public/brand — אין כרגע קובץ
 * תמונת-מותג ייעודית ליחס גובה-רוחב "ריבועי"/רשתות חברתיות; יש לשקול בעתיד
 * הוספת גרסה כזו (למשל 1200x630) אם יסופקו נכסי מותג נוספים.
 */
export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/",
    siteName: "MAJIDA Beauté Center",
    locale: "he_IL",
    type: "website",
    images: [
      {
        url: "/brand/majida_logo_transparent.svg",
        alt: "לוגו MAJIDA Beauté Center",
      },
    ],
  },
};

/**
 * דף הנחיתה הציבורי (/) — MAJIDA Beauté Center.
 * שלד סטטי בלבד (משימה 2.1): רקע כהה (bg-ink) לפי BR-02.
 * משימה 2.2: Hero כולל כותרת/CTA, וכפתור WhatsApp צף מוצג ברמת העמוד כולו.
 * משימה 2.21: קצב רצועות כהה/בהיר — Hero (ink) → טיפולים (champagne) → לפני/אחרי (ink-raised)
 * → המלצות (sand) → מפריד תמונה → אודות (porcelain) → טופס (ink) → פרטי קשר (ink-raised) → Footer (ink).
 * משימה 2.8: סקשן פרטי קשר (ContactInfoSection) ו-Footer עם קישורי placeholder
 * למדיניות פרטיות/נגישות/תקנון.
 *
 * כל שליפת נתונים מה-DB (TreatmentsSection, ContactFormSectionContainer)
 * עטופה ב-Suspense משלה, כנדרש כדי לאפשר Prerendering של ה-shell הסטטי
 * (Next.js Cache Components) — שתיהן משתמשות באותו מקור נתונים `getTreatments`.
 */
export default function Home() {
  return (
    <main dir="rtl" className="flex min-h-screen w-full flex-col bg-ink text-champagne">
      {/* משימה 2.16: מתזמר אנימציות (Client, span מוסתר יחיד; לא עוטף את הסקשנים) */}
      <LandingMotion />
      <Hero />
      <Suspense fallback={<TreatmentsSectionFallback />}>
        <LandingMotionSectionReady section="treatments">
          <TreatmentsSection />
        </LandingMotionSectionReady>
      </Suspense>
      <BeforeAfterSection />
      <TestimonialsSection />
      <SectionDivider />
      <AboutSection />
      <Suspense fallback={<ContactFormSectionFallback />}>
        <LandingMotionSectionReady section="contact-form">
          <ContactFormSectionContainer />
        </LandingMotionSectionReady>
      </Suspense>
      <ContactInfoSection />
      <Footer />
      <WhatsAppFloatingButton />
    </main>
  );
}
