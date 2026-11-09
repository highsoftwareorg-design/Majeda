import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/landing/Footer";

/**
 * תקנון ותנאי שימוש (מחליף את קישור ה-placeholder שהוביל ל-/terms מאז 2.8).
 *
 * תבנית בלבד. מבנה הסעיפים והנקודות המשפטיות מבוססים על הנחיות כלליות לדין הישראלי
 * (חוק הגנת הצרכן, חוק החוזים האחידים התשמ״ב–1982, חוק הגנת הפרטיות, ותקנות שוויון
 * זכויות לאנשים עם מוגבלות), בהשראת המדריך:
 * https://schwebel-law.com/writing/website-terms-of-use-israel
 * הנוסח נכתב מחדש והותאם לקליניקת יופי; אין בו ייעוץ משפטי. לפני פרסום בפרודקשן —
 * חובה סקירה ואישור של עו״ד, והשלמת כל הפרטים המסומנים על ידי הקליניקה.
 *
 * עיצוב: זהה להצהרת הנגישות — רצועת כותרת כהה (bg-ink-glow) כ"רגע" יחיד, גוף על רקע
 * בהיר ל-measure-prose, Server Component סטטי ללא JS נוסף.
 */

export const metadata: Metadata = {
  title: "תקנון ותנאי שימוש",
  description:
    "תקנון ותנאי השימוש באתר MAJIDA Beauté Center: השירותים, קביעת תורים וביטולים, מחירים, פרטיות, אחריות ודין.",
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

export default function TermsOfUsePage() {
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
            <h1 className="font-heading text-h2 text-gold-pale measure-heading">תקנון ותנאי שימוש</h1>
            <span aria-hidden="true" className="rule-gilded" />
            <p className="text-lead text-champagne-muted measure-prose">
              תקנון זה מסדיר את השימוש באתר <bdi>MAJIDA Beauté Center</bdi> ואת ההתקשרות בין הקליניקה
              לבין המשתמשות והמשתמשים בו. המשך הגלישה והשימוש בשירותי האתר מהווים הסכמה לתנאים
              שלהלן.
            </p>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-landing flex-col gap-stack px-gutter py-section-tight">
          <aside
            role="note"
            aria-label="סטטוס התקנון"
            className="measure-prose rounded-lg border border-gold-dark bg-porcelain p-5 text-body text-charcoal"
          >
            <p>
              <strong className="font-semibold">טיוטה:</strong> תקנון זה הוא תבנית ראשונית ואינו מהווה
              ייעוץ משפטי. הוא טעון סקירה ואישור של עורך/ת דין, והשלמת הפרטים המסומנים על ידי הקליניקה,
              לפני פרסום רשמי ולפני שניתן להסתמך עליו.
            </p>
          </aside>

          <div className="flex flex-col gap-stack measure-prose text-body">
            <Section id="general" title="1. כללי והגדרות">
              <p>
                אתר זה (&quot;האתר&quot;) מופעל על ידי <ToFill>שם הקליניקה / העוסק המורשה או החברה</ToFill>,
                מספר עוסק/ח.פ. <ToFill>מספר</ToFill>, שכתובתו <ToFill>כתובת הקליניקה</ToFill> (&quot;הקליניקה&quot;).
                &quot;משתמש&quot; — כל אדם הגולש באתר או עושה שימוש בשירותיו. בכל מקום בתקנון שבו נכתב
                לשון זכר או נקבה, הכוונה לכל המגדרים כאחד.
              </p>
              <p>
                תנאי התקנון מנוסחים בלשון כללית לנוחות הקריאה בלבד, ואינם גורעים מזכויות המוקנות
                לצרכן/ית לפי דין.
              </p>
            </Section>

            <Section id="services" title="2. השירותים והתוכן באתר">
              <p>
                האתר מציג מידע על הקליניקה ועל הטיפולים המוצעים בה, ומאפשר יצירת קשר וקביעת תור.
                המידע, התיאורים והמחירים המוצגים באתר הם כלליים ועשויים להתעדכן מעת לעת. תמונות
                להמחשה בלבד. אין במידע המוצג משום התחייבות לתוצאה טיפולית, והוא אינו מהווה ייעוץ
                רפואי או אסתטי; כל טיפול כפוף לאבחון ולהתאמה אישית במעמד הפגישה.
              </p>
            </Section>

            <Section id="appointments" title="3. קביעת תורים, ביטול ודחייה">
              <p>
                קביעת תור נעשית באמצעות האתר, הטלפון או הודעה, בכפוף לזמינות. הקליניקה רשאית לאשר,
                לדחות או לבטל תור במקרים חריגים, תוך מתן הודעה סבירה ללקוח/ה.
              </p>
              <p>
                מדיניות הביטול מצד הלקוח/ה: <ToFill>פירוט חלון הביטול (למשל עד 48 שעות מראש) וכל דמי
                ביטול/איחור, בכפוף למגבלות חוק הגנת הצרכן</ToFill>. דמי ביטול, ככל שייגבו, לא יעלו על
                השיעור המותר בדין. אין באמור כדי לגרוע מזכות הביטול הקבועה בחוק הגנת הצרכן, התשמ״א–1981,
                ובתקנותיו, במקרים שבהם היא חלה.
              </p>
            </Section>

            <Section id="pricing" title="4. מחירים ותשלום">
              <p>
                המחירים באתר נקובים בשקלים חדשים (₪) וכוללים מע״מ כחוק, אלא אם צוין אחרת. הקליניקה
                רשאית לעדכן מחירים מעת לעת; המחיר המחייב הוא זה שסוכם עם הלקוח/ה במעמד קביעת התור או
                הטיפול. אמצעי התשלום המקובלים: <ToFill>פירוט אמצעי התשלום</ToFill>.
              </p>
            </Section>

            <Section id="privacy" title="5. פרטיות ומידע אישי">
              <p>
                השימוש במידע אישי הנמסר באתר (לרבות בטופסי יצירת קשר, קביעת תור וטופסי הסכמה מדעת)
                כפוף ל
                <Link
                  href="/privacy"
                  className="mx-1 underline decoration-gold-dark underline-offset-4 hover:text-gold-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-dark"
                >
                  מדיניות הפרטיות
                </Link>
                של הקליניקה, המהווה חלק בלתי נפרד מתקנון זה. מסירת פרטים אישיים נעשית מרצון, ונתונה
                להסכמתך; ניתן לעיין במידע, לתקנו או לבקש את מחיקתו בהתאם לחוק הגנת הפרטיות, התשמ״א–1981.
              </p>
            </Section>

            <Section id="marketing" title="6. דיוור ושיווק">
              <p>
                משלוח תכני שיווק ועדכונים (לרבות בוואטסאפ, בדוא״ל או ב-SMS) ייעשה רק לאחר קבלת הסכמתך
                המפורשת, בהתאם לסעיף 30א לחוק התקשורת (בזק ושידורים), התשמ״ב–1982. ניתן לבטל את
                ההסכמה ולהסיר את פרטיך מרשימת הדיוור בכל עת, באמצעות <ToFill>דרך ההסרה (קישור/השבת
                &quot;הסר&quot;/טלפון)</ToFill>.
              </p>
            </Section>

            <Section id="ip" title="7. קניין רוחני">
              <p>
                כל הזכויות בתכני האתר — לרבות הטקסטים, העיצוב, הסמל (לוגו), התמונות והסימנים
                המסחריים — שייכות לקליניקה או לבעלי הזכויות מטעמה, ואין לעשות בהם שימוש, להעתיקם או
                להפיצם ללא אישור מראש ובכתב.
              </p>
            </Section>

            <Section id="liability" title="8. אחריות והגבלתה">
              <p>
                הקליניקה פועלת לשמירה על תקינות האתר ועל דיוק המידע, אך אינה מתחייבת שהשירות יהיה נקי
                מתקלות או מטעויות, ואינה אחראית לנזק עקיף שנגרם משימוש באתר או מהסתמכות על מידע כללי
                המוצג בו. אין באמור כדי להגביל אחריות שלא ניתן להגבילה לפי דין, לרבות אחריות לנזק גוף
                או לנזק שנגרם בזדון או ברשלנות חמורה.
              </p>
            </Section>

            <Section id="accessibility" title="9. נגישות">
              <p>
                הקליניקה פועלת להנגשת האתר. פירוט ההתאמות, המגבלות הידועות ודרכי הפנייה מופיעים
                ב
                <Link
                  href="/accessibility"
                  className="mx-1 underline decoration-gold-dark underline-offset-4 hover:text-gold-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-dark"
                >
                  הצהרת הנגישות
                </Link>
                .
              </p>
            </Section>

            <Section id="law" title="10. דין וסמכות שיפוט">
              <p>
                על תקנון זה ועל השימוש באתר יחולו דיני מדינת ישראל בלבד. סמכות השיפוט הבלעדית בכל
                מחלוקת תהיה נתונה לבתי המשפט המוסמכים ב<ToFill>עיר/מחוז</ToFill>, ואין בכך כדי לגרוע
                מהוראות כופות לטובת צרכן/ית לפי דין.
              </p>
            </Section>

            <Section id="changes" title="11. שינויים בתקנון">
              <p>
                הקליניקה רשאית לעדכן תקנון זה מעת לעת. הנוסח המחייב הוא הנוסח המתפרסם בעמוד זה.
                במקרה של שינוי מהותי תינתן הודעה סבירה, ולגבי התקשרות חדשה תידרש הסכמה מחודשת.
              </p>
              <p>
                גרסה: <ToFill>מספר גרסה</ToFill> · בתוקף מיום: <ToFill>תאריך בפורמט DD/MM/YYYY</ToFill>
              </p>
            </Section>

            <Section id="contact" title="12. יצירת קשר">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border border-hairline-light bg-porcelain p-5 sm:grid-cols-[auto_1fr]">
                <dt className="font-semibold">הקליניקה</dt>
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
                <dt className="font-semibold">כתובת</dt>
                <dd>
                  <ToFill>כתובת הקליניקה</ToFill>
                </dd>
              </dl>
            </Section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
