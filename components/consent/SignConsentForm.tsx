"use client";

/**
 * SignConsentForm — טופס חתימה דיגיטלית (משימה 7.6, FR-CF-04, FR-CF-05).
 *
 * רכיב Client שמציג את שדות טופס ההסכמה לחתימה:
 * - פרטים ממולאים מראש (שם לקוח/ה, טיפול, תאריך)
 * - שדות מסוגים שונים: text / boolean / checkbox / signature
 * - שדות אפוטרופוס (guardianName, guardianIdNumber) עבור קטינים/ות
 * - כפתור "חתום" מוגבל עד שכל התנאים מתקיימים
 *
 * RTL, עברית, mobile-first.
 */

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { SignaturePad, type SignaturePadRef } from "./SignaturePad";

/** מבנה שדה בטופס ההסכמה (תואם ל-ConsentTemplate.fields ב-Prisma) */
interface ConsentField {
  id: string;
  type: "text" | "boolean" | "checkbox" | "signature";
  label: string;
  required?: boolean;
}

interface SignConsentFormProps {
  token: string;
  signedConsentId: string;
  clientName: string;
  isMinor: boolean;
  fields: ConsentField[];
  treatmentName: string | null;
  /** תאריך/שעת התור אם קיים */
  signedAt: string | null;
}

