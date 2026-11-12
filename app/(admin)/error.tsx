"use client";

/**
 * Error boundary למסכי הניהול — תופס שגיאות שנזרקות בעמודי (admin) (דשבורד,
 * לקוחות, יומן וכו'). ללא קובץ זה, שגיאת שרת בעמוד מציגה עמוד לבן ריק.
 *
 * הערה: שגיאות שנזרקות ב-(admin)/layout.tsx עצמו עולות מעל גבול זה ונתפסות
 * ב-app/global-error.tsx.
 *
 * ה-digest מוצג לצורך איתור בלוגים (Vercel). אין כאן PII.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      dir="rtl"
      className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <h1 className="font-heading text-2xl text-charcoal">אירעה שגיאה בטעינת העמוד</h1>
      <p className="leading-relaxed text-charcoal/80">
        משהו השתבש בעת טעינת הנתונים. נסו שוב. אם התקלה חוזרת, פנו לתמיכה הטכנית
        וציינו את קוד השגיאה שמטה.
      </p>
      <button
        onClick={() => reset()}
        className="min-h-11 rounded-lg bg-gold px-6 py-2.5 font-semibold text-ink hover:bg-gold-light"
      >
        נסו שוב
      </button>
      {error.digest ? (
        <p className="mt-2 text-xs text-charcoal/50">
          קוד שגיאה: <code dir="ltr">{error.digest}</code>
        </p>
      ) : null}
    </div>
  );
}
