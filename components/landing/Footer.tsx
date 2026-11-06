/**
 * Footer של דף הנחיתה (משימה 2.8).
 * קישורי placeholder בלבד למדיניות פרטיות, הצהרת נגישות ותקנון —
 * העמודים /privacy ו-/terms טרם נוצרו; /accessibility (הצהרת נגישות) נוצר במשימה 2.18.
 */

import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

const LEGAL_LINKS = [
  { href: "/privacy", label: "מדיניות פרטיות" },
  { href: "/accessibility", label: "הצהרת נגישות" },
  { href: "/terms", label: "תקנון" },
];

/**
 * שנה קבועה (לא `new Date()`) כדי לשמור על יכולת Prerendering סטטי של העמוד
 * (Next.js Cache Components חוסם ערכים לא-יציבים כמו הזמן הנוכחי בזמן build).
 * יש לעדכן ידנית מדי שנה, או להחליף בעתיד ל-`"use cache"`/רינדור בצד לקוח.
 */
const CURRENT_YEAR = 2026;

/**
 * משימה 2.14 — יישום כיוון העיצוב "אטלייה נואר ושמפניה" (2.11):
 * - סגירת הדף כתמונת-מראה של ה-Hero: רקע bg-ink-glow-close (אור זהוב עולה מהתחתית),
 *   כך שהדף נפתח ונסגר באותו אור. זה ה"רגע" היחיד של ה-Footer — שאר הרכיב שקט.
 * - קומפוזיציה ממורכזת בכוונה (חותם/סיגנט), בניגוד לסקשנים המיושרים ל-start:
 *   סמל הלוגו → קו מוזהב → קישורים משפטיים → זכויות יוצרים.
 * - קישורים: יעד מגע ≥44px (min-h-11), champagne-muted → gold-pale ב-hover.
 * - "© שנה MAJIDA Beauté Center" עטוף ב-<bdi> כדי שהרצף הלטיני לא יתערבב עם הנקודה והעברית.
 * - ניגודיות בשיא ההילה (המקרה הגרוע): champagne-muted 7.69, gold-pale 13.89, gold-light 11.41.
 * - data-footer הוא עוגן יציב ל-2.16 (אין אנימציה כאן).
 * - ריפוד block-end מוגדל מתחת ל-sm (6rem + safe-area): כפתור ה-WhatsApp הצף (56px + היסט 20px)
 *   לא יסתיר את שורת זכויות היוצרים בגלילה מלאה (ui-ux-pro-max: fixed-element-offset, safe-area-awareness).
 *   מ-sm ומעלה — pbe-section-tight כמו קודם.
 */
export function Footer() {
  return (
    <footer
      data-footer
      data-band="dark"
      data-band-tone="ink"
      className="w-full border-t border-hairline-dark bg-ink-glow-close px-gutter pt-section-tight pbe-[calc(6rem+env(safe-area-inset-bottom,0px))] sm:pbe-section-tight"
    >
      <div className="mx-auto flex w-full max-w-landing flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <Logo variant="transparent" asIcon size={72} />
          <span aria-hidden="true" className="rule-gilded" />
        </div>

        <nav aria-label="קישורים משפטיים">
          <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-1 text-body text-champagne-muted">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-11 items-center px-1 transition-colors duration-(--duration-quick) ease-luxe hover:text-gold-pale focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className="text-caption text-champagne-muted">
          <bdi>© {CURRENT_YEAR} MAJIDA Beauté Center</bdi>. כל הזכויות שמורות.
        </p>
      </div>
    </footer>
  );
}

export default Footer;
