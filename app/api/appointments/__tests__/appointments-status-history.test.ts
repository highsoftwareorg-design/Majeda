/**
 * בדיקות ל-PATCH /api/appointments/[id] — יצירת רשומת היסטוריית סטטוס (משימה 5.8, FR-AP-04).
 *
 * בודק:
 * 1. שינוי סטטוס תקין — prisma.appointmentStatusHistory.create נקרא עם fromStatus/toStatus נכונים.
 * 2. עדכון שדה שאינו סטטוס (כגון notes) — prisma.appointmentStatusHistory.create לא נקרא.
 * 3. שינוי לאותו סטטוס — prisma.appointmentStatusHistory.create לא נקרא (אין שינוי).
 *
 * הרצה: `npx vitest run --reporter=verbose app/api/appointments/__tests__/appointments-status-history.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (חייבים לפני ה-imports של המודולים הממוקים)
// ---------------------------------------------------------------------------

const {
  mockGetAppointmentById,
  mockPrismaAppointmentUpdate,
  mockCheckAppointmentConflict,
  mockPrismaStatusHistoryCreate,
} = vi.hoisted(() => ({
  mockGetAppointmentById: vi.fn(),
  mockPrismaAppointmentUpdate: vi.fn(),
  mockCheckAppointmentConflict: vi.fn(),
  mockPrismaStatusHistoryCreate: vi.fn().mockResolvedValue({ id: "hist-new" }),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

vi.mock("@/lib/db/appointments", () => ({
  getAppointmentsByDateRange: vi.fn(),
  createAppointment: vi.fn(),
  getAppointmentById: mockGetAppointmentById,
  checkAppointmentConflict: mockCheckAppointmentConflict,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    appointment: {
      update: mockPrismaAppointmentUpdate,
    },
    appointmentStatusHistory: {
      create: mockPrismaStatusHistoryCreate,
    },
  },
}));

vi.mock("@/lib/db/clinicSettings", () => ({
  getClinicSettings: vi.fn().mockResolvedValue({
    openHour: 8,
    closeHour: 21,
    breakStartHour: null,
    breakStartMin: null,
    breakEndHour: null,
    breakEndMin: null,
  }),
}));

// ---------------------------------------------------------------------------
// Import handlers after mocks
// ---------------------------------------------------------------------------

import { PATCH } from "@/app/api/appointments/[id]/route";

// ---------------------------------------------------------------------------
// נתוני עזר
// ---------------------------------------------------------------------------

function makePatchRequest(
  id: string,
  body: unknown
): [Request, { params: Promise<{ id: string }> }] {
  const req = new Request(`http://localhost/api/appointments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return [req, { params: Promise.resolve({ id }) }];
}

/** תור דמה עם סטטוס SCHEDULED */
const MOCK_APPOINTMENT_SCHEDULED = {
  id: "appt-status-1",
  clientId: "client-1",
  treatmentId: "treatment-1",
  therapist: "מג'ידה",
  room: null,
  startTime: new Date("2026-11-10T10:00:00.000Z"),
  endTime: new Date("2026-11-10T11:00:00.000Z"),
  status: "SCHEDULED",
  notes: null,
  createdAt: new Date("2026-11-01T00:00:00.000Z"),
  updatedAt: new Date("2026-11-01T00:00:00.000Z"),
  client: { id: "client-1", firstName: "דנה", lastName: "כהן", phone: "0501234567" },
  treatment: {
    id: "treatment-1",
    name: "טיפול פנים",
    durationMinutes: 60,
    color: "#D2AB2E",
  },
  statusHistory: [] as Array<{
    id: string;
    fromStatus: string;
    toStatus: string;
    changedAt: Date;
    changedBy: string;
  }>,
};

// ---------------------------------------------------------------------------
// בדיקות
// ---------------------------------------------------------------------------

