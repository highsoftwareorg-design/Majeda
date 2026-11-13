/**
 * GET /api/clients/[id]/consents — רשימת טפסי הסכמה חתומים ללקוח (task 7.9, FR-PR-08, FR-CF-09).
 *
 * מחזיר את כל ה-SignedConsent של הלקוח, כולל סטטוס מחושב (בתוקף / פג תוקף / ממתין לחתימה).
 *
 * פרטיות (§11): אין להחזיר נתוני חתימה גולמיים (signatureClientData/signatureTherapistData) —
 * רק מטא-דאטה הנדרש לתצוגה בפרופיל.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { auth } from '@/lib/auth/auth';

export type ConsentStatus = 'בתוקף' | 'פג תוקף' | 'ממתין לחתימה';

export interface ConsentItem {
  id: string;
  templateName: string;
  templateVersion: number;
  signedAt: string | null;
  expiresAt: string | null;
  pdfStorageKey: string | null;
  status: ConsentStatus;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });

  const { id } = await params;

  const consents = await prisma.signedConsent.findMany({
    where: { clientId: id },
    include: { template: { select: { name: true, validityDays: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const now = new Date();

  const result: ConsentItem[] = consents.map((c) => {
    const expiresAt =
      c.signedAt && c.template.validityDays
        ? new Date(
            c.signedAt.getTime() + c.template.validityDays * 24 * 60 * 60 * 1000
          )
        : null;

    let status: ConsentStatus;
    if (!c.signedAt) {
      status = 'ממתין לחתימה';
    } else if (expiresAt && expiresAt < now) {
      status = 'פג תוקף';
    } else {
      status = 'בתוקף';
    }

    return {
      id: c.id,
      templateName: c.template.name,
      templateVersion: c.templateVersion,
      signedAt: c.signedAt?.toISOString() ?? null,
      expiresAt: expiresAt?.toISOString() ?? null,
      pdfStorageKey: c.pdfStorageKey,
      status,
    };
  });

  return NextResponse.json(result);
}
