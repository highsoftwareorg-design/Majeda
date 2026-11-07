/**
 * GET /api/appointments/export — ייצוא סיכום תורים לתקופה ל-CSV (משימה 10.2).
 *
 * פרמטרים: start=YYYY-MM-DD&end=YYYY-MM-DD (שניהם כוללים, לפי יום בשעון ישראל),
 *          therapist= (התאמה חלקית, לא רגישה לרישיות), status= (AppointmentStatus).
 *
 * שדות: תאריך (DD/MM/YYYY), שעה (HH:mm), שם לקוח/ה, טלפון, טיפול, מטפל/ת, חדר,
 * סטטוס, מחיר (מהטיפול).
 *
 * הרשאה: אדמין בלבד (session.user.role === "admin"). לא מחובר → 401, לא אדמין → 403.
 * הקובץ לא נשמר בשרת — מוחזר ישירות בתגובה (§11, PII).
 */

import { NextResponse } from "next/server";
import { AppointmentStatus, type Prisma } from "@prisma/client";
import { fromZonedTime } from "date-fns-tz";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import {
  ISRAEL_TZ,
  buildCsv,
  csvResponse,
  formatIsraelDate,
  formatIsraelTime,
} from "@/lib/exports/csv";

const EXPORT_HEADERS = [
  "תאריך",
  "שעה",
  "שם לקוח/ה",
  "טלפון",
  "טיפול",
  "מטפל/ת",
  "חדר",
  "סטטוס",
  "מחיר",
];

/** סטטוסי תור בעברית (זהה ל-WeeklyCalendar). */
const STATUS_HE: Record<AppointmentStatus, string> = {
  SCHEDULED: "נקבע",
  CONFIRMED: "אושר",
  ARRIVED: "הגיע/ה",
  COMPLETED: "בוצע",
  CANCELLED: "בוטל",
  NO_SHOW: "לא הגיע/ה",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * ממיר YYYY-MM-DD לתחילת היום בשעון ישראל (כ-Date ב-UTC).
 * מחשב את היום הבא דרך Date.UTC כדי להימנע מבעיות מעבר שעון קיץ/חורף.
 */
function israelDayStart(ymd: string): Date {
  return fromZonedTime(`${ymd}T00:00:00`, ISRAEL_TZ);
}

function nextDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * GET /api/appointments/export
 */
export async function GET(request: Request) {
  // ─── הרשאות: אדמין בלבד ─────────────────────────────────────────────────
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  }
  if (session.user?.role !== "admin") {
    return NextResponse.json({ error: "אין הרשאה לייצוא" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;

  // ─── פענוח וולידציה ─────────────────────────────────────────────────────
  const start = params.get("start") ?? "";
  const end = params.get("end") ?? "";
  if (!DATE_RE.test(start) || !DATE_RE.test(end) || isNaN(israelDayStart(start).getTime())) {
    return NextResponse.json(
      { error: "יש לציין תאריך התחלה וסיום בפורמט YYYY-MM-DD" },
      { status: 400 }
    );
  }
  if (end < start) {
    return NextResponse.json(
      { error: "תאריך הסיום חייב להיות אחרי תאריך ההתחלה" },
      { status: 400 }
    );
  }

  const therapist = params.get("therapist")?.trim() ?? "";
  const statusParam = params.get("status")?.trim() ?? "";
  const VALID_STATUSES = Object.values(AppointmentStatus) as string[];
  if (statusParam && !VALID_STATUSES.includes(statusParam)) {
    return NextResponse.json({ error: "סטטוס תור לא חוקי" }, { status: 400 });
  }

  // ─── שאילתה ─────────────────────────────────────────────────────────────
  const where: Prisma.AppointmentWhereInput = {
    // טווח כולל לפי ימים בשעון ישראל: [תחילת start, תחילת היום שאחרי end)
    startTime: {
      gte: israelDayStart(start),
      lt: israelDayStart(nextDay(end)),
    },
    ...(therapist
      ? { therapist: { contains: therapist, mode: "insensitive" } }
      : {}),
    ...(statusParam ? { status: statusParam as AppointmentStatus } : {}),
  };

  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: { startTime: "asc" },
    select: {
      startTime: true,
      therapist: true,
      room: true,
      status: true,
      client: { select: { firstName: true, lastName: true, phone: true } },
      treatment: { select: { name: true, price: true } },
    },
  });

  // ─── CSV ────────────────────────────────────────────────────────────────
  const rows = appointments.map((apt) => [
    formatIsraelDate(apt.startTime),
    formatIsraelTime(apt.startTime),
    `${apt.client.firstName} ${apt.client.lastName}`.trim(),
    apt.client.phone,
    apt.treatment?.name ?? "",
    apt.therapist,
    apt.room ?? "",
    STATUS_HE[apt.status],
    apt.treatment ? String(apt.treatment.price) : "",
  ]);

  return csvResponse(
    buildCsv(EXPORT_HEADERS, rows),
    `appointments-${start}-${end}.csv`
  );
}
