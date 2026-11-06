/**
 * שאילתות בסיס נתונים לביקורים (Visit) — משימה 4.4, §4.1 ציר זמן.
 * משימה 4.8: כולל גם amendments (תיקונים לאחר נעילה).
 */

import { prisma } from "@/lib/db/prisma";

/**
 * מחזיר את כל הביקורים של לקוח מסוים, ממוינים מהחדש לישן (יורד לפי visitDate).
 * כולל את הטיפולים שבוצעו בכל ביקור דרך join table VisitTreatment → Treatment,
 * וכולל תיקונים (amendments) ממוינים מהישן לחדש.
 *
 * @param clientId — מזהה הלקוח
 */
export async function getClientVisits(clientId: string) {
  return prisma.visit.findMany({
    where: { clientId },
    orderBy: { visitDate: "desc" },
    include: {
      visitTreatments: {
        include: { treatment: true },
      },
      amendments: {
        orderBy: { editedAt: "asc" },
      },
    },
  });
}

/** טיפוס ביקור כולל טיפולים ותיקונים — נוחות לקומפוננטות TypeScript */
export type ClientVisitWithTreatments = Awaited<
  ReturnType<typeof getClientVisits>
>[number];
