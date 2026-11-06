"use client";

/**
 * VisitForm — טופס "רישום ביקור" (משימה 4.5, FR-PR-02).
 *
 * רכיב קליינט הפותח/נסגר עם כפתור "הוסף ביקור". כאשר פתוח, מציג טופס
 * מלא עם כל שדות הביקור: תאריך, טיפולים, מטפל/ת, אזור, מוצרים ואצווה,
 * פרמטרים, הערות ומחיר.
 *
 * בסיום שמירה מוצלחת, אם לטיפולים שנבחרו יש ברירת מחדל לחזרה
 * (recommendedReturnDays), מוצגת הצעת תאריך חזרה לאישור/עריכה (FR-PR-05, משימה 4.7).
 *
 * RTL, עברית, mobile-responsive, לפי הנחיות hebrew-ui.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, CalendarCheck } from "lucide-react";

type Treatment = {
  id: string;
  name: string;
  recommendedReturnDays?: number | null;
};

type Props = {
  clientId: string;
  treatments: Treatment[];
};

/** ברירת מחדל לתאריך — היום בפורמט YYYY-MM-DD */
function todayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** המרת Date לפורמט YYYY-MM-DD (ללא שעה, ל-input type="date") */
function toDateInputString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * חישוב הצעת תאריך חזרה: visitDate + max(recommendedReturnDays של הטיפולים שנבחרו).
 * מחזיר null אם אף טיפול לא מוגדר עם ימי חזרה.
 */
function computeSuggestedReturnDate(
  visitDateStr: string,
  selectedIds: Set<string>,
  treatments: Treatment[]
): string | null {
  const selectedTreatments = treatments.filter((t) => selectedIds.has(t.id));
  const days = selectedTreatments
    .map((t) => t.recommendedReturnDays ?? null)
    .filter((d): d is number => d !== null && d > 0);
  if (days.length === 0) return null;
  const maxDays = Math.max(...days);
  const visitDate = new Date(visitDateStr);
  if (isNaN(visitDate.getTime())) return null;
  const returnDate = new Date(visitDate);
  returnDate.setDate(returnDate.getDate() + maxDays);
  return toDateInputString(returnDate);
}

