"use server";

/**
 * Server Action: שליחת טופס "השארת פרטים" מדף הנחיתה (משימה 2.7).
 *
 * יוצר/מעדכן רשומת `Client` לפי מספר טלפון (upsert) — ללא שליחת
 * WhatsApp/אימייל בפועל (תחום נפרד). ולידציה מתבצעת שוב כאן בצד השרת
 * (לא סומכים על הולידציה בצד הלקוח בלבד), באמצעות אותה לוגיקה המשותפת
 * ב-`lib/validations/contact.ts`.
 *
 * הערה (פרטיות — §11, הנחיות הארגון): אין להדפיס ללוג (console.log)
 * שם/טלפון/הערה של לקוחה אמיתית או מדומה. שגיאות מדווחות ללא פרטי PII.
 */

import { prisma } from "@/lib/db/prisma";
import {
  validateContactForm,
  isContactFormValid,
  normalizeIsraeliPhone,
  type ContactFormValues,
} from "@/lib/validations/contact";

export type SubmitContactFormResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * הטופס בדף הנחיתה אוסף שם מלא בשדה אחד, אך מודל ה-`Client` (משימה 3.1)
 * דורש שם פרטי ושם משפחה בנפרד (SRS §3/§12.1). מפצלים לפי הרווח הראשון —
 * אם לא הוזן שם משפחה, הוא נשמר כמחרוזת ריקה.
 */
function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const spaceIndex = trimmed.indexOf(" ");

  if (spaceIndex === -1) {
    return { firstName: trimmed, lastName: "" };
  }

  return {
    firstName: trimmed.slice(0, spaceIndex).trim(),
    lastName: trimmed.slice(spaceIndex + 1).trim(),
  };
}

export async function submitContactForm(
  values: ContactFormValues
): Promise<SubmitContactFormResult> {
  const errors = validateContactForm(values);

  if (!isContactFormValid(errors)) {
    return {
      ok: false,
      message: "נא לתקן את השדות המסומנים ולנסות שוב.",
    };
  }

  const phone = normalizeIsraeliPhone(values.phone);
  const { firstName, lastName } = splitFullName(values.name);
  const note = values.note.trim();
  const marketingConsentChannel = values.marketingConsent ? "landing_page" : "none";
  const marketingConsentAt = values.marketingConsent ? new Date() : null;

  try {
    await prisma.client.upsert({
      where: { phone },
      create: {
        phone,
        firstName,
        lastName,
        note: note || null,
        requestedTreatmentId: values.treatmentId || null,
        marketingConsentChannel,
        marketingConsentAt,
        source: "landing_page",
      },
      update: {
        firstName,
        lastName,
        note: note || null,
        requestedTreatmentId: values.treatmentId || null,
        marketingConsentChannel,
        marketingConsentAt,
        source: "landing_page",
      },
    });

    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "אירעה שגיאה בשליחת הפרטים. נא לנסות שוב מאוחר יותר.",
    };
  }
}
