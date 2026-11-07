/**
 * POST /api/sign/[token]/submit — שמירת חתימה, Audit trail ומניעת שימוש כפול בטוקן
 * משימה 7.7 (FR-CF-07).
 *
 * אינו דורש authentication — הטוקן הוא עצמו אמצעי הזיהוי החד-פעמי.
 * לאחר חתימה מוצלחת, הרשומה מסומנת כחתומה (signedAt !== null) ואין אפשרות לחתום שוב.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import crypto from 'crypto';
import { saveConsentPdf } from '@/lib/consent/storage';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const body = await req.json();
    const {
      fieldValues,
      signatureClientData,
      signatureTherapistData,
      guardianName,
      guardianIdNumber,
    } = body as {
      fieldValues: Record<string, string | boolean>;
      signatureClientData: string;
      signatureTherapistData?: string;
      guardianName?: string;
      guardianIdNumber?: string;
    };

    // שלב 1: מציאת רשומת החתימה לפי הטוקן
    const consent = await prisma.signedConsent.findFirst({
      where: { signingToken: token },
    });

    if (!consent) {
      return NextResponse.json(
        { error: 'קישור החתימה לא נמצא' },
        { status: 410 }
      );
    }

    // שלב 2: בדיקה שלא נחתם כבר
    if (consent.signedAt) {
      return NextResponse.json(
        { error: 'הטופס כבר נחתם' },
        { status: 410 }
      );
    }

    // שלב 3: בדיקת תוקף הטוקן
    if (
      consent.signingTokenExpiresAt &&
      consent.signingTokenExpiresAt < new Date()
    ) {
      return NextResponse.json(
        { error: 'הקישור פג תוקף' },
        { status: 410 }
      );
    }

    // שלב 4: חישוב Audit Trail
    const signedAt = new Date();
    const auditIp =
      req.headers.get('x-forwarded-for') ??
      req.headers.get('x-real-ip') ??
      null;
    const auditDevice = req.headers.get('user-agent') ?? null;

    // SHA-256 של תוכן הטופס בעת החתימה — לצורכי אימות שלמות עתידי
    const hashInput = JSON.stringify({
      fieldValues,
      signatureClientData,
      signedAt: signedAt.toISOString(),
    });
    const auditHash = crypto
      .createHash('sha256')
      .update(hashInput)
      .digest('hex');

    // שלב 5: עדכון הרשומה עם כל נתוני החתימה
    const updated = await prisma.signedConsent.update({
      where: { id: consent.id },
      data: {
        fieldValues: fieldValues ?? {},
        signatureClientData: signatureClientData ?? null,
        signatureTherapistData: signatureTherapistData ?? null,
        guardianName: guardianName ?? null,
        guardianIdNumber: guardianIdNumber ?? null,
        auditIp,
        auditDevice,
        auditHash,
        signedAt,
      },
    });

    // שלב 6: יצירת PDF ושמירה באחסון — משימה 7.8 (FR-CF-08)
    // מופעל באופן אסינכרוני (fire-and-forget) כדי לא לעכב את תגובת החתימה.
    saveConsentPdf(updated.id).catch((err) => {
      console.error('[Consent PDF] PDF generation/storage failed:', err);
    });

    return NextResponse.json({ ok: true, signedConsentId: updated.id });
  } catch (error) {
    console.error('Error submitting consent:', error);
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 });
  }
}
