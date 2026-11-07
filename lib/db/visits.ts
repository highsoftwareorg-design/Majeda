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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * יוצר רשומות FollowUp (status=PENDING) לכל כלל מעקב פעיל של הטיפולים שבוצעו בביקור
 * (משימה 8.3, FR-FU-02).
 *
 * לכל FollowUpRule פעיל: scheduledDate = visitDate + offsetDays (ימים).
 * ביקור ללא טיפולים, או טיפולים ללא כללים פעילים → 0 רשומות.
 * אידמפוטנטי: כלל שכבר יצר FollowUp לביקור הזה אינו נוצר שוב.
 *
 * @param visitId — מזהה הביקור
 * @returns מספר רשומות FollowUp שנוצרו
 */
export async function createFollowUpsForVisit(visitId: string): Promise<number> {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: {
      id: true,
      clientId: true,
      visitDate: true,
      visitTreatments: {
        select: {
          treatment: {
            select: {
              followUpRules: {
                where: { isActive: true },
                select: { id: true, offsetDays: true },
              },
            },
          },
        },
      },
    },
  });
  if (!visit) return 0;

  const rules = visit.visitTreatments.flatMap(
    (vt) => vt.treatment.followUpRules
  );
  if (rules.length === 0) return 0;

  // מניעת כפילויות: כללים שכבר יצרו מעקב לביקור זה
  const existing = await prisma.followUp.findMany({
    where: {
      visitId,
      ruleId: { in: rules.map((r) => r.id) },
    },
    select: { ruleId: true },
  });
  const existingRuleIds = new Set(existing.map((f) => f.ruleId));

  const data = rules
    .filter((rule) => !existingRuleIds.has(rule.id))
    .map((rule) => ({
      visitId: visit.id,
      clientId: visit.clientId,
      ruleId: rule.id,
      scheduledDate: new Date(
        visit.visitDate.getTime() + rule.offsetDays * MS_PER_DAY
      ),
      status: "PENDING",
    }));

  if (data.length === 0) return 0;

  const result = await prisma.followUp.createMany({ data });
  return result.count;
}
