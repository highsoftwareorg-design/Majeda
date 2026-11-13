/**
 * מחיקה לצמיתות של תבנית הסכמה (משימה 12.5, §12 — CASCADE).
 *
 * בלי מיגרציה ובלי `onDelete: Cascade` חדש בסכימה: כל המחיקות/הניתוקים מתבצעים
 * מפורשות בסדר ילד→הורה בתוך `prisma.$transaction` יחיד (אטומיות — כשל באמצע
 * מחזיר rollback מלא).
 *
 * סדר הפעולות בטרנזקציה:
 *   1. איסוף מפתחות `pdfStorageKey` של ה-SignedConsent של התבנית (להחזרה בלבד).
 *   2. ניתוק הקשר העצמי (`previousVersionId`) מגרסאות שמצביעות לתבנית זו.
 *   3. מחיקת ה-SignedConsent של התבנית (cascade מאושר — Restrict על `templateId`).
 *   4. מחיקת התבנית עצמה.
 *
 * מפתחות R2 (`pdfStorageKey`) אינם נמחקים מהאחסון (אין פונקציית מחיקה ב-`lib/consent/r2.ts`) —
 * הם מוחזרים לקורא לצורך ניקוי עתידי.
 *
 * הערה (פרטיות — §11): אין להדפיס ללוג PII (שמות, תוכן טפסים, תוכן רפואי).
 */

import { prisma } from "@/lib/db/prisma";

export type HardDeleteConsentTemplateResult = {
  /** מפתחות ה-PDF של ה-SignedConsent שנמחקו — יתומים ב-R2 (ללא שמות לקוח/ה). */
  orphanedPdfKeys: string[];
};

/** זמן מקסימלי לטרנזקציה (ms). */
const TRANSACTION_TIMEOUT_MS = 15_000;

/**
 * מוחק לצמיתות תבנית הסכמה לפי מזהה ואת הטפסים החתומים המבוססים עליה.
 *
 * @returns `null` אם התבנית לא קיימת; אחרת את מפתחות ה-PDF שנמחקו.
 * @throws אם אחת המחיקות נכשלת — הטרנזקציה מתבטלת במלואה.
 */
export async function hardDeleteConsentTemplate(
  templateId: string
): Promise<HardDeleteConsentTemplateResult | null> {
  return prisma.$transaction(
    async (tx) => {
      const template = await tx.consentTemplate.findUnique({
        where: { id: templateId },
        select: { id: true },
      });
      if (!template) return null;

      // 1. איסוף מפתחות PDF (לפני מחיקת ה-SignedConsent).
      const signedConsents = await tx.signedConsent.findMany({
        where: { templateId },
        select: { pdfStorageKey: true },
      });
      const orphanedPdfKeys = signedConsents
        .map((c) => c.pdfStorageKey)
        .filter((key): key is string => typeof key === "string" && key !== "");

      // 2. ניתוק הקשר העצמי — גרסאות שמצביעות לתבנית זו (ConsentVersions).
      await tx.consentTemplate.updateMany({
        where: { previousVersionId: templateId },
        data: { previousVersionId: null },
      });

      // 3. טפסים חתומים שמבוססים על התבנית — Restrict על templateId.
      await tx.signedConsent.deleteMany({ where: { templateId } });

      // 4. התבנית עצמה.
      await tx.consentTemplate.delete({ where: { id: templateId } });

      return { orphanedPdfKeys };
    },
    { timeout: TRANSACTION_TIMEOUT_MS }
  );
}
