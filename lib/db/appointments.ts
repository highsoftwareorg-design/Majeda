/**
 * שאילתות בסיס נתונים לתורים (Appointment) — משימה 5.1, §12.1 Appointment, בסיס ל-FR-AP-04.
 */

import { AppointmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/** קישורים שנכללים בכל שאילתת תור — לקוח, טיפול, והיסטוריית סטטוס */
const appointmentInclude = {
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
      requiresConsentForm: true,
      authorizedTherapists: true,
    },
  },
  // היסטוריית שינויי סטטוס — 5 האחרונים, מהחדש לישן (משימה 5.8, FR-AP-04)
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

/**
 * מחזיר תורים בטווח תאריכים נתון (startTime >= start AND startTime < end).
 * ממוין עולה לפי startTime.
 *
 * @param start — תחילת הטווח (כולל)
 * @param end   — סיום הטווח (לא כולל)
 */
export async function getAppointmentsByDateRange(start: Date, end: Date) {
  return prisma.appointment.findMany({
    where: {
      startTime: {
        gte: start,
        lt: end,
      },
    },
    orderBy: { startTime: "asc" },
    include: appointmentInclude,
  });
}

/** טיפוס תור כולל קשרים — נוחות לקומפוננטות TypeScript */
export type AppointmentWithRelations = Awaited<
  ReturnType<typeof getAppointmentsByDateRange>
>[number];

export interface CreateAppointmentData {
  clientId: string;
  treatmentId?: string | null;
  therapist: string;
  room?: string | null;
  startTime: Date;
  endTime: Date;
  notes?: string | null;
}

/**
 * יוצר תור חדש.
 * מאמת ש-startTime < endTime לפני השמירה.
 *
 * @throws Error אם startTime >= endTime
 */
export async function createAppointment(data: CreateAppointmentData) {
  if (data.startTime >= data.endTime) {
    throw new Error("שעת ההתחלה חייבת להיות לפני שעת הסיום");
  }

  return prisma.appointment.create({
    data: {
      clientId: data.clientId,
      treatmentId: data.treatmentId ?? null,
      therapist: data.therapist,
      room: data.room ?? null,
      startTime: data.startTime,
      endTime: data.endTime,
      notes: data.notes ?? null,
    },
    include: appointmentInclude,
  });
}

/**
 * מעדכן את סטטוס התור.
 *
 * @param id     — מזהה התור
 * @param status — הסטטוס החדש
 * @returns      — התור המעודכן עם קשרים, או null אם לא נמצא
 */
export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus
) {
  try {
    return await prisma.appointment.update({
      where: { id },
      data: { status },
      include: appointmentInclude,
    });
  } catch {
    // P2025 — רשומה לא נמצאה
    return null;
  }
}

/**
 * מחזיר תור יחיד לפי מזהה, כולל קשרים.
 * מחזיר null אם לא נמצא.
 *
 * @param id — מזהה התור
 */
export async function getAppointmentById(id: string) {
  return prisma.appointment.findUnique({
    where: { id },
    include: appointmentInclude,
  });
}

/** תוצאת בדיקת חפיפה */
export interface ConflictCheckResult {
  hasConflict: boolean;
  /** סוג ההתנגשות — "therapist" (מטפל/ת תפוס/ה) או "room" (חדר תפוס) */
  conflictType: "therapist" | "room" | null;
  /** תיאור התור המתנגש (לצורך הודעת שגיאה) */
  conflictWith?: string;
}

/**
 * יוצר רשומת היסטוריית שינוי סטטוס תור (משימה 5.8, FR-AP-04).
 * אמור להיקרא בתוך טרנזקציה (ראו שימוש ב-PATCH /api/appointments/[id]).
 *
 * @param appointmentId — מזהה התור
 * @param fromStatus    — הסטטוס הקודם
 * @param toStatus      — הסטטוס החדש
 * @param changedBy     — שם המשתמש שביצע את השינוי (ברירת מחדל: "system")
 */
export async function createStatusHistoryRecord(
  appointmentId: string,
  fromStatus: AppointmentStatus,
  toStatus: AppointmentStatus,
  changedBy = "system"
) {
  return prisma.appointmentStatusHistory.create({
    data: { appointmentId, fromStatus, toStatus, changedBy },
  });
}

/**
 * בודק חפיפה בין תור חדש/מעודכן לתורים קיימים.
 *
 * בדיקת חפיפה: (existingStart < newEnd) AND (existingEnd > newStart)
 * תורים מבוטלים (CANCELLED) ואי-הגעה (NO_SHOW) אינם נחשבים לחפיפה.
 *
 * @param params.therapist  — שם המטפל/ת
 * @param params.room       — חדר (אופציונלי)
 * @param params.startTime  — שעת התחלה של התור החדש/המעודכן
 * @param params.endTime    — שעת סיום של התור החדש/המעודכן
 * @param params.excludeId  — מזהה תור להחריג מהבדיקה (בעדכון, כדי לא להתנגש עם עצמו)
 */
export async function checkAppointmentConflict(params: {
  therapist: string;
  room?: string | null;
  startTime: Date;
  endTime: Date;
  excludeId?: string;
}): Promise<ConflictCheckResult> {
  const { therapist, room, startTime, endTime, excludeId } = params;

  // תנאי OR: מטפל/ת זהים, או חדר זהה (אם חדר סופק)
  const orConditions: Prisma.AppointmentWhereInput[] = [{ therapist }];
  if (room) {
    orConditions.push({ room });
  }

  const conflicts = await prisma.appointment.findMany({
    where: {
      // החרגת התור עצמו בעת עדכון
      ...(excludeId ? { id: { not: excludeId } } : {}),
      // רק תורים פעילים (לא מבוטל / לא אי-הגעה)
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      // חפיפת טווח זמן: existingStart < newEnd AND existingEnd > newStart
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      // מטפל/ת זהים או חדר זהה
      OR: orConditions,
    },
    select: {
      id: true,
      therapist: true,
      room: true,
      startTime: true,
      endTime: true,
    },
    take: 1,
  });

  if (conflicts.length === 0) {
    return { hasConflict: false, conflictType: null };
  }

  const conflict = conflicts[0];

  // קביעת סוג ההתנגשות — מטפל/ת גוברת על חדר (בדיקת סדר עדיפויות)
  const conflictType =
    conflict.therapist === therapist ? "therapist" : "room";

  const startStr = conflict.startTime.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const endStr = conflict.endTime.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return {
    hasConflict: true,
    conflictType,
    conflictWith: `${startStr}–${endStr}`,
  };
}
