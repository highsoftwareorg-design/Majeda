/**
 * API לתור יחיד לפי מזהה (משימה 5.1, §12.1 Appointment, בסיס ל-FR-AP-04).
 *
 * PATCH /api/appointments/[id] — עדכון שדות: status, therapist, room, startTime, endTime, notes
 *
 * הערה (פרטיות — §11): אין להדפיס ללוג פרטי PII של לקוח (שם/טלפון).
 */

import { NextResponse } from "next/server";
import { AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getAppointmentById, checkAppointmentConflict } from "@/lib/db/appointments";

type RouteParams = { params: Promise<{ id: string }> };

const VALID_STATUSES: AppointmentStatus[] = [
  "SCHEDULED",
  "CONFIRMED",
  "ARRIVED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

/**
 * PATCH /api/appointments/[id]
 *
 * כל השדות אופציונליים — מעדכן רק את מה שסופק.
 * שדות: status, therapist, room, startTime, endTime, notes.
 *
 * אם גם startTime וגם endTime מסופקים, מאמת startTime < endTime.
 * אם רק אחד מהם מסופק, מאמת מול הערך הקיים במסד הנתונים.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;

  // ודא שהתור קיים
  const existing = await getAppointmentById(id);
  if (!existing) {
    return NextResponse.json({ error: "תור לא נמצא" }, { status: 404 });
  }

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

  // פונקציית עזר: מחרוזת ריקה → null
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;

  // בניית אובייקט העדכון — רק שדות שסופקו
  const updateData: Record<string, unknown> = {};

  // סטטוס
  if ("status" in data) {
    const s = data.status;
    if (typeof s !== "string" || !VALID_STATUSES.includes(s as AppointmentStatus)) {
      return NextResponse.json(
        {
          error: `סטטוס לא חוקי. ערכים מותרים: ${VALID_STATUSES.join(", ")}`,
        },
        { status: 400 }
      );
    }
    updateData.status = s as AppointmentStatus;
  }

  // therapist
  if ("therapist" in data) {
    const t = str(data.therapist);
    if (!t) {
      return NextResponse.json(
        { error: "therapist אינו יכול להיות ריק" },
        { status: 400 }
      );
    }
    updateData.therapist = t;
  }

  // room (nullable)
  if ("room" in data) {
    updateData.room = str(data.room);
  }

  // notes (nullable)
  if ("notes" in data) {
    updateData.notes = str(data.notes);
  }

  // startTime
  let newStart: Date = existing.startTime;
  if ("startTime" in data) {
    if (typeof data.startTime !== "string") {
      return NextResponse.json(
        { error: "startTime חייב להיות ISO string" },
        { status: 400 }
      );
    }
    newStart = new Date(data.startTime);
    if (isNaN(newStart.getTime())) {
      return NextResponse.json(
        { error: "startTime אינו תאריך תקין" },
        { status: 400 }
      );
    }
    updateData.startTime = newStart;
  }

  // endTime
  let newEnd: Date = existing.endTime;
  if ("endTime" in data) {
    if (typeof data.endTime !== "string") {
      return NextResponse.json(
        { error: "endTime חייב להיות ISO string" },
        { status: 400 }
      );
    }
    newEnd = new Date(data.endTime);
    if (isNaN(newEnd.getTime())) {
      return NextResponse.json(
        { error: "endTime אינו תאריך תקין" },
        { status: 400 }
      );
    }
    updateData.endTime = newEnd;
  }

  // ולידציה: startTime < endTime (בודק גם אם שונה רק אחד מהם)
  if (("startTime" in data || "endTime" in data) && newStart >= newEnd) {
    return NextResponse.json(
      { error: "שעת ההתחלה חייבת להיות לפני שעת הסיום" },
      { status: 400 }
    );
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "לא סופקו שדות לעדכון" },
      { status: 400 }
    );
  }

  // בדיקת חפיפה כאשר זמן, מטפל/ת או חדר השתנו (FR-AP-03)
  const conflictRelevantFields = ["startTime", "endTime", "therapist", "room"];
  const needsConflictCheck = conflictRelevantFields.some((f) => f in data);
  if (needsConflictCheck) {
    const effectiveTherapist =
      typeof updateData.therapist === "string"
        ? updateData.therapist
        : existing.therapist;
    const effectiveRoom =
      "room" in updateData
        ? (updateData.room as string | null)
        : existing.room;

    const conflict = await checkAppointmentConflict({
      therapist: effectiveTherapist,
      room: effectiveRoom,
      startTime: newStart,
      endTime: newEnd,
      excludeId: id,
    });

    if (conflict.hasConflict) {
      const msg =
        conflict.conflictType === "therapist"
          ? `המטפל/ת "${effectiveTherapist}" כבר קבוע/ה לתור בשעות ${conflict.conflictWith ?? ""}`
          : `החדר "${effectiveRoom}" כבר תפוס בשעות ${conflict.conflictWith ?? ""}`;
      return NextResponse.json({ error: msg }, { status: 409 });
    }
  }

  // קביעה האם הסטטוס משתנה — לצורך יצירת רשומת היסטוריה (משימה 5.8, FR-AP-04)
  const statusChanging =
    "status" in updateData && updateData.status !== existing.status;
  const previousStatus = existing.status;

  /** include משותף לכל שאילתות PATCH */
  const patchInclude = {
    client: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    },
    treatment: {
      select: {
        id: true,
        name: true,
        durationMinutes: true,
        color: true, // נדרש להצגת צבע הטיפול ביומן (משימה 5.3, FR-AP-01)
      },
    },
    statusHistory: {
      orderBy: { changedAt: "desc" as const },
      take: 5,
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        changedAt: true,
        changedBy: true,
      },
    },
  } as const;

  try {
    // עדכון התור תמיד (סטטוס ו/או שדות אחרים)
    const appointment = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: patchInclude,
    });

    // אם הסטטוס השתנה — יצירת רשומת היסטוריה (FR-AP-04)
    // נעשית אחרי העדכון; כשל ב-create מוחזר כשגיאה 500 אך התור כבר עודכן.
    // בשלב 1 זה מקובל — atomicity מלאה תתוגבר עם queue/job בעתיד.
    if (statusChanging) {
      await prisma.appointmentStatusHistory.create({
        data: {
          appointmentId: id,
          fromStatus: previousStatus,
          toStatus: updateData.status as AppointmentStatus,
          changedBy: "system",
        },
      });
      // הוסף את הרשומה החדשה לתחילת רשימת ההיסטוריה בתגובה (ללא fetch נוסף)
      (appointment.statusHistory as Array<{
        id: string;
        fromStatus: AppointmentStatus;
        toStatus: AppointmentStatus;
        changedAt: Date;
        changedBy: string;
      }>).unshift({
        id: `hist-${Date.now()}`,
        fromStatus: previousStatus,
        toStatus: updateData.status as AppointmentStatus,
        changedAt: new Date(),
        changedBy: "system",
      });
      // הגבל ל-5 רשומות אחרונות
      if (appointment.statusHistory.length > 5) {
        appointment.statusHistory.splice(5);
      }
    }

    return NextResponse.json({ appointment });
  } catch (err) {
    console.error("[PATCH /api/appointments/:id]", err);
    return NextResponse.json(
      { error: "שגיאה בעדכון התור — נסה שוב" },
      { status: 500 }
    );
  }
}
