/**
 * lib/consent/storage.ts — שמירת PDF של טופס הסכמה ב-Vercel Blob (משימה 7.8, FR-CF-08, BR-05).
 *
 * במצב פיתוח (ללא BLOB_READ_WRITE_TOKEN) — מדלג על אחסון ומחזיר מפתח דמה.
 * בסביבת ייצור — שומר ב-Vercel Blob ומעדכן את שדה pdfStorageKey ב-SignedConsent.
 */

import { put } from '@vercel/blob';
import { prisma } from '@/lib/db/prisma';
import { generateConsentPdf } from './pdf';

export async function saveConsentPdf(signedConsentId: string): Promise<string> {
  // In development without BLOB_READ_WRITE_TOKEN, skip blob storage
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.info(
      `[Consent PDF] Skipping blob storage (no BLOB_READ_WRITE_TOKEN) for consent ${signedConsentId}`
    );
    return 'mock-storage-key';
  }

  const pdfBuffer = await generateConsentPdf(signedConsentId);

  // Fetch client ID for path construction
  const consent = await prisma.signedConsent.findUnique({
    where: { id: signedConsentId },
    select: { clientId: true },
  });

  if (!consent) throw new Error(`SignedConsent not found: ${signedConsentId}`);

  const path = `consents/${consent.clientId}/${signedConsentId}.pdf`;

  const { url } = await put(path, pdfBuffer, {
    access: 'public',
    contentType: 'application/pdf',
  });

  // Update the SignedConsent record with the storage URL
  await prisma.signedConsent.update({
    where: { id: signedConsentId },
    data: { pdfStorageKey: url },
  });

  return url;
}
