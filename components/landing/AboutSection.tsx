import Image from "next/image";
import { SECTION_IMAGES } from "@/lib/landing/section-images";

/**
 * סקשן "אודות המרפאה והצוות" בדף הנחיתה (משימה 2.5).
 * טקסט סטטי לדוגמה בלבד (אין חיבור למסד נתונים/CMS בשלב זה) —
 * תוכן שיווקי להמחשה, אינו מייצג פרטי צוות אמיתיים.
 *
 * משימה 2.14 — יישום כיוון העיצוב "אטלייה נואר ושמפניה" (2.11):
 * - דיוקנאות הצוות במסגרת הקשת (frame-arch) — השימוש המיועד של מוטיב החתימה
 *   (placeholders של צוות). אין frame-zoom: אין כאן תמונה אמיתית, וה-hover נשמר לתמונות.
 * - במקום שלושה כרטיסים זהים: בנייד כל חברת צוות היא שורה (קשת קטנה + שם/תפקיד),
 *   מ-sm ומעלה — שלוש קשתות זו לצד זו.
 * - מאפייני data-about* הם עוגנים יציבים לאנימציה ב-2.16.
 *
 * משימה 2.21 — קצב רצועות + תמונת אווירה:
 * - רצועה בהירה (porcelain) — השלישית בדף. טקסט (WCAG): כותרת/גוף/שמות charcoal 16.94,
 *   תפקידים taupe 6.16. קווי שיער hairline-light. בניגודיות גבוהה porcelain→white:
 *   charcoal 17.36 (taupe→charcoal).
 * - תמונת אווירה של חדר הטיפולים (SECTION_IMAGES.about, ללא פנים) בעמודת הסיום, במסגרת
 *   **מלבנית** (rounded-frame, 4:5) ולא בקשת — כדי שלא תיקרא כ"דיוקן" ולא תשויך לשמות הצוות.
 *   התמונה מחוץ לרשימת הצוות ב-DOM ובפריסה.
 * - **אילוץ יושרה (חובה):** בחלק הצוות ([data-about-team]) אין תמונות כלל — רק placeholders
 *   aria-hidden (bg-placeholder-light) עד שיסופקו תמונות אמיתיות של הצוות. בדיקה אוטומטית אוכפת זאת.
 * - [data-landing-image] הוא מכל overflow:hidden — עוגן ל-parallax/clip של 2.22.
 */

const TEAM_MEMBERS = [
  {
    id: 1,
    name: "מג'ידה כהן",
    role: "מייסדת ומטפלת ראשית",
  },
  {
    id: 2,
    name: "נור חדאד",
    role: "קוסמטיקאית רפואית",
  },
  {
    id: 3,
    name: "יעל אברהם",
    role: "מטפלת הסרת שיער ופנים",
  },
];

export function AboutSection() {
  return (
    <section
      id="about"
      data-about
      data-band="light"
      data-band-tone="porcelain"
      className="w-full bg-porcelain px-gutter py-section"
      aria-labelledby="about-heading"
    >
      <div className="mx-auto grid w-full max-w-landing grid-cols-1 gap-stack lg:grid-cols-[7fr_5fr] lg:items-center lg:gap-x-grid">
        <div data-about-copy className="flex min-w-0 flex-col items-start gap-6 lg:col-start-1 lg:row-start-1">
          <header data-section-heading className="flex flex-col items-start gap-6">
            <h2
              id="about-heading"
              className="measure-heading font-heading text-h2 font-medium text-charcoal"
            >
              אודות המרפאה והצוות
            </h2>
            <span aria-hidden="true" className="rule-gilded" />
          </header>
          {/* charcoal על porcelain: 16.94:1 */}
          <p className="measure-prose text-lead text-charcoal">
            מג&apos;ידה Beauté Center היא מרפאת יופי וטיפוח בוטיקית, המשלבת מקצועיות,
            טכנולוגיה מתקדמת ויחס אישי חם. הצוות שלנו מלווה כל לקוחה לאורך המסע שלה —
            מהייעוץ הראשוני ועד לתוצאות הרצויות — תוך שמירה על סטנדרטים גבוהים של
            בטיחות, היגיינה ושירות.
          </p>
        </div>

        {/* תמונת האווירה — בעמודת הסיום (שמאל ב-RTL) לאורך שתי השורות בדסקטופ; lazy */}
        <div
          data-landing-image="about"
          className="frame-zoom frame-hairline-light relative aspect-portrait w-full overflow-hidden rounded-frame bg-sand sm:max-w-md lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-w-none"
        >
          {/* 2.22: שכבת parallax פנימית — frame-zoom ממשיך לפעול על ה-img עצמו (אין התנגשות transform) */}
          <div data-landing-parallax className="absolute inset-0">
            <Image
              src={SECTION_IMAGES.about.src}
              alt={SECTION_IMAGES.about.alt}
              fill
              sizes="(min-width: 1280px) 460px, (min-width: 1024px) 40vw, (min-width: 640px) 448px, 100vw"
              className="object-cover"
            />
          </div>
        </div>

        <ul
          data-about-team
          className="grid w-full min-w-0 grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-grid lg:col-start-1 lg:row-start-2"
        >
          {TEAM_MEMBERS.map((member) => (
            <li
              key={member.id}
              data-about-member
              className="flex min-w-0 items-center gap-6 sm:flex-col sm:items-stretch sm:gap-5"
            >
              {/* gap-6/sm:gap-5 (20–24px) > פעמיים frame-offset — קו השיער לא נוגע בטקסט */}
              <div
                aria-hidden="true"
                data-about-portrait
                data-placeholder
                className="frame-arch frame-hairline-light w-24 shrink-0 bg-placeholder-light sm:w-full"
              />
              <div className="flex min-w-0 flex-col gap-1 sm:text-center">
                {/* charcoal על porcelain: 16.94:1; taupe: 6.16:1 */}
                <h3 className="font-heading text-h3 font-bold text-charcoal">
                  {member.name}
                </h3>
                <p className="text-caption text-taupe">{member.role}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default AboutSection;
