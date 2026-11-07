/**
 * app/api/whatsapp/webhook/route.ts
 * Task 6.6 — Webhook לקבלת עדכוני סטטוס ותשובות מהירות מ-WhatsApp (FR-WA-03, FR-WA-06).
 *
 * GET  — אימות ה-webhook (Meta/Twilio verification challenge).
 * POST — קבלת אירועי WhatsApp: עדכוני סטטוס מסירה/קריאה ותשובות מהירות מלקוחות.
 *
 * הערה אבטחה: האנדפוינט חייב להחזיר 200 תמיד (גם לאחר שגיאה) כדי למנוע
 * retry-storm מ-Twilio/Meta. לוגיקת ה-business רצה בתוך try/catch.
 *
 * הערה פרטיות (§11): אין ללוג מספרי טלפון או פרטי PII. שגיאות טכניות בלבד.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { whatsappService } from "@/lib/whatsapp/index";
import type { AppointmentStatus } from "@prisma/client";

// Token לאימות ה-webhook (Meta hub.verify_token) — חייב להתאים לערך שהוגדר ב-Meta/Twilio.
const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "";

// ---------------------------------------------------------------------------
// GET — אימות ה-webhook (Meta verification challenge)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ---------------------------------------------------------------------------
// POST — קבלת אירועי WhatsApp (סטטוס + הודעות נכנסות)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const signature = req.headers.get("x-twilio-signature") ?? "";

    // ניתוח האירוע — מחזיר null אם החתימה אינה תקינה (במצב mock — תמיד תקינה).
    const event = whatsappService.parseWebhookEvent(body, signature);
    if (!event) {
      return NextResponse.json({ received: true });
    }

    // -----------------------------------------------------------------------
    // עדכון סטטוס מסירה/קריאה של הודעה (FR-WA-03)
    // -----------------------------------------------------------------------
    if (event.type === "status_update" && event.messageId && event.status) {
      const statusMap: Record<string, string> = {
        sent: "SENT",
        delivered: "DELIVERED",
        read: "READ",
        failed: "FAILED",
        undelivered: "FAILED",
      };
      const newStatus =
        statusMap[event.status.toLowerCase()] ?? event.status.toUpperCase();

      const updateData: Record<string, unknown> = { status: newStatus };
      if (newStatus === "DELIVERED") updateData.deliveredAt = new Date();
      if (newStatus === "READ") updateData.readAt = new Date();
      if (newStatus === "SENT") updateData.sentAt = new Date();

      // עדכון לפי externalId (Twilio Message SID)
      await prisma.message.updateMany({
        where: { externalId: event.messageId },
        data: updateData,
      });
    }

    // -----------------------------------------------------------------------
    // טיפול בהודעות נכנסות (FR-WA-06) — תשובות מהירות ובקשות הסרה
    // -----------------------------------------------------------------------
    if (event.type === "inbound_message" && event.from && event.body) {
      const lowerBody = event.body.toLowerCase().trim();
      const phone = event.from.replace("whatsapp:", "");

      // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
      // תשובה מהירה "מאשר/ת" — אישור תור + AppointmentStatusHistory
      // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
      if (
        lowerBody === "מאשר" ||
        lowerBody === "מאשרת" ||
        lowerBody === "confirmed" ||
        lowerBody === "כן"
      ) {
        const client = await prisma.client.findFirst({ where: { phone } });
        if (client) {
          const appointment = await prisma.appointment.findFirst({
            where: {
              clientId: client.id,
              status: { in: ["SCHEDULED", "CONFIRMED"] as AppointmentStatus[] },
            },
            orderBy: { startTime: "asc" },
          });
          if (appointment && appointment.status !== "CONFIRMED") {
            // שמירת שינוי סטטוס + יצירת AppointmentStatusHistory בטרנזקציה אחת
            await prisma.$transaction([
              prisma.appointment.update({
                where: { id: appointment.id },
                data: { status: "CONFIRMED" },
              }),
              prisma.appointmentStatusHistory.create({
                data: {
                  appointmentId: appointment.id,
                  fromStatus: appointment.status,
                  toStatus: "CONFIRMED",
                  changedBy: "whatsapp_reply",
                },
              }),
            ]);
          }
        }
      }

      // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
      // תשובה מהירה "צריך/ה לשנות" — סימון בהערות התור
      // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
      if (
        lowerBody === "צריך לשנות" ||
        lowerBody === "צריכה לשנות" ||
        lowerBody === "שינוי"
      ) {
        const client = await prisma.client.findFirst({ where: { phone } });
        if (client) {
          const appointment = await prisma.appointment.findFirst({
            where: {
              clientId: client.id,
              status: { in: ["SCHEDULED", "CONFIRMED"] as AppointmentStatus[] },
            },
            orderBy: { startTime: "asc" },
          });
          if (appointment) {
            const existingNotes = appointment.notes ?? "";
            await prisma.appointment.update({
              where: { id: appointment.id },
              data: {
                notes: `${existingNotes}\nלקוח/ה ביקש/ה שינוי — לטיפול קבלה`.trim(),
              },
            });
          }
        }
      }

      // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
      // בקשת הסרה מרשימת תפוצה — STOP / הסר / הסירי (FR-WA-06, SRS §11.3)
      // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
      if (
        lowerBody === "stop" ||
        lowerBody === "הסר" ||
        lowerBody === "הסירי"
      ) {
        // עדכון הסכמת הדיוור ל-none — תיעוד מתי ואיך בוטלה ההסכמה (SRS §11.3)
        await prisma.client.updateMany({
          where: { phone },
          data: {
            marketingConsentChannel: "none",
            marketingConsentAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    // תמיד מחזירים 200 כדי למנוע retry-storm מ-Twilio/Meta
    console.error("Webhook processing error:", error);
    return NextResponse.json({ received: true });
  }
}
