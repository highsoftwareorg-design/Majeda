/**
 * שליחת הודעת בדיקה לאדמין (משימה 9.3, FR-MK-02).
 *
 * POST /api/campaigns/:id/test
 *   שולח את תבנית הקמפיין למספר ADMIN_PHONE עם נמען לדוגמה "שרה (בדיקה)".
 *   נוצרת רשומת Message ללא clientId (הודעת אדמין, לא לקוחה) — כך שאינה נספרת בדוח הקמפיין.
 *
 * הערה (פרטיות — §11): אין להדפיס ללוג את מספר הטלפון או את תוכן ההודעה.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { whatsappService } from "@/lib/whatsapp/index";
import {
  buildSampleVariables,
  extractPlaceholders,
  renderTemplateBody,
  SAMPLE_TEST_RECIPIENT_NAME,
} from "@/lib/campaigns/preview";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });

  const { id } = await params;

  const adminPhone = process.env.ADMIN_PHONE?.trim();
  if (!adminPhone) {
    return NextResponse.json({ error: "מספר האדמין לא הוגדר בשרת" }, { status: 500 });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: {
      id: true,
      template: { select: { name: true, body: true } },
    },
  });
  if (!campaign) {
    return NextResponse.json({ error: "קמפיין לא נמצא" }, { status: 404 });
  }
  if (!campaign.template) {
    return NextResponse.json({ error: "לקמפיין אין תבנית לשליחה" }, { status: 400 });
  }

  const variables = buildSampleVariables(
    extractPlaceholders(campaign.template.body),
    { name: SAMPLE_TEST_RECIPIENT_NAME }
  );

  const message = await prisma.message.create({
    data: {
      clientId: null,
      channel: "whatsapp",
      templateId: campaign.template.name,
      content: { ...variables, composedBody: renderTemplateBody(campaign.template.body, variables) },
      direction: "outbound",
      status: "PENDING",
      sourceType: "campaign",
      sourceId: campaign.id,
    },
  });

  try {
    await whatsappService.sendTemplate({
      to: adminPhone,
      templateName: campaign.template.name,
      variables,
      messageId: message.id,
    });
    return NextResponse.json({ ok: true, messageId: message.id });
  } catch {
    await prisma.message.update({
      where: { id: message.id },
      data: { status: "FAILED", errorCode: "send_failed", errorMessage: "שליחת הבדיקה נכשלה" },
    });
    return NextResponse.json({ error: "שליחת הבדיקה נכשלה" }, { status: 502 });
  }
}
