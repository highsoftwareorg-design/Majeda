/**
 * ולידציה לטופס "השארת פרטים" בדף הנחיתה (משימה 2.6).
 * ולידציה בצד לקוח בלבד — ללא תלות בספריית סכמות חיצונית (zod וכו׳),
 * כדי להישאר עקבי עם שאר הפרויקט שעדיין לא כולל ספרייה כזו.
 */

export type ContactFormValues = {
  name: string;
  phone: string;
  treatmentId: string;
  note: string;
  marketingConsent: boolean;
};

export type ContactFormErrors = Partial<
  Record<keyof Omit<ContactFormValues, "marketingConsent">, string>
>;

/**
 * בדיקת פורמט טלפון ישראלי בסיסי: תומך ב-05XXXXXXXX (10 ספרות)
 * וב-+9725XXXXXXXX / 9725XXXXXXXX (עם קידומת מדינה).
 * רווחים ומקפים בין הספרות מתעלמים מהם.
 */
export function isValidIsraeliPhone(rawPhone: string): boolean {
  const normalized = rawPhone.replace(/[\s-]/g, "");
  const localPattern = /^05\d{8}$/; // 05XXXXXXXX
  const intlPattern = /^\+?9725\d{8}$/; // +9725XXXXXXXX / 9725XXXXXXXX
  return localPattern.test(normalized) || intlPattern.test(normalized);
}

export function validateContactForm(
  values: ContactFormValues
): ContactFormErrors {
  const errors: ContactFormErrors = {};

  if (!values.name.trim()) {
    errors.name = "נא להזין שם מלא";
  }

  if (!values.phone.trim()) {
    errors.phone = "נא להזין מספר טלפון";
  } else if (!isValidIsraeliPhone(values.phone)) {
    errors.phone = "מספר טלפון לא תקין — נא להזין מספר ישראלי תקין (לדוגמה: 050-1234567)";
  }

  return errors;
}

export function isContactFormValid(errors: ContactFormErrors): boolean {
  return Object.keys(errors).length === 0;
}

/**
 * נרמול מספר טלפון ישראלי לפורמט אחיד (05XXXXXXXX) לצורך שמירה/זיהוי
 * ייחודי במסד הנתונים (משימה 2.7) — כדי שאותו מספר שהוזן בפורמטים שונים
 * (עם/בלי +972, עם/בלי רווחים ומקפים) יזוהה כאותו לקוח ולא ייצור כפילות.
 * יש לקרוא לפונקציה רק אחרי שעבר `isValidIsraeliPhone`.
 */
export function normalizeIsraeliPhone(rawPhone: string): string {
  const digitsOnly = rawPhone.replace(/[\s-]/g, "").replace(/^\+/, "");
  if (digitsOnly.startsWith("972")) {
    return `0${digitsOnly.slice(3)}`;
  }
  return digitsOnly;
}
