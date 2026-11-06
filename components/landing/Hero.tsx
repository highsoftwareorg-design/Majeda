import Image from "next/image";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { HERO_CONTENT, HERO_IMAGE } from "@/lib/landing/hero-content";

/**
 * אזור הפתיחה (Hero) של דף הנחיתה.
 * משימה 2.1: רקע כהה ולוגו מלא בגודל מינימלי 120px.
 * משימה 2.2: כותרת, משפט הבטחה וכפתור CTA "לקביעת תור".
 * כפתור ה-WhatsApp הצף ממומש ברכיב נפרד (WhatsAppFloatingButton) ומוצג ברמת העמוד.
 *
 * משימה 2.12 — יישום כיוון העיצוב "אטלייה נואר ושמפניה" (2.11):
 * - הלוגו מוצג בתוך מסגרת הקשת (frame-arch) — מוטיב החתימה של הדף, כ"מראת אטלייה".
 *   מילוי הקשת הוא ink, זהה לרקע הגרפי של קובץ הלוגו המלא, כך שהריבוע של ה-SVG
 *   נבלע בקשת ונראה כדיוקן בתוך המראה.
 * - נייד: עמודה אחת ממורכזת (קשת → כותרת → קו מוזהב → הבטחה → CTA).
 *   דסקטופ (lg): קומפוזיציה א-סימטרית בשתי עמודות — הטקסט בצד ההתחלה (ימין ב-RTL)
 *   ומיושר ל-start, הקשת בצד הסיום. כל הריווחים logical/סימטריים.
 * - כותרת text-display במשקל 500 (לא 700) בגוון gold-pale; הזהב המלא שמור לקו, ל-CTA וללוגו.
 *
 * משימה 2.20 — Hero שיווקי עם תמונה:
 * - ה-h1 הוא כותרת שיווקית (HERO_CONTENT — ניתן לעריכה ע״י הקליניקה); שם המותג נישא ע"י alt הלוגו.
 * - תמונת אווירה מלאה (full-bleed) מאחורי הקומפוזיציה, ממקור הנתונים של 2.19. "המראה" (הקשת
 *   עם הלוגו) תלויה עכשיו בתוך חדר אמיתי במקום על מסך שחור. התמונה היא אלמנט ה-LCP ולכן
 *   היא — ולא הלוגו — מקבלת priority + fetchPriority="high".
 * - scrim מטוקנים בלבד (bg-scrim-hero, styles/tokens.css): רצפה אחידה של ink 68% שמבטיחה
 *   ניגודיות בכל מיקום טקסט + ויניטה סימטרית לעומק. במצב ניגודיות גבוהה התמונה והוויניטה
 *   מוסתרות (tokens.css) והרקע חוזר ל-ink אחיד.
 * - [data-hero-image] הוא מכל overflow:hidden לתמונה — 2.22 יוסיף parallax על ה-img הפנימי
 *   בלי ליצור גלילה אופקית. התמונה והוויניטה נמצאות אחרי התוכן ב-DOM (קורא מסך פוגש קודם את הכותרת),
 *   וממוקמות מאחוריו ב-z-index בתוך ה-isolate של הסקשן.
 *
 * משימה 2.21 — טבעת הפוקוס של ה-CTA (WCAG 1.4.11/2.4.7): הייתה gold-light/60, כלומר 2.79:1 מול
 * ה-scrim במקרה הגרוע (אפור 89/89/89 — ink 68% על לבן). עכשיו טבעת אטומה כפולה: offset של 2px ב-ink (ink מול כפתור
 * ה-gold 9.00:1, מפריד את הטבעת מהכפתור) ומעליו 3px gold-light (מול ה-scrim הגרוע 4.79:1, מול ה-ink 13.45:1).
 * ה-scrim עצמו (68%) לא שונה.
 *
 * מאפייני data-hero-* הם נקודות עיגון יציבות לאנימציית הכניסה המתוזמרת של 2.16,
 * הממומשת ב-LandingMotion.tsx (הרכיב הזה נשאר Server Component ללא קוד אנימציה).
 */
/*
 * משימה 2.22: בתוך [data-hero-image] יש שכבה פנימית [data-landing-parallax] (absolute inset-0)
 * שעליה LandingMotion מפעיל scale-on-scroll עדין. ה-timeline של 2.16 נוגע רק ב-[data-hero-media]
 * ובטקסט — אלמנטים שונים, ולכן אין התנגשות transform.
 */
export function Hero() {
  return (
    <section
      data-hero
      data-band="dark"
      data-band-tone="ink"
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[85svh] w-full items-center overflow-hidden border-b border-hairline-dark bg-ink-glow px-gutter py-section"
    >
      <div className="mx-auto grid w-full max-w-landing items-center justify-items-center gap-stack lg:grid-cols-[1.15fr_0.85fr] lg:gap-grid">
        {/* מסגרת הקשת — מוטיב החתימה. בדסקטופ עוברת לצד הסיום (שמאל ב-RTL). */}
        <div
          data-hero-media
          className="frame-arch frame-hairline-dark flex w-64 items-center justify-center bg-ink shadow-glow sm:w-72 lg:order-last lg:w-full lg:max-w-sm"
        >
          {/* The SVG artwork fills only ~60% of its square canvas; scale up, frame-arch clips the matching ink margin */}
          <Logo variant="full" size={384} fluid priority={false} className="scale-[1.4]" />
        </div>

        <div
          data-hero-copy
          className="flex flex-col items-center gap-6 text-center lg:items-start lg:justify-self-stretch lg:text-start"
        >
          <h1
            id="hero-title"
            data-hero-title
            className="measure-heading font-heading text-display font-medium text-gold-pale"
          >
            {HERO_CONTENT.title}
          </h1>
          <span data-hero-rule aria-hidden="true" className="rule-gilded" />
          <p
            data-hero-promise
            className="measure-prose text-lead text-champagne"
          >
            {HERO_CONTENT.promise}
          </p>
          <Button
            asChild
            size="lg"
            data-hero-cta
            className="mt-2 h-12 min-w-44 bg-gold px-8 text-ink shadow-glow duration-(--duration-quick) ease-luxe hover:bg-gold-light focus-visible:ring-3 focus-visible:ring-gold-light focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            <a href={HERO_CONTENT.ctaHref}>
              {/* גודל הגופן על span פנימי: cn מפרש text-body כצבע ומוחק את text-ink אם שניהם באותו className */}
              <span className="text-body font-semibold">{HERO_CONTENT.ctaLabel}</span>
            </a>
          </Button>
        </div>
      </div>

      {/* תמונת האווירה — מכל overflow:hidden (עוגן ל-parallax של 2.22) */}
      <div data-hero-image data-landing-image="hero" className="absolute inset-0 -z-20 overflow-hidden">
        {/* 2.22: שכבת ה-parallax (scale-on-scroll) — GSAP מזיז רק אותה, לא את ה-img ולא את עוגני ה-timeline */}
        <div data-landing-parallax className="absolute inset-0">
          <Image
            src={HERO_IMAGE.src}
            alt={HERO_IMAGE.alt}
            fill
            priority
            fetchPriority="high"
            sizes="100vw"
            className="object-cover"
          />
        </div>
      </div>
      {/* scrim — שכבות ink מטוקנים (ראו --gradient-scrim-hero) */}
      <div data-hero-scrim aria-hidden="true" className="absolute inset-0 -z-10 bg-scrim-hero" />
    </section>
  );
}

export default Hero;
