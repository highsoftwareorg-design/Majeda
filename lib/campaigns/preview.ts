/**
 * lib/campaigns/preview.ts
 * Task 9.3 — החלפת משתנים בגוף תבנית קמפיין (FR-MK-02).
 *
 * קובץ טהור (ללא Prisma / Node-only APIs) כדי שיהיה בשימוש גם בקומפוננטת הלקוח
 * (CampaignPreview) וגם בשרת (נתיב בדיקה ושליחה).
 *
 * הערה (פרטיות — §11): ערכי הדוגמה הם בדויים בלבד, אין כאן נתוני לקוחות אמיתיים.
 */

/** תבנית placeholder בפורמט {שם_משתנה} */
const PLACEHOLDER_RE = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/** ערכי דוגמה לתצוגה מקדימה (נמען בדוי) */
export const SAMPLE_RECIPIENT_NAME = "שרה לוי";
export const SAMPLE_TEST_RECIPIENT_NAME = "שרה (בדיקה)";

/** שמות המשתנים המופיעים בגוף התבנית (ללא כפילויות, בסדר הופעה) */
export function extractPlaceholders(body: string): string[] {
  const names = new Set<string>();
  for (const match of body.matchAll(PLACEHOLDER_RE)) {
    names.add(match[1]);
  }
  return [...names];
}

/** תאריך נוכחי בפורמט DD/MM/YYYY (אזור ישראל) */
export function formatTodayIsrael(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(now);
}

/**
 * בונה ערכי דוגמה לכל placeholder שנמצא בתבנית.
 * `overrides` מאפשר לדרוס ערכים (למשל name בבדיקה לאדמין).
 */
export function buildSampleVariables(
  placeholders: string[],
  overrides: Record<string, string> = {}
): Record<string, string> {
  const defaults: Record<string, string> = {
    name: SAMPLE_RECIPIENT_NAME,
    date: formatTodayIsrael(),
    time: "10:00",
    treatment: "טיפול פנים",
    therapist: "מיכל",
  };
  const result: Record<string, string> = {};
  for (const key of new Set(["name", ...placeholders])) {
    result[key] = overrides[key] ?? defaults[key] ?? "";
  }
  return result;
}

/** מחליף כל placeholder מוכר בערך; placeholder שאין לו ערך נשאר כמו שהוא */
export function renderTemplateBody(
  body: string,
  variables: Record<string, string>
): string {
  return body.replace(PLACEHOLDER_RE, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : whole
  );
}
