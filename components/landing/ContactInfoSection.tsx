/**
 * סקשן "פרטי קשר" בדף הנחיתה (משימה 2.8).
 * תוכן סטטי לדוגמה בלבד (כתובת, שעות פעילות, קישורי רשתות חברתיות) —
 * אינו מייצג כתובת/שעות/קישורים אמיתיים, יש להחליף בפרטים אמיתיים לפני פרודקשן.
 */

import type { SVGProps } from "react";
import { Clock, MapPin } from "lucide-react";

/**
 * אייקוני רשתות חברתיות (Instagram/Facebook) כ-SVG מוטבע,
 * מכיוון שגרסת lucide-react בפרויקט אינה כוללת אייקוני מותג.
 */
function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M13.5 21v-7.5h2.5l.5-3h-3V8.5c0-.87.24-1.46 1.49-1.46H16.5V4.36A20 20 0 0 0 14.26 4.25c-2.21 0-3.73 1.35-3.73 3.83V10.5H8v3h2.53V21h2.97Z" />
    </svg>
  );
}

const OPENING_HOURS = [
  { label: "ראשון - חמישי", hours: "09:00 - 20:00" },
  { label: "שישי", hours: "09:00 - 14:00" },
  { label: "שבת", hours: "סגור" },
];

const SOCIAL_LINKS = [
  {
    id: "instagram",
    label: "אינסטגרם",
    href: "https://instagram.com/majida.beaute",
    Icon: InstagramIcon,
  },
  {
    id: "facebook",
    label: "פייסבוק",
    href: "https://facebook.com/majida.beaute",
    Icon: FacebookIcon,
  },
];

/**
 * משימה 2.14 — יישום כיוון העיצוב "אטלייה נואר ושמפניה" (2.11):
 * - פתיחת רצועת הסגירה הכהה (ink), המתמזגת ב-Footer (bg-ink-glow-close). קו שיער עליון
 *   מפריד מסקשן הטופס שמעליו (גם הוא ink).
 * - במקום שלושה כרטיסים זהים ("SaaS-card kit"): "כרטיס ביקור" של אטלייה — שלוש עמודות
 *   המופרדות בקווי שיער בלבד (border-t, כמו תפריט הטיפולים), כותרת h3 בסריף gold-pale
 *   עם אייקון זהב קטן בצד ההתחלה, תוכן ב-champagne-muted. מיושר ל-start כמו שאר הסקשנים.
 * - שעות הפעילות כטבלת "יום ← שעות" מיושרת (תווית ב-start, שעות ב-end, ספרות tabular);
 *   התוכן הטקסטואלי זהה (כולל ":" אחרי היום).
 * - קישורי הרשתות: 44×44px (יעד מגע), hover/focus ב-180ms ease-luxe; ink על gold 9.00:1.
 * - מאפייני data-contact* הם עוגנים יציבים לאנימציה ב-2.16 (אין אנימציה כאן).
 *
 * משימה 2.21 — קצב רצועות: הטופס שמעל הוא ink, ולכן פרטי הקשר עוברים ל-ink-raised (אין שתי
 * רצועות סמוכות באותו גוון), וה-Footer שמתחת חוזר ל-ink עם הילת הסגירה. ניגודיות על ink-raised:
 * gold-pale 15.46, champagne-muted 8.56, gold (אייקונים) 8.50, טבעת פוקוס gold-light 12.69;
 * ink על gold (hover רשתות) 9.00 — ללא שינוי.
 */
export function ContactInfoSection() {
  return (
    <section
      id="contact-info"
      data-contact
      data-band="dark"
      data-band-tone="ink-raised"
      className="w-full border-t border-hairline-dark bg-ink-raised px-gutter py-section"
      aria-labelledby="contact-info-heading"
    >
      <div className="mx-auto flex w-full max-w-landing flex-col gap-stack">
        <header data-section-heading className="flex flex-col items-start gap-6">
          <h2
            id="contact-info-heading"
            className="measure-heading font-heading text-h2 font-medium text-gold-pale"
          >
            פרטי קשר
          </h2>
          <span aria-hidden="true" className="rule-gilded" />
        </header>

        {/* ניגודיות על ink-raised: gold-pale 15.46, champagne-muted 8.56, gold (אייקונים) 8.50 */}
        <div className="grid w-full grid-cols-1 gap-x-grid md:grid-cols-3">
          <div
            data-contact-item
            className="flex min-w-0 flex-col gap-4 border-t border-hairline-dark py-8"
          >
            <h3 className="flex items-center gap-3 font-heading text-h3 font-bold text-gold-pale">
              <MapPin aria-hidden="true" className="size-5 shrink-0 text-gold" />
              כתובת
            </h3>
            <p className="text-body text-champagne-muted">
              רחוב הדוגמה 12, תל אביב (כתובת לדוגמה)
            </p>
          </div>

          <div
            data-contact-item
            className="flex min-w-0 flex-col gap-4 border-t border-hairline-dark py-8"
          >
            <h3 className="flex items-center gap-3 font-heading text-h3 font-bold text-gold-pale">
              <Clock aria-hidden="true" className="size-5 shrink-0 text-gold" />
              שעות פעילות
            </h3>
            <ul className="flex flex-col text-body text-champagne-muted">
              {OPENING_HOURS.map((item) => (
                <li
                  key={item.label}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-hairline-dark py-2 last:border-b-0"
                >
                  <span>{item.label}:</span> <span className="tabular-nums">{item.hours}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            data-contact-item
            className="flex min-w-0 flex-col gap-4 border-t border-hairline-dark py-8"
          >
            <h3 className="font-heading text-h3 font-bold text-gold-pale">
              עקבו אחרינו
            </h3>
            <div className="flex items-center gap-3">
              {SOCIAL_LINKS.map(({ id, label, href, Icon }) => (
                <a
                  key={id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className="flex size-11 items-center justify-center rounded-full border border-hairline-dark text-gold transition-colors duration-(--duration-quick) ease-luxe hover:border-gold hover:bg-gold hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
                >
                  <Icon aria-hidden="true" className="size-5" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ContactInfoSection;
