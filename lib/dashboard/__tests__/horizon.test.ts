/**
 * בדיקות יחידה ל-getUpcomingHorizon (משימה 11.10).
 *
 * מאמת: HORIZON = היום + 7 ימים כולל (start כולל, end בלעדי), גבולות חצות
 * בשעון ישראל (Asia/Jerusalem) ללא תלות באזור הזמן של השרת, התנהגות סביב
 * חצות ישראל, ומעבר שעון קיץ/חורף.
 */
import { describe, expect, it } from "vitest";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { getUpcomingHorizon, UPCOMING_DAYS } from "@/lib/dashboard/horizon";

const TZ = "Asia/Jerusalem";
const stamp = (d: Date) => formatInTimeZone(d, TZ, "yyyy-MM-dd HH:mm:ss");
const offset = (d: Date) => formatInTimeZone(d, TZ, "xxx");

describe("getUpcomingHorizon", () => {
  it("default UPCOMING_DAYS is 7", () => {
    expect(UPCOMING_DAYS).toBe(7);
  });

  describe("summer (DST, UTC+3)", () => {
    const now = new Date("2026-06-14T09:00:00Z"); // 12:00 מקומי
    const h = getUpcomingHorizon(now);

    it("todayYmd is the Israel-local calendar day", () => {
      expect(h.todayYmd).toBe("2026-06-14");
    });

    it("start is Israel-local midnight of today (inclusive bound)", () => {
      expect(stamp(h.start)).toBe("2026-06-14 00:00:00");
      // start זהה בדיוק לחצות ישראל של היום → נכלל דרך gte
      expect(h.start.getTime()).toBe(
        fromZonedTime("2026-06-14T00:00:00", TZ).getTime()
      );
    });

    it("end is exclusive Israel-local midnight of today+8 (covers today..today+7 inclusive)", () => {
      // today+7 = 2026-06-21 ; end = תחילת 2026-06-22
      expect(stamp(h.end)).toBe("2026-06-22 00:00:00");
    });

    it("has the +03:00 offset in summer", () => {
      expect(offset(h.start)).toBe("+03:00");
      expect(offset(h.end)).toBe("+03:00");
    });

    it("start inclusive / end exclusive semantics are correct", () => {
      const beforeStart = fromZonedTime("2026-06-13T23:59:00", TZ);
      const day7Late = fromZonedTime("2026-06-21T23:59:00", TZ); // today+7 late
      const day8Midnight = fromZonedTime("2026-06-22T00:00:00", TZ); // today+8 start

      expect(beforeStart.getTime()).toBeLessThan(h.start.getTime()); // excluded
      expect(day7Late.getTime()).toBeLessThan(h.end.getTime()); // included (today+7)
      // תור בדיוק על גבול end נשלל (lt, לא lte)
      expect(day8Midnight.getTime()).toBe(h.end.getTime());
    });

    it("covers exactly 8 distinct days (today..today+7)", () => {
      for (let i = 0; i <= 7; i++) {
        const day = String(14 + i).padStart(2, "0");
        const noon = fromZonedTime(`2026-06-${day}T12:00:00`, TZ);
        expect(noon.getTime()).toBeGreaterThanOrEqual(h.start.getTime());
        expect(noon.getTime()).toBeLessThan(h.end.getTime());
      }
      // יום לפני ואחרי הטווח — מחוץ
      expect(fromZonedTime("2026-06-13T12:00:00", TZ).getTime()).toBeLessThan(
        h.start.getTime()
      );
      expect(
        fromZonedTime("2026-06-22T12:00:00", TZ).getTime()
      ).toBeGreaterThanOrEqual(h.end.getTime());
    });
  });

  describe("winter (standard time, UTC+2)", () => {
    const now = new Date("2026-01-15T09:00:00Z"); // 11:00 מקומי
    const h = getUpcomingHorizon(now);

    it("todayYmd / start / end are correct in winter", () => {
      expect(h.todayYmd).toBe("2026-01-15");
      expect(stamp(h.start)).toBe("2026-01-15 00:00:00");
      expect(stamp(h.end)).toBe("2026-01-23 00:00:00");
    });

    it("has the +02:00 offset in winter", () => {
      expect(offset(h.start)).toBe("+02:00");
      expect(offset(h.end)).toBe("+02:00");
    });
  });

  describe("midnight boundary in Israel time", () => {
    it("summer: just before Israel midnight stays on current day, at/after rolls over", () => {
      // חצות ישראל של 15/06 = 2026-06-14T21:00:00Z (UTC+3)
      expect(getUpcomingHorizon(new Date("2026-06-14T20:59:59Z")).todayYmd).toBe(
        "2026-06-14"
      );
      expect(getUpcomingHorizon(new Date("2026-06-14T21:00:00Z")).todayYmd).toBe(
        "2026-06-15"
      );
    });

    it("winter: just before Israel midnight stays on current day, at/after rolls over", () => {
      // חצות ישראל של 16/01 = 2026-01-15T22:00:00Z (UTC+2)
      expect(getUpcomingHorizon(new Date("2026-01-15T21:59:59Z")).todayYmd).toBe(
        "2026-01-15"
      );
      expect(getUpcomingHorizon(new Date("2026-01-15T22:00:00Z")).todayYmd).toBe(
        "2026-01-16"
      );
    });
  });

  describe("DST spring-forward within the horizon window", () => {
    // שעון קיץ 2026 בישראל מתחיל 27/03/2026 בשעה 02:00 → 03:00.
    // now לפני המעבר (UTC+2); today+7 חוצה אל שעון קיץ (UTC+3).
    const now = new Date("2026-03-24T09:00:00Z"); // 11:00 מקומי, חורף
    const h = getUpcomingHorizon(now);

    it("start and end are Israel-local midnights of the correct days across DST", () => {
      expect(h.todayYmd).toBe("2026-03-24");
      expect(stamp(h.start)).toBe("2026-03-24 00:00:00");
      // today+7 = 2026-03-31 ; end = תחילת 2026-04-01 (כבר בשעון קיץ)
      expect(stamp(h.end)).toBe("2026-04-01 00:00:00");
    });

    it("the offset flips from +02:00 (start) to +03:00 (end) across the window", () => {
      expect(offset(h.start)).toBe("+02:00");
      expect(offset(h.end)).toBe("+03:00");
    });

    it("the UTC span is 8 days minus one hour (the lost DST hour)", () => {
      const hours = (h.end.getTime() - h.start.getTime()) / 3_600_000;
      expect(hours).toBe(8 * 24 - 1); // 191
    });
  });

  describe("custom days parameter", () => {
    const now = new Date("2026-06-14T09:00:00Z");

    it("days=3 covers today..today+3 inclusive", () => {
      const h = getUpcomingHorizon(now, 3);
      // today+3 = 2026-06-17 ; end = תחילת 2026-06-18
      expect(stamp(h.end)).toBe("2026-06-18 00:00:00");
    });

    it("days=0 covers today only", () => {
      const h = getUpcomingHorizon(now, 0);
      expect(stamp(h.end)).toBe("2026-06-15 00:00:00");
    });
  });

  describe("month/year rollover", () => {
    it("handles crossing into the next year", () => {
      const h = getUpcomingHorizon(new Date("2026-12-30T12:00:00Z")); // 14:00 מקומי, חורף
      expect(h.todayYmd).toBe("2026-12-30");
      expect(stamp(h.start)).toBe("2026-12-30 00:00:00");
      // today+7 = 2027-01-06 ; end = תחילת 2027-01-07
      expect(stamp(h.end)).toBe("2027-01-07 00:00:00");
    });
  });
});
