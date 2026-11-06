/**
 * סקשן "המלצות" בדף הנחיתה (משימה 2.4).
 * ציטוטים סטטיים לדוגמה בלבד (אין חיבור למסד נתונים/CMS בשלב זה).
 *
 * משימה 2.13 — יישום כיוון העיצוב "אטלייה נואר ושמפניה" (2.11):
 * - המשך הרצועה הבהירה (bg-sand, ממשיך ללא תפר את סוף ה-champagne-wash של לפני/אחרי;
 *   לכן ריפוד עליון מצומצם pt-section-tight בתוך אותה רצועה).
 * - ציטוטים ללא "כרטיס" (בלי רקע/מסגרת/רדיוס): הציטוט עצמו בסריף (Frank Ruhl Libre,
 *   text-lead) בגוון charcoal, וקו אנכי דק בצד ההתחלה (border-s, ימין ב-RTL)
 *   בגוון gold-dark (4.96:1 על sand — עובר 3:1 לגרפיקה). שם הממליצה ב-gold-deep.
 * - מאפייני data-testimonial* הם עוגנים יציבים לאנימציית stagger ב-2.16.
 *
 * משימה 2.21 — קצב רצועות: לפני/אחרי שמעל הפך לרצועה כהה (ink-raised), ולכן ההמלצות הן
 * עכשיו רצועה בהירה עצמאית (sand) עם ריפוד מלא py-section. צמדי הטקסט לא השתנו
 * (charcoal 14.25, gold-deep 7.52, קו gold-dark 4.96 — גרפיקה).
 */

const TESTIMONIALS = [
  {
    id: 1,
    quote: "הצוות מקצועי ואכפתי, הרגשתי בידיים טובות מהרגע הראשון. התוצאות מדברות בעד עצמן!",
    name: "דנה כהן",
  },
  {
    id: 2,
    quote: "אווירה מפנקת וטיפול אישי אמיתי. אני ממליצה על מג'ידה לכל חברה שמחפשת יחס מקצועי.",
    name: "מיכל לוי",
  },
  {
    id: 3,
    quote: "סוף סוף מקום שבאמת מקשיב לצרכים שלי ומתאים את הטיפול בהתאם. תוצאות מעולות.",
    name: "רים עאסי",
  },
  {
    id: 4,
    quote: "חוויה מפנקת מההתחלה ועד הסוף, ותוצאות שרואים כבר אחרי הטיפול הראשון.",
    name: "שירה מזרחי",
  },
];

export function TestimonialsSection() {
  return (
    <section
      id="testimonials"
      data-testimonials
      data-band="light"
      data-band-tone="sand"
      className="w-full bg-sand px-gutter py-section"
      aria-labelledby="testimonials-heading"
    >
      <div className="mx-auto flex w-full max-w-landing flex-col gap-stack">
        <header data-section-heading className="flex flex-col items-start">
          <h2
            id="testimonials-heading"
            className="measure-heading font-heading text-h2 font-medium text-charcoal"
          >
            מה הלקוחות שלנו אומרות
          </h2>
        </header>
        <div className="grid w-full grid-cols-1 gap-x-grid gap-y-stack sm:grid-cols-2">
          {TESTIMONIALS.map((testimonial) => (
            <figure
              key={testimonial.id}
              data-testimonial-item
              className="flex min-w-0 flex-col gap-4 border-s border-gold-dark ps-6"
            >
              <blockquote className="measure-prose font-heading text-lead text-charcoal">
                &rdquo;{testimonial.quote}&rdquo;
              </blockquote>
              <figcaption className="text-caption font-semibold text-gold-deep">
                — {testimonial.name}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export default TestimonialsSection;
