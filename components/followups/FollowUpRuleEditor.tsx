"use client";

/**
 * טופס יצירת כלל מעקב לטיפול (משימה 8.2, FR-FU-01).
 *
 * שדות: שם הכלל, מרווח בימים מתאריך הביקור, נמען (לקוח/ה / אדמין / שניהם),
 * והנחיה אופציונלית לאדמין. שולח POST ל-/api/treatments/:id/follow-up-rules.
 *
 * RTL, עברית, mobile-responsive (עמודה אחת במובייל).
 */

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

/** מבנה כלל מעקב (תואם ל-Prisma FollowUpRule, תאריכים כמחרוזות) */
export interface FollowUpRuleData {
  id: string;
  treatmentId: string;
  name: string;
  offsetDays: number;
  recipientType: string;
  adminNote: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FollowUpRuleEditorProps {
  /** מזהה הטיפול שהכלל משויך אליו */
  treatmentId: string;
  /** קריאה לאחר שמירה מוצלחת — מקבלת את הכלל החדש */
  onSave: (rule: FollowUpRuleData) => void;
  /** קריאה לביטול */
  onCancel: () => void;
}

const RECIPIENT_OPTIONS: { value: string; label: string }[] = [
  { value: "client", label: "לקוח/ה" },
  { value: "admin", label: "אדמין" },
  { value: "both", label: "שניהם" },
];

const INPUT_CLASS =
  "w-full rounded-lg border border-hairline-dark bg-white px-3 py-2 text-sm text-charcoal placeholder:text-taupe focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

const LABEL_CLASS = "block text-sm font-medium text-charcoal mb-1";

export function FollowUpRuleEditor({
  treatmentId,
  onSave,
  onCancel,
}: FollowUpRuleEditorProps) {
  const [name, setName] = useState("");
  const [offsetDaysRaw, setOffsetDaysRaw] = useState("");
  const [recipientType, setRecipientType] = useState("client");
  const [adminNote, setAdminNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("יש להזין שם לכלל המעקב");
      return;
    }
    const offsetDays = Number(offsetDaysRaw);
    if (offsetDaysRaw.trim() === "" || !Number.isInteger(offsetDays) || offsetDays < 0) {
      setError("יש להזין מספר ימים שלם (0 ומעלה)");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/treatments/${treatmentId}/follow-up-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          offsetDays,
          recipientType,
          adminNote: adminNote.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "שגיאה בשמירת כלל המעקב — נסה שוב");
        return;
      }
      onSave(data.rule as FollowUpRuleData);
    } catch {
      setError("שגיאת רשת — נסה שוב");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      dir="rtl"
      noValidate
      className="space-y-4 rounded-lg border border-hairline-dark bg-champagne p-4"
      aria-label="טופס כלל מעקב"
    >
      <div>
        <label htmlFor="fu-name" className={LABEL_CLASS}>
          שם הכלל <span aria-hidden="true" className="text-red-600">*</span>
        </label>
        <input
          id="fu-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="למשל: בדיקת שלומות"
          className={INPUT_CLASS}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="fu-offset" className={LABEL_CLASS}>
            ימים מתאריך הביקור <span aria-hidden="true" className="text-red-600">*</span>
          </label>
          <input
            id="fu-offset"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={offsetDaysRaw}
            onChange={(e) => setOffsetDaysRaw(e.target.value)}
            className={INPUT_CLASS}
            required
          />
        </div>

        <div>
          <label htmlFor="fu-recipient" className={LABEL_CLASS}>
            נמען
          </label>
          <select
            id="fu-recipient"
            value={recipientType}
            onChange={(e) => setRecipientType(e.target.value)}
            className={INPUT_CLASS}
          >
            {RECIPIENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="fu-admin-note" className={LABEL_CLASS}>
          נוסח משימה לאדמין <span className="text-xs text-taupe">(אופציונלי)</span>
        </label>
        <textarea
          id="fu-admin-note"
          rows={3}
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          placeholder="למשל: לבדוק טלפונית שהלקוחה מרוצה מהטיפול"
          className={INPUT_CLASS}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
          className="min-h-11 w-full sm:w-auto"
        >
          ביטול
        </Button>
        <Button
          type="submit"
          disabled={saving}
          className="min-h-11 w-full sm:w-auto"
        >
          {saving ? "שומר..." : "שמירת כלל"}
        </Button>
      </div>
    </form>
  );
}