export function SignConsentForm({
  token,
  clientName,
  isMinor,
  fields,
  treatmentName,
  signedAt,
}: SignConsentFormProps) {
  // ערכי השדות — key = field.id, value = string | boolean
  const [fieldValues, setFieldValues] = useState<
    Record<string, string | boolean>
  >({});
  const [guardianName, setGuardianName] = useState("");
  const [guardianIdNumber, setGuardianIdNumber] = useState("");
  const [signatureEmpty, setSignatureEmpty] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const signaturePadRef = useRef<SignaturePadRef>(null);

  // האם יש שדה חתימה בטופס
  const hasSignatureField = fields.some((f) => f.type === "signature");

  // כל ה-checkboxes הנדרשים
  const requiredCheckboxes = fields.filter(
    (f) => f.type === "checkbox" && f.required
  );

  const allRequiredCheckboxesChecked = requiredCheckboxes.every(
    (f) => fieldValues[f.id] === true
  );

  const guardianFieldsValid =
    !isMinor ||
    (guardianName.trim().length > 0 && guardianIdNumber.trim().length > 0);

  /**
   * כפתור "חתום" מופעל רק כאשר:
   * 1. כל ה-checkboxes הנדרשים מסומנים
   * 2. אם יש שדה חתימה — לוח החתימה אינו ריק
   * 3. אם קטין/ה — שדות אפוטרופוס מלאים
   */
  const isSubmitEnabled =
    allRequiredCheckboxesChecked &&
    (!hasSignatureField || !signatureEmpty) &&
    guardianFieldsValid;

  const todayDisplay = new Date().toLocaleDateString("he-IL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // תאריך התור מפורמט (אם קיים)
  const appointmentDateDisplay = signedAt
    ? new Date(signedAt).toLocaleDateString("he-IL", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSubmitEnabled || isSubmitting) return;

    setSubmitError(null);
    setIsSubmitting(true);

    const signatureClientData = hasSignatureField
      ? (signaturePadRef.current?.exportDataURL() ?? "")
      : "";

    try {
      const res = await fetch(`/api/sign/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldValues,
          signatureClientData,
          ...(isMinor ? { guardianName, guardianIdNumber } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSubmitError(
          (data as { error?: string }).error ?? "שגיאה בשמירת הטופס. נסה/י שוב."
        );
        return;
      }

      setSubmitted(true);
    } catch {
      setSubmitError("שגיאת רשת. בדוק/י חיבור אינטרנט ונסה/י שוב.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div
        dir="rtl"
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center"
      >
        <div className="text-green-600 text-5xl mb-4" aria-hidden="true">
          ✓
        </div>
        <h2 className="text-xl font-bold text-green-700 mb-2">
          חתמת בהצלחה! תודה
        </h2>
        <p className="text-gray-600 text-sm">
          פרטי החתימה נשמרו בהצלחה. ניתן לסגור דף זה.
        </p>
      </div>
    );
  }

  return (
    <form
      dir="rtl"
      onSubmit={handleSubmit}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col gap-6"
      noValidate
    >
      {/* פרטים ממולאים מראש */}
      <section
        aria-labelledby="prefilled-heading"
        className="bg-gray-50 rounded-lg p-4 flex flex-col gap-2 text-sm"
      >
        <h2
          id="prefilled-heading"
          className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1"
        >
          פרטי הטופס
        </h2>
        <div className="flex justify-between gap-2">
          <span className="text-gray-500">שם הלקוח/ה</span>
          <span className="font-medium text-end">{clientName}</span>
        </div>
        {treatmentName && (
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">טיפול</span>
            <span className="font-medium text-end">{treatmentName}</span>
          </div>
        )}
        {appointmentDateDisplay && (
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">תאריך התור</span>
            <span className="font-medium text-end">{appointmentDateDisplay}</span>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <span className="text-gray-500">תאריך חתימה</span>
          <span className="font-medium text-end">{todayDisplay}</span>
        </div>
      </section>

      {/* שדות הטופס */}
      {fields.length > 0 && (
        <section className="flex flex-col gap-5" aria-label="שדות הטופס">
          {fields.map((field) => renderField(field, fieldValues, setFieldValues, signaturePadRef, setSignatureEmpty, signatureEmpty))}
        </section>
      )}

      {/* שדות אפוטרופוס — מוצג רק לקטינים */}
      {isMinor && (
        <section
          aria-labelledby="guardian-heading"
          className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col gap-4"
        >
          <h3
            id="guardian-heading"
            className="text-sm font-semibold text-amber-800"
          >
            פרטי אפוטרופוס — נדרשים עבור קטין/ה
          </h3>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="guardianName"
              className="text-sm font-medium text-gray-700"
            >
              שם האפוטרופוס <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="guardianName"
              type="text"
              autoComplete="name"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--color-gold,#D2AB2E)]"
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="guardianIdNumber"
              className="text-sm font-medium text-gray-700"
            >
              מספר תעודת זהות <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="guardianIdNumber"
              type="text"
              inputMode="numeric"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--color-gold,#D2AB2E)]"
              value={guardianIdNumber}
              onChange={(e) => setGuardianIdNumber(e.target.value)}
              required
            />
          </div>
        </section>
      )}

      {/* הסבר מדוע הכפתור מנוטרל */}
      {!isSubmitEnabled && (
        <div role="alert" aria-live="polite">
          <ul className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 list-disc list-inside space-y-1">
            {!allRequiredCheckboxesChecked && (
              <li>יש לסמן את כל התיבות הנדרשות</li>
            )}
            {hasSignatureField && signatureEmpty && (
              <li>יש לחתום בלוח החתימה</li>
            )}
            {isMinor && !guardianName.trim() && (
              <li>יש להזין שם אפוטרופוס</li>
            )}
            {isMinor && !guardianIdNumber.trim() && (
              <li>יש להזין מספר תעודת זהות של האפוטרופוס</li>
            )}
          </ul>
        </div>
      )}

      {/* הודעת שגיאה מהשרת */}
      {submitError && (
        <div
          role="alert"
          aria-live="assertive"
          className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3"
        >
          {submitError}
        </div>
      )}

      {/* כפתור חתימה */}
      <Button
        type="submit"
        disabled={!isSubmitEnabled || isSubmitting}
        className="w-full py-6 text-base font-semibold bg-[color:var(--color-gold,#D2AB2E)] hover:bg-[color:var(--color-gold-dark,#7A5F10)] text-[color:var(--color-ink,#0B0B0B)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-disabled={!isSubmitEnabled || isSubmitting}
      >
        {isSubmitting ? "שומר..." : "חתום על הטופס"}
      </Button>
    </form>
  );
}

/** פונקציה עזר לרינדור שדה לפי סוג */
function renderField(
  field: ConsentField,
  fieldValues: Record<string, string | boolean>,
  setFieldValues: React.Dispatch<
    React.SetStateAction<Record<string, string | boolean>>
  >,
  signaturePadRef: React.RefObject<SignaturePadRef | null>,
  setSignatureEmpty: (v: boolean) => void,
  signatureEmpty: boolean
): React.ReactNode {
  switch (field.type) {
    case "text":
      return (
        <div key={field.id} className="flex flex-col gap-1">
          <label
            htmlFor={`field-${field.id}`}
            className="text-sm font-medium text-gray-700"
          >
            {field.label}
            {field.required && (
              <span className="text-red-500 me-1" aria-hidden="true">
                {" "}*
              </span>
            )}
          </label>
          <input
            id={`field-${field.id}`}
            type="text"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--color-gold,#D2AB2E)]"
            value={(fieldValues[field.id] as string) ?? ""}
            onChange={(e) =>
              setFieldValues((prev) => ({
                ...prev,
                [field.id]: e.target.value,
              }))
            }
            required={field.required}
          />
        </div>
      );

    case "boolean":
      return (
        <fieldset key={field.id} className="flex flex-col gap-2 border-none p-0 m-0">
          <legend className="text-sm font-medium text-gray-700">
            {field.label}
            {field.required && (
              <span className="text-red-500 me-1" aria-hidden="true">
                {" "}*
              </span>
            )}
          </legend>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
              <input
                type="radio"
                name={`field-${field.id}`}
                value="yes"
                checked={fieldValues[field.id] === true}
                onChange={() =>
                  setFieldValues((prev) => ({ ...prev, [field.id]: true }))
                }
                className="w-4 h-4"
              />
              <span className="text-sm">כן</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
              <input
                type="radio"
                name={`field-${field.id}`}
                value="no"
                checked={fieldValues[field.id] === false}
                onChange={() =>
                  setFieldValues((prev) => ({ ...prev, [field.id]: false }))
                }
                className="w-4 h-4"
              />
              <span className="text-sm">לא</span>
            </label>
          </div>
        </fieldset>
      );

    case "checkbox":
      return (
        <div key={field.id} className="flex items-start gap-3 min-h-[44px]">
          <input
            id={`field-${field.id}`}
            type="checkbox"
            className="w-5 h-5 mt-0.5 cursor-pointer accent-[color:var(--color-gold,#D2AB2E)] shrink-0"
            checked={(fieldValues[field.id] as boolean) ?? false}
            onChange={(e) =>
              setFieldValues((prev) => ({
                ...prev,
                [field.id]: e.target.checked,
              }))
            }
            required={field.required}
          />
          <label
            htmlFor={`field-${field.id}`}
            className="text-sm text-gray-700 cursor-pointer leading-relaxed pt-0.5"
          >
            {field.label}
            {field.required && (
              <span className="text-red-500 me-1" aria-hidden="true">
                {" "}*
              </span>
            )}
          </label>
        </div>
      );

    case "signature":
      return (
        <div key={field.id} className="flex flex-col gap-2">
          <span className="text-sm font-medium text-gray-700">
            {field.label}
            {field.required && (
              <span className="text-red-500 me-1" aria-hidden="true">
                {" "}*
              </span>
            )}
          </span>
          <SignaturePad
            ref={signaturePadRef}
            onChange={(isEmpty) => setSignatureEmpty(isEmpty)}
          />
          {signatureEmpty && (
            <p className="text-xs text-amber-600" role="note">
              חתמו בתיבה למעלה לפני שליחת הטופס
            </p>
          )}
        </div>
      );

    default:
      return null;
  }
}
