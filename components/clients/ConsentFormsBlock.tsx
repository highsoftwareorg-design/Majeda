/**
 * ConsentFormsBlock — בלוק "טפסי הסכמה" (משימה 4.11, §4.1 FR-PR-08).
 *
 * שלד תצוגה בלבד — Phase 1.
 * טפסי הסכמה וחתימה דיגיטלית (§8) יממשו בתוכנית המשך נפרדת.
 * הבלוק מוצג תמיד ללא שגיאה, גם כשאין נתוני טפסים במערכת.
 *
 * RTL, עברית, mobile-responsive לפי הנחיית hebrew-ui.
 */

import { FileText, Info } from "lucide-react";

export function ConsentFormsBlock() {
  return (
    <section
      dir="rtl"
      aria-label="טפסי הסכמה"
      role="region"
      className="rounded-brand border border-gold/20 bg-white"
    >
      <div className="p-4 sm:p-5">
        {/* כותרת */}
        <div className="mb-4 flex items-center gap-2">
          <FileText
            className="h-5 w-5 shrink-0 text-gold-dark"
            aria-hidden="true"
          />
          <h2 className="text-base font-semibold text-charcoal">
            טפסי הסכמה
          </h2>
        </div>

        {/* מצב ריק */}
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <FileText
            className="h-10 w-10 text-gold/30"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-taupe">
            אין טפסים עדיין
          </p>
        </div>

        {/* הודעה גנרית על תכונה עתידית */}
        <div
          role="note"
          aria-label="תכונה עתידית — טפסי הסכמה"
          className="flex items-start gap-2 rounded-brand border border-gold/20 bg-champagne/40 px-4 py-3"
        >
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-gold-dark"
            aria-hidden="true"
          />
          <p className="text-xs text-taupe/90 leading-relaxed">
            תכונת טפסי ההסכמה והחתימה הדיגיטלית (§8) תהיה זמינה בעתיד.
            <br />
            לאחר המימוש ניתן יהיה לשלוח, לחתום ולאחסן טפסים ישירות מכאן.
          </p>
        </div>
      </div>
    </section>
  );
}
