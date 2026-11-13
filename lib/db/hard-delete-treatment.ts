/**
 * מחיקה לצמיתות של טיפול מהקטלוג (משימה 12.3, §12 — CASCADE/DETACH).
 *
 * בלי מיגרציה ובלי `onDelete: Cascade` חדש בסכימה: כל הניתוקים/המחיקות מתבצעים
 * מפורשות בתוך `prisma.$transaction` יחיד (אטומיות — כשל באמצע מחזיר rollback מלא).
 *
 * סדר הפעולות בטרנזקציה:
 *   1. תורים — ניתוק (treatmentId=null), התור נשמר.
 *   2. לקוחות — ניתוק requestedTreatmentId (דף הנחיתה), הלקוח/ה נשמר/ת.
 *   3. מעקבים — ניתוק ruleId של מעקבים שכללם שייך לטיפול; ואז מחיקת FollowUpRule.
 *   4. VisitTreatment — מחיקת פריטי הטיפול מביקורים היסטוריים (אושר ע"י הבעלים; הביקור נשמר).
 *   5. Treatment — מחיקת הטיפול עצמו.
 *
 * הערה (פרטיות — §11): אין להדפיס ללוג PII.
 */

import { prisma } from "@/lib/db/prisma";

/** זמן מקסימלי לטרנזקציה (ms). */
const TRANSACTION_TIMEOUT_MS = 15_000;

/**
 * מוחק לצמיתות טיפול מהקטלוג לפי מזהה, עם ניתוק/מחיקה של הרשומות המקושרות.
 *
 * @returns `false` אם הטיפול לא קיים; `true` אם נמחק.
 * @throws אם אחת הפעולות נכשלת — הטרנזקציה מתבטלת במלואה.
 */
export async function hardDeleteTreatment(treatmentId: string): Promise<boolean> {
  return prisma.$transaction(
    async (tx) => {
      const treatment = await tx.treatment.findUnique({
        where: { id: treatmentId },
        select: { id: true },
      });
      if (!treatment) return false;

      // 1. תורים — ניתוק בלבד (לא מחיקה).
      await tx.appointment.updateMany({
        where: { treatmentId },
        data: { treatmentId: null },
      });

      // 2. בקשת טיפול מדף הנחיתה — ניתוק בלבד.
      await tx.client.updateMany({
        where: { requestedTreatmentId: treatmentId },
        data: { requestedTreatmentId: null },
      });

      // 3. כללי מעקב — ניתוק המעקבים מהכללים, ואז מחיקת הכללים (Restrict על treatmentId).
      const rules = await tx.followUpRule.findMany({
        where: { treatmentId },
        select: { id: true },
      });
      const ruleIds = rules.map((r) => r.id);
      if (ruleIds.length > 0) {
        await tx.followUp.updateMany({
          where: { ruleId: { in: ruleIds } },
          data: { ruleId: null },
        });
      }
      await tx.followUpRule.deleteMany({ where: { treatmentId } });

      // 4. פריטי טיפול בביקורים היסטוריים — מחיקה (Restrict על treatmentId; הביקור נשמר).
      await tx.visitTreatment.deleteMany({ where: { treatmentId } });

      // 5. הטיפול עצמו.
      await tx.treatment.delete({ where: { id: treatmentId } });

      return true;
    },
    { timeout: TRANSACTION_TIMEOUT_MS }
  );
}
