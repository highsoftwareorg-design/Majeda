/**
 * מחיקה לצמיתות של תור ביומן (משימה 12.4, §12 — CASCADE/UNLINK).
 *
 * בלי מיגרציה ובלי `onDelete: Cascade` חדש בסכימה: כל הניתוקים/המחיקות מתבצעים
 * מפורשות בתוך `prisma.$transaction` יחיד (אטומיות — כשל באמצע מחזיר rollback מלא).
 *
 * סדר הפעולות בטרנזקציה (ילד → הורה):
 *   1. SignedConsent — ניתוק (appointmentId=null); הטופס החתום נשמר אצל הלקוח/ה.
 *   2. ConsentOverride — מחיקה (Restrict על appointmentId; רשומת audit שייכת רק לתור).
 *   3. AppointmentStatusHistory — מחיקה (Cascade ממילא; מפורש למען הבהירות).
 *   4. Appointment — מחיקת התור עצמו.
 *
 * הערה: הודעות תזכורת (`Message`) אינן נמחקות — הקישור אליהן הוא sourceType/sourceId רך
 * (ללא FK); sourceId עשוי להצביע לתור שנמחק (מקובל).
 *
 * הערה (פרטיות — §11): אין להדפיס ללוג PII.
 */

import { prisma } from "@/lib/db/prisma";

/** זמן מקסימלי לטרנזקציה (ms). */
const TRANSACTION_TIMEOUT_MS = 15_000;

/**
 * מוחק לצמיתות תור לפי מזהה, עם ניתוק/מחיקה של הרשומות המקושרות.
 *
 * @returns `false` אם התור לא קיים; `true` אם נמחק.
 * @throws אם אחת הפעולות נכשלת — הטרנזקציה מתבטלת במלואה.
 */
export async function hardDeleteAppointment(appointmentId: string): Promise<boolean> {
  return prisma.$transaction(
    async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        select: { id: true },
      });
      if (!appointment) return false;

      // 1. טפסים חתומים — ניתוק בלבד (לא מחיקה).
      await tx.signedConsent.updateMany({
        where: { appointmentId },
        data: { appointmentId: null },
      });

      // 2. דריסות חסימת הסכמה — מחיקה (Restrict על appointmentId).
      await tx.consentOverride.deleteMany({ where: { appointmentId } });

      // 3. היסטוריית סטטוס — מחיקה מפורשת (Cascade ממילא).
      await tx.appointmentStatusHistory.deleteMany({ where: { appointmentId } });

      // 4. התור עצמו.
      await tx.appointment.delete({ where: { id: appointmentId } });

      return true;
    },
    { timeout: TRANSACTION_TIMEOUT_MS }
  );
}
