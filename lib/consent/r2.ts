/**
 * lib/consent/r2.ts — לקוח Cloudflare R2 (S3-compatible) משותף לשמירה ולשליפה של PDF חתום (משימה 11.12, §11).
 *
 * מקור יחיד לקונפיגורציה: storage.ts (העלאה) וה-route של הורדת ה-PDF משתמשים באותה פונקציה.
 * הקרדנציאלס נקראים רק מ-env ולא נחשפים ללקוח/ה.
 */

import { S3Client } from '@aws-sdk/client-s3';

/** שם ה-bucket (ברירת מחדל: majeda-files). */
export function getR2Bucket(): string {
  return process.env.CLOUDFLARE_R2_BUCKET_NAME ?? 'majeda-files';
}

/**
 * מחזיר S3Client מוגדר ל-R2, או null אם CLOUDFLARE_R2_ACCOUNT_ID לא מוגדר
 * (מצב פיתוח ללא R2 — ההתנהגות זהה למה שהייתה ב-storage.ts).
 */
export function getR2Client(): S3Client | null {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  if (!accountId) return null;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? '',
    },
  });
}

/** האם קיימים כל משתני הסביבה הנדרשים לחתימת בקשות ל-R2 (לשימוש בנתיב ההורדה). */
export function hasR2Credentials(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  );
}
