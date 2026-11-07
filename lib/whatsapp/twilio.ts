/**
 * lib/whatsapp/twilio.ts
 * Task 6.1 — מימוש Twilio של שירות WhatsApp.
 *
 * משתמש בחבילת `twilio` לשליחת הודעות ואימות webhook.
 * משתני סביבה נדרשים:
 *   TWILIO_ACCOUNT_SID   — Account SID מ-Twilio Console
 *   TWILIO_AUTH_TOKEN    — Auth Token מ-Twilio Console
 *   TWILIO_WHATSAPP_FROM — מספר השולח (לדוגמה: whatsapp:+14155238886)
 */

import twilio from "twilio";
import { prisma } from "@/lib/db/prisma";
import type {
  SendTemplateParams,
  WebhookEvent,
  WhatsAppService,
} from "./types";

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error(
      "[TwilioWhatsApp] חסרים משתני סביבה: TWILIO_ACCOUNT_SID ו/או TWILIO_AUTH_TOKEN"
    );
  }
  return twilio(accountSid, authToken);
}

export class TwilioWhatsAppService implements WhatsAppService {
  async sendTemplate(params: SendTemplateParams): Promise<{ externalId: string }> {
    const { to, templateName, variables, messageId } = params;

    const from = process.env.TWILIO_WHATSAPP_FROM;
    if (!from) {
      throw new Error(
        "[TwilioWhatsApp] חסר משתנה סביבה: TWILIO_WHATSAPP_FROM"
      );
    }

    // בנה גוף הודעה על ידי החלפת משתנים בתוך שם התבנית
    // (Twilio Content API — שימוש ב-contentSid בגרסאות עתידיות)
    const body = Object.entries(variables).reduce(
      (acc, [key, value]) => acc.replace(new RegExp(`\\{${key}\\}`, "g"), value),
      templateName
    );

    const client = getTwilioClient();

    let externalId = "";
    let status = "SENT";
    let errorCode: string | undefined;
    let errorMessage: string | undefined;

    try {
      await prisma.message.update({
        where: { id: messageId },
        data: { status: "SENDING" },
      });

      const msg = await client.messages.create({
        from: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
        to: to.startsWith("whatsapp:") ? to : `whatsapp:${to}`,
        body,
      });

      externalId = msg.sid;
      status = "SENT";
    } catch (err) {
      status = "FAILED";
      if (err instanceof Error) {
        errorMessage = err.message;
        // Twilio errors expose a `code` property
        const twilioErr = err as Error & { code?: number };
        if (twilioErr.code !== undefined) {
          errorCode = String(twilioErr.code);
        }
      }
      throw err;
    } finally {
      await prisma.message.update({
        where: { id: messageId },
        data: {
          status,
          externalId: externalId || undefined,
          sentAt: status === "SENT" ? new Date() : undefined,
          errorCode: errorCode ?? undefined,
          errorMessage: errorMessage ?? undefined,
        },
      });
    }

    return { externalId };
  }

  parseWebhookEvent(body: unknown, signature: string): WebhookEvent | null {
    const webhookUrl = process.env.TWILIO_WEBHOOK_URL ?? "";
    const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";

    // אמת חתימת Twilio
    const isValid = twilio.validateRequest(
      authToken,
      signature,
      webhookUrl,
      body as Record<string, string>
    );

    if (!isValid) {
      console.warn("[TwilioWhatsApp] אימות חתימת webhook נכשל — הבקשה נדחתה");
      return null;
    }

    const params = body as Record<string, string>;

    // עדכון סטטוס מסירה (Twilio Status Callback)
    if (params.MessageStatus && params.MessageSid) {
      return {
        type: "status_update",
        messageId: params.MessageSid,
        status: params.MessageStatus,
        timestamp: params.Timestamp,
      };
    }

    // הודעה נכנסת (Inbound)
    if (params.Body && params.From) {
      return {
        type: "inbound_message",
        from: params.From,
        body: params.Body,
        timestamp: params.DateSent,
      };
    }

    return null;
  }
}
