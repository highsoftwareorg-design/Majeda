/**
 * NextReturnReminder — תזכורת "חזרה הבאה" (משימה 4.9, §4.1).
 *
 * מציג את תאריך החזרה הקרוב ביותר (לא מטופל) מתוך כל ביקורי הלקוח.
 * כפתור "דחה ב-7 ימים" מעדכן את returnDate (+7 ימים) דרך PATCH.
 * כפתור "סומן כבוצע" מסמן returnNoteHandled=true ומסתיר את הבלוק.
 *
 * Client Component — נדרשת אינטראקטיביות (onClick, useState).
 * RTL, עברית, mobile-responsive לפי הנחיית hebrew-ui.
 */

"use client";

import { useState } from "react";
import { Calendar, CheckCheck, Clock } from "lucide-react";

/** טיפוס ביקור מינימלי הנדרש לרכיב זה (תת-קבוצה של ClientVisitWithTreatments) */
export type VisitForReminder = {
  id: string;
  /** תאריך חזרה מוצע — עשוי להגיע כ-string מחצייה Server→Client */
  returnDate: Date | string | null;
  /** האם התזכורת כבר טופלה (מסומנת כבוצע) */
  returnNoteHandled: boolean;
};

type Props = {
  clientId: string;
  visits: VisitForReminder[];
};

/** מחזיר את הביקור עם ה-returnDate הקרוב ביותר שעדיין לא טופל. */
function findEarliestPendingVisit(
  visits: VisitForReminder[]
): { visitId: string; returnDate: Date } | null {
  const candidates = visits
    .filter((v) => v.returnDate != null && !v.returnNoteHandled)
    .map((v) => ({
      visitId: v.id,
      returnDate: new Date(v.returnDate as Date | string),
    }))
    .sort((a, b) => a.returnDate.getTime() - b.returnDate.getTime());

  return candidates[0] ?? null;
}

/** פורמטר תאריך עברי — "5 בנובמבר 2026" */
const dateFormatter = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jerusalem",
});

export function NextReturnReminder({ clientId, visits }: Props) {
  const initial = findEarliestPendingVisit(visits);

  // state: הביקור הפעיל הנוכחי — null מסתיר את הבלוק
  const [target, setTarget] = useState<{
    visitId: string;
    returnDate: Date;
  } | null>(initial);

  const [loading, setLoading] = useState<"postpone" | "done" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // אין תאריך חזרה פתוח — הבלוק מוסתר לחלוטין
  if (!target) return null;

  const isOverdue = target.returnDate < new Date();
  const formattedDate = dateFormatter.format(target.returnDate);

  /** שולח PATCH לנקודת הקצה של הביקור */
  async function patchVisit(body: Record<string, unknown>): Promise<void> {
    const res = await fetch(
      `/api/clients/${clientId}/visits/${target!.visitId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      let msg = "שגיאה בעדכון";
      try {
        const data = await res.json();
        if (typeof data?.error === "string") msg = data.error;
      } catch {
        // ignore parse error
      }
      throw new Error(msg);
    }
  }

  /** דחה את תאריך החזרה ב-7 ימים */
  async function handlePostpone() {
    if (loading) return;
    setLoading("postpone");
    setError(null);

    const newDate = new Date(target!.returnDate);
    newDate.setDate(newDate.getDate() + 7);

    try {
      await patchVisit({ returnDate: newDate.toISOString() });
      // עדכון אופטימיסטי — שמור על אותו visitId, תאריך חדש
      setTarget({ visitId: target!.visitId, returnDate: newDate });
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בדחיית התאריך");
    } finally {
      setLoading(null);
    }
  }

  /** סמן את התזכורת כטופלה (הסתר את הבלוק) */
  async function handleDone() {
    if (loading) return;
    setLoading("done");
    setError(null);

    try {
      await patchVisit({ returnNoteHandled: true });
      setTarget(null); // הסתרת הבלוק
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בסימון כבוצע");
    } finally {
      setLoading(null);
    }
  }

  return (
    <section
      dir="rtl"
      aria-label="תזכורת חזרה הבאה"
      role="region"
      className="relative overflow-hidden rounded-brand border border-warning/40 bg-warning/10"
    >
      {/* פס אקסנט בצד ההתחלה (ימין ב-RTL) */}
      <div
        className="absolute inset-y-0 start-0 w-1 bg-warning"
        aria-hidden="true"
      />

      <div className="p-4 ps-5 sm:p-5 sm:ps-6">
        {/* שורת כותרת + תאריך + כפתורים */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* מידע: כותרת + תאריך */}
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Calendar
                className="h-5 w-5 shrink-0 text-warning"
                aria-hidden="true"
              />
              <h2 className="text-base font-semibold text-warning">
                תזכורת חזרה הבאה
              </h2>
              {isOverdue && (
                <span
                  aria-label="תאריך זה עבר — הלקוחה עדיין לא חזרה"
                  className="inline-flex items-center gap-1 rounded-full border border-error/30 bg-error/10 px-2 py-0.5 text-xs font-medium text-error"
                >
                  <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                  באיחור
                </span>
              )}
            </div>
            <p
              className="text-lg font-bold text-charcoal"
              aria-label={`תאריך חזרה: ${formattedDate}`}
            >
              {formattedDate}
            </p>
          </div>

          {/* כפתורי פעולה */}
          <div className="flex flex-wrap gap-2">
            {/* דחה ב-7 ימים — outline */}
            <button
              type="button"
              onClick={handlePostpone}
              disabled={loading !== null}
              aria-busy={loading === "postpone"}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-brand border border-warning/50 bg-white px-4 py-2 text-sm font-medium text-warning transition-colors hover:bg-warning/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading === "postpone" ? (
                "מעדכן..."
              ) : (
                <>
                  <Clock
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  דחה ב-7 ימים
                </>
              )}
            </button>

            {/* סומן כבוצע — ממולא */}
            <button
              type="button"
              onClick={handleDone}
              disabled={loading !== null}
              aria-busy={loading === "done"}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-brand border border-transparent bg-warning px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-warning/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading === "done" ? (
                "שומר..."
              ) : (
                <>
                  <CheckCheck
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  סומן כבוצע
                </>
              )}
            </button>
          </div>
        </div>

        {/* הודעת שגיאה */}
        {error && (
          <p role="alert" className="mt-3 text-sm text-error">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
