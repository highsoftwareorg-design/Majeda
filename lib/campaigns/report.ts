/**
 * lib/campaigns/report.ts
 * Task 9.6 — דוח קמפיין (FR-MK-06).
 *
 * מקור הנתונים: Message עם sourceType='campaign' ו-sourceId=campaignId.
 * הודעות בדיקה לאדמין (clientId=null) אינן נספרות בדוח.
 *
 * bookedCount: תורים שנוצרו ללקוחות/ות שקיבלו הודעה, בתוך 14 יום מ-sentAt.
 *
 * הערה (פרטיות — §11): הדוח מציג שמות נמענים בלבד (ללא טלפון).
 */

import { prisma } from "@/lib/db/prisma";

/** חלון ייחוס להזמנות שנוצרו בעקבות הקמפיין */
export const BOOKING_WINDOW_DAYS = 14;

/** סטטוסי הודעה שנחשבים "נשלחה" (ב-MOCK אין אישור מסירה אמיתי) */
const SENT_STATUSES = ["SENT", "DELIVERED", "READ", "MOCK"];
const DELIVERED_STATUSES = ["DELIVERED", "READ"];
const READ_STATUSES = ["READ"];

export const MESSAGE_STATUS_LABELS: Record<string, string> = {
  PENDING: "ממתינה",
  SENDING: "בשליחה",
  SENT: "נשלחה",
  DELIVERED: "נמסרה",
  READ: "נקראה",
  FAILED: "נכשלה",
  MOCK: "נשלחה (מדומה)",
};

export function messageStatusLabel(status: string): string {
  return MESSAGE_STATUS_LABELS[status] ?? status;
}

export interface CampaignStats {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  booked: number;
}

export interface CampaignReportMessage {
  id: string;
  status: string;
  createdAt: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  errorMessage: string | null;
  client: { firstName: string; lastName: string } | null;
}

export interface CampaignReport {
  campaign: NonNullable<Awaited<ReturnType<typeof loadCampaign>>>;
  stats: CampaignStats;
  messages: CampaignReportMessage[];
}

function loadCampaign(id: string) {
  return prisma.campaign.findUnique({
    where: { id },
    include: {
      segment: { select: { id: true, name: true } },
      template: { select: { id: true, name: true, body: true, variables: true } },
    },
  });
}

/** מחשב אחוז שלם; בסיס 0 → 0 */
export function percentOf(part: number, base: number): number {
  return base > 0 ? Math.round((part / base) * 100) : 0;
}

/** דוח מלא לקמפיין, או null אם לא נמצא */
export async function getCampaignReport(campaignId: string): Promise<CampaignReport | null> {
  const campaign = await loadCampaign(campaignId);
  if (!campaign) return null;

  const messages = await prisma.message.findMany({
    where: {
      sourceType: "campaign",
      sourceId: campaignId,
      clientId: { not: null },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      clientId: true,
      status: true,
      createdAt: true,
      sentAt: true,
      deliveredAt: true,
      readAt: true,
      errorMessage: true,
      client: { select: { firstName: true, lastName: true } },
    },
  });

  const count = (statuses: string[]) =>
    messages.filter((m) => statuses.includes(m.status)).length;

  let booked = 0;
  if (campaign.sentAt) {
    const sentClientIds = [
      ...new Set(
        messages
          .filter((m) => SENT_STATUSES.includes(m.status) && m.clientId)
          .map((m) => m.clientId as string)
      ),
    ];
    if (sentClientIds.length > 0) {
      const windowEnd = new Date(
        campaign.sentAt.getTime() + BOOKING_WINDOW_DAYS * 24 * 60 * 60 * 1000
      );
      booked = await prisma.appointment.count({
        where: {
          clientId: { in: sentClientIds },
          createdAt: { gte: campaign.sentAt, lte: windowEnd },
        },
      });
    }
  }

  return {
    campaign,
    stats: {
      total: messages.length,
      sent: count(SENT_STATUSES),
      delivered: count(DELIVERED_STATUSES),
      read: count(READ_STATUSES),
      failed: count(["FAILED"]),
      booked,
    },
    messages: messages.map((m) => ({
      id: m.id,
      status: m.status,
      createdAt: m.createdAt,
      sentAt: m.sentAt,
      deliveredAt: m.deliveredAt,
      readAt: m.readAt,
      errorMessage: m.errorMessage,
      client: m.client,
    })),
  };
}
