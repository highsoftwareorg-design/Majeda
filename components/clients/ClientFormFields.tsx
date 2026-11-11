"use client";

/**
 * שדות משותפים לטופס לקוח/ה — משימות 11.4 (יצירה) ו-11.5 (עריכה), FR-CL-01.
 *
 * מרכז את מבנה השדות, קבועי האפשרויות, מחלקות ה-CSS והודעת הכפילות (טלפון)
 * כדי שלא לשכפל אותם בין `NewClientDialog` ל-`EditClientDialog`.
 * השדות הרפואיים אינם כאן (הם ב-`MedicalAlertsForm`).
 *
 * `idPrefix` מאפשר מזהי DOM שונים לכל טופס (למשל "nc" ו-"ec") כך שאין התנגשות.
 */

import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  ClientValidationErrors,
  ClientGenderInput,
  ClientMarketingConsentChannelInput,
} from "@/lib/validations/clients";
import { normalizeIsraeliPhone } from "@/lib/validations/clients";

export type ClientFormTagOption = { id: string; name: string };

export const GENDER_OPTIONS: { value: "" | ClientGenderInput; label: string }[] = [
  { value: "", label: "לא צוין" },
  { value: "female", label: "נקבה" },
  { value: "male", label: "זכר" },
  { value: "other", label: "אחר" },
];

export const CONSENT_OPTIONS: { value: ClientMarketingConsentChannelInput; label: string }[] = [
  { value: "none", label: "ללא הסכמה לדיוור" },
  { value: "landing_page", label: "דף נחיתה" },
  { value: "whatsapp", label: "וואטסאפ" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "אימייל" },
  { value: "in_person", label: "פנים אל פנים" },
];

/** ערכי הטופס (מחרוזות גולמיות לשדות קלט). */
export type ClientFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  gender: "" | ClientGenderInput;
  birthDate: string;
  email: string;
  city: string;
  source: string;
  tagIds: string[];
  marketingConsentChannel: ClientMarketingConsentChannelInput;
  note: string;
};

/** פרטי הלקוח/ה הקיים/ה שנמצא/ה לאחר 409 — לקישור לפרופיל. */
export type ExistingClientRef = { id: string; name: string } | null;

export const INPUT_CLASS = cn(
  "h-11 w-full rounded-lg border border-gold-antique/40 bg-porcelain px-3 text-base text-charcoal",
  "placeholder:text-taupe/70 focus:outline-none focus:ring-2 focus:ring-gold-dark focus:ring-offset-1"
);

export const INPUT_ERROR_CLASS = "border-red-400 focus:ring-red-400";

/** מחפש לקוח/ה קיים/ה לפי טלפון מנורמל דרך ה-API הקיים של הרשימה (GET). */
export async function findExistingClientByPhone(phone: string): Promise<ExistingClientRef> {
  const normalized = normalizeIsraeliPhone(phone);
  try {
    const response = await fetch(`/api/clients?q=${encodeURIComponent(normalized)}`);
    if (!response.ok) return null;
    const body = (await response.json()) as {
      clients?: { id: string; firstName: string; lastName: string; phone: string }[];
    };
    const match = body.clients?.find(
      (c) => normalizeIsraeliPhone(c.phone) === normalized
    );
    return match ? { id: match.id, name: `${match.firstName} ${match.lastName}` } : null;
  } catch {
    return null;
  }
}

type ClientFormFieldsProps = {
  idPrefix: string;
  values: ClientFormValues;
  errors: ClientValidationErrors;
  tags: ClientFormTagOption[];
  duplicatePhone: boolean;
  existing: ExistingClientRef;
  onChange: <K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) => void;
  onToggleTag: (tagId: string) => void;
  /** תגיות שאי אפשר לבטל כאן (למשל תגיות קיימות בעריכה). */
  lockedTagIds?: string[];
  /** הסבר קצר מתחת לכותרת התגיות (אופציונלי). */
  tagHint?: string;
};

