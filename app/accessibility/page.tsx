import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/landing/Footer";

/**
 * משימה 2.18 — הצהרת נגישות (מחליפה את הקישור שהוביל לעמוד שלא היה קיים מאז 2.8).
 *
 * תבנית בלבד: ההצהרה מתארת רק את מה שבוצע בפועל בפרויקט, מציינת את התקן כ*יעד* (לא כעמידה
 * מאושרת), ומסמנת בבירור את כל הפרטים שהקליניקה צריכה למלא. לפני פרסום בפרודקשן — סקירה
 * ואישור של יועץ/ת נגישות מורשה/ית (PLAN.md, Notes/Risks 2.18).
 *
 * עיצוב: רצועת כותרת כהה (bg-ink-glow, כמו ה-Hero) כ"רגע" היחיד; גוף ההצהרה על רקע בהיר
 * לקריאה רציפה (charcoal על champagne/porcelain 15+:1, charcoal על blush 13.05:1), measure-prose,
 * Server Component סטטי — ללא JS נוסף.
 */

export const metadata: Metadata = {
  title: "הצהרת נגישות",
  description: "הצהרת הנגישות של אתר MAJIDA Beauté Center: התאמות שבוצעו, מגבלות ידועות ודרכי פנייה.",
};

/** ערך שהקליניקה חייבת להשלים — מסומן חזותית ובטקסט. */
function ToFill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-sm bg-blush px-1.5 font-semibold text-charcoal" data-placeholder="">
      [למילוי ע״י הקליניקה: {children}]
    </span>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="font-heading text-h3 text-charcoal">
        {title}
      </h2>
      {children}
    </section>
  );
}

const ADJUSTMENTS = [
  "האתר כתוב בעברית ומוגדר כמסמך מימין לשמאל (lang=\"he\", dir=\"rtl\"), כך שקוראי מסך מקריאים אותו בשפה ובכיוון הנכונים.",
  "מבנה סמנטי: כותרות בהיררכיה, אזורי ניווט ותוכן מסומנים, וקישורים וכפתורים עם שמות נגישים בעברית.",
  "ניווט מלא במקלדת עם סימון פוקוס נראה לעין; אלמנט שמקבל פוקוס מוצג במלואו גם כשאנימציית הכניסה שלו טרם הסתיימה.",
  "ניגודיות צבעים: צירופי טקסט ורקע נבדקו בחישוב לפי נוסחת WCAG ועומדים על יחס של 4.5:1 לפחות לטקסט רגיל.",
  "טופס יצירת הקשר: לכל שדה תווית טקסט קבועה, ושדה הטלפון מציג מקלדת מספרים בנייד; הודעות שגיאה מקושרות לשדה הרלוונטי, והודעות שגיאה ואישור מוצגות כטקסט.",
  "תצוגה מותאמת לנייד ולטאבלט, ואזורי לחיצה בגודל 44 פיקסלים לפחות.",
  "אנימציות: כיבוד הגדרת \"הפחתת תנועה\" של מערכת ההפעלה, ואפשרות לעצור את כל האנימציות דרך תפריט הנגישות.",
  "תפריט נגישות פנימי (ללא תוסף חיצוני) הזמין בכל עמוד: הגדלה והקטנה של הטקסט, ניגודיות גבוהה, גווני אפור, הדגשת קישורים, גופן קריא, עצירת אנימציות, סמן עכבר מוגדל ואיפוס. ההגדרות נשמרות בדפדפן בלבד.",
  "בדיקות נגישות אוטומטיות (axe-core) מורצות על רכיבי האתר כחלק מתהליך הפיתוח.",
];

const LIMITATIONS = [
  "האתר טרם עבר בדיקת נגישות מלאה על ידי מורשה/ית נגישות, וטרם נבדק באופן ידני מלא עם קוראי מסך שונים.",
  "חלק מהתמונות באתר (גלריית לפני/אחרי ודיוקנאות הצוות) הן עדיין תמונות זמניות מעוצבות, שיוחלפו בתמונות אמיתיות עם טקסט חלופי מתאים.",
  "כפתור הפנייה בוואטסאפ עדיין אינו פעיל; בינתיים ניתן לפנות בטלפון או בטופס יצירת הקשר.",
  "הפסקת האנימציות חלה מיד; ביטול ההפסקה ייכנס לתוקף רק לאחר רענון הדף.",
];

