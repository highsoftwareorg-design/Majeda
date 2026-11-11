/**
 * טווח "הטיפולים הקרובים" בדשבורד (משימה 11.10).
 *
 * HORIZON = היום + N ימים, כולל משני הקצוות (ברירת מחדל N=7).
 * הגבולות מחושבים לפי יום בשעון ישראל (Asia/Jerusalem, NFR-05) — לא לפי
 * אזור הזמן של השרת (Vercel רץ ב-UTC). התוצאה מתאימה ישירות ל-
 * `getAppointmentsByDateRange(start, end)`, כאשר end בלעדי.
 */

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { ISRAEL_TZ } from "@/lib/exports/csv";

export const UPCOMING_DAYS = 7;

export interface UpcomingHorizon {
  /** תחילת היום הנוכחי בשעון ישראל (כולל) */
  start: Date;
  /** תחילת היום שאחרי הטווח בשעון ישראל (בלעדי) */
  end: Date;
  /** תאריך היום בפורמט yyyy-MM-dd (שעון ישראל) */
  todayYmd: string;
}

/**
 * מחשב את טווח התורים: מתחילת היום (ישראל) ועד סוף היום ה-N (ישראל).
 *
 * @param now   — הרגע הנוכחי (ברירת מחדל: new Date())
 * @param days  — מספר הימים הקדימה (כולל), ברירת מחדל 7
 */
export function getUpcomingHorizon(now: Date = new Date(), days: number = UPCOMING_DAYS): UpcomingHorizon {
  const todayYmd = formatInTimeZone(now, ISRAEL_TZ, "yyyy-MM-dd");

  // חישוב תאריך היום + days באמצעות UTC (ללא השפעת אזור זמן השרת)
  const [y, m, d] = todayYmd.split("-").map(Number);
  const afterYmd = new Date(Date.UTC(y, m - 1, d + days + 1)).toISOString().slice(0, 10);

  return {
    start: fromZonedTime(`${todayYmd}T00:00:00`, ISRAEL_TZ),
    end: fromZonedTime(`${afterYmd}T00:00:00`, ISRAEL_TZ),
    todayYmd,
  };
}
