/**
 * מחיקה לצמיתות של לקוח/ה וכל רשומותיו/ה (משימה 12.2, §12 — CASCADE).
 *
 * בלי מיגרציה ובלי `onDelete: Cascade` חדש בסכימה: כל המחיקות/הניתוקים מתבצעים
 * מפורשות בסדר ילד→הורה בתוך `prisma.$transaction` יחיד (אטומיות — כשל באמצע
 * מחזיר rollback מלא). יחסים שמוגדרים כ-Restrict (ברירת מחדל ליחסים חובה) נפתרים
 * בכך שהילדים נמחקים לפני ההורה.
 *
 * מפתחות R2 של טפסים חתומים (`pdfStorageKey`) אינם נמחקים מהאחסון (אין פונקציית
 * מחיקה ב-`lib/consent/r2.ts`) — הם מוחזרים לקורא לצורך ניקוי עתידי.
 *
 * הערה (פרטיות — §11): אין להדפיס ללוג PII (שמות, טלפונים, תוכן רפואי).
 */

import { prisma } from "@/lib/db/prisma";

export type HardDeleteClientResult = {
  /** מפתחות ה-PDF של ה-SignedConsent שנמחקו — יתומים ב-R2 (ללא שמות לקוח/ה). */
  orphanedPdfKeys: string[];
};

/** זמן מקסימלי לטרנזקציה (ms) — כ-12 שאילתות מחיקה מול מסד מרוחק. */
const TRANSACTION_TIMEOUT_MS = 15_000;

/**
 * מוחק לצמיתות לקוח/ה לפי מזהה ואת כל הרשומות הקשורות אליו/ה.
 *
 * @returns `null` אם הלקוח/ה לא קיים/ת; אחרת את מפתחות ה-PDF שנמחקו.
 * @throws אם אחת המחיקות נכשלת — הטרנזקציה מתבטלת במלואה.
 */
export async function hardDeleteClient(
  clientId: string
): Promise<HardDeleteClientResult | null> {
  return prisma.$transaction(
    async (tx) => {
      const client = await tx.client.findUnique({
        where: { id: clientId },
        select: { id: true },
      });
      if (!client) return null;

      // 1. איסוף מזהים (לפני כל מחיקה): תורים, ביקורים, מפתחות PDF.
      const appointments = await tx.appointment.findMany({
        where: { clientId },
        select: { id: true },
      });
      const visits = await tx.visit.findMany({
        where: { clientId },
        select: { id: true },
      });
      const signedConsents = await tx.signedConsent.findMany({
        where: { clientId },
        select: { pdfStorageKey: true },
      });

      const appointmentIds = appointments.map((a) => a.id);
      const visitIds = visits.map((v) => v.id);
      const orphanedPdfKeys = signedConsents
        .map((c) => c.pdfStorageKey)
        .filter((key): key is string => typeof key === "string" && key !== "");

      // מעקבים (FollowUp) — של הלקוח/ה, וכאלה המקושרים לביקורים שלו/ה.
      // נאספים לפני המחיקה כדי שגם AdminTask המקושר אליהם יימחק לפניהם.
      const followUps = await tx.followUp.findMany({
        where: { OR: [{ clientId }, { visitId: { in: visitIds } }] },
        select: { id: true },
      });
      const followUpIds = followUps.map((f) => f.id);

      // 2. משימות "להתקשר" — Restrict על followUpId ו-clientId.
      await tx.adminTask.deleteMany({
        where: { OR: [{ clientId }, { followUpId: { in: followUpIds } }] },
      });

      // 3. מעקבים — Restrict על visitId/clientId.
      await tx.followUp.deleteMany({
        where: { id: { in: followUpIds } },
      });

      // 4. תיקוני ביקור — Restrict על visitId.
      await tx.visitAmendment.deleteMany({
        where: { visitId: { in: visitIds } },
      });

      // 5. ביקורים — VisitTreatment נמחק אוטומטית (Cascade על visitId).
      await tx.visit.deleteMany({ where: { clientId } });

      // 6. דריסות הסכמה — Restrict על appointmentId.
      await tx.consentOverride.deleteMany({
        where: { appointmentId: { in: appointmentIds } },
      });

      // 7. טפסים חתומים — Restrict על clientId. ה-PDF נשאר ב-R2 (מוחזר לקורא).
      await tx.signedConsent.deleteMany({ where: { clientId } });

      // 8. תורים — AppointmentStatusHistory נמחק אוטומטית (Cascade).
      await tx.appointment.deleteMany({ where: { clientId } });

      // 9. הודעות — אחרת היה SetNull; בבחירת "cascade מלא" מוחקים.
      await tx.message.deleteMany({ where: { clientId } });

      // 10. תגיות הלקוח/ה — Cascade ממילא; מפורש לבהירות.
      await tx.clientTag.deleteMany({ where: { clientId } });

      // 11. הלקוח/ה עצמו/ה.
      await tx.client.delete({ where: { id: clientId } });

      return { orphanedPdfKeys };
    },
    { timeout: TRANSACTION_TIMEOUT_MS }
  );
}
