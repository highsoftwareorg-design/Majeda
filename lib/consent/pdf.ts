/**
 * lib/consent/pdf.ts — יצירת PDF של טופס הסכמה חתום (משימה 7.8, FR-CF-08).
 *
 * משתמש ב-pdf-lib (TypeScript טהור, ללא Native bindings — תואם ל-Vercel).
 * הערה: pdf-lib אינה תומכת ב-RTL אוטומטי; טקסט עברי מוצג כמיטב יכולתו.
 * פתרון מלא ל-RTL ב-PDF מחייב הטמעת גופן TTF עם תמיכה עברית — מתוכנן לשלב עתידי.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { prisma } from '@/lib/db/prisma';

/** Strip non-ASCII characters for WinAnsi-encoded standard PDF fonts */
const ascii = (s: string): string => s.replace(/[^\x20-\x7E]/g, '?');

export async function generateConsentPdf(signedConsentId: string): Promise<Buffer> {
  const consent = await prisma.signedConsent.findUnique({
    where: { id: signedConsentId },
    include: {
      client: { select: { firstName: true, lastName: true, phone: true } },
      template: { select: { name: true, fields: true } },
    },
  });

  if (!consent) throw new Error(`SignedConsent not found: ${signedConsentId}`);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  // Use standard Helvetica font (pdf-lib built-in; Hebrew requires embedded TTF which is complex)
  // For MVP, Latin transliteration and best-effort Hebrew display are used.
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = height - 50;
  const leftMargin = 50;
  const lineHeight = 20;

  // Title
  page.drawText('Consent Form', {
    x: leftMargin,
    y,
    size: 18,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= lineHeight * 2;

  // Template name
  page.drawText(`Form: ${ascii(consent.template.name)}`, {
    x: leftMargin,
    y,
    size: 14,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= lineHeight * 1.5;

  // Client info
  const clientName = `${consent.client.firstName} ${consent.client.lastName}`.trim();
  page.drawText(`Client: ${ascii(clientName)}`, { x: leftMargin, y, size: 12, font, color: rgb(0, 0, 0) });
  y -= lineHeight;

  if (consent.client.phone) {
    page.drawText(`Phone: ${ascii(consent.client.phone)}`, { x: leftMargin, y, size: 12, font, color: rgb(0, 0, 0) });
    y -= lineHeight;
  }

  // Signed at
  const signedAt = consent.signedAt ? consent.signedAt.toISOString() : 'Not signed';
  page.drawText(`Signed: ${signedAt}`, { x: leftMargin, y, size: 12, font, color: rgb(0, 0, 0) });
  y -= lineHeight * 2;

  // Field values
  const fieldValues = (consent.fieldValues as Record<string, string | boolean>) ?? {};
  for (const [key, value] of Object.entries(fieldValues)) {
    if (y < 100) break; // prevent overflow
    // Sanitize text to avoid pdf-lib encoding issues with special characters
    const safeKey = key.replace(/[^\x20-\x7E]/g, '?');
    const safeValue = String(value).replace(/[^\x20-\x7E]/g, '?');
    page.drawText(`${safeKey}: ${safeValue}`, {
      x: leftMargin,
      y,
      size: 11,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= lineHeight;
  }

  // Signature image (if available)
  if (consent.signatureClientData && consent.signatureClientData.startsWith('data:image/png;base64,')) {
    try {
      y -= 10;
      page.drawText('Client Signature:', { x: leftMargin, y, size: 11, font, color: rgb(0, 0, 0) });
      y -= lineHeight;

      const base64Data = consent.signatureClientData.replace('data:image/png;base64,', '');
      const pngBytes = Buffer.from(base64Data, 'base64');
      const pngImage = await pdfDoc.embedPng(pngBytes);
      const imgDims = pngImage.scale(0.5);

      if (y - imgDims.height > 50) {
        page.drawImage(pngImage, {
          x: leftMargin,
          y: y - imgDims.height,
          width: Math.min(imgDims.width, 300),
          height: Math.min(imgDims.height, 100),
        });
        y -= Math.min(imgDims.height, 100) + 10;
      }
    } catch {
      // Skip signature image on error (malformed base64, corrupt PNG, etc.)
    }
  }

  // Audit trail
  y -= 10;
  if (y > 80) {
    page.drawLine({
      start: { x: leftMargin, y },
      end: { x: width - leftMargin, y },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= lineHeight;
    page.drawText('Audit Trail', { x: leftMargin, y, size: 11, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
    y -= lineHeight;

    if (consent.auditIp) {
      page.drawText(`IP: ${consent.auditIp}`, { x: leftMargin, y, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
      y -= lineHeight;
    }
    if (consent.auditHash) {
      // Show first 40 chars of hash (full SHA-256 is 64 chars)
      page.drawText(`Hash: ${consent.auditHash.substring(0, 40)}...`, {
        x: leftMargin,
        y,
        size: 9,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
