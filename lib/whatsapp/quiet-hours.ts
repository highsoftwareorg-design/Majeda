import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const ISRAEL_TZ = 'Asia/Jerusalem';

// TODO: חגים יהודיים — לא ממומש ב-MVP
// אפשרות עתידית: שימוש ב-Hebcal API (https://www.hebcal.com/hebcal/)
// או רשימת תאריכים שנתית ב-ClinicSettings

export interface QuietHoursSettings {
  startHour: number; // e.g. 8 (08:00)
  endHour: number;   // e.g. 21 (21:00)
}

const DEFAULT_SETTINGS: QuietHoursSettings = {
  startHour: 8,
  endHour: 21,
};

/**
 * Returns true if the given UTC date falls outside the allowed sending window
 * (default: 08:00–21:00 Asia/Jerusalem, any day except Shabbat).
 * Note: does NOT check Shabbat separately — Shabbat is checked by isShabbat().
 */
export function isQuietHour(date: Date, settings: QuietHoursSettings = DEFAULT_SETTINGS): boolean {
  const zoned = toZonedTime(date, ISRAEL_TZ);
  const hour = zoned.getHours();
  return hour < settings.startHour || hour >= settings.endHour;
}

/**
 * Returns true if the given UTC date falls during Shabbat
 * (Friday 18:00 Israel time through Saturday night ~1 hour after sunset).
 * Approximate: Saturday ends at 23:00 Israel time (conservative).
 * TODO: Use precise Zmanim API or Hebcal for exact havdalah time.
 */
export function isShabbat(date: Date): boolean {
  const zoned = toZonedTime(date, ISRAEL_TZ);
  const day = zoned.getDay(); // 0=Sun, 5=Fri, 6=Sat
  const hour = zoned.getHours();

  // Friday from 18:00
  if (day === 5 && hour >= 18) return true;
  // Saturday until 23:00 (conservative motzei shabbat)
  if (day === 6 && hour < 23) return true;

  return false;
}

/**
 * Returns the next DateTime (UTC) when sending is allowed.
 * If currently in quiet hours or Shabbat, returns start of next allowed window.
 */
export function nextAllowedSendTime(date: Date, settings: QuietHoursSettings = DEFAULT_SETTINGS): Date {
  // Try advancing hour by hour (up to 48h)
  let candidate = new Date(date);
  for (let i = 0; i < 48; i++) {
    candidate = new Date(candidate.getTime() + 60 * 60 * 1000); // +1 hour
    if (!isQuietHour(candidate, settings) && !isShabbat(candidate)) {
      // Snap to the start of this hour
      const zoned = toZonedTime(candidate, ISRAEL_TZ);
      zoned.setMinutes(0, 0, 0);
      return fromZonedTime(zoned, ISRAEL_TZ);
    }
  }
  // Fallback: return 48h later
  return new Date(date.getTime() + 48 * 60 * 60 * 1000);
}
