/**
 * סקשן "לפני/אחרי" בדף הנחיתה (משימה 2.4).
 * גלריית Placeholder בלבד — אין תמונות אמיתיות בשלב זה, ולכן מוצגים
 * מקומות שמורים מעוצבים (ללא טעינת תמונות) שמסמנים "לפני"/"אחרי".
 *
 * משימה 2.13 — יישום כיוון העיצוב "אטלייה נואר ושמפניה" (2.11): כל זוג לפני/אחרי
 * מוצג כשתי "מראות" במסגרת הקשת (frame-arch) — מוטיב החתימה של הדף.
 *
 * משימה 2.21 — קצב רצועות + placeholder מכוון:
 * - **אילוץ יושרה (חובה):** אין כאן תמונות סטוק, בשום צורה. תוצאות לפני/אחרי יוצגו רק
 *   מתמונות אמיתיות של המרפאה. בדיקה אוטומטית מוודאת שאין <img> או נתיב /images/stock/.
 * - רצועה כהה (ink-raised) בין הטיפולים (בהיר) להמלצות (בהיר).
 * - הכיתוב הגלוי "בקרוב — תוצאות אמיתיות מהמרפאה" מסביר את הקשתות הריקות, כך שהן נקראות
 *   כמקום שמור ולא כתמונות שלא נטענו: "מראות" ריקות עם הילת זהב עדינה (bg-placeholder-dark)
 *   וקשת פנימית דקה (קו שיער שיורש את צורת הקשת). אין frame-zoom — hover שמור לתמונות בלבד.
 * - ניגודיות (WCAG): כותרת gold-pale על ink-raised 15.46; הכיתוב gold-light על ink-raised 12.69;
 *   פתיח champagne-muted 8.56; שם הטיפול gold-pale 15.46; התווית "לפני"/"אחרי" gold-pale
 *   על שיא ההילה (gold 18% בתוך ink-elevated, ≈ 64/56/36 ב-sRGB) 9.66, ועל ink-elevated 13.19.
 * - מאפייני data-before-after* הם עוגנים יציבים לאנימציית stagger ב-2.16.
 */

const PLACEHOLDER_ITEMS = [
  { id: 1, treatment: "טיפול פנים מחדש" },
  { id: 2, treatment: "הסרת שיער בלייזר" },
  { id: 3, treatment: "עיצוב גבות" },
];

/** הכיתוב הגלוי של הסקשן (2.21) — מוצא לקבוע כדי שהבדיקות יאמתו אותו ללא כפילות. */
export const BEFORE_AFTER_COMING_SOON = "בקרוב — תוצאות אמיתיות מהמרפאה";

function BeforeAfterPlaceholder({ label }: { label: "לפני" | "אחרי" }) {
  return (
    <div
      role="img"
      data-before-after-frame
      data-placeholder
      className="frame-arch frame-hairline-dark flex w-full items-end justify-center bg-placeholder-dark pb-5"
      aria-label={`${label}: מקום שמור לתמונה אמיתית מהמרפאה`}
    >
      {/* קשת פנימית דקה — "מראה" ריקה; rounded-[inherit] יורש את צורת הקשת */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-3 rounded-[inherit] border border-hairline-dark"
      />
      <span className="relative font-heading text-lead font-medium text-gold-pale">
        {label}
      </span>
    </div>
  );
}

export function BeforeAfterSection() {
  return (
    <section
      id="before-after"
      data-before-after
      data-band="dark"
      data-band-tone="ink-raised"
      className="w-full bg-ink-raised px-gutter py-section"
      aria-labelledby="before-after-heading"
    >
      <div className="mx-auto flex w-full max-w-landing flex-col gap-stack">
        <header data-section-heading className="flex flex-col items-start gap-4">
          <h2
            id="before-after-heading"
            className="measure-heading font-heading text-h2 font-medium text-gold-pale"
          >
            לפני ואחרי
          </h2>
          <span aria-hidden="true" className="rule-gilded" />
          <p
            data-before-after-caption
            className="measure-prose font-heading text-lead font-medium text-gold-light"
          >
            {BEFORE_AFTER_COMING_SOON}
          </p>
          <p className="measure-prose text-body text-champagne-muted">
            הגלריה תתעדכן בתמונות של מטופלות המרפאה, באישורן, ולא בתמונות להמחשה.
          </p>
        </header>
        <div className="grid w-full grid-cols-1 gap-x-grid gap-y-stack sm:grid-cols-2 lg:grid-cols-3">
          {PLACEHOLDER_ITEMS.map((item) => (
            <figure
              key={item.id}
              data-before-after-item
              className="flex min-w-0 flex-col gap-6"
            >
              {/* gap-5 (20px) > פעמיים frame-offset (8px) — קווי השיער של שתי הקשתות לא חופפים */}
              <div className="grid grid-cols-2 gap-5 px-2">
                <BeforeAfterPlaceholder label="לפני" />
                <BeforeAfterPlaceholder label="אחרי" />
              </div>
              <figcaption className="text-center font-heading text-h3 font-bold text-gold-pale">
                {item.treatment}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export default BeforeAfterSection;
