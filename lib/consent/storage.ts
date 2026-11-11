/**
 * lib/consent/storage.ts — שמירת PDF של טופס הסכמה ב-Cloudflare R2 (משימה 7.8, FR-CF-08, BR-05).
 *
 * במצב פיתוח (ללא CLOUDFLARE_R2_ACCOUNT_ID) — מדלג על אחסון ומחזיר מפתח דמה.
 * בסביבת ייצור — שומר ב-R2 ומעדכן את שדה pdfStorageKey ב-SignedConsent.
 */

import { PutObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/db/prisma';
import { generateConsentPdf } from './pdf';
import { getR2Client, getR2Bucket } from './r2';

export async function saveConsentPdf(signedConsentId: string): Promise<string> {
  const client = getR2Client();

  if (!client) {
    console.info(
      `[Consent PDF] Skipping R2 storage (no CLOUDFLARE_R2_ACCOUNT_ID) for consent ${signedConsentId}`
    );
    return 'mock-storage-key';
  }

  const pdfBuffer = await generateConsentPdf(signedConsentId);

  const consent = await prisma.signedConsent.findUnique({
    where: { id: signedConsentId },
    select: { clientId: true },
  });

  if (!consent) throw new Error(`SignedConsent not found: ${signedConsentId}`);

  const key = `consents/${consent.clientId}/${signedConsentId}.pdf`;
  const bucket = getR2Bucket();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    })
  );

  const publicBase = process.env.CLOUDFLARE_R2_PUBLIC_URL?.replace(/\/$/, '');
  const url = publicBase ? `${publicBase}/${key}` : key;

  await prisma.signedConsent.update({
    where: { id: signedConsentId },
    data: { pdfStorageKey: url },
  });

  return url;
}
