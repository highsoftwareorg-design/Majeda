"use client";

/**
 * VisitAmendmentForm — טופס "הוסף תיקון" לביקור נעול (משימה 4.8, FR-PR-07).
 *
 * Client Component — מוצג רק כאשר הביקור נעול (נוצר לפני יותר מ-24 שעות).
 * מאפשר לבחור שדה לתיקון (notes / clientReaction), להזין ערך חדש,
 * ולשלוח ל-PATCH endpoint שיוצר רשומת VisitAmendment.
 * הסיכום המקורי לא נמחק.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

type Field = "notes" | "clientReaction";

type Props = {
  clientId: string;
  visitId: string;
  /** הערך הנוכחי של notes (הסיכום המקורי / תיקון אחרון) */
  currentNotes: string | null;
  /** הערך הנוכחי של clientReaction */
  currentClientReaction: string | null;
};

const FIELD_LABELS: Record<Field, string> = {
  notes: "סיכום טיפול",
  clientReaction: "תוצאה / תגובת לקוחה",
};

export function VisitAmendmentForm({
  clientId,
  visitId,
  currentNotes,
  currentClientReaction,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<Field>("notes");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleOpen() {
    // מלא מראש עם הערך הנוכחי של השדה שנבחר
    const current = field === "notes" ? currentNotes : currentClientReaction;
    setValue(current ?? "");
    setError(null);
    setSuccess(false);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setError(null);
  }

  function handleFieldChange(newField: Field) {
    setField(newField);
    const current =
      newField === "notes" ? currentNotes : currentClientReaction;
    setValue(current ?? "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) {
      setError("יש להזין ערך לתיקון");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/clients/${clientId}/visits/${visitId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value.trim() }),
        }
      );

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? "שגיאה בשמירת התיקון — נסה שוב");
        return;
      }

      setSuccess(true);
      setOpen(false);
      // רענן את נתוני הדף כדי להציג את התיקון החדש
      router.refresh();
    } catch {
      setError("שגיאת רשת — בדוק חיבור אינטרנט ונסה שוב");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir="rtl" lang="he">
      {/* כפתור "הוסף תיקון" */}
      {!open && (
        <button
          type="button"
          onClick={handleOpen}
          className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-brand border border-gold/40 bg-champagne/60 px-3 py-2 text-sm font-medium text-gold-dark transition-colors hover:bg-champagne hover:border-gold/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          aria-label="הוסף תיקון לסיכום הביקור"
        >
          {/* אייקון עיפרון */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 shrink-0"
            aria-hidden="true"
          >
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
          הוסף תיקון
        </button>
      )}

      {/* הודעת הצלחה */}
      {success && !open && (
        <p className="mt-2 text-sm text-[#276749]" role="status" aria-live="polite">
          התיקון נשמר בהצלחה
        </p>
      )}

      {/* טופס התיקון */}
      {open && (
        <form
          onSubmit={handleSubmit}
          className="mt-3 rounded-brand border border-gold/30 bg-champagne/40 p-4"
          aria-label="טופס תיקון לסיכום ביקור"
          noValidate
        >
          <p className="mb-3 text-sm font-semibold text-gold-dark">
            הוסף תיקון לסיכום הביקור
          </p>

          {/* בחירת שדה */}
          <fieldset className="mb-3">
            <legend className="mb-1.5 text-xs font-medium text-taupe">
              שדה לתיקון
            </legend>
            <div className="flex flex-wrap gap-2">
              {(["notes", "clientReaction"] as Field[]).map((f) => (
                <label
                  key={f}
                  className="flex min-h-[44px] cursor-pointer items-center gap-2"
                >
                  <input
                    type="radio"
                    name={`amendment-field-${visitId}`}
                    value={f}
                    checked={field === f}
                    onChange={() => handleFieldChange(f)}
                    className="accent-[#7A5F10]"
                  />
                  <span className="text-sm text-charcoal">
                    {FIELD_LABELS[f]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* תיבת טקסט */}
          <div className="mb-3">
            <label
              htmlFor={`amendment-value-${visitId}`}
              className="mb-1.5 block text-xs font-medium text-taupe"
            >
              תוכן התיקון
            </label>
            <textarea
              id={`amendment-value-${visitId}`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={4}
              className="w-full rounded-brand border border-hairline-light bg-white/80 px-3 py-2 text-sm text-charcoal placeholder-taupe/60 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold resize-y"
              placeholder={`הזן את הטקסט המתוקן עבור "${FIELD_LABELS[field]}"…`}
              dir="rtl"
              lang="he"
              aria-required="true"
              aria-describedby={
                error ? `amendment-error-${visitId}` : undefined
              }
            />
          </div>

          {/* שגיאה */}
          {error && (
            <p
              id={`amendment-error-${visitId}`}
              role="alert"
              className="mb-3 text-sm text-[#B26A00]"
            >
              {error}
            </p>
          )}

          {/* כפתורי פעולה */}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-[44px] items-center rounded-brand bg-gold-dark px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-50"
            >
              {loading ? "שומר…" : "שמור תיקון"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="inline-flex min-h-[44px] items-center rounded-brand border border-hairline-light bg-white/60 px-4 py-2 text-sm font-medium text-taupe transition-colors hover:bg-champagne focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-50"
            >
              ביטול
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
