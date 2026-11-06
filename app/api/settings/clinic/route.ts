/**
 * API הגדרות מרפאה — שעות פעילות (משימה 5.7, FR-AP-05).
 *
 * GET /api/settings/clinic  — מחזיר הגדרות נוכחיות (או ברירות מחדל)
 * PUT /api/settings/clinic  — שומר הגדרות (upsert)
 */

import { NextResponse } from "next/server";
import { getClinicSettings, upsertClinicSettings } from "@/lib/db/clinicSettings";

/** GET /api/settings/clinic */
export async function GET() {
  try {
    const settings = await getClinicSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    console.error("[GET /api/settings/clinic]", err);
    return NextResponse.json(
      { error: "שגיאה בשליפת הגדרות המרפאה" },
      { status: 500 }
    );
  }
}

/** PUT /api/settings/clinic */
export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "גוף הבקשה אינו JSON תקין" },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "נתונים חסרים" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;

  // ולידציה: openHour ו-closeHour — שעות שלמות בין 0-23
  const openHour = typeof data.openHour === "number" ? Math.round(data.openHour) : NaN;
  const closeHour = typeof data.closeHour === "number" ? Math.round(data.closeHour) : NaN;

  if (isNaN(openHour) || openHour < 0 || openHour > 23) {
    return NextResponse.json(
      { error: "שעת פתיחה לא חוקית (0–23)" },
      { status: 400 }
    );
  }
  if (isNaN(closeHour) || closeHour < 0 || closeHour > 23) {
    return NextResponse.json(
      { error: "שעת סגירה לא חוקית (0–23)" },
      { status: 400 }
    );
  }
  if (openHour >= closeHour) {
    return NextResponse.json(
      { error: "שעת הפתיחה חייבת להיות לפני שעת הסגירה" },
      { status: 400 }
    );
  }

  // הפסקה — אופציונלית
  const int = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    const n = typeof v === "number" ? Math.round(v) : NaN;
    return isNaN(n) ? null : n;
  };

  const breakStartHour = int(data.breakStartHour);
  const breakStartMin = int(data.breakStartMin) ?? 0;
  const breakEndHour = int(data.breakEndHour);
  const breakEndMin = int(data.breakEndMin) ?? 0;

  // ולידציה בסיסית של ההפסקה (רק כשמוגדרת)
  if (breakStartHour !== null || breakEndHour !== null) {
    if (breakStartHour === null || breakEndHour === null) {
      return NextResponse.json(
        { error: "הפסקה: יש להגדיר גם שעת התחלה וגם שעת סיום" },
        { status: 400 }
      );
    }
    const breakStartTotal = breakStartHour * 60 + breakStartMin;
    const breakEndTotal = breakEndHour * 60 + breakEndMin;
    if (breakStartTotal >= breakEndTotal) {
      return NextResponse.json(
        { error: "שעת תחילת הפסקה חייבת להיות לפני שעת סיומה" },
        { status: 400 }
      );
    }
    if (breakStartHour < openHour || breakEndHour > closeHour) {
      return NextResponse.json(
        { error: "הפסקה חייבת להיות בתוך שעות הפעילות" },
        { status: 400 }
      );
    }
  }

  try {
    const settings = await upsertClinicSettings({
      openHour,
      closeHour,
      breakStartHour,
      breakStartMin,
      breakEndHour,
      breakEndMin,
    });
    return NextResponse.json({ settings });
  } catch (err) {
    console.error("[PUT /api/settings/clinic]", err);
    return NextResponse.json(
      { error: "שגיאה בשמירת הגדרות המרפאה — נסה שוב" },
      { status: 500 }
    );
  }
}
