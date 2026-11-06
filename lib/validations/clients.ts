/**
 * ולידציה ל-API ניהול לקוחות (admin) — יצירה/עדכון (משימה 3.2, FR-CL-01).
 *
 * ולידציה בצד שרת בלבד (אין UI עדיין — ראו משימה 3.5), עקבית בסגנון עם
 * `lib/validations/contact.ts` (ללא ספריית סכמות חיצונית כמו zod, כדי
 * להישאר תואם למוסכמות הקיימות בפרויקט).
 */

import { isValidIsraeliPhone, normalizeIsraeliPhone } from "@/lib/validations/contact";

export const CLIENT_GENDERS = ["female", "male", "other"] as const;
export type ClientGenderInput = (typeof CLIENT_GENDERS)[number];

export const CLIENT_MARKETING_CONSENT_CHANNELS = [
  "none",
  "landing_page",
  "whatsapp",
  "sms",
  "email",
  "in_person",
] as const;
export type ClientMarketingConsentChannelInput =
  (typeof CLIENT_MARKETING_CONSENT_CHANNELS)[number];

/** שדות הניתנים ליצירה. `phone` חובה וייחודי (FR-CL-01). */
export type CreateClientInput = {
  firstName: string;
  lastName: string;
  phone: string;
  gender?: ClientGenderInput | null;
  birthDate?: string | null; // ISO date string
  email?: string | null;
  city?: string | null;
  source?: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  note?: string | null;
  marketingConsentChannel?: ClientMarketingConsentChannelInput;
  requestedTreatmentId?: string | null;
  tagIds?: string[];
  // התראות רפואיות — task 4.3, §4.1 FR-PR-01 (partial). Free-text, all optional.
  allergies?: string | null;
  medications?: string | null;
  pregnancyNursing?: string | null;
  medicalConditions?: string | null;
};

/** שדות הניתנים לעדכון חלקי — כל שדה אופציונלי (PATCH). */
export type UpdateClientInput = Partial<CreateClientInput>;

export type ClientValidationErrors = Partial<
  Record<
    | "firstName"
    | "lastName"
    | "phone"
    | "gender"
    | "birthDate"
    | "email"
    | "marketingConsentChannel",
    string
  >
>;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidIsoDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

/**
 * ולידציה ליצירת לקוח. כל השדות שנדרשים ב-FR-CL-01 (שם פרטי, שם משפחה,
 * טלפון) הם שדות חובה כאן.
 */
export function validateCreateClient(
  input: CreateClientInput
): ClientValidationErrors {
  const errors: ClientValidationErrors = {};

  if (!input.firstName?.trim()) {
    errors.firstName = "נא להזין שם פרטי";
  }

  if (!input.lastName?.trim()) {
    errors.lastName = "נא להזין שם משפחה";
  }

  if (!input.phone?.trim()) {
    errors.phone = "נא להזין מספר טלפון";
  } else if (!isValidIsraeliPhone(input.phone)) {
    errors.phone = "מספר טלפון לא תקין — נא להזין מספר ישראלי תקין";
  }

  Object.assign(errors, validateCommonFields(input));

  return errors;
}

/**
 * ולידציה לעדכון חלקי — בודקת רק שדות שהוגשו בפועל (לא כל שדה חובה כמו
 * ביצירה), כדי לאפשר PATCH של שדה בודד.
 */
export function validateUpdateClient(
  input: UpdateClientInput
): ClientValidationErrors {
  const errors: ClientValidationErrors = {};

  if (input.firstName !== undefined && !input.firstName.trim()) {
    errors.firstName = "שם פרטי לא יכול להיות ריק";
  }

  if (input.lastName !== undefined && !input.lastName.trim()) {
    errors.lastName = "שם משפחה לא יכול להיות ריק";
  }

  if (input.phone !== undefined) {
    if (!input.phone.trim()) {
      errors.phone = "מספר טלפון לא יכול להיות ריק";
    } else if (!isValidIsraeliPhone(input.phone)) {
      errors.phone = "מספר טלפון לא תקין — נא להזין מספר ישראלי תקין";
    }
  }

  Object.assign(errors, validateCommonFields(input));

  return errors;
}

function validateCommonFields(
  input: UpdateClientInput
): ClientValidationErrors {
  const errors: ClientValidationErrors = {};

  if (input.gender != null && !CLIENT_GENDERS.includes(input.gender)) {
    errors.gender = "מין לא תקין";
  }

  if (input.birthDate != null && !isValidIsoDate(input.birthDate)) {
    errors.birthDate = "תאריך לידה לא תקין";
  }

  if (input.email != null && input.email !== "" && !isValidEmail(input.email)) {
    errors.email = "כתובת אימייל לא תקינה";
  }

  if (
    input.marketingConsentChannel != null &&
    !CLIENT_MARKETING_CONSENT_CHANNELS.includes(input.marketingConsentChannel)
  ) {
    errors.marketingConsentChannel = "ערוץ הסכמה לא תקין";
  }

  return errors;
}

export function isClientValid(errors: ClientValidationErrors): boolean {
  return Object.keys(errors).length === 0;
}

/**
 * ולידציה למיזוג כפילויות (משימה 3.4, FR-CL-02) — ה-"ערך הסופי" הנבחר לכל
 * שדה חייב לעמוד באותם כללים כמו יצירת לקוח (שם פרטי/שם משפחה/טלפון חובה,
 * טלפון בפורמט ישראלי), כי הוא יישמר כערך הסופי ברשומת השורדת.
 */
export type MergeClientsInput = {
  survivorId: string;
  duplicateId: string;
  resolved: CreateClientInput;
};

export type MergeValidationErrors = ClientValidationErrors & {
  survivorId?: string;
  duplicateId?: string;
};

export function validateMergeClients(
  input: Partial<MergeClientsInput>
): MergeValidationErrors {
  const errors: MergeValidationErrors = {};

  if (!input.survivorId?.trim()) {
    errors.survivorId = "נא לבחור לקוח שישרוד את המיזוג";
  }

  if (!input.duplicateId?.trim()) {
    errors.duplicateId = "נא לבחור את הלקוח הכפול לארכוב";
  }

  if (
    input.survivorId &&
    input.duplicateId &&
    input.survivorId === input.duplicateId
  ) {
    errors.duplicateId = "לא ניתן למזג לקוח עם עצמו";
  }

  if (!input.resolved) {
    errors.phone = "נא לבחור ערך סופי לכל שדה";
    return errors;
  }

  Object.assign(errors, validateCreateClient(input.resolved));

  return errors;
}

export { normalizeIsraeliPhone };
