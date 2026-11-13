/**
 * lib/consent/pdf.ts — יצירת PDF של טופס הסכמה חתום (משימה 7.8, FR-CF-08).
 *
 * משתמש ב-pdf-lib (TypeScript טהור, ללא Native bindings — תואם ל-Vercel).
 *
 * תמיכה בעברית:
 * - הגופן Noto Sans Hebrew (Regular / Bold) מוטמע מ-lib/consent/fonts/hebrew-fonts.ts (base64),
 *   ונרשם ל-pdf-lib דרך @pdf-lib/fontkit.
 * - pdf-lib אינה תומכת ב-bidi: כל שורה עוברת המרה לסדר חזותי דרך bidi-js לפני הציור,
 *   והטקסט מיושר לימין (מחושב לפי widthOfTextAtSize).
 * - תוויות שדות מוצגות בעברית (מתוך template.fields), לא מזהי שדות.
 */

import { PDFDocument, PDFFont, PDFPage, rgb, RGB } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import bidiFactory from 'bidi-js';
import { prisma } from '@/lib/db/prisma';
import {
  NOTO_SANS_HEBREW_BOLD_B64,
  NOTO_SANS_HEBREW_REGULAR_B64,
} from './fonts/hebrew-fonts';

const bidi = bidiFactory();

const PAGE_WIDTH = 595; // A4
const PAGE_HEIGHT = 842; // A4
const LEFT_MARGIN = 50;
const RIGHT_MARGIN = 50;
const LINE_HEIGHT = 20;
const BODY_SIZE = 11;

const BLACK = rgb(0, 0, 0);
const TEXT_COLOR = rgb(0.1, 0.1, 0.1);
const MUTED_COLOR = rgb(0.5, 0.5, 0.5);

/** שדות שאינם טקסט: חתימה מצויירת כתמונה, ולא מופיעה כשורה. */
const SIGNATURE_FIELD_TYPE = 'signature';

interface TemplateField {
  id: string;
  type: string;
  label: string;
}

/**
 * ממיר מחרוזת לסדר חזותי (visual order) עבור pdf-lib, שמצייר משמאל לימין.
 * הטקסט מתפרש כפסקה מימין-לשמאל; מקטעים לטיניים/ספרות (שמות מכשירים, טלפונים, תאריכים) נשמרים כבלוקים LTR.
 */
function toVisualOrder(text: string): string {
  if (!text) return text;
  const last = text.length - 1;
  const embedding = bidi.getEmbeddingLevels(text, 'rtl');
  const flips = bidi.getReorderSegments(text, embedding, 0, last);
  const mirrored = bidi.getMirroredCharactersMap(text, embedding.levels, 0, last);

  const chars = text.split('');
  for (const [index, replacement] of mirrored) {
    chars[index] = replacement;
  }
  for (const [start, end] of flips) {
    for (let i = start, j = end; i < j; i++, j--) {
      const tmp = chars[i];
      chars[i] = chars[j];
      chars[j] = tmp;
    }
  }
  return chars.join('');
}

/** שובר טקסט לשורות לפי רוחב מקסימלי (בסדר לוגי, לפני המרה לסדר חזותי). */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(toVisualOrder(candidate), size) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** מחזיר את מערך השדות מתוך template.fields (JSON לא מטופס), עם בדיקת טיפוסים. */
function parseTemplateFields(raw: unknown): TemplateField[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (f): f is TemplateField =>
      typeof f === 'object' &&
      f !== null &&
      typeof (f as Record<string, unknown>).id === 'string' &&
      typeof (f as Record<string, unknown>).type === 'string' &&
      typeof (f as Record<string, unknown>).label === 'string'
  );
}

