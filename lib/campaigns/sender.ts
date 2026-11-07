/**
 * lib/campaigns/sender.ts
 * Task 9.5 — שליחת קמפיין WhatsApp עם throttling (FR-MK-04, FR-MK-05).
 *
 * נקרא מה-handler המאוחד היחיד: app/api/cron/run/route.ts (Vercel Hobby = cron אחד בלבד).
 *
 * לוגיקה:
 *   1. קמפיינים SCHEDULED שמועד התזמון שלהם עבר → נתפסים (claim) ל-SENDING.
 *   2. לכל קמפיין ב-SENDING: טוענים את הנמענים (getSegmentRecipients) ומדלגים על מי
 *      שכבר קיבל הודעה מהקמפיין הזה (Message עם sourceType/sourceId/clientId) — כך
 *      שמחזור נוסף ממשיך מאיפה שהפסיק.
 *   3. שליחה ב-batch של 10 הודעות, והמתנה של 1 שנייה בין batches.
 *   4. כשאין נמענים שנותרו → status=SENT, sentCount/recipientCount מעודכנים.
 *
 * הערה: תקציב זמן לכל הרצה (MAX_RUN_MS) מונע חריגה ממגבלת הזמן של פונקציית ה-cron;
 * קמפיין גדול ימשיך במחזור הבא.
 *
 * הערה (פרטיות — §11): אין להדפיס ללוג שמות, טלפונים או תוכן הודעות.
 */

import { prisma } from "@/lib/db/prisma";
import { whatsappService } from "@/lib/whatsapp/index";
import {
  getSegmentRecipients,
  type CampaignRecipient,
} from "@/lib/campaigns/recipients";
import {
  extractPlaceholders,
  formatTodayIsrael,
  renderTemplateBody,
} from "@/lib/campaigns/preview";

export const BATCH_SIZE = 10;
export const BATCH_DELAY_MS = 1000;
/** תקציב זמן מקסימלי להרצה אחת (מילישניות) */
export const MAX_RUN_MS = 50_000;

export interface ProcessCampaignsResult {
  /** קמפיינים שנתפסו מ-SCHEDULED ל-SENDING במחזור הזה */
  claimed: number;
  /** הודעות שנשלחו בהצלחה במחזור הזה */
  sent: number;
  /** הודעות שנכשלו במחזור הזה */
  failed: number;
  /** קמפיינים שהסתיימו (status=SENT) במחזור הזה */
  completed: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** נקודת הכניסה — נקראת מה-cron המאוחד */
export async function processCampaigns(): Promise<ProcessCampaignsResult> {
  const deadline = Date.now() + MAX_RUN_MS;
  const now = new Date();
  const result: ProcessCampaignsResult = { claimed: 0, sent: 0, failed: 0, completed: 0 };

  // 1. תפיסת קמפיינים מתוזמנים שהגיע מועדם (claim אטומי מול הרצות מקבילות)
  const due = await prisma.campaign.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    select: { id: true },
  });
  for (const { id } of due) {
    const claim = await prisma.campaign.updateMany({
      where: { id, status: "SCHEDULED" },
      data: { status: "SENDING", sentAt: now },
    });
    result.claimed += claim.count;
  }

  // 2. עיבוד כל הקמפיינים בשליחה
  const sending = await prisma.campaign.findMany({
    where: { status: "SENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      segmentId: true,
      template: { select: { name: true, body: true } },
    },
  });

  for (const campaign of sending) {
    if (Date.now() >= deadline) break;
    const outcome = await sendCampaign(campaign, deadline);
    result.sent += outcome.sent;
    result.failed += outcome.failed;
    if (outcome.completed) result.completed += 1;
  }

  return result;
}

interface SendableCampaign {
  id: string;
  segmentId: string | null;
  template: { name: string; body: string } | null;
}

interface CampaignRunOutcome {
  sent: number;
  failed: number;
  completed: boolean;
}

