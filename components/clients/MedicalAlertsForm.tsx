"use client";

/**
 * MedicalAlertsForm — טופס עריכת התראות רפואיות (משימה 4.3, §4.1 FR-PR-01).
 *
 * רכיב קליינט (Client Component) עם ארבעה שדות textarea, כפתור שמירה
 * שקורא ל-PATCH /api/clients/:id, וטיפול בשגיאות ובהצלחה.
 *
 * RTL, עברית, מותאם לנייד לפי הנחיית hebrew-ui.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MedicalAlertsData } from "./MedicalAlertsBlock";

type Props = {
  clientId: string;
  initialData: MedicalAlertsData;
};

const FIELD_DEFINITIONS: {
  key: keyof MedicalAlertsData;
  label: string;
  placeholder: string;
}[] = [
  {
    key: "allergies",
    label: "אלרגיות",
    placeholder: "למשל: אלרגיה לפניצילין, ניקל...",
  },
  {
    key: "medications",
    label: "תרופות",
    placeholder: "למשל: וורפרין, איזוטרטינואין...",
  },
  {
    key: "pregnancyNursing",
    label: "הריון / הנקה",
    placeholder: "למשל: בהריון שבוע 20...",
  },
  {
    key: "medicalConditions",
    label: "מצבים רפואיים",
    placeholder: "למשל: סוכרת, אפילפסיה...",
  },
];

export function MedicalAlertsForm({ clientId, initialData }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<MedicalAlertsData>(initialData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allergies: values.allergies || null,
          medications: values.medications || null,
          pregnancyNursing: values.pregnancyNursing || null,
          medicalConditions: values.medicalConditions || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.error ?? `שגיאת שרת (${res.status}) — נסה שוב`
        );
      }

      setSaved(true);
      setOpen(false);
      // רענון נתוני ה-Server Component כדי לשקף את הערכים החדשים
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "אירעה שגיאה בשמירה — נסה שוב");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div dir="rtl" className="rounded-brand border border-taupe/20 bg-white p-4 sm:p-5">
      {/* כותרת עם כפתור פתיחה/סגירה */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-charcoal">
          עריכת התראות רפואיות
        </h2>
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            setError(null);
            setSaved(false);
            // איפוס ל-initialData אם המשתמש סגר בלי לשמור
            if (open) setValues(initialData);
          }}
          aria-expanded={open}
          className="min-h-11 min-w-11 rounded-brand px-3 py-2 text-sm font-medium text-gold-dark transition-colors hover:bg-champagne focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-dark"
        >
          {open ? "ביטול" : "עריכה"}
        </button>
      </div>

      {/* הודעת הצלחה (מחוץ לטופס) */}
      {saved && !open && (
        <p
          role="status"
          aria-live="polite"
          className="mt-2 text-sm text-success font-medium"
        >
          ההתראות הרפואיות עודכנו בהצלחה
        </p>
      )}

      {/* טופס העריכה — מוצג רק כשפתוח */}
      {open && (
        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          {FIELD_DEFINITIONS.map(({ key, label, placeholder }) => (
            <div key={key} className="flex flex-col gap-1">
              <label
                htmlFor={`medical-${key}`}
                className="text-sm font-medium text-charcoal"
              >
                {label}
              </label>
              <textarea
                id={`medical-${key}`}
                name={key}
                rows={2}
                value={values[key] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [key]: e.target.value }))
                }
                placeholder={placeholder}
                className="w-full resize-y rounded-brand border border-taupe/30 bg-champagne px-3 py-2 text-sm text-charcoal placeholder:text-taupe/60 focus-visible:border-gold-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-dark"
                dir="rtl"
              />
            </div>
          ))}

          {/* הודעת שגיאה */}
          {error && (
            <p role="alert" aria-live="assertive" className="text-sm text-error font-medium">
              {error}
            </p>
          )}

          {/* כפתור שמירה */}
          <div className="flex justify-start">
            <button
              type="submit"
              disabled={saving}
              aria-busy={saving}
              className="min-h-11 rounded-brand bg-gold-dark px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gold-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-dark disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "שומר..." : "שמור"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