/** שדות הטופס המשותפים: שם, טלפון, מין, לידה, אימייל, עיר, מקור, הסכמה, תגיות והערות. */
export function ClientFormFields({
  idPrefix,
  values,
  errors,
  tags,
  duplicatePhone,
  existing,
  onChange,
  onToggleTag,
  lockedTagIds = [],
  tagHint,
}: ClientFormFieldsProps) {
  const id = (name: string) => `${idPrefix}-${name}`;
  const errId = (name: string) => `${idPrefix}-${name}-error`;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("first-name")} className="text-sm font-medium text-charcoal">
            שם פרטי <span aria-hidden="true" className="text-red-600">*</span>
          </Label>
          <Input
            id={id("first-name")}
            name="firstName"
            autoComplete="off"
            required
            aria-required="true"
            aria-invalid={Boolean(errors.firstName) || undefined}
            aria-describedby={errors.firstName ? errId("first-name") : undefined}
            value={values.firstName}
            onChange={(e) => onChange("firstName", e.target.value)}
            className={cn("h-11 bg-porcelain text-base", errors.firstName && INPUT_ERROR_CLASS)}
          />
          {errors.firstName && (
            <p id={errId("first-name")} role="alert" className="text-xs text-red-600">
              {errors.firstName}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("last-name")} className="text-sm font-medium text-charcoal">
            שם משפחה <span aria-hidden="true" className="text-red-600">*</span>
          </Label>
          <Input
            id={id("last-name")}
            name="lastName"
            autoComplete="off"
            required
            aria-required="true"
            aria-invalid={Boolean(errors.lastName) || undefined}
            aria-describedby={errors.lastName ? errId("last-name") : undefined}
            value={values.lastName}
            onChange={(e) => onChange("lastName", e.target.value)}
            className={cn("h-11 bg-porcelain text-base", errors.lastName && INPUT_ERROR_CLASS)}
          />
          {errors.lastName && (
            <p id={errId("last-name")} role="alert" className="text-xs text-red-600">
              {errors.lastName}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={id("phone")} className="text-sm font-medium text-charcoal">
            טלפון <span aria-hidden="true" className="text-red-600">*</span>
          </Label>
          <Input
            id={id("phone")}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            placeholder="050-1234567"
            required
            aria-required="true"
            aria-invalid={Boolean(errors.phone) || undefined}
            aria-describedby={errors.phone ? errId("phone") : undefined}
            value={values.phone}
            onChange={(e) => onChange("phone", e.target.value)}
            className={cn(
              "h-11 bg-porcelain text-base text-start",
              errors.phone && INPUT_ERROR_CLASS
            )}
          />
          {errors.phone && (
            <p id={errId("phone")} role="alert" className="text-xs text-red-600">
              {errors.phone}
            </p>
          )}
          {duplicatePhone && (
            <div
              role="alert"
              className="flex flex-col gap-2 rounded-lg border border-gold-dark/50 bg-champagne p-3 text-sm text-charcoal"
            >
              {existing ? (
                <>
                  <p>
                    מספר הטלפון שייך ללקוח/ה {existing.name} במערכת. לא ניתן ליצור כפילות.
                  </p>
                  <Link
                    href={`/clients/${existing.id}`}
                    className="inline-flex min-h-11 items-center font-medium text-gold-dark underline-offset-2 hover:underline"
                  >
                    מעבר לכרטיס הלקוח/ה הקיים/ה
                  </Link>
                </>
              ) : (
                <>
                  <p>
                    מספר הטלפון כבר קיים במערכת, ייתכן בכרטיס שבארכיון. ניתן לבדוק
                    באיתור כפילויות.
                  </p>
                  <Link
                    href="/clients/duplicates"
                    className="inline-flex min-h-11 items-center font-medium text-gold-dark underline-offset-2 hover:underline"
                  >
                    מעבר לאיתור כפילויות
                  </Link>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("gender")} className="text-sm font-medium text-charcoal">
            מין
          </Label>
          <select
            id={id("gender")}
            name="gender"
            value={values.gender}
            onChange={(e) => onChange("gender", e.target.value as ClientFormValues["gender"])}
            className={cn(INPUT_CLASS, errors.gender && INPUT_ERROR_CLASS)}
          >
            {GENDER_OPTIONS.map((option) => (
              <option key={option.value || "none"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("birth-date")} className="text-sm font-medium text-charcoal">
            תאריך לידה
          </Label>
          <input
            id={id("birth-date")}
            name="birthDate"
            type="date"
            dir="ltr"
            value={values.birthDate}
            onChange={(e) => onChange("birthDate", e.target.value)}
            aria-invalid={Boolean(errors.birthDate) || undefined}
            className={cn(INPUT_CLASS, errors.birthDate && INPUT_ERROR_CLASS)}
          />
          {errors.birthDate && (
            <p role="alert" className="text-xs text-red-600">
              {errors.birthDate}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("email")} className="text-sm font-medium text-charcoal">
            אימייל
          </Label>
          <Input
            id={id("email")}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            aria-invalid={Boolean(errors.email) || undefined}
            aria-describedby={errors.email ? errId("email") : undefined}
            value={values.email}
            onChange={(e) => onChange("email", e.target.value)}
            className={cn("h-11 bg-porcelain text-base text-start", errors.email && INPUT_ERROR_CLASS)}
          />
          {errors.email && (
            <p id={errId("email")} role="alert" className="text-xs text-red-600">
              {errors.email}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("city")} className="text-sm font-medium text-charcoal">
            עיר
          </Label>
          <Input
            id={id("city")}
            name="city"
            autoComplete="off"
            value={values.city}
            onChange={(e) => onChange("city", e.target.value)}
            className="h-11 bg-porcelain text-base"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("source")} className="text-sm font-medium text-charcoal">
            מקור הגעה
          </Label>
          <Input
            id={id("source")}
            name="source"
            autoComplete="off"
            placeholder="לדוגמה: אינסטגרם, המלצה"
            value={values.source}
            onChange={(e) => onChange("source", e.target.value)}
            className="h-11 bg-porcelain text-base"
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={id("consent")} className="text-sm font-medium text-charcoal">
            ערוץ הסכמה לדיוור
          </Label>
          <select
            id={id("consent")}
            name="marketingConsentChannel"
            value={values.marketingConsentChannel}
            onChange={(e) =>
              onChange(
                "marketingConsentChannel",
                e.target.value as ClientMarketingConsentChannelInput
              )
            }
            className={INPUT_CLASS}
          >
            {CONSENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {tags.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-charcoal">תגיות</legend>
          {tagHint && <p className="text-xs text-taupe">{tagHint}</p>}
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              const checked = values.tagIds.includes(tag.id);
              const locked = lockedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={checked}
                  disabled={locked}
                  onClick={() => onToggleTag(tag.id)}
                  className={cn(
                    "min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1",
                    "disabled:cursor-not-allowed",
                    checked
                      ? "border-gold-dark bg-gold-dark text-champagne"
                      : "border-gold-antique/40 bg-porcelain text-charcoal hover:border-gold-dark/60 hover:bg-champagne",
                    locked && "opacity-70"
                  )}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id("note")} className="text-sm font-medium text-charcoal">
          הערות
        </Label>
        <Textarea
          id={id("note")}
          name="note"
          rows={3}
          value={values.note}
          onChange={(e) => onChange("note", e.target.value)}
          className="bg-porcelain text-base"
        />
      </div>
    </>
  );
}