/** שולח את מה שנותר לקמפיין אחד, עד סיום או עד תום תקציב הזמן */
async function sendCampaign(
  campaign: SendableCampaign,
  deadline: number
): Promise<CampaignRunOutcome> {
  // קמפיין ללא סגמנט/תבנית לא ניתן לשליחה — מסמנים כבוטל כדי שלא ייתפס שוב בכל מחזור
  if (!campaign.segmentId || !campaign.template) {
    console.warn(`[campaigns] קמפיין ${campaign.id} חסר סגמנט או תבנית — בוטל`);
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "CANCELLED" },
    });
    return { sent: 0, failed: 0, completed: false };
  }

  const { eligible } = await getSegmentRecipients(campaign.segmentId);

  // דילוג על נמענים שכבר קיבלו הודעה מהקמפיין הזה (המשכיות בין מחזורים)
  const alreadyMessaged = await prisma.message.findMany({
    where: {
      sourceType: "campaign",
      sourceId: campaign.id,
      clientId: { not: null },
    },
    select: { clientId: true },
  });
  const doneIds = new Set(alreadyMessaged.map((m) => m.clientId));
  const pending = eligible.filter((c) => !doneIds.has(c.id));

  const placeholders = extractPlaceholders(campaign.template.body);
  let sent = 0;
  let failed = 0;
  let stoppedEarly = false;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    if (Date.now() >= deadline) {
      stoppedEarly = true;
      break;
    }
    const batch = pending.slice(i, i + BATCH_SIZE);
    const outcomes = await Promise.all(
      batch.map((recipient) =>
        sendToRecipient(campaign.id, campaign.template!, placeholders, recipient)
      )
    );
    for (const outcome of outcomes) {
      if (outcome) sent += 1;
      else failed += 1;
    }
    if (i + BATCH_SIZE < pending.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  // ספירה מצטברת של הודעות שנשלחו (לא FAILED) — מעודכנת בכל הרצה
  const sentCount = await prisma.message.count({
    where: {
      sourceType: "campaign",
      sourceId: campaign.id,
      clientId: { not: null },
      status: { not: "FAILED" },
    },
  });
  const failedCount = await prisma.message.count({
    where: {
      sourceType: "campaign",
      sourceId: campaign.id,
      clientId: { not: null },
      status: "FAILED",
    },
  });

  const completed = !stoppedEarly;
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      recipientCount: eligible.length,
      sentCount,
      failedCount,
      ...(completed ? { status: "SENT" } : {}),
    },
  });

  return { sent, failed, completed };
}

/** יוצר Message לנמען ושולח את התבנית. מחזיר true בהצלחה, false בכישלון. */
async function sendToRecipient(
  campaignId: string,
  template: { name: string; body: string },
  placeholders: string[],
  recipient: CampaignRecipient
): Promise<boolean> {
  // ערכים אמיתיים בלבד לנמען: {name} = שם מלא, {date} = היום; שאר המשתנים ריקים
  // (לא מוצגים ערכי דוגמה ללקוחות אמיתיים)
  const fullName = `${recipient.firstName} ${recipient.lastName}`.trim();
  const variables: Record<string, string> = {};
  for (const key of new Set(["name", ...placeholders])) {
    variables[key] = key === "name" ? fullName : key === "date" ? formatTodayIsrael() : "";
  }

  const message = await prisma.message.create({
    data: {
      clientId: recipient.id,
      channel: "whatsapp",
      templateId: template.name,
      content: { ...variables, composedBody: renderTemplateBody(template.body, variables) },
      direction: "outbound",
      status: "PENDING",
      sourceType: "campaign",
      sourceId: campaignId,
    },
  });

  try {
    await whatsappService.sendTemplate({
      to: recipient.phone,
      templateName: template.name,
      variables,
      messageId: message.id,
    });
    return true;
  } catch {
    await prisma.message.update({
      where: { id: message.id },
      data: { status: "FAILED", errorCode: "send_failed", errorMessage: "שליחת ההודעה נכשלה" },
    });
    return false;
  }
}
