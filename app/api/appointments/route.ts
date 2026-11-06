/**
 * API לתורים — יצירה וקריאה לפי טווח תאריכים (משימה 5.1, §12.1 Appointment, בסיס ל-FR-AP-04).
 *
 * GET  /api/appointments?start=YYYY-MM-DD&end=YYYY-MM-DD  — תורים בטווח תאריכים
 * POST /api/appointments                                   — יצירת תור חדש
 *
 * הערה (פרטיות — §11): אין להדפיס ללוג פרטי PII של לקוח (שם/טלפון).
 */

import { NextResponse } from "next/server";
import {
  getAppointmentsByDateRange,
  createAppointment,
  checkAppointmentConflict,
} from "@/lib/db/appointments";
import { getClinicSettings } from "@/lib/db/clinicSettings";

/**
 * GET /api/appointments?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * שני הפרמטרים חובה. start מתפרש כתחילת היום (00:00:00), end כסוף היום (T23:59:59.999Z)
 * כך שהיומן מקבל את כל התורים לכל תאריכי הטווח (כולל).
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const startStr = params.get("start");
  const endStr = params.get("end");

  if (!startStr || !endStr) {
    return NextResponse.json(
      { error: "פרמטרים start ו-end הם חובה (פורמט YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  const start = new Date(startStr + "T00:00:00.000Z");
  const end = new Date(endStr + "T23:59:59.999Z");

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json(
      { error: "פורמט תאריך לא תקין — נדרש YYYY-MM-DD" },
      { status: 400 }
    );
  }

  if (start > end) {
    return NextResponse.json(
      { error: "start חייב להיות לפני end" },
      { status: 400 }
    );
  }

  try {
    const appointments = await getAppointmentsByDateRange(start, end);
    return NextResponse.json({ appointments });
  } catch (err) {
    console.error("[GET /api/appointments]", err);
    return NextResponse.json(
      { error: "שגיאה בשליפת תורים — נסה שוב" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/appointments — יצירת תור חדש.
 *
 * שדות חובה: clientId, therapist, startTime, endTime.
 * שדות אופציונליים: treatmentId, room, notes.
 */
export async function POST(request: Request) {
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

  // ולידציה: שדות חובה
  const clientId =
    typeof data.clientId === "string" ? data.clientId.trim() : "";
  if (!clientId) {
    return NextResponse.json(
      { error: "clientId הוא שדה חובה" },
      { status: 400 }
    );
  }

  const therapist =
    typeof data.therapist === "string" ? data.therapist.trim() : "";
  if (!therapist) {
    return NextResponse.json(
      { error: "therapist הוא שדה חובה" },
      { status: 400 }
    );
  }

  if (!data.startTime || typeof data.startTime !== "string") {
    return NextResponse.json(
      { error: "startTime הוא שדה חובה (ISO string)" },
      { status: 400 }
    );
  }
  const startTime = new Date(data.startTime);
  if (isNaN(startTime.getTime())) {
    return NextResponse.json(
      { error: "startTime אינו תאריך תקין" },
      { status: 400 }
    );
  }

  if (!data.endTime || typeof data.endTime !== "string") {
    return NextResponse.json(
      { error: "endTime הוא שדה חובה (ISO string)" },
      { status: 400 }
    );
  }
  const endTime = new Date(data.endTime);
  if (isNaN(endTime.getTime())) {
    return NextResponse.json(
      { error: "endTime אינו תאריך תקין" },
      { status: 400 }
    );
  }

  // שדות אופציונליים
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;

  const treatmentId = str(data.treatmentId);
  const room = str(data.room);
  const notes = str(data.notes);

  // ולידציה מוקדמת: startTime < endTime (לפני בדיקת חפיפה)
  if (startTime >= endTime) {
    return NextResponse.json(
      { error: "שעת ההתחלה חייבת להיות לפני שעת הסיום" },
      { status: 400 }
    );
  }

  // ולידציה מול שעות פעילות המרפאה (FR-AP-05, משימה 5.7)
  const clinicSettings = await getClinicSettings();
  const openMins = clinicSettings.openHour * 60;
  const closeMins = clinicSettings.closeHour * 60;
  const startMins = startTime.getHours() * 60 + startTime.getMinutes();
  const endMins = endTime.getHours() * 60 + endTime.getMinutes();

  if (startMins < openMins || endMins > closeMins) {
    return NextResponse.json(
      { error: "מחוץ לשעות פעילות" },
      { status: 409 }
    );
  }

  try {
    // בדיקת חפיפה לפני יצירת התור (FR-AP-03)
    const conflict = await checkAppointmentConflict({
      therapist,
      room,
      startTime,
      endTime,
    });
    if (conflict.hasConflict) {
      const msg =
        conflict.conflictType === "therapist"
          ? `המטפל/ת "${therapist}" כבר קבוע/ה לתור בשעות ${conflict.conflictWith ?? ""}`
          : `החדר "${room}" כבר תפוס בשעות ${conflict.conflictWith ?? ""}`;
      return NextResponse.json({ error: msg }, { status: 409 });
    }

    const appointment = await createAppointment({
      clientId,
      treatmentId,
      therapist,
      room,
      startTime,
      endTime,
      notes,
    });
    return NextResponse.json({ appointment }, { status: 201 });
  } catch (err) {
    if (err instanceof Error) {
      // ולידציה עסקית (startTime >= endTime)
      if (err.message.includes("שעת ההתחלה")) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      // לקוח/טיפול לא נמצא — Prisma P2003 (foreign key)
      if (err.message.includes("Foreign key constraint")) {
        return NextResponse.json(
          { error: "לקוח או טיפול לא נמצאו" },
          { status: 404 }
        );
      }
    }
    console.error("[POST /api/appointments]", err);
    return NextResponse.json(
      { error: "שגיאה ביצירת התור — נסה שוב" },
      { status: 500 }
    );
  }
}
