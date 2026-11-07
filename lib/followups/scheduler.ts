/**
 * lib/followups/scheduler.ts
 * Tasks 8.5 / 8.6 — עיבוד מעקבים (FR-FU-03, FR-FU-04).
 *
 * נקרא מה-handler המאוחד היחיד: app/api/cron/run/route.ts (Vercel Hobby = cron אחד בלבד).
 *
 * לכל FollowUp בסטטוס PENDING שהגיע מועדו:
 *   1. recipientType = client | both → שליחת WhatsApp ללקוח/ה (פעם אחת בלבד — לפי messageId).
 *      - מחוץ לשעות (quiet hours / שבת) → נדחה למחזור הבא.
 *      - תבנית שיווקית (MARKETING) ללקוח/ה ללא הסכמה לדיוור → לא נשלחת.
 *   2. recipientType = admin | both → יצירת AdminTask (רק אם אין כבר משימה OPEN למעקב).
 *   3. עדכון סטטוס: admin → SENT; both → SENT לאחר שהחלק של הלקוח הושלם.
 */

import { prisma } from '@/lib/db/prisma';
import { whatsappService } from '@/lib/whatsapp/index';
import { isQuietHour, isShabbat } from '@/lib/whatsapp/quiet-hours';

export interface ProcessFollowUpsResult {
  sentToClient: number;
  adminTasksCreated: number;
  skipped: number;
}

export async function processFollowUps(): Promise<ProcessFollowUpsResult> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 60 * 60 * 1000); // עד שעה קדימה

  // מעקבים ממתינים שהגיע מועדם (כולל מעקבים שפספסו מחזור קודם בגלל שעות שקט)
  const pendingFollowUps = await prisma.followUp.findMany({
    where: {
      status: 'PENDING',
      scheduledDate: { lte: windowEnd },
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          marketingConsentChannel: true,
        },
      },
      rule: { select: { recipientType: true, clientTemplateId: true, adminNote: true } },
    },
  });

  let sentToClient = 0;
  let adminTasksCreated = 0;
  let skipped = 0;

  for (const followUp of pendingFollowUps) {
    const { client, rule } = followUp;

    // מעקב ידני (ללא כלל) — אין פעולה אוטומטית
    if (!rule) {
      skipped++;
      continue;
    }

    const wantsClient = rule.recipientType === 'client' || rule.recipientType === 'both';
    const wantsAdmin = rule.recipientType === 'admin' || rule.recipientType === 'both';

    // ── חלק הלקוח/ה ─────────────────────────────────────────────────────────
    // clientDone = אין עוד מה לעשות בצד הלקוח (נשלח כבר, או לא רלוונטי)
    let clientDone = true;

    if (wantsClient && !followUp.messageId) {
      if (!client.phone) {
        // אין טלפון — לא ניתן לשלוח; מדלגים בלי לשנות סטטוס
        skipped++;
        clientDone = rule.recipientType === 'both';
      } else {
        const templateName = rule.clientTemplateId ?? 'follow_up';
        const template = await prisma.whatsAppTemplate.findUnique({
          where: { name: templateName },
          select: { category: true },
        });
        const isMarketing = template?.category === 'MARKETING';

        if (isMarketing && client.marketingConsentChannel === 'none') {
          // הודעה שיווקית ללא הסכמה לדיוור — לא נשלחת
          skipped++;
          clientDone = rule.recipientType === 'both';
        } else if (isQuietHour(now) || isShabbat(now)) {
          skipped++;
          clientDone = false;
        } else {
          try {
            const clientName = `${client.firstName} ${client.lastName}`.trim();
            const message = await prisma.message.create({
              data: {
                clientId: client.id,
                channel: 'whatsapp',
                templateId: templateName,
                content: { name: clientName },
                direction: 'outbound',
                status: 'PENDING',
                sourceType: 'follow_up',
                sourceId: followUp.id,
              },
            });

            await whatsappService.sendTemplate({
              to: client.phone,
              templateName,
              variables: { name: clientName },
              messageId: message.id,
            });

            await prisma.followUp.update({
              where: { id: followUp.id },
              data: { messageId: message.id },
            });
            sentToClient++;
          } catch (err) {
            console.error('Follow-up send error:', err);
            skipped++;
            clientDone = false;
          }
        }
      }
    }

    // ── חלק האדמין ──────────────────────────────────────────────────────────
    if (wantsAdmin) {
      // מניעת כפילות: לא יוצרים משימה חדשה אם כבר יש משימה פתוחה למעקב
      const openTask = await prisma.adminTask.findFirst({
        where: { followUpId: followUp.id, status: 'OPEN' },
        select: { id: true },
      });
      if (!openTask) {
        await prisma.adminTask.create({
          data: {
            followUpId: followUp.id,
            clientId: client.id,
            status: 'OPEN',
          },
        });
        adminTasksCreated++;
      }
    }

    // ── עדכון סטטוס ─────────────────────────────────────────────────────────
    // admin-only: המשימה נוצרה/קיימת → המעקב טופל מצד המערכת.
    // client / both: רק לאחר שחלק הלקוח/ה הושלם (נשלח, או לא רלוונטי).
    const shouldMarkSent = rule.recipientType === 'admin' ? wantsAdmin : clientDone;

    if (shouldMarkSent) {
      await prisma.followUp.update({
        where: { id: followUp.id },
        data: { status: 'SENT' },
      });
    }
  }

  return { sentToClient, adminTasksCreated, skipped };
}