/** מעצב ערך תשובה לתצוגה אנושית. מחזיר null לערך ריק/חסר. */
function formatAnswer(value: unknown): string | null {
  if (typeof value === 'boolean') return value ? 'כן' : 'לא';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jerusalem',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** dd/MM/yyyy HH:mm לפי שעון ישראל. */
function formatDateTime(date: Date): string {
  return DATE_TIME_FORMAT.format(date).replace(',', '');
}

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
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(Buffer.from(NOTO_SANS_HEBREW_REGULAR_B64, 'base64'), { subset: true });
  const boldFont = await pdfDoc.embedFont(Buffer.from(NOTO_SANS_HEBREW_BOLD_B64, 'base64'), { subset: true });

  const page: PDFPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const { width } = page.getSize();
  const contentWidth = width - LEFT_MARGIN - RIGHT_MARGIN;

  /** מצייר שורה מיושרת לימין, אחרי המרה לסדר חזותי. */
  const drawRtl = (text: string, y: number, size: number, f: PDFFont, color: RGB): void => {
    const visual = toVisualOrder(text);
    const textWidth = f.widthOfTextAtSize(visual, size);
    page.drawText(visual, {
      x: width - RIGHT_MARGIN - textWidth,
      y,
      size,
      font: f,
      color,
    });
  };

  let y = PAGE_HEIGHT - 50;

  // כותרת
  drawRtl('טופס הסכמה חתום', y, 18, boldFont, rgb(0.1, 0.1, 0.1));
  y -= LINE_HEIGHT * 2;

  // שם הטופס
  drawRtl(`טופס: ${consent.template.name}`, y, 14, boldFont, rgb(0.2, 0.2, 0.2));
  y -= LINE_HEIGHT * 1.5;

  // פרטי לקוח/ה
  const clientName = `${consent.client.firstName} ${consent.client.lastName}`.trim();
  drawRtl(`שם הלקוח/ה: ${clientName}`, y, 12, font, BLACK);
  y -= LINE_HEIGHT;

  if (consent.client.phone) {
    drawRtl(`טלפון: ${consent.client.phone}`, y, 12, font, BLACK);
    y -= LINE_HEIGHT;
  }

  const signedAt = consent.signedAt ? formatDateTime(consent.signedAt) : 'טרם נחתם';
  drawRtl(`נחתם בתאריך: ${signedAt}`, y, 12, font, BLACK);
  y -= LINE_HEIGHT * 2;

  // תשובות לשדות — לפי סדר הטופס, עם התוויות בעברית (לא מזהי שדות)
  const fieldValues = (consent.fieldValues as Record<string, unknown>) ?? {};
  const templateFields = parseTemplateFields(consent.template.fields);
  for (const field of templateFields) {
    if (field.type === SIGNATURE_FIELD_TYPE) continue;
    const answer = formatAnswer(fieldValues[field.id]);
    if (answer === null) continue;

    // מסירים נקודה/רווח סופי מהתווית לפני הנקודתיים
    const label = field.label.replace(/[.\s]+$/, '');
    const lines = wrapText(`${label}: ${answer}`, font, BODY_SIZE, contentWidth);
    for (const line of lines) {
      if (y < 100) break; // prevent overflow
      drawRtl(line, y, BODY_SIZE, font, TEXT_COLOR);
      y -= LINE_HEIGHT;
    }
    if (y < 100) break;
  }

  // חתימת הלקוח/ה (מצוירת כתמונה)
  if (consent.signatureClientData && consent.signatureClientData.startsWith('data:image/png;base64,')) {
    try {
      y -= 10;
      drawRtl('חתימת הלקוח/ה:', y, BODY_SIZE, font, BLACK);
      y -= LINE_HEIGHT;

      const base64Data = consent.signatureClientData.replace('data:image/png;base64,', '');
      const pngBytes = Buffer.from(base64Data, 'base64');
      const pngImage = await pdfDoc.embedPng(pngBytes);

      // התאמה למלבן 300x100 תוך שמירה על יחס הגובה-רוחב
      const scale = Math.min(1, 300 / pngImage.width, 100 / pngImage.height);
      const imgWidth = pngImage.width * scale;
      const imgHeight = pngImage.height * scale;

      if (y - imgHeight > 50) {
        page.drawImage(pngImage, {
          x: width - RIGHT_MARGIN - imgWidth,
          y: y - imgHeight,
          width: imgWidth,
          height: imgHeight,
        });
        y -= imgHeight + 10;
      }
    } catch {
      // Skip signature image on error (malformed base64, corrupt PNG, etc.)
    }
  }

  // נתיב ביקורת
  y -= 10;
  if (y > 80) {
    page.drawLine({
      start: { x: LEFT_MARGIN, y },
      end: { x: width - RIGHT_MARGIN, y },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= LINE_HEIGHT;
    drawRtl('נתיב ביקורת', y, BODY_SIZE, boldFont, rgb(0.3, 0.3, 0.3));
    y -= LINE_HEIGHT;

    if (consent.auditIp) {
      drawRtl(`כתובת IP: ${consent.auditIp}`, y, 9, font, MUTED_COLOR);
      y -= LINE_HEIGHT;
    }
    if (consent.auditHash) {
      // Show first 40 chars of hash (full SHA-256 is 64 chars)
      drawRtl(`חתימת אימות (Hash): ${consent.auditHash.substring(0, 40)}...`, y, 9, font, MUTED_COLOR);
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
