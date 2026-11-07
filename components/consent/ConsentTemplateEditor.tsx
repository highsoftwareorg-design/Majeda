"use client";

/**
 * עורך תבנית הסכמה (משימה 7.2, FR-CF-01, FR-CF-02).
 *
 * טופס ליצירת תבנית חדשה או עריכת תבנית קיימת.
 * שדות: שם, טופס כללי, מזהי טיפולים, תוקף, שפה, ורשימה דינמית של שדות הטופס.
 *
 * RTL, עברית, mobile-responsive.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** מבנה שדה בטופס ההסכמה */
export interface ConsentField {
  id: string;
  type: "text" | "boolean" | "checkbox" | "signature";
  label: string;
  required?: boolean;
}

/** מבנה תבנית הסכמה (מתאים ל-Prisma ConsentTemplate) */
export interface ConsentTemplateData {
  id: string;
  name: string;
  isGeneral: boolean;
  treatmentIds: string[];
  validityDays: number | null;
  language: string;
  version: number;
  isActive: boolean;
  fields: ConsentField[];
  createdAt: string;
  updatedAt: string;
}

interface ConsentTemplateEditorProps {
  /** תבנית קיימת לעריכה — undefined = יצירה חדשה */
  template?: ConsentTemplateData;
  /** קריאה לאחר שמירה מוצלחת */
  onSave: () => void;
  /** קריאה לביטול */
  onCancel: () => void;
}

/** כינויים עבריים לסוגי שדות */
const FIELD_TYPE_LABELS: Record<ConsentField["type"], string> = {
  text: "שדה טקסט",
  boolean: "כן / לא",
  checkbox: "תיבת סימון (חובה)",
  signature: "חתימה",
};

