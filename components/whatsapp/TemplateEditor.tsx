"use client";

/**
 * עורך תבניות WhatsApp (משימה 6.8, FR-WA-05).
 *
 * טופס ליצירת תבנית חדשה או עריכת תבנית קיימת.
 * מכיל: שם (readonly בעריכה), קטגוריה, גוף ההודעה, משתנים ושפה.
 * תצוגה מקדימה: גוף ההודעה עם {משתנה} מוחלף בערכים לדוגמה.
 *
 * RTL, עברית, mobile-responsive.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** מבנה תבנית (מתאים ל-Prisma WhatsAppTemplate) */
export interface WhatsAppTemplateData {
  id: string;
  name: string;
  category: string;
  body: string;
  variables: string[];
  approvedByMeta: boolean;
  language: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TemplateEditorProps {
  /** תבנית קיימת לעריכה — undefined = יצירה חדשה */
  template?: WhatsAppTemplateData;
  /** קריאה לאחר שמירה מוצלחת */
  onSave: () => void;
  /** קריאה לביטול */
  onCancel: () => void;
}

/** ערכי דוגמה למשתנים בתצוגה מקדימה */
const SAMPLE_VALUES: Record<string, string> = {
  name: "מג׳ידה",
  date: "15/11/2026",
  time: "14:00",
  treatment: "טיפול פנים",
  therapist: "מג׳ידה",
  address: "הרצל 1, תל אביב",
};

/** מחליף {משתנה} בערך דוגמה (או [משתנה] אם אין ערך) */
function buildPreview(body: string, variables: string[]): string {
  let result = body;
  for (const v of variables) {
    const sample = SAMPLE_VALUES[v] ?? `[${v}]`;
    result = result.replaceAll(`{${v}}`, sample);
  }
  return result;
}

export function TemplateEditor({ template, onSave, onCancel }: TemplateEditorProps) {
  const isEditing = Boolean(template);

  const [name, setName] = useState(template?.name ?? "");
  const [category, setCategory] = useState(template?.category ?? "UTILITY");
  const [body, setBody] = useState(template?.body ?? "");
  const [variablesRaw, setVariablesRaw] = useState(
    (template?.variables ?? []).join(", ")
  );
  const [language, setLanguage] = useState(template?.language ?? "he");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /** מנתח מחרוזת משתנים "name, date, time" למערך ["name","date","time"] */
  function parseVariables(raw: string): string[] {
    return raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const variables = parseVariables(variablesRaw);
    const bodyTrimmed = body.trim();

    if (!bodyTrimmed) {
      setErrorMsg("גוף ההודעה הוא שדה חובה");
      return;
    }
    if (!isEditing && !name.trim()) {
      setErrorMsg("שם התבנית הוא שדה חובה");
      return;
    }

    setSaving(true);
    try {
      const url = isEditing
        ? `/api/whatsapp/templates/${template!.id}`
        : "/api/whatsapp/templates";
      const method = isEditing ? "PATCH" : "POST";

      const payload = isEditing
        ? { category, body: bodyTrimmed, variables, language }
        : { name: name.trim(), category, body: bodyTrimmed, variables, language };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error ?? "אירעה שגיאה בשמירת התבנית");
        return;
      }

      onSave();
    } catch {
      setErrorMsg("שגיאת רשת — נסי שוב");
    } finally {
      setSaving(false);
    }
  }

  function handleMetaAlert() {
    // TODO: הגשה ל-Meta — יש לעשות ידנית דרך Meta Business Suite
    alert(
      "הגשה ל-Meta נדרשת ידנית דרך Meta Business Suite.\n\nלאחר קבלת אישור Meta, עדכני את שדה 'מאושר ע״י Meta' ידנית."
    );
  }

  const previewText = buildPreview(body, parseVariables(variablesRaw));

  return (
    <form
      onSubmit={handleSubmit}
      dir="rtl"
      lang="he"
      className="space-y-6"
      aria-label={isEditing ? "עריכת תבנית" : "יצירת תבנית חדשה"}
    >
      {/* שם התבנית */}
      <div>
        <label
          htmlFor="template-name"
          className="block text-sm font-medium text-charcoal mb-1"
        >
          שם התבנית (Meta template name)
        </label>
        {isEditing ? (
          <div
            id="template-name"
            className="rounded-lg border border-hairline-dark bg-champagne px-3 py-2 text-sm text-taupe"
          >
            {template!.name}
            <span className="me-2 text-xs text-taupe">(לא ניתן לשינוי)</span>
          </div>
        ) : (
          <>
            <input
              id="template-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="לדוגמה: appointment_reminder_24h"
              dir="ltr"
              className="w-full rounded-lg border border-hairline-dark bg-white px-3 py-2 text-sm text-charcoal placeholder:text-taupe focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            />
            <p className="mt-1 text-xs text-taupe">
              אותיות לטיניות קטנות, ספרות וקו תחתון בלבד (לפי הנחיות Meta)
            </p>
          </>
        )}
      </div>

      {/* קטגוריה ושפה בשורה אחת */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="template-category"
            className="block text-sm font-medium text-charcoal mb-1"
          >
            קטגוריה
          </label>
          <select
            id="template-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-hairline-dark bg-white px-3 py-2 text-sm text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <option value="UTILITY">שירות (UTILITY)</option>
            <option value="MARKETING">שיווק (MARKETING)</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="template-language"
            className="block text-sm font-medium text-charcoal mb-1"
          >
            שפה
          </label>
          <select
            id="template-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full rounded-lg border border-hairline-dark bg-white px-3 py-2 text-sm text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <option value="he">עברית (he)</option>
            <option value="ar">ערבית (ar)</option>
          </select>
        </div>
      </div>

      {/* משתנים */}
      <div>
        <label
          htmlFor="template-variables"
          className="block text-sm font-medium text-charcoal mb-1"
        >
          משתנים (מופרדים בפסיק)
        </label>
        <input
          id="template-variables"
          type="text"
          value={variablesRaw}
          onChange={(e) => setVariablesRaw(e.target.value)}
          placeholder="לדוגמה: name, date, time"
          dir="ltr"
          className="w-full rounded-lg border border-hairline-dark bg-white px-3 py-2 text-sm text-charcoal placeholder:text-taupe focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        />
        <p className="mt-1 text-xs text-taupe">
          שמות המשתנים שמשמשים בגוף ההודעה בפורמט {"{שם}"}, למשל: name, date, time
        </p>
      </div>

      {/* גוף ההודעה */}
      <div>
        <label
          htmlFor="template-body"
          className="block text-sm font-medium text-charcoal mb-1"
        >
          גוף ההודעה
        </label>
        <textarea
          id="template-body"
          required
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={"לדוגמה: היי {name} 🤍 תורך לטיפול {treatment} ביום {date} בשעה {time} אצלנו במרפאה. בהמתנה!"}
          className="w-full rounded-lg border border-hairline-dark bg-white px-3 py-2 text-sm text-charcoal placeholder:text-taupe focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold resize-y min-h-[120px]"
        />
      </div>

      {/* תצוגה מקדימה */}
      {body.trim() && (
        <div
          role="region"
          aria-label="תצוגה מקדימה של ההודעה"
          className="rounded-lg bg-champagne border border-hairline-dark p-4"
        >
          <p className="text-xs font-medium text-taupe mb-2">תצוגה מקדימה (עם ערכי דוגמה):</p>
          <p className="text-sm text-charcoal whitespace-pre-wrap">{previewText}</p>
        </div>
      )}

      {/* הגשה ל-Meta — כפתור TODO */}
      <div className="rounded-lg border border-gold/40 bg-gold/5 p-4">
        <p className="text-sm text-charcoal mb-2">
          <strong>הגשה לאישור Meta</strong> — נדרשת ידנית לאחר שמירת התבנית
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleMetaAlert}
          className="border-gold text-charcoal hover:bg-gold/10"
        >
          הגש לאישור Meta
        </Button>
      </div>

      {/* הודעת שגיאה */}
      {errorMsg && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700"
        >
          {errorMsg}
        </p>
      )}

      {/* כפתורי פעולה */}
      <div className="flex gap-3 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          ביטול
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "שומר..." : "שמור"}
        </Button>
      </div>
    </form>
  );
}
