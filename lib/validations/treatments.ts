/**
 * ולידציה ל-API קטלוג הטיפולים — יצירה/עדכון (משימה 11.7, FR-AP-02).
 *
 * ולידציה בצד שרת בלבד, בסגנון `lib/validations/clients.ts` (ללא ספריית סכמות
 * חיצונית, כי אין zod בפרויקט). השדות תואמים בדיוק למודל `Treatment` ב-Prisma.
 */

export const DEFAULT_TREATMENT_COLOR = "#D2AB2E";

export const TREATMENT_FIELDS = [
  "name",
  "description",
  "durationMinutes",
  "price",
  "recommendedReturn",
  "recommendedReturnDays",
  "color",
  "requiresConsentForm",
  "authorizedTherapists",
] as const;

export type TreatmentField = (typeof TREATMENT_FIELDS)[number];

/** הערכים המנורמלים שנשמרים ב-DB (כל השדות אופציונליים ב-PATCH). */
export type TreatmentInput = {
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  recommendedReturn: string | null;
  recommendedReturnDays: number | null;
  color: string;
  requiresConsentForm: boolean;
  authorizedTherapists: string | null;
};

export type TreatmentValidationErrors = Partial<Record<TreatmentField, string>>;

export type ParsedTreatment = {
  errors: TreatmentValidationErrors;
  data: Partial<TreatmentInput>;
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** ממיר ערך מספרי (מספר או מחרוזת מספרית) למספר שלם; אחרת NaN. */
function toInteger(value: unknown): number {
  if (typeof value === "number") return Number.isInteger(value) ? value : NaN;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim());
    return Number.isInteger(n) ? n : NaN;
  }
  return NaN;
}

/** מחרוזת אופציונלית: null / ריק → null; אחרת מחרוזת מנורמלת. */
function optionalText(value: unknown): string | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value === "string") return value.trim() || null;
  return undefined;
}

/**
 * מאמת גוף בקשה ליצירה (`create`, שדות חובה נבדקים) או לעדכון חלקי (`update`,
 * רק שדות שהוגשו נבדקים ונכללים ב-`data`).
 */
export function parseTreatmentInput(
  raw: unknown,
  mode: "create" | "update"
): ParsedTreatment {
  const errors: TreatmentValidationErrors = {};
  const data: Partial<TreatmentInput> = {};

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    errors.name = "נתונים חסרים";
    return { errors, data };
  }
  const input = raw as Record<string, unknown>;
  const has = (key: TreatmentField) =>
    input[key] !== undefined || mode === "create";

  // שם הטיפול — חובה וייחודי (הייחודיות נאכפת ב-DB, P2002 → 409)
  if (has("name")) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name) {
      errors.name = "נא להזין שם טיפול";
    } else if (name.length > 100) {
      errors.name = "שם הטיפול ארוך מדי (עד 100 תווים)";
    } else {
      data.name = name;
    }
  }

  // תיאור קצר — אופציונלי
  if (input.description !== undefined) {
    const description = optionalText(input.description);
    if (description === undefined) {
      errors.description = "תיאור לא תקין";
    } else if (description && description.length > 500) {
      errors.description = "התיאור ארוך מדי (עד 500 תווים)";
    } else {
      data.description = description;
    }
  }

  // משך בדקות — מספר שלם חיובי, חובה
  if (has("durationMinutes")) {
    const duration = toInteger(input.durationMinutes);
    if (!Number.isInteger(duration) || duration < 1 || duration > 600) {
      errors.durationMinutes = "משך הטיפול חייב להיות מספר דקות בין 1 ל-600";
    } else {
      data.durationMinutes = duration;
    }
  }

  // מחיר בשקלים שלמים — מספר שלם אי-שלילי, חובה
  if (has("price")) {
    const price = toInteger(input.price);
    if (!Number.isInteger(price) || price < 0 || price > 100000) {
      errors.price = "מחיר חייב להיות מספר שלם של שקלים (0 ומעלה)";
    } else {
      data.price = price;
    }
  }

  // זמן חזרה מומלץ — טקסט חופשי, אופציונלי (למשל "4 שבועות")
  if (input.recommendedReturn !== undefined) {
    const text = optionalText(input.recommendedReturn);
    if (text === undefined) {
      errors.recommendedReturn = "זמן חזרה לא תקין";
    } else if (text && text.length > 100) {
      errors.recommendedReturn = "טקסט זמן החזרה ארוך מדי (עד 100 תווים)";
    } else {
      data.recommendedReturn = text;
    }
  }

  // זמן חזרה מומלץ במספר ימים (לחישוב אוטומטי, משימה 4.7) — אופציונלי
  if (input.recommendedReturnDays !== undefined) {
    if (input.recommendedReturnDays === null || input.recommendedReturnDays === "") {
      data.recommendedReturnDays = null;
    } else {
      const days = toInteger(input.recommendedReturnDays);
      if (!Number.isInteger(days) || days < 1 || days > 3650) {
        errors.recommendedReturnDays = "מספר הימים חייב להיות בין 1 ל-3650";
      } else {
        data.recommendedReturnDays = days;
      }
    }
  }

  // צבע ביומן — HEX, ריק/חסר → ברירת המחדל של המותג
  if (input.color !== undefined) {
    if (input.color === null || input.color === "") {
      data.color = DEFAULT_TREATMENT_COLOR;
    } else if (typeof input.color === "string" && HEX_COLOR.test(input.color)) {
      data.color = input.color.toUpperCase();
    } else {
      errors.color = "צבע לא תקין — נא לבחור צבע";
    }
  }

  // האם נדרש טופס הסכמה — בוליאני
  if (has("requiresConsentForm")) {
    const value = input.requiresConsentForm ?? false;
    if (typeof value !== "boolean") {
      errors.requiresConsentForm = "ערך לא תקין לשדה טופס נדרש";
    } else {
      data.requiresConsentForm = value;
    }
  }

  // מטפלים מורשים — מחרוזת מופרדת בפסיקים (כמו ב-Client/Visit בשלב זה)
  if (input.authorizedTherapists !== undefined) {
    const text = optionalText(input.authorizedTherapists);
    if (text === undefined) {
      errors.authorizedTherapists = "רשימת המטפלים לא תקינה";
    } else if (text && text.length > 300) {
      errors.authorizedTherapists = "רשימת המטפלים ארוכה מדי (עד 300 תווים)";
    } else {
      data.authorizedTherapists = text
        ? text
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .join(",") || null
        : null;
    }
  }

  return { errors, data };
}

export function isTreatmentValid(errors: TreatmentValidationErrors): boolean {
  return Object.keys(errors).length === 0;
}