export function VisitForm({ clientId, treatments }: Props) {
  const router = useRouter();

  // פתיחה/סגירה של הטופס
  const [open, setOpen] = useState(false);

  // מצבי שמירה
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // שדות הטופס
  const [visitDate, setVisitDate] = useState(todayString);
  const [selectedTreatments, setSelectedTreatments] = useState<Set<string>>(
    new Set()
  );
  const [therapist, setTherapist] = useState("");
  const [treatedArea, setTreatedArea] = useState("");
  const [products, setProducts] = useState("");
  const [parameters, setParameters] = useState("");
  const [notes, setNotes] = useState("");
  const [clientReaction, setClientReaction] = useState("");
  const [price, setPrice] = useState("");

  // הצעת תאריך חזרה (FR-PR-05, משימה 4.7)
  const [savedVisitId, setSavedVisitId] = useState<string | null>(null);
  const [suggestedReturnDate, setSuggestedReturnDate] = useState<string | null>(null);
  const [returnDateInput, setReturnDateInput] = useState("");
  const [savingReturn, setSavingReturn] = useState(false);
  const [returnSaved, setReturnSaved] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  function resetForm() {
    setVisitDate(todayString());
    setSelectedTreatments(new Set());
    setTherapist("");
    setTreatedArea("");
    setProducts("");
    setParameters("");
    setNotes("");
    setClientReaction("");
    setPrice("");
    setError(null);
    setSaved(false);
    setSavedVisitId(null);
    setSuggestedReturnDate(null);
    setReturnDateInput("");
    setSavingReturn(false);
    setReturnSaved(false);
    setReturnError(null);
  }

  function handleOpen() {
    resetForm();
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    resetForm();
  }

  function toggleTreatment(id: string) {
    setSelectedTreatments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // ולידציה בצד לקוח
    if (!visitDate) {
      setError("תאריך הביקור הוא שדה חובה");
      return;
    }
    if (price !== "" && (isNaN(Number(price)) || Number(price) < 0)) {
      setError("המחיר חייב להיות מספר אי-שלילי");
      return;
    }

    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch(`/api/clients/${clientId}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitDate,
          treatmentIds: Array.from(selectedTreatments),
          therapist: therapist || null,
          treatedArea: treatedArea || null,
          products: products || null,
          parameters: parameters || null,
          notes: notes || null,
          clientReaction: clientReaction || null,
          price: price !== "" ? Number(price) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string })?.error ?? `שגיאת שרת (${res.status})`
        );
      }

      const responseData = await res.json() as { visit?: { id?: string } };
      const newVisitId = responseData?.visit?.id ?? null;

      setSaved(true);
      setSavedVisitId(newVisitId);

      // חישוב הצעת תאריך חזרה (FR-PR-05)
      const suggested = computeSuggestedReturnDate(
        visitDate,
        selectedTreatments,
        treatments
      );
      if (suggested && newVisitId) {
        setSuggestedReturnDate(suggested);
        setReturnDateInput(suggested);
        // לא סוגרים את הטופס — מחכים לאישור תאריך החזרה
      } else {
        // אין הצעה — סוגרים כרגיל ומרעננים
        setOpen(false);
        resetForm();
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "אירעה שגיאה בשמירה — נסה שוב"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveReturnDate() {
    if (!savedVisitId || !returnDateInput) return;
    setReturnError(null);
    setSavingReturn(true);

    try {
      const res = await fetch(
        `/api/clients/${clientId}/visits/${savedVisitId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ returnDate: returnDateInput }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string })?.error ?? `שגיאת שרת (${res.status})`
        );
      }

      setReturnSaved(true);
      // ריענון נתוני ה-Server Component + סגירה
      router.refresh();
      setTimeout(() => {
        setOpen(false);
        resetForm();
      }, 800);
    } catch (err) {
      setReturnError(
        err instanceof Error ? err.message : "אירעה שגיאה בשמירת תאריך החזרה"
      );
    } finally {
      setSavingReturn(false);
    }
  }

  function handleSkipReturnDate() {
    router.refresh();
    setOpen(false);
    resetForm();
  }

  // סגנון כללי לשדות קלט
  const inputClass =
    "w-full rounded-brand border border-taupe/30 bg-champagne px-3 py-2 text-sm text-charcoal placeholder:text-taupe/60 focus-visible:border-gold-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-dark";
  const labelClass = "text-sm font-medium text-charcoal";

  return (
    <div dir="rtl" lang="he">
      {/* כפתור "הוסף ביקור" — גלוי תמיד כאשר הטופס סגור */}
      {!open && (
        <div className="flex items-center justify-between">
          {saved && (
            <p
              role="status"
              aria-live="polite"
              className="text-sm font-medium text-success"
            >
              הביקור נרשם בהצלחה
            </p>
          )}
          <button
            type="button"
            onClick={handleOpen}
            className="ms-auto inline-flex min-h-11 items-center gap-2 rounded-brand bg-gold-dark px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gold-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-dark"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            הוסף ביקור
          </button>
        </div>
      )}

      {/* טופס הביקור — מוצג כאשר open=true */}
      {open && (
        <div className="rounded-brand border border-taupe/20 bg-white p-4 sm:p-5">
          {/* כותרת ו-X לסגירה */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-charcoal">
              רישום ביקור חדש
            </h3>
            <button
              type="button"
              onClick={handleClose}
              aria-label="סגור טופס ביקור"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-brand text-taupe transition-colors hover:bg-champagne hover:text-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-dark"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* ——— הצעת תאריך חזרה (מוצגת לאחר שמירה מוצלחת) ——— */}
          {saved && suggestedReturnDate ? (
            <section
              aria-labelledby="return-date-heading"
              className="space-y-4"
            >
              <div className="flex items-center gap-2">
                <CalendarCheck
                  className="h-5 w-5 shrink-0 text-gold-dark"
                  aria-hidden="true"
                />
                <h4
                  id="return-date-heading"
                  className="text-base font-semibold text-charcoal"
                >
                  הצעת מועד חזרה
                </h4>
              </div>

              <p className="text-sm text-taupe">
                המערכת מציעה תאריך חזרה מחושב לפי הטיפולים שנרשמו. ניתן לשנות
                את התאריך לפני אישורו.
              </p>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="return-date-input"
                  className={labelClass}
                >
                  תאריך חזרה מוצע
                </label>
                <input
                  id="return-date-input"
                  type="date"
                  value={returnDateInput}
                  onChange={(e) => setReturnDateInput(e.target.value)}
                  className={`${inputClass} max-w-[220px]`}
                  aria-describedby="return-date-desc"
                />
                <p id="return-date-desc" className="text-xs text-taupe/70">
                  ניתן לשנות את התאריך ידנית לפני שמירה
                </p>
              </div>

              {returnError && (
                <p
                  role="alert"
                  aria-live="assertive"
                  className="text-sm font-medium text-error"
                >
                  {returnError}
                </p>
              )}

              {returnSaved && (
                <p
                  role="status"
                  aria-live="polite"
                  className="text-sm font-medium text-success"
                >
                  תאריך החזרה נשמר בהצלחה
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleSaveReturnDate}
                  disabled={savingReturn || !returnDateInput || returnSaved}
                  aria-busy={savingReturn}
                  className="min-h-11 rounded-brand bg-gold-dark px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gold-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingReturn ? "שומר..." : "שמור מועד חזרה"}
                </button>
                <button
                  type="button"
                  onClick={handleSkipReturnDate}
                  disabled={savingReturn}
                  className="min-h-11 rounded-brand px-4 py-2.5 text-sm font-medium text-taupe transition-colors hover:bg-champagne hover:text-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-dark disabled:opacity-60"
                >
                  דלג על קביעת תאריך חזרה
                </button>
              </div>
            </section>
          ) : (
            /* ——— טופס הביקור הרגיל ——— */
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* ——— תאריך ביקור ——— */}
              <div className="flex flex-col gap-1">
                <label htmlFor="visit-date" className={labelClass}>
                  תאריך ביקור <span aria-hidden="true" className="text-error">*</span>
                </label>
                <input
                  id="visit-date"
                  type="date"
                  required
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className={inputClass}
                  aria-required="true"
                />
              </div>

              {/* ——— בחירת טיפולים (רב-ברירה) ——— */}
              {treatments.length > 0 && (
                <fieldset>
                  <legend className={`mb-2 ${labelClass}`}>
                    טיפולים שבוצעו
                  </legend>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {treatments.map((t) => {
                      const checked = selectedTreatments.has(t.id);
                      return (
                        <label
                          key={t.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-brand border px-3 py-2 text-sm transition-colors ${
                            checked
                              ? "border-gold-dark bg-champagne font-medium text-gold-dark"
                              : "border-taupe/30 text-charcoal hover:border-taupe/60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTreatment(t.id)}
                            className="h-4 w-4 accent-gold-dark"
                            aria-label={t.name}
                          />
                          <span>{t.name}</span>
                          {t.recommendedReturnDays ? (
                            <span
                              className="me-auto ms-1 text-xs text-taupe/70"
                              aria-label={`המלצת חזרה: ${t.recommendedReturnDays} ימים`}
                            >
                              (+{t.recommendedReturnDays}ד׳)
                            </span>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {/* ——— מטפל/ת ——— */}
              <div className="flex flex-col gap-1">
                <label htmlFor="visit-therapist" className={labelClass}>
                  מטפל/ת
                </label>
                <input
                  id="visit-therapist"
                  type="text"
                  value={therapist}
                  onChange={(e) => setTherapist(e.target.value)}
                  placeholder="שם המטפל/ת"
                  className={inputClass}
                />
              </div>

              {/* ——— אזור מטופל ——— */}
              <div className="flex flex-col gap-1">
                <label htmlFor="visit-treated-area" className={labelClass}>
                  אזור מטופל
                </label>
                <input
                  id="visit-treated-area"
                  type="text"
                  value={treatedArea}
                  onChange={(e) => setTreatedArea(e.target.value)}
                  placeholder='למשל: פנים, גב עליון, פרקי ידיים'
                  className={inputClass}
                />
              </div>

              {/* ——— מוצרים וחומרים (כולל מספר אצווה) ——— */}
              <div className="flex flex-col gap-1">
                <label htmlFor="visit-products" className={labelClass}>
                  מוצרים וחומרים (כולל מספר אצווה)
                </label>
                <textarea
                  id="visit-products"
                  rows={2}
                  value={products}
                  onChange={(e) => setProducts(e.target.value)}
                  placeholder="למשל: חומצה היאלורונית — אצווה 2024-B, 1ml"
                  className={`${inputClass} resize-y`}
                  dir="rtl"
                />
              </div>

              {/* ——— מינון/פרמטרים ——— */}
              <div className="flex flex-col gap-1">
                <label htmlFor="visit-parameters" className={labelClass}>
                  מינון / פרמטרים
                </label>
                <textarea
                  id="visit-parameters"
                  rows={2}
                  value={parameters}
                  onChange={(e) => setParameters(e.target.value)}
                  placeholder="למשל: עוצמה 15J, תדירות 10Hz, 3 מעברים"
                  className={`${inputClass} resize-y`}
                  dir="rtl"
                />
              </div>

              {/* ——— סיכום טיפול (FR-PR-03) ——— */}
              <fieldset className="rounded-brand border border-taupe/20 p-3 sm:p-4">
                <legend className="px-1 text-sm font-semibold text-gold-dark">
                  סיכום טיפול
                </legend>

                {/* שדה 1: סיכום טיפול חופשי */}
                <div className="mt-2 flex flex-col gap-1">
                  <label htmlFor="visit-notes" className={labelClass}>
                    סיכום טיפול
                  </label>
                  <textarea
                    id="visit-notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="תיאור מהלך הטיפול, הערות קליניות, הוראות לאחר הטיפול..."
                    className={`${inputClass} resize-y`}
                    dir="rtl"
                  />
                </div>

                {/* שדה 2: תוצאה / תגובת לקוחה */}
                <div className="mt-3 flex flex-col gap-1">
                  <label htmlFor="visit-client-reaction" className={labelClass}>
                    תוצאה / תגובת לקוחה
                  </label>
                  <textarea
                    id="visit-client-reaction"
                    rows={2}
                    value={clientReaction}
                    onChange={(e) => setClientReaction(e.target.value)}
                    placeholder="למשל: שביעות רצון גבוהה, אדמומיות קלה שחלפה, תוצאה מצוינת..."
                    className={`${inputClass} resize-y`}
                    dir="rtl"
                  />
                </div>
              </fieldset>

              {/* ——— מחיר ——— */}
              <div className="flex flex-col gap-1">
                <label htmlFor="visit-price" className={labelClass}>
                  מחיר (₪)
                </label>
                <input
                  id="visit-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                  className={`${inputClass} max-w-[160px]`}
                  dir="ltr"
                />
              </div>

              {/* ——— הודעת שגיאה ——— */}
              {error && (
                <p
                  role="alert"
                  aria-live="assertive"
                  className="text-sm font-medium text-error"
                >
                  {error}
                </p>
              )}

              {/* ——— כפתורי פעולה ——— */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  aria-busy={saving}
                  className="min-h-11 rounded-brand bg-gold-dark px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gold-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "שומר..." : "שמור ביקור"}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={saving}
                  className="min-h-11 rounded-brand px-4 py-2.5 text-sm font-medium text-taupe transition-colors hover:bg-champagne hover:text-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-dark disabled:opacity-60"
                >
                  ביטול
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
