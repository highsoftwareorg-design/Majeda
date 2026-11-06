/**
 * MedicalAlertsBlock — בלוק "התראות רפואיות" (משימה 4.3, §4.1 FR-PR-01).
 *
 * מוצג בבולט בראש פרופיל הלקוח כאשר לפחות אחד מהשדות הרפואיים מלא.
 * צבע האזהרה #B26A00 (--color-warning) לפי נספח א.6.
 *
 * RTL, עברית, מותאם לנייד לפי הנחיית hebrew-ui.
 */

import { AlertTriangle } from "lucide-react";

export type MedicalAlertsData = {
  allergies: string | null;
  medications: string | null;
  pregnancyNursing: string | null;
  medicalConditions: string | null;
};

const FIELD_DEFINITIONS: { key: keyof MedicalAlertsData; label: string }[] = [
  { key: "allergies", label: "אלרגיות" },
  { key: "medications", label: "תרופות" },
  { key: "pregnancyNursing", label: "הריון / הנקה" },
  { key: "medicalConditions", label: "מצבים רפואיים" },
];

/**
 * מחזיר רכיב ריק (null) כאשר כל ארבעת השדות הרפואיים ריקים או null —
 * הבלוק לא מוצג כלל, ואינו גוזל מקום בממשק.
 */
export function MedicalAlertsBlock({ data }: { data: MedicalAlertsData }) {
  const activeFields = FIELD_DEFINITIONS.filter(
    ({ key }) => data[key]?.trim()
  );

  // הבלוק מוסתר לחלוטין כאשר אין התראות
  if (activeFields.length === 0) {
    return null;
  }

  return (
    <section
      dir="rtl"
      aria-label="התראות רפואיות"
      role="region"
      className="relative overflow-hidden rounded-brand border border-warning/40 bg-warning/10"
    >
      {/* פס אקסנט בצד ההתחלה (ימין ב-RTL) */}
      <div
        className="absolute inset-y-0 start-0 w-1 bg-warning"
        aria-hidden="true"
      />

      <div className="p-4 ps-5 sm:p-5 sm:ps-6">
        {/* כותרת הבלוק */}
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle
            className="h-5 w-5 shrink-0 text-warning"
            aria-hidden="true"
          />
          <h2 className="text-base font-semibold text-warning">
            התראות רפואיות
          </h2>
        </div>

        {/* שדות מלאים בלבד, עם תווית ועם ערך מודגש */}
        <dl className="space-y-2">
          {activeFields.map(({ key, label }) => (
            <div
              key={key}
              className="flex flex-col gap-0.5 sm:flex-row sm:gap-2"
            >
              <dt className="min-w-[9rem] shrink-0 text-sm font-medium text-warning/80">
                {label}:
              </dt>
              <dd className="text-sm font-bold text-charcoal">
                {data[key]}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
