/**
 * lib/whatsapp/__tests__/quiet-hours.test.ts
 * Task 6.2 — בדיקות ל-quiet-hours.ts
 *
 * כל הבדיקות יוצרות תאריכים תקינים לפי אזור הזמן Asia/Jerusalem
 * באמצעות fromZonedTime מ-date-fns-tz.
 *
 * הרצה: `npx vitest run lib/whatsapp/__tests__/quiet-hours.test.ts`
 */

import { describe, it, expect } from "vitest";
import { fromZonedTime } from "date-fns-tz";
import { isQuietHour, isShabbat, nextAllowedSendTime } from "@/lib/whatsapp/quiet-hours";

const TZ = "Asia/Jerusalem";

/**
 * בונה Date (UTC) מתאריך ושעה בזמן ישראל.
 * כך הבדיקות ניתנות לקריאה ברורה ולא תלויות ב-offset ידני.
 */
function israelDate(
  year: number,
  month: number, // 1-based
  day: number,
  hour: number,
  minute = 0,
  second = 0
): Date {
  // fromZonedTime מקבל תאריך-שעה מקומי ב-TZ ומחזיר UTC
  return fromZonedTime(
    new Date(year, month - 1, day, hour, minute, second),
    TZ
  );
}

// ===== isQuietHour =====

describe("isQuietHour", () => {
  it("1. יום חול 10:00 (ישראל) — לא שעת שקט → false", () => {
    // שני 2026-11-02 בשעה 10:00 ישראל (נובמבר = UTC+2)
    const date = israelDate(2026, 11, 2, 10);
    expect(isQuietHour(date)).toBe(false);
  });

  it("2. יום חול 22:00 (ישראל) — שעת שקט → true", () => {
    // שני 2026-11-02 בשעה 22:00 ישראל
    const date = israelDate(2026, 11, 2, 22);
    expect(isQuietHour(date)).toBe(true);
  });

  it("3. בדיוק 08:00 (ישראל) — תחילת חלון מותר → false", () => {
    const date = israelDate(2026, 11, 2, 8);
    expect(isQuietHour(date)).toBe(false);
  });

  it("4. בדיוק 21:00 (ישראל) — תחילת שעת שקט (endHour=21) → true", () => {
    const date = israelDate(2026, 11, 2, 21);
    expect(isQuietHour(date)).toBe(true);
  });

  it("5. שבת 21:30 (ישראל) — גם שעת שקט → true", () => {
    // שבת 2026-11-07 בשעה 21:30 ישראל
    const date = israelDate(2026, 11, 7, 21, 30);
    expect(isQuietHour(date)).toBe(true);
  });
});

// ===== isShabbat =====

describe("isShabbat", () => {
  it("1. שישי 19:00 (ישראל) — שבת (מעל 18:00 ביום שישי) → true", () => {
    // שישי 2026-11-06 בשעה 19:00 ישראל
    const date = israelDate(2026, 11, 6, 19);
    expect(isShabbat(date)).toBe(true);
  });

  it("2. שישי 17:59 (ישראל) — לפני שבת → false", () => {
    const date = israelDate(2026, 11, 6, 17, 59);
    expect(isShabbat(date)).toBe(false);
  });

  it("3. שישי 18:00 (ישראל) — תחילת שבת (כולל) → true", () => {
    const date = israelDate(2026, 11, 6, 18);
    expect(isShabbat(date)).toBe(true);
  });

  it("4. שבת 21:30 (ישראל) — עדיין שבת → true", () => {
    // שבת 2026-11-07 בשעה 21:30 ישראל
    const date = israelDate(2026, 11, 7, 21, 30);
    expect(isShabbat(date)).toBe(true);
  });

  it("5. שבת 23:30 (ישראל) — מוצאי שבת (אחרי 23:00) → false", () => {
    // שבת 2026-11-07 בשעה 23:30 ישראל
    const date = israelDate(2026, 11, 7, 23, 30);
    expect(isShabbat(date)).toBe(false);
  });

  it("6. שבת 22:59 (ישראל) — עדיין שבת (לפני 23:00) → true", () => {
    const date = israelDate(2026, 11, 7, 22, 59);
    expect(isShabbat(date)).toBe(true);
  });

  it("7. שבת 23:00 (ישראל) — בדיוק 23:00, hour<23 שקרי → false", () => {
    const date = israelDate(2026, 11, 7, 23);
    expect(isShabbat(date)).toBe(false);
  });

  it("8. יום ראשון 10:00 (ישראל) — לא שבת → false", () => {
    const date = israelDate(2026, 11, 8, 10);
    expect(isShabbat(date)).toBe(false);
  });
});

// ===== nextAllowedSendTime =====

describe("nextAllowedSendTime", () => {
  it("6. מיום שישי 20:00 ישראל — מחזיר זמן ביום ראשון 08:00 ישראל (לא שבת, לא שקט)", () => {
    // שישי 2026-11-06 בשעה 20:00 ישראל
    // שבת נמשכת עד שבת 23:00 ישראל; ואז שעות שקט עד ראשון 08:00
    const fridayEvening = israelDate(2026, 11, 6, 20);
    const result = nextAllowedSendTime(fridayEvening);

    // הזמן המוחזר לא צריך להיות שעת שקט ולא שבת
    expect(isQuietHour(result)).toBe(false);
    expect(isShabbat(result)).toBe(false);

    // צפי: ראשון 2026-11-08 08:00 ישראל
    const expectedSunday8am = israelDate(2026, 11, 8, 8);
    // הפרש לא יעלה על שעה (snapTo beginning of hour)
    expect(result.getTime()).toBe(expectedSunday8am.getTime());
  });

  it("7. מיום חול 22:00 ישראל — מחזיר יום למחרת 08:00 ישראל", () => {
    // שני 2026-11-02 בשעה 22:00 ישראל
    const mondayNight = israelDate(2026, 11, 2, 22);
    const result = nextAllowedSendTime(mondayNight);

    expect(isQuietHour(result)).toBe(false);
    expect(isShabbat(result)).toBe(false);

    // צפי: שלישי 2026-11-03 08:00 ישראל
    const expectedTuesday8am = israelDate(2026, 11, 3, 8);
    expect(result.getTime()).toBe(expectedTuesday8am.getTime());
  });

  it("8. מזמן מותר (יום חול 10:00 ישראל) — מחזיר זמן מאוחר יותר שגם הוא מותר", () => {
    // גם כאשר כבר בחלון מותר, הפונקציה מחזירה +1 שעה לפחות (כך היא מממשת)
    const allowed = israelDate(2026, 11, 2, 10);
    const result = nextAllowedSendTime(allowed);

    expect(isQuietHour(result)).toBe(false);
    expect(isShabbat(result)).toBe(false);
    // הזמן המוחזר חייב להיות מאוחר מה-input
    expect(result.getTime()).toBeGreaterThan(allowed.getTime());
  });

  it("9. מערב שישי מאוחר (23:30 ישראל) — מחזיר ראשון 08:00 ישראל", () => {
    // שישי 2026-11-06 23:30 ישראל — שבת ממשיכה עד שבת 23:00
    const fridayLate = israelDate(2026, 11, 6, 23, 30);
    const result = nextAllowedSendTime(fridayLate);

    expect(isQuietHour(result)).toBe(false);
    expect(isShabbat(result)).toBe(false);

    const expectedSunday8am = israelDate(2026, 11, 8, 8);
    expect(result.getTime()).toBe(expectedSunday8am.getTime());
  });
});