export default function AccessibilityStatementPage() {
  return (
    <>
      <main dir="rtl" className="flex w-full flex-1 flex-col bg-champagne text-charcoal">
        <header className="bg-ink-glow px-gutter py-section-tight text-champagne">
          <div className="mx-auto flex w-full max-w-landing flex-col gap-4">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-2 self-start text-body text-champagne-muted hover:text-gold-pale focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
            >
              {/* חץ "חזרה" מצביע ימינה ב-RTL */}
              <ArrowRight aria-hidden="true" className="size-4" />
              חזרה לעמוד הבית
            </Link>
            <h1 className="font-heading text-h2 text-gold-pale measure-heading">הצהרת נגישות</h1>
            <span aria-hidden="true" className="rule-gilded" />
            <p className="text-lead text-champagne-muted measure-prose">
              ב-<bdi>MAJIDA Beauté Center</bdi> אנו רואים חשיבות בכך שכל אחת ואחד יוכלו להשתמש באתר
              בנוחות. בעמוד זה מפורטות ההתאמות שבוצעו, המגבלות הידועות ודרכי הפנייה בנושא נגישות.
            </p>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-landing flex-col gap-stack px-gutter py-section-tight">
          <aside
            role="note"
            aria-label="סטטוס ההצהרה"
            className="measure-prose rounded-lg border border-gold-dark bg-porcelain p-5 text-body text-charcoal"
          >
            <p>
              <strong className="font-semibold">טיוטה:</strong> הצהרה זו היא תבנית ראשונית. היא טעונה
              סקירה ואישור של יועץ/ת נגישות מורשה/ית, והשלמת הפרטים המסומנים על ידי הקליניקה, לפני
              פרסום רשמי.
            </p>
          </aside>

          <div className="flex flex-col gap-stack measure-prose text-body">
            <Section id="standard" title="תקן ורמת הנגישות">
              <p>
                היעד שהצבנו לאתר הוא עמידה בדרישות התקן הישראלי ת״י 5568 ברמה AA, המבוסס על הנחיות
                הנגישות לתוכן אינטרנט (WCAG) של ארגון W3C, ובהנחיות <bdi>WCAG 2.1</bdi> ברמה AA,
                בהתאם לתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע״ג–2013.
              </p>
              <p>
                זהו יעד ולא אישור עמידה: האתר טרם נבדק על ידי מורשה/ית נגישות (ראו &quot;מגבלות
                ידועות&quot;).
              </p>
            </Section>

            <Section id="adjustments" title="התאמות הנגישות שבוצעו באתר">
              <ul className="flex list-disc flex-col gap-2 ps-5 marker:text-gold-dark">
                {ADJUSTMENTS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p>
                תפריט הנגישות הוא כלי עזר בלבד ואינו מחליף את הנגישות המובנית של האתר. האתר אינו
                משתמש בתוסף נגישות חיצוני.
              </p>
            </Section>

            <Section id="limitations" title="מגבלות ידועות">
              <ul className="flex list-disc flex-col gap-2 ps-5 marker:text-gold-dark">
                {LIMITATIONS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p>אנו ממשיכים לשפר את נגישות האתר, ונשמח לשמוע על כל קושי שנתקלתם בו.</p>
            </Section>

            <Section id="physical" title="הסדרי נגישות בקליניקה">
              <p>
                <ToFill>פירוט הסדרי הנגישות הפיזיים בקליניקה — חניה, כניסה, מעליות, שירותים וכדומה</ToFill>
              </p>
            </Section>

            <Section id="contact" title="פנייה בנושא נגישות">
              <p>
                נתקלתם בבעיית נגישות באתר או בקליניקה? נשמח שתפנו אלינו ונטפל בפנייה בהקדם. כדי
                שנוכל לטפל ביעילות, מומלץ לציין את העמוד שבו נתקלתם בבעיה, תיאור קצר שלה ואת סוג
                הדפדפן או הטכנולוגיה המסייעת שבה השתמשתם.
              </p>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border border-hairline-light bg-porcelain p-5 sm:grid-cols-[auto_1fr]">
                <dt className="font-semibold">רכז/ת הנגישות</dt>
                <dd>
                  <ToFill>שם מלא</ToFill>
                </dd>
                <dt className="font-semibold">טלפון</dt>
                <dd>
                  <ToFill>מספר טלפון</ToFill>
                </dd>
                <dt className="font-semibold">דוא״ל</dt>
                <dd>
                  <ToFill>כתובת דוא״ל</ToFill>
                </dd>
                <dt className="font-semibold">כתובת למשלוח דואר</dt>
                <dd>
                  <ToFill>כתובת הקליניקה</ToFill>
                </dd>
              </dl>
            </Section>

            <Section id="updated" title="עדכון ההצהרה">
              <p>
                תאריך הסקירה האחרונה של הצהרה זו: <ToFill>תאריך בפורמט DD/MM/YYYY</ToFill>
              </p>
            </Section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
