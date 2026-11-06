/**
 * מסך יומן תורים שבועי — משימה 5.3, FR-AP-01.
 *
 * Server Component: שולף תורים לשבוע הנוכחי מה-DB ומעביר ל-WeeklyCalendar.
 * הרשאות: מוגן ב-middleware.ts (דרשה כניסה).
 * PII: הנתונים מועברים לרכיב Client בלבד; אין לוגים עם שמות/טלפונים (§11).
 */

import { connection } from "next/server";
import { getAppointmentsByDateRange } from "@/lib/db/appointments";
import { getClinicSettings } from "@/lib/db/clinicSettings";
import { prisma } from "@/lib/db/prisma";
import {
  WeeklyCalendar,
  type SerializedAppointment,
  type TreatmentOption,
} from "@/components/calendar/WeeklyCalendar";

/** מחזיר את תחילת השבוע (ראשון=0) עבור תאריך נתון */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function CalendarPage() {
  // מאלץ הרצה ב-request time (לא prerender סטטי)
  await connection();

  const today = new Date();
  const weekStart = getWeekStart(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const [rawAppointments, clinicSettings, rawTreatments] = await Promise.all([
    getAppointmentsByDateRange(weekStart, weekEnd),
    getClinicSettings(),
    // שליפת רשימת טיפולים לדיאלוג יצירת תור חדש (משימה 5.9, FR-AP-02)
    prisma.treatment.findMany({
      select: { id: true, name: true, durationMinutes: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const treatments: TreatmentOption[] = rawTreatments.map((t) => ({
    id: t.id,
    name: t.name,
    durationMinutes: t.durationMinutes,
    color: t.color ?? null,
  }));

  // סריאליזציה: המרת Date → ISO string להעברה ל-Client Component
  const appointments: SerializedAppointment[] = rawAppointments.map((apt) => ({
    id: apt.id,
    clientId: apt.clientId,
    client: apt.client,
    treatmentId: apt.treatmentId,
    treatment: apt.treatment
      ? {
          id: apt.treatment.id,
          name: apt.treatment.name,
          durationMinutes: apt.treatment.durationMinutes,
          color: apt.treatment.color,
        }
      : null,
    therapist: apt.therapist,
    room: apt.room,
    startTime: apt.startTime.toISOString(),
    endTime: apt.endTime.toISOString(),
    status: apt.status,
    notes: apt.notes,
    // היסטוריית שינויי סטטוס — מסורייל ל-ISO string (משימה 5.8, FR-AP-04)
    statusHistory: (apt.statusHistory ?? []).map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      changedAt: h.changedAt.toISOString(),
      changedBy: h.changedBy,
    })),
    createdAt: apt.createdAt.toISOString(),
    updatedAt: apt.updatedAt.toISOString(),
  }));

  return (
    <main
      dir="rtl"
      className="flex flex-col min-h-screen bg-champagne"
      lang="he"
    >
      <WeeklyCalendar
        initialAppointments={appointments}
        initialWeekStart={weekStart.toISOString()}
        openHour={clinicSettings.openHour}
        closeHour={clinicSettings.closeHour}
        treatments={treatments}
      />
    </main>
  );
}
