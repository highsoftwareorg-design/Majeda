/**
 * lib/whatsapp/index.ts
 * Task 6.1 — נקודת כניסה לשירות WhatsApp.
 *
 * בוחר את המימוש הפעיל לפי משתנה הסביבה WHATSAPP_MODE:
 *   WHATSAPP_MODE=mock  (או לא מוגדר) → MockWhatsAppService
 *   כל ערך אחר (למשל "real")          → TwilioWhatsAppService
 *
 * שימוש:
 *   import { whatsappService } from "@/lib/whatsapp";
 *   await whatsappService.sendTemplate({ to, templateName, variables, messageId });
 */

import { MockWhatsAppService } from "./mock";
import { TwilioWhatsAppService } from "./twilio";
import type { WhatsAppService } from "./types";

export type { WhatsAppService, SendTemplateParams, WebhookEvent } from "./types";

export const whatsappService: WhatsAppService =
  process.env.WHATSAPP_MODE === "real"
    ? new TwilioWhatsAppService()
    : new MockWhatsAppService();
