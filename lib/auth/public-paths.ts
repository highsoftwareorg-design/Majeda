// מודול טהור לנתיבי API — ללא imports, כדי שיהיה בטוח לשימוש ב-Edge (middleware.ts).
// רשימת ה-allowlist הציבורי מוגדרת כאן בלבד — אין לשכפל אותה במקומות אחרים.
// task 13.1 (SRS §11): כל נתיב תחת /api דורש session, פרט לרשימה הסגורה הזו.

/**
 * נתיבי API שמותר לגשת אליהם ללא session.
 * - /api/auth/        : נתיבי NextAuth עצמם (חסימתם שוברת את ההתחברות)
 * - /api/sign/        : חתימת לקוח/ה — ה-token הוא האישור
 * - /api/whatsapp/webhook : Twilio/Meta — מאומת בחתימה/verify token
 * - /api/cron/run     : Vercel Cron — מאומת ב-Authorization: Bearer <CRON_SECRET>
 */
export const PUBLIC_API_PREFIXES: readonly string[] = [
  "/api/auth/",
  "/api/sign/",
  "/api/whatsapp/webhook",
  "/api/cron/run",
];

/**
 * האם הנתיב נמצא ב-allowlist הציבורי.
 * לכל פריפיקס: הנתיב תואם אם הוא שווה לפריפיקס ללא "/" סופי, או מתחיל בו ואחריו "/".
 * כלומר ההתאמה היא על גבול מקטע בלבד — אין התאמת פריפיקס חלקית על מקטע
 * (לדוגמה "/api/cron/runner" או "/api/whatsapp/webhook-admin" אינם תואמים).
 * אין נרמול (למשל אותיות גדולות/קטנות) — ההשוואה רגישה לאותיות.
 */
export function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => {
    const exact = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
    return pathname === exact || pathname.startsWith(exact + "/");
  });
}

/**
 * האם הנתיב הוא חלק מ-/api (כולל /api עצמו).
 */
export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}
