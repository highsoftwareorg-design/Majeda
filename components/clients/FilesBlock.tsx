/**
 * FilesBlock — בלוק "קבצים ותמונות" (משימה 4.10, §4.1).
 *
 * שלד תצוגה בלבד — Phase 1.
 * העלאת קבצים תמונות לפני/אחרי תהיה זמינה בשלב 2 (§12.2).
 * הבלוק מוצג תמיד בדף הפרופיל, ללא שגיאה גם כשאין קבצים.
 *
 * RTL, עברית, mobile-responsive לפי הנחיית hebrew-ui.
 */

import { ImageOff } from "lucide-react";

export function FilesBlock() {
  return (
    <section
      dir="rtl"
      aria-label="קבצים ותמונות"
      role="region"
      className="rounded-brand border border-gold/20 bg-white"
    >
      <div className="p-4 sm:p-5">
        {/* כותרת */}
        <div className="mb-4 flex items-center gap-2">
          <ImageOff
            className="h-5 w-5 shrink-0 text-gold-dark"
            aria-hidden="true"
          />
          <h2 className="text-base font-semibold text-charcoal">
            קבצים ותמונות
          </h2>
        </div>

        {/* אזור העלאה — מנוטרל (placeholder בלבד) */}
        <div
          aria-disabled="true"
          aria-label="אזור העלאת קבצים — לא פעיל בשלב זה"
          className="flex flex-col items-center justify-center gap-3 rounded-brand border-2 border-dashed border-gold/25 bg-champagne/40 px-4 py-10 text-center select-none cursor-not-allowed"
        >
          <ImageOff
            className="h-10 w-10 text-gold/40"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-taupe">
            אזור העלאת קבצים
          </p>
          <p className="text-xs text-taupe/70">
            (גרור קבצים לכאן, או לחץ לבחירה)
          </p>
        </div>

        {/* הודעת "בקרוב" */}
        <p
          role="note"
          className="mt-3 text-center text-xs text-taupe/80"
        >
          בקרוב — פיצ׳ר זה יהיה זמין בשלב 2
        </p>
      </div>
    </section>
  );
}
