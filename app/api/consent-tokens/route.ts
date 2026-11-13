/**
 * API ליצירת קישורי חתימה חד-פעמיים לטפסי הסכמה (משימה 7.4, FR-CF-06 חלק א').
 *
 * POST /api/consent-tokens
 *   Body: { clientId: string, templateId: string, appointmentId?: string }
 *
 *   - אם קיים כבר SignedConsent לא חתום (signedAt=null) בתוקף לאותו
 *     clientId+templateId+appointmentId — מחזיר את ה-token הקיים (אידמפוטנטי).
 *   - אחרת — יוצר SignedConsent חדש עם signingToken (UUID), תוקף 72 שעות,
 *     ושולח הודעת WhatsApp דרך WhatsAppService עם קישור החתימה.
 *
 * הערה (פרטיות — §11): אין להדפיס ללוג מזהי לקוחות או מידע רפואי.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { whatsappService } from "@/lib/whatsapp/index";
import { auth } from "@/lib/auth/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "גוף הבקשה אינו JSON תקין" },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "נתונים חסרים" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const clientId =
    typeof data.clientId === "string" ? data.clientId.trim() : "";
  const templateId =
    typeof data.templateId === "string" ? data.templateId.trim() : "";
  const appointmentId =
    typeof data.appointmentId === "string" && data.appointmentId.trim()
      ? data.appointmentId.trim()
      : null;

  if (!clientId || !templateId) {
    return NextResponse.json(
      { error: "clientId ו-templateId חובה" },
      { status: 400 }
    );
  }

  try {
    // בדיקה אם קיים SignedConsent לא חתום ובתוקף לאותו שילוב
    const existing = await prisma.signedConsent.findFirst({
      where: {
        clientId,
        templateId,
        appointmentId: appointmentId ?? null,
        signedAt: null,
        signingTokenExpiresAt: { gt: new Date() },
      },
    });

    if (existing && existing.signingToken) {
      return NextResponse.json({
        signingToken: existing.signingToken,
        signedConsentId: existing.id,
        existing: true,
      });
    }

    // שליפת הלקוח והתבנית במקביל
    const [client, template] = await Promise.all([
      prisma.client.findUnique({ where: { id: clientId } }),
      prisma.consentTemplate.findUnique({ where: { id: templateId } }),
    ]);

    if (!client) {
      return NextResponse.json(
        { error: "לקוח/ה לא נמצאו" },
        { status: 404 }
      );
    }

    if (!template) {
      return NextResponse.json(
        { error: "תבנית הסכמה לא נמצאה" },
        { status: 404 }
      );
    }

    // יצירת טוקן חתימה חד-פעמי (72 שעות תוקף)
    const signingToken = crypto.randomUUID();
    const signingTokenExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    // יצירת רשומת SignedConsent
    const signedConsent = await prisma.signedConsent.create({
      data: {
        clientId,
        templateId,
        appointmentId: appointmentId ?? null,
        templateVersion: template.version,
        signingToken,
        signingTokenExpiresAt,
        fieldValues: {},
      },
    });

    // שליחת הודעת WhatsApp עם קישור החתימה
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      "https://localhost:3000";
    const signingUrl = `${appUrl}/sign/${signingToken}`;
    const clientName =
      `${client.firstName} ${client.lastName}`.trim();

    if (client.phone) {
      // רישום הודעה ב-DB לפני השליחה
      const message = await prisma.message.create({
        data: {
          clientId,
          channel: "whatsapp",
          templateId: "consent_signing_link",
          content: { name: clientName, signingUrl },
          direction: "outbound",
          status: "PENDING",
          sourceType: "consent",
          sourceId: signedConsent.id,
        },
      });

      // שליחה דרך WhatsAppService (Mock בסביבת פיתוח, Twilio בפרודקשן)
      await whatsappService.sendTemplate({
        to: client.phone,
        templateName: "consent_signing_link",
        variables: { name: clientName, url: signingUrl },
        messageId: message.id,
      });
    }

    return NextResponse.json(
      {
        signingToken,
        signedConsentId: signedConsent.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/consent-tokens] Error:", error);
    return NextResponse.json({ error: "שגיאה פנימית" }, { status: 500 });
  }
}
