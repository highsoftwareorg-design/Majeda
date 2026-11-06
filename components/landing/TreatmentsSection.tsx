import Image from "next/image";
import { getTreatments } from "@/lib/db/treatments";
import { SECTION_IMAGES } from "@/lib/landing/section-images";

/**
 * פורמט תצוגה למשך טיפול בדקות, לדוגמה: "45 דקות" / "שעה ו-30 דקות".
 */
function formatDuration(durationMinutes: number): string {
  if (durationMinutes < 60) {
    return `${durationMinutes} דקות`;
  }
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  const hoursLabel = hours === 1 ? "שעה" : `${hours} שעות`;
  if (minutes === 0) {
    return hoursLabel;
  }
  return `${hoursLabel} ו-${minutes} דקות`;
}

/**
 * סקשן "הטיפולים" בדף הנחיתה (משימה 2.3).
 * Server Component ששולף את רשימת הטיפולים ישירות מטבלת Treatment
 * (ללא מערך דמה כפול בקוד) — אותו מקור נתונים המשמש גם ביומן/שלבים הבאים.
 *
 * משימה 2.13 — יישום כיוון העיצוב "אטלייה נואר ושמפניה" (2.11):
 * - (2.13: רצועה כהה; הוחלף ב-2.21 — ראו למטה.)
 * - במקום ערכת כרטיסי shadcn זהים ("SaaS-card kit") — "תפריט טיפולים" של אטלייה:
 *   רשימה סמנטית (ul/li) המופרדת בקווי שיער בלבד, שם הטיפול בסריף (Frank Ruhl Libre)
 *   והמחיר בקצה השורה (inline-end) כמו בתפריט, תיאור ומשך בטקסט משני.
 * - אין hover על פריטי טקסט (hover שמור לתמונות בלבד, 2.11).
 * - מאפייני data-treatments* הם עוגנים יציבים לאנימציית stagger ב-2.16 (ממומשת ב-LandingMotion.tsx, לא כאן).
 *
 * משימה 2.21 — קצב רצועות ותמונת אווירה:
 * - הרצועה הבהירה הראשונה אחרי ה-Hero הכהה: bg-champagne-wash (שמפניה→חול).
 *   טקסט (WCAG, מקרה גרוע = קצה החול): כותרות charcoal 16.09/14.25, מחיר gold-deep 8.50/7.52,
 *   תיאור/משך taupe 5.85/5.18. קווי הפרדה hairline-light (גרפיקה בלבד).
 * - תמונת אווירה אחת לסקשן כולו (SECTION_IMAGES.treatments, landscape 3:2 טבעי — ללא חיתוך),
 *   ליד הכותרת. אין טקסט על התמונה, ולכן אין צורך ב-scrim. הרשימה עדיין נשלפת רק מ-getTreatments().
 * - [data-landing-image] הוא מכל overflow:hidden — עוגן ל-parallax ולחשיפת ה-clip של 2.22.
 */
/*
 * משימה 2.22:
 * - בתוך [data-landing-image="treatments"] יש שכבה פנימית [data-landing-parallax] — עליה בלבד
 *   LandingMotion מפעיל parallax; ה-clip של החשיפה מוחל על המכל, frame-zoom על ה-img. שלושה
 *   אלמנטים שונים, ולכן אין התנגשות transform.
 * - hover-gilded-line (styles/tokens.css): קו gold-deep דק שנמתח מהמרכז מעל קו השיער של הפריט —
 *   עיטור בלבד, ללא שינוי צבע טקסט וללא סמן לחיצה (הפריט אינו פעולה ואינו ניתן למיקוד).
 */
export async function TreatmentsSection() {
  const treatments = await getTreatments();

  if (treatments.length === 0) {
    return null;
  }

  return (
    <section
      id="treatments"
      data-treatments
      data-band="light"
      data-band-tone="champagne"
      className="w-full bg-champagne-wash px-gutter py-section"
      aria-labelledby="treatments-heading"
    >
      <div className="mx-auto flex w-full max-w-landing flex-col gap-stack">
        <div className="grid w-full grid-cols-1 items-end gap-stack lg:grid-cols-[5fr_7fr] lg:gap-grid">
          <header data-section-heading className="flex flex-col items-start gap-6">
            <h2
              id="treatments-heading"
              className="measure-heading font-heading text-h2 font-medium text-charcoal"
            >
              הטיפולים שלנו
            </h2>
            <span aria-hidden="true" className="rule-gilded" />
          </header>

          {/* תמונת אווירה לסקשן כולו — lazy (רק ה-Hero מקבל priority) */}
          <div
            data-landing-image="treatments"
            className="frame-zoom frame-hairline-light relative aspect-landscape w-full overflow-hidden rounded-frame bg-sand"
          >
            {/* 2.22: שכבת parallax פנימית — frame-zoom ממשיך לפעול על ה-img עצמו (אין התנגשות transform) */}
            <div data-landing-parallax className="absolute inset-0">
              <Image
                src={SECTION_IMAGES.treatments.src}
                alt={SECTION_IMAGES.treatments.alt}
                fill
                sizes="(min-width: 1280px) 640px, (min-width: 1024px) 55vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>

        <ul
          data-treatments-list
          className="grid w-full grid-cols-1 gap-x-grid border-t border-hairline-light lg:grid-cols-2"
        >
          {treatments.map((treatment) => (
            <li
              key={treatment.id}
              data-treatment-item
              className="hover-gilded-line flex min-w-0 flex-col gap-3 border-b border-hairline-light py-8"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h3 className="min-w-0 font-heading text-h3 font-bold text-charcoal">
                  {treatment.name}
                </h3>
                {treatment.price != null && (
                  <p className="shrink-0 font-heading text-lead font-medium text-gold-deep">
                    החל מ-₪{treatment.price}
                  </p>
                )}
              </div>
              {treatment.description && (
                <p className="measure-prose text-body text-taupe">
                  {treatment.description}
                </p>
              )}
              <p className="text-caption text-taupe">
                משך הטיפול: {formatDuration(treatment.durationMinutes)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default TreatmentsSection;
