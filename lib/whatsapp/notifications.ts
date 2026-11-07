/**
 * lib/whatsapp/notifications.ts
 * Task 6.3 — שליחת הודעת אישור מיידית בעת קביעת תור (FR-WA-01).
 *
 * שימוש:
 *   import { sendAppointmentConfirmation } from "@/lib/whatsapp/notifications";
 *   sendAppointmentConfirmation(appointmentId).catch(console.error);
 */

import { prisma } from "@/lib/db/prisma";
import { whatsappService } from "@/lib/whatsapp/index";
import { isQuietHour, isShabbat } from "@/lib/whatsapp/quiet-hours";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const ISRAEL_TZ = "Asia/Jerusalem";
const CLINIC_ADDRESS = process.env.CLINIC_ADDRESS ?? "כתובת המרפאה";

/**
 * שולח הודעת אישור WhatsApp ללקוח/ה לאחר קביעת תור.
 * - יוצר רשומת Message ב-DB (תמיד).
 * - בשעות שקטות / שבת — משאיר כ-PENDING לשליחה מאוחרת ע"י cron.
 * - במצב mock (WHATSAPP_MODE != "real") — Message.status=MOCK.
 */
export async function sendAppointmentConfirmation(
  appointmentId: string
): Promise<void> {
  // 1. שליפת התור + לקוח + טיפול מה-DB
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      client: true,
      treatment: true,
    },
  });

  // אם אין תור, או ללקוח/ה אין טלפון — אין מה לשלוח
  if (!appointment || !appointment.client?.phone) return;

  const startTime = appointment.startTime;
  const zonedTime = toZonedTime(startTime, ISRAEL_TZ);
  const dateStr = format(zonedTime, "dd/MM/yyyy");
  const timeStr = format(zonedTime, "HH:mm");
  const treatmentName = appointment.treatment?.name ?? "הטיפול";
  // therapist הוא שדה טקסט חופשי (לא קישור ל-User בשלב זה)
  const therapistName = appointment.therapist ?? "";
  const clientName =
    `${appointment.client.firstName} ${appointment.client.lastName}`.trim();
  const wazeLink = `https://waze.com/ul?q=${encodeURIComponent(CLINIC_ADDRESS)}`;

  const variables: Record<string, string> = {
    name: clientName,
    date: dateStr,
    time: timeStr,
    treatment: treatmentName,
    therapist: therapistName,
    address: CLINIC_ADDRESS,
    wazeLink,
  };

  // 2. יצירת רשומת Message בסטטוס PENDING
  const message = await prisma.message.create({
    data: {
      clientId: appointment.client.id,
      channel: "whatsapp",
      templateId: "appointment_confirmation",
      content: variables,
      direction: "outbound",
      status: "PENDING",
      sourceType: "appointment",
      sourceId: appointmentId,
    },
  });

  // 3. בדיקת שעות שקטות / שבת — לא שולחים; ה-cron יטפל בהמשך
  const now = new Date();
  if (isQuietHour(now) || isShabbat(now)) {
    return;
  }

  // 4. שליחה דרך שירות WhatsApp (mock או Twilio לפי WHATSAPP_MODE)
  await whatsappService.sendTemplate({
    to: appointment.client.phone,
    templateName: "appointment_confirmation",
    variables,
    messageId: message.id,
  });
}