/** יצירת מזהה ייחודי פשוט לשדה חדש */
function newFieldId(): string {
  return `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function ConsentTemplateEditor({
  template,
  onSave,
  onCancel,
}: ConsentTemplateEditorProps) {
  const isEditing = Boolean(template);

  const [name, setName] = useState(template?.name ?? "");
  const [isGeneral, setIsGeneral] = useState(template?.isGeneral ?? false);
  const [treatmentIdsRaw, setTreatmentIdsRaw] = useState(
    (template?.treatmentIds ?? []).join(", ")
  );
  const [validityDaysRaw, setValidityDaysRaw] = useState(
    template?.validityDays != null ? String(template.validityDays) : ""
  );
  const [language, setLanguage] = useState(template?.language ?? "he");
  const [fields, setFields] = useState<ConsentField[]>(
    template?.fields ?? []
  );

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /** פענוח מחרוזת מזהי טיפולים */
  function parseTreatmentIds(raw: string): string[] {
    return raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  /** הוספת שדה חדש לרשימה */
  function addField() {
    setFields((prev) => [
      ...prev,
      { id: newFieldId(), type: "text", label: "", required: false },
    ]);
  }

  /** הסרת שדה לפי מיקום */
  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  /** עדכון שדה קיים */
  function updateField(
    index: number,
    patch: Partial<ConsentField>
  ) {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const nameTrimmed = name.trim();
    if (!nameTrimmed) {
      setErrorMsg("שם התבנית הוא שדה חובה");
      return;
    }

    // ולידציה: כל שדה חייב להיות עם label
    for (let i = 0; i < fields.length; i++) {
      if (!fields[i].label.trim()) {
        setErrorMsg(`שדה מספר ${i + 1} חסר תווית (label)`);
        return;
      }
    }

    const treatmentIds = parseTreatmentIds(treatmentIdsRaw);
    const validityDays =
      validityDaysRaw.trim() !== "" && !isNaN(Number(validityDaysRaw))
        ? Number(validityDaysRaw)
        : null;

    const payload = {
      name: nameTrimmed,
      isGeneral,
      treatmentIds,
      validityDays,
      language,
      fields,
    };

    setSaving(true);
    try {
      const url = isEditing
        ? `/api/consent-templates/${template!.id}`
        : "/api/consent-templates";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(
          (data as Record<string, string>).error ?? "אירעה שגיאה בשמירת התבנית"
        );
        return;
      }

      onSave();
    } catch {
      setErrorMsg("שגיאת רשת — נסי שוב");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      dir="rtl"
      lang="he"
      className="space-y-6"
      aria-label={isEditing ? "עריכת תבנית הסכמה" : "יצירת תבנית הסכמה חדשה"}
      noValidate
    >
      {/* שם התבנית */}
      <div>
        <label
          htmlFor="ct-name"
          className="block text-sm font-medium text-charcoal mb-1"
        >
          שם התבנית <span aria-hidden="true" className="text-red-600">*</span>
        </label>
        <input
          id="ct-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="לדוגמה: הסכמה כללית לטיפול"
          className="w-full rounded-lg border border-hairline-dark bg-white px-3 py-2 text-sm text-charcoal placeholder:text-taupe focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          aria-required="true"
        />
      </div>

      {/* טופס כללי */}
      <div className="flex items-center gap-3">
        <input
          id="ct-is-general"
          type="checkbox"
          checked={isGeneral}
          onChange={(e) => setIsGeneral(e.target.checked)}
          className="h-5 w-5 rounded border-hairline-dark text-gold accent-gold"
        />
        <label htmlFor="ct-is-general" className="text-sm text-charcoal select-none">
          טופס כללי לכל לקוח/ה חדש/ה
        </label>
      </div>

      {/* מזהי טיפולים + תוקף בימים — שורה אחת במסך רחב */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* מזהי טיפולים */}
        <div>
          <label
            htmlFor="ct-treatment-ids"
            className="block text-sm font-medium text-charcoal mb-1"
          >
            מזהי טיפולים (מופרדים בפסיק)
          </label>
          <input
            id="ct-treatment-ids"
            type="text"
            value={treatmentIdsRaw}
            onChange={(e) => setTreatmentIdsRaw(e.target.value)}
            placeholder="id1, id2, id3"
            dir="ltr"
            className="w-full rounded-lg border border-hairline-dark bg-white px-3 py-2 text-sm text-charcoal placeholder:text-taupe focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          />
          <p className="mt-1 text-xs text-taupe">
            השאירי ריק אם הטופס כללי (לא מיועד לטיפול ספציפי)
          </p>
        </div>

        {/* תוקף בימים */}
        <div>
          <label
            htmlFor="ct-validity-days"
            className="block text-sm font-medium text-charcoal mb-1"
          >
            תוקף בימים
          </label>
          <input
            id="ct-validity-days"
            type="number"
            min="1"
            value={validityDaysRaw}
            onChange={(e) => setValidityDaysRaw(e.target.value)}
            placeholder="השאירי ריק = ללא הגבלה"
            className="w-full rounded-lg border border-hairline-dark bg-white px-3 py-2 text-sm text-charcoal placeholder:text-taupe focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          />
        </div>
      </div>

      {/* שפה */}
      <div>
        <label
          htmlFor="ct-language"
          className="block text-sm font-medium text-charcoal mb-1"
        >
          שפה
        </label>
        <select
          id="ct-language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full rounded-lg border border-hairline-dark bg-white px-3 py-2 text-sm text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:w-48"
        >
          <option value="he">עברית</option>
          <option value="ar">ערבית</option>
        </select>
      </div>

      {/* שדות הטופס — רשימה דינמית */}
      <fieldset className="rounded-lg border border-hairline-dark p-4">
        <legend className="px-2 text-sm font-medium text-charcoal">
          שדות הטופס
        </legend>

        {fields.length === 0 && (
          <p className="text-sm text-taupe mb-3">
            לא הוגדרו שדות עדיין. לחצי על &quot;הוסף שדה&quot; להוספת שדה ראשון.
          </p>
        )}

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="flex flex-col gap-2 rounded-lg border border-hairline-dark bg-champagne p-3 sm:flex-row sm:items-start sm:gap-3"
            >
              {/* סוג שדה */}
              <div className="sm:w-44 shrink-0">
                <label
                  htmlFor={`field-type-${field.id}`}
                  className="block text-xs text-taupe mb-1"
                >
                  סוג שדה
                </label>
                <select
                  id={`field-type-${field.id}`}
                  value={field.type}
                  onChange={(e) =>
                    updateField(index, {
                      type: e.target.value as ConsentField["type"],
                    })
                  }
                  className="w-full rounded-md border border-hairline-dark bg-white px-2 py-1.5 text-sm text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  {(
                    Object.entries(FIELD_TYPE_LABELS) as [
                      ConsentField["type"],
                      string
                    ][]
                  ).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* תווית שדה */}
              <div className="flex-1 min-w-0">
                <label
                  htmlFor={`field-label-${field.id}`}
                  className="block text-xs text-taupe mb-1"
                >
                  תווית השדה
                </label>
                <input
                  id={`field-label-${field.id}`}
                  type="text"
                  value={field.label}
                  onChange={(e) =>
                    updateField(index, { label: e.target.value })
                  }
                  placeholder="לדוגמה: הסכמה לטיפול"
                  className="w-full rounded-md border border-hairline-dark bg-white px-2 py-1.5 text-sm text-charcoal placeholder:text-taupe focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                />
              </div>

              {/* חובה */}
              <div className="flex items-center gap-1.5 pt-5 shrink-0">
                <input
                  id={`field-required-${field.id}`}
                  type="checkbox"
                  checked={field.required ?? false}
                  onChange={(e) =>
                    updateField(index, { required: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-hairline-dark accent-gold"
                />
                <label
                  htmlFor={`field-required-${field.id}`}
                  className="text-xs text-taupe select-none"
                >
                  חובה
                </label>
              </div>

              {/* הסרת שדה */}
              <div className="flex items-center pt-5 shrink-0">
                <button
                  type="button"
                  onClick={() => removeField(index)}
                  className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 min-h-[44px] min-w-[44px]"
                  aria-label={`הסר שדה ${index + 1}`}
                >
                  הסר
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addField}
          className="mt-3 rounded-lg border border-hairline-dark bg-white px-4 py-2 text-sm text-charcoal hover:bg-champagne focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold min-h-[44px]"
        >
          + הוסף שדה
        </button>
      </fieldset>

      {/* הודעת שגיאה */}
      {errorMsg && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {errorMsg}
        </p>
      )}

      {/* כפתורי פעולה */}
      <div className="flex flex-wrap items-center justify-start gap-3 pt-2">
        <Button
          type="submit"
          disabled={saving}
          className="min-h-[44px] min-w-[80px] bg-gold text-ink hover:bg-gold-dark"
        >
          {saving ? "שומר..." : "שמור"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
          className="min-h-[44px]"
        >
          ביטול
        </Button>
      </div>
    </form>
  );
}
