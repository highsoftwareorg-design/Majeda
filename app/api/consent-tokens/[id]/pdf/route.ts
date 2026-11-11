/**
 * GET /api/consent-tokens/[id]/pdf — הורדה פרטית של PDF של טופס הסכמה חתום (משימה 11.12, §11).
 *
 * [id] = מזהה SignedConsent (זהה לקישור ב-ConsentList).
 *
 * אבטחה (§11): נדרשת התחברות (Auth.js). ה-PDF נשמר ב-R2 בבאקט פרטי, ו-pdfStorageKey הוא מפתח גולמי.
 * התשובה היא הפניה (302) ל-presigned GET URL קצר-חיים (60 שניות). אין שמירת URL ציבורי.
 * ה-route לא מקבל מפתח מהמשתמש — המפתח נשלף מ-DB בלבד.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { getR2Client, getR2Bucket, hasR2Credentials } from '@/lib/consent/r2';

/** תוקף ה-presigned URL בשניות. */
const PRESIGN_TTL_SECONDS = 60;

/** ערך דמה שנשמר בפיתוח ללא R2 (ראו lib/consent/storage.ts). */
const MOCK_STORAGE_KEY = 'mock-storage-key';

const NO_CACHE_HEADERS = { 'Cache-Control': 'private, no-store' };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ─── אימות: נדרשת התחברות ───────────────────────────────────────────────
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: 'נדרשת התחברות' },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  const { id } = await params;

  try {
    // ─── שליפת מפתח האחסון מה-DB ──────────────────────────────────────────
    const consent = await prisma.signedConsent.findUnique({
      where: { id },
      select: { id: true, pdfStorageKey: true },
    });

    if (!consent) {
      return NextResponse.json(
        { error: 'טופס ההסכמה לא נמצא' },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    const storageKey = consent.pdfStorageKey;
    if (!storageKey || storageKey === MOCK_STORAGE_KEY) {
      return NextResponse.json(
        { error: 'לא נשמר קובץ PDF עבור טופס זה' },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    // ─── מפתח/URL ציבורי קיים (מקרה legacy) — הפניה ישירה ─────────────────
    if (/^https?:\/\//i.test(storageKey)) {
      return NextResponse.redirect(storageKey, {
        status: 302,
        headers: NO_CACHE_HEADERS,
      });
    }

    // ─── מפתח R2 גולמי — presigned GET קצר-חיים ────────────────────────────
    const client = getR2Client();
    if (!client || !hasR2Credentials()) {
      console.error(
        `[GET /api/consent-tokens/${id}/pdf] R2 is not configured (missing CLOUDFLARE_R2_* env vars)`
      );
      return NextResponse.json(
        { error: 'אחסון הקבצים אינו מוגדר כראוי. יש לפנות למנהל המערכת' },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    const url = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: getR2Bucket(),
        Key: storageKey,
        ResponseContentType: 'application/pdf',
        ResponseContentDisposition: `inline; filename="consent-${consent.id}.pdf"`,
      }),
      { expiresIn: PRESIGN_TTL_SECONDS }
    );

    return NextResponse.redirect(url, {
      status: 302,
      headers: NO_CACHE_HEADERS,
    });
  } catch (error) {
    console.error(`[GET /api/consent-tokens/${id}/pdf] Error:`, error);
    return NextResponse.json(
      { error: 'שגיאה בטעינת הקובץ' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
