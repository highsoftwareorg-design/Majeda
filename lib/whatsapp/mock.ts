/**
 * lib/whatsapp/mock.ts
 * Task 6.1 — מימוש Mock של שירות WhatsApp.
 *
 * שומר רשומת Message ב-DB עם status=MOCK ומדפיס לקונסול את ההודעה שהייתה נשלחת.
 * משמש לפיתוח ובדיקות ללא אישורי Twilio/Meta אמיתיים.
 */

import { prisma } from "@/lib/db/prisma";
import type {
  SendTemplateParams,
  WebhookEvent,
  WhatsAppService,
} from "./types";

export class MockWhatsAppService implements WhatsAppService {
  async sendTemplate(params: SendTemplateParams): Promise<{ externalId: string }> {
    const { to, templateName, variables, messageId } = params;

    // בנה גוף הודעה מדומה על ידי החלפת משתנים
    const composedBody = Object.entries(variables).reduce(
      (body, [key, value]) => body.replace(new RegExp(`\\{${key}\\}`, "g"), value),
      `[תבנית: ${templateName}]`
    );

    const mockSid = `MOCK_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // שמור/עדכן רשומת Message ב-DB
    await prisma.message.update({
      where: { id: messageId },
      data: {
        status: "MOCK",
        externalId: mockSid,
        sentAt: new Date(),
        content: { to, templateName, variables, composedBody } as Parameters<typeof prisma.message.update>[0]["data"]["content"],
      },
    });

    console.info(
      "[WhatsApp Mock] הודעה מדומה (לא נשלחה בפועל):\n" +
        `  To:       ${to}\n` +
        `  Template: ${templateName}\n` +
        `  Body:     ${composedBody}\n` +
        `  MockSID:  ${mockSid}\n` +
        `  DB MsgId: ${messageId}`
    );

    return { externalId: mockSid };
  }

  parseWebhookEvent(_body: unknown, _signature: string): WebhookEvent | null {
    // במצב Mock אין webhook אמיתי — תמיד מחזיר null
    return null;
  }
}
