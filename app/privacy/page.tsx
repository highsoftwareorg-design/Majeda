import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/landing/Footer";

/**
 * מדיניות פרטיות (מחליף את קישור ה-placeholder שהוביל ל-/privacy מאז 2.8).
 *
 * תבנית בלבד. מבנה הסעיפים מבוסס על חובת היידוע שבסעיף 11 לחוק הגנת הפרטיות, התשמ״א–1981,
 * ועל הנחיות רשות הגנת הפרטיות (הסכמה מדעת, מפורשת וניתנת להוכחה; הסכמה נפרדת לשימוש משני),
 * בהשראת המדריך: https://schwebel-law.com/writing/website-terms-of-use-israel
 * סוגי המידע והמעבדים מתוארים לפי מה שהמערכת אוספת בפועל (פרטי קשר, היסטוריית טיפולים,
 * טופסי הסכמה מדעת וחתימות, הודעות וואטסאפ, אחסון מסמכים). אין בכך ייעוץ משפטי — לפני פרסום
 * חובה סקירה ואישור של עו״ד והשלמת הפרטים המסומנים על ידי הקליניקה.
 *
 * עיצוב: זהה להצהרת הנגישות ולתקנון.
 */

export const metadata: Metadata = {
  title: "מדיניות פרטיות",
  description:
    "מדיניות הפרטיות של MAJIDA Beauté Center: איזה מידע נאסף, כיצד נעשה בו שימוש, עם מי הוא משותף, אבטחה וזכויותייך.",
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

const DATA_COLLECTED = [
  "פרטי זיהוי וקשר: שם, מספר טלפון, כתובת דוא״ל וכל פרט שתמסרו בטופס יצירת הקשר או בעת קביעת תור.",
  "מידע על תורים וטיפולים: סוג הטיפול, מועדים, היסטוריית ביקורים והערות טיפול.",
  "מידע רגיש: טופסי הסכמה מדעת וחתימה דיגיטלית, וכן התראות/רגישויות רפואיות הנדרשות לטיפול בטוח. מידע זה נאסף בהסכמתכם ומטופל ברמת רגישות גבוהה.",
  "התכתבויות: תוכן הודעות וואטסאפ, SMS או דוא״ל שתחליפו עם הקליניקה בנוגע לתורים ולמעקב.",
  "מידע טכני בסיסי הנדרש לתפעול האתר ולאבטחתו.",
];

const PURPOSES = [
  "ניהול תורים, מתן השירות והמעקב הטיפולי.",
  "יצירת קשר בנוגע לתורים, תזכורות ומעקב לאחר טיפול.",
  "ניהול טופסי הסכמה מדעת ותיעודם כנדרש.",
  "שיווק ודיוור — רק בכפוף להסכמה נפרדת ומפורשת, הניתנת לביטול בכל עת.",
  "עמידה בחובות שבדין ושמירה על זכויות הקליניקה.",
];

export default function PrivacyPolicyPage() {
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
            <h1 className="font-heading text-h2 text-gold-pale measure-heading">מדיניות פרטיות</h1>
            <span aria-hidden="true" className="rule-gilded" />
            <p className="text-lead text-champagne-muted measure-prose">
              ב-<bdi>MAJIDA Beauté Center</bdi> אנו מכבדים את פרטיותכם ומחויבים להגן על המידע האישי
              שאתם מוסרים לנו. מדיניות זו מסבירה איזה מידע נאסף, כיצד אנו עושים בו שימוש, עם מי הוא
              משותף, וכיצד תוכלו לממש את זכויותיכם.
            </p>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-landing flex-col gap-stack px-gutter py-section-tight">
          <aside
            role="note"
            aria-label="סטטוס המדיניות"
            className="measure-prose rounded-lg border border-gold-dark bg-porcelain p-5 text-body text-charcoal"
          >
            <p>
              <strong className="font-semibold">טיוטה:</strong> מדיניות זו היא תבנית ראשונית ואינה
              מהווה ייעוץ משפטי. היא טעונה סקירה ואישור של עורך/ת דין, והשלמת הפרטים המסומנים על ידי
              הקליניקה, לפני פרסום רשמי.
            </p>
          </aside>

          <div className="flex flex-col gap-stack measure-prose text-body">
            <Section id="controller" title="1. מי אחראי למידע">
              <p>
                האחראית על המידע היא <ToFill>שם הקליניקה / העוסק המורשה או החברה</ToFill>, מספר
                עוסק/ח.פ. <ToFill>מספר</ToFill>, מכתובת <ToFill>כתובת הקליניקה</ToFill>. לפניות בנושא
                פרטיות: <ToFill>שם ודרכי קשר של הממונה על הפרטיות</ToFill>.
              </p>
            </Section>

            <Section id="data" title="2. איזה מידע נאסף">
              <ul className="flex list-disc flex-col gap-2 ps-5 marker:text-gold-dark">
                {DATA_COLLECTED.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p>
                מסירת המידע נעשית מרצון ובהסכמה. אינכם חייבים למסור מידע, אך ללא פרטים מסוימים לא
                נוכל לקבוע תור או להעניק את השירות.
              </p>
            </Section>

            <Section id="purpose" title="3. למה המידע משמש">
              <ul className="flex list-disc flex-col gap-2 ps-5 marker:text-gold-dark">
                {PURPOSES.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Section>

            <Section id="sharing" title="4. שיתוף המידע עם צדדים שלישיים">
              <p>
                איננו מוכרים מידע אישי. אנו נעזרים בספקי שירות המעבדים מידע עבורנו בלבד ובהתאם
                להנחיותינו, ובהם: שירות הודעות (וואטסאפ/SMS) למשלוח תזכורות ומעקב, שירות דוא״ל לדיווחים,
                אחסון מאובטח של מסמכים וטופסי הסכמה חתומים, ותשתית אירוח ובסיס נתונים. חלק מהספקים
                עשויים לאחסן מידע מחוץ לישראל; במקרה כזה נפעל להבטחת רמת הגנה נאותה. פירוט הספקים:
                <ToFill>רשימת ספקי העיבוד ומיקום אחסון המידע</ToFill>. בנוסף, מידע עשוי להימסר אם נידרש
                לכך על פי דין או צו שיפוטי.
              </p>
            </Section>

            <Section id="security" title="5. אבטחת מידע ושמירתו">
              <p>
                אנו נוקטים אמצעים ארגוניים וטכנולוגיים סבירים להגנה על המידע מפני גישה, שימוש או
                חשיפה בלתי מורשים, לרבות הגבלת הרשאות ואחסון מוצפן של מסמכים רגישים. המידע יישמר למשך
                הזמן הנדרש למטרות שלשמן נאסף ולעמידה בחובות שבדין, ולאחר מכן יימחק או יעבור אנונימיזציה.
                תקופות השמירה: <ToFill>תקופות השמירה לכל סוג מידע, לרבות רשומות רפואיות/טיפוליות</ToFill>.
              </p>
            </Section>

            <Section id="rights" title="6. זכויותייך">
              <p>
                בהתאם לחוק הגנת הפרטיות, התשמ״א–1981, עומדת לכם הזכות לעיין במידע המוחזק עליכם, לבקש
                את תיקונו אם אינו נכון, שלם או מעודכן, ולבקש את מחיקתו בכפוף למגבלות הדין. כמו כן ניתן
                לחזור בכם מהסכמה לדיוור שיווקי בכל עת. לפניה בנושא זכויותיכם: <ToFill>דרכי הפנייה</ToFill>.
              </p>
            </Section>

            <Section id="marketing" title="7. דיוור שיווקי">
              <p>
                משלוח תכני שיווק ייעשה רק לאחר קבלת הסכמתכם המפורשת, בהתאם לסעיף 30א לחוק התקשורת
                (בזק ושידורים), התשמ״ב–1982. בכל הודעה תימצא דרך פשוטה להסרה, וניתן גם לפנות אלינו
                ישירות כדי להסיר את פרטיכם מרשימת הדיוור.
              </p>
            </Section>

            <Section id="cookies" title="8. עוגיות (Cookies) ומידע טכני">
              <p>
                <ToFill>תיאור השימוש בעוגיות ובכלי מדידה באתר, ככל שקיימים, והאפשרות לנהל אותם</ToFill>.
                ככל שהאתר אינו עושה שימוש בעוגיות שאינן חיוניות — יש לציין זאת במפורש.
              </p>
            </Section>

            <Section id="updates" title="9. עדכון המדיניות">
              <p>
                אנו רשאים לעדכן מדיניות זו מעת לעת. הנוסח המחייב הוא הנוסח המתפרסם בעמוד זה.
                בתוקף מיום: <ToFill>תאריך בפורמט DD/MM/YYYY</ToFill>.
              </p>
              <p>
                מדיניות זו משלימה את
                <Link
                  href="/terms"
                  className="mx-1 underline decoration-gold-dark underline-offset-4 hover:text-gold-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-dark"
                >
                  תקנון ותנאי השימוש
                </Link>
                של האתר.
              </p>
            </Section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