describe("PATCH /api/appointments/[id] — יצירת היסטוריית סטטוס (משימה 5.8, FR-AP-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // ברירת מחדל: תור קיים עם סטטוס SCHEDULED
    mockGetAppointmentById.mockResolvedValue({ ...MOCK_APPOINTMENT_SCHEDULED });
    mockCheckAppointmentConflict.mockResolvedValue({
      hasConflict: false,
      conflictType: null,
    });
  });

  // =========================================================================
  // 1. שינוי סטטוס — prisma.appointmentStatusHistory.create נקרא עם ערכים נכונים
  // =========================================================================

  it("שינוי סטטוס SCHEDULED → CONFIRMED: prisma.appointmentStatusHistory.create נקרא עם fromStatus=SCHEDULED, toStatus=CONFIRMED", async () => {
    // מחזיר תור מעודכן עם הסטטוס החדש
    mockPrismaAppointmentUpdate.mockResolvedValue({
      ...MOCK_APPOINTMENT_SCHEDULED,
      status: "CONFIRMED",
      statusHistory: [],
    });

    const [req, routeCtx] = makePatchRequest("appt-status-1", {
      status: "CONFIRMED",
    });
    const res = await PATCH(req, routeCtx);

    // תגובה תקינה
    expect(res.status).toBe(200);

    // prisma.appointmentStatusHistory.create נקרא פעם אחת
    expect(mockPrismaStatusHistoryCreate).toHaveBeenCalledOnce();

    // נבדק שה-data מכיל fromStatus ו-toStatus נכונים
    const createCall = mockPrismaStatusHistoryCreate.mock.calls[0][0];
    expect(createCall.data.fromStatus).toBe("SCHEDULED");
    expect(createCall.data.toStatus).toBe("CONFIRMED");
    expect(createCall.data.appointmentId).toBe("appt-status-1");
  });

  it("שינוי סטטוס SCHEDULED → CANCELLED: prisma.appointmentStatusHistory.create נקרא עם fromStatus=SCHEDULED, toStatus=CANCELLED", async () => {
    mockPrismaAppointmentUpdate.mockResolvedValue({
      ...MOCK_APPOINTMENT_SCHEDULED,
      status: "CANCELLED",
      statusHistory: [],
    });

    const [req, routeCtx] = makePatchRequest("appt-status-1", {
      status: "CANCELLED",
    });
    await PATCH(req, routeCtx);

    expect(mockPrismaStatusHistoryCreate).toHaveBeenCalledOnce();
    const createCall = mockPrismaStatusHistoryCreate.mock.calls[0][0];
    expect(createCall.data.fromStatus).toBe("SCHEDULED");
    expect(createCall.data.toStatus).toBe("CANCELLED");
  });

  // =========================================================================
  // 2. עדכון שדה שאינו סטטוס — prisma.appointmentStatusHistory.create לא נקרא
  // =========================================================================

  it("עדכון notes בלבד (ללא שינוי סטטוס): prisma.appointmentStatusHistory.create לא נקרא", async () => {
    mockPrismaAppointmentUpdate.mockResolvedValue({
      ...MOCK_APPOINTMENT_SCHEDULED,
      notes: "הערה חדשה",
      statusHistory: [],
    });

    const [req, routeCtx] = makePatchRequest("appt-status-1", {
      notes: "הערה חדשה",
    });
    const res = await PATCH(req, routeCtx);

    expect(res.status).toBe(200);
    // לא צריך ליצור רשומת היסטוריה כאשר הסטטוס לא השתנה
    expect(mockPrismaStatusHistoryCreate).not.toHaveBeenCalled();
  });

  // =========================================================================
  // 3. שינוי לאותו סטטוס — לא נוצרת רשומת היסטוריה
  // =========================================================================

  it("שליחת אותו סטטוס (SCHEDULED → SCHEDULED): prisma.appointmentStatusHistory.create לא נקרא", async () => {
    mockPrismaAppointmentUpdate.mockResolvedValue({
      ...MOCK_APPOINTMENT_SCHEDULED,
      status: "SCHEDULED",
      statusHistory: [],
    });

    const [req, routeCtx] = makePatchRequest("appt-status-1", {
      status: "SCHEDULED", // אותו סטטוס — אין שינוי
    });
    const res = await PATCH(req, routeCtx);

    expect(res.status).toBe(200);
    // statusChanging = false כי previousStatus === updateData.status
    expect(mockPrismaStatusHistoryCreate).not.toHaveBeenCalled();
  });

  // =========================================================================
  // 4. תגובת ה-API כוללת statusHistory מעודכנת לאחר שינוי סטטוס
  // =========================================================================

  it("תגובת PATCH כוללת appointment עם statusHistory שכולל את הרשומה החדשה (fromStatus/toStatus)", async () => {
    mockPrismaAppointmentUpdate.mockResolvedValue({
      ...MOCK_APPOINTMENT_SCHEDULED,
      status: "CONFIRMED",
      statusHistory: [], // ריק — ה-route מוסיף את הרשומה החדשה ב-unshift
    });

    const [req, routeCtx] = makePatchRequest("appt-status-1", {
      status: "CONFIRMED",
    });
    const res = await PATCH(req, routeCtx);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.appointment).toBeDefined();

    // הרשומה החדשה נוספה ב-unshift לתחילת statusHistory
    expect(body.appointment.statusHistory).toBeDefined();
    expect(body.appointment.statusHistory.length).toBeGreaterThanOrEqual(1);

    const latestEntry = body.appointment.statusHistory[0];
    expect(latestEntry.fromStatus).toBe("SCHEDULED");
    expect(latestEntry.toStatus).toBe("CONFIRMED");
  });
});
