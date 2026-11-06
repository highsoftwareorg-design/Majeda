/**
 * בדיקות ל-task 5.6 — בדיקת חפיפת תורים (conflict detection, FR-AP-03).
 *
 * task 5.6 הוסיפה את checkAppointmentConflict() וחיברה אותה ל-POST ול-PATCH.
 *
 * קריטריון קבלה: ניסיון ליצור/לגרור תור לטווח זמן שחופף תור קיים לאותו מטפל/ת
 * מוחזר עם שגיאה וללא שמירה; תור לאותה שעה אך למטפל/ת אחר/ת או חדר אחר נשמר בהצלחה.
 *
 * הבדיקות:
 *   POST /api/appointments
 *     1. חפיפת מטפל/ת — 409 עם הודעה בעברית הכוללת את שם המטפל/ת
 *     2. חפיפת חדר — 409 עם הודעה בעברית הכוללת את שם החדר
 *     3. ללא חפיפה — יצירה מוצלחת, 201
 *
 *   PATCH /api/appointments/[id]
 *     4. חפיפת מטפל/ת בעדכון — 409
 *     5. עדכון סטטוס בלבד — לא נבדק conflict, 200
 *     6. עדכון זמן ללא חפיפה — 200 (נשמר בהצלחה)
 *
 * הרצה: `npx vitest run --reporter=verbose app/api/appointments/__tests__/appointments-conflict.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// --- Mocks (חייבים לפני ה-imports של המודולים הממוקים) ---

const {
  mockGetAppointmentsByDateRange,
  mockCreateAppointment,
  mockGetAppointmentById,
  mockPrismaAppointmentUpdate,
  mockCheckAppointmentConflict,
  mockPrismaStatusHistoryCreate,
} = vi.hoisted(() => ({
  mockGetAppointmentsByDateRange: vi.fn(),
  mockCreateAppointment: vi.fn(),
  mockGetAppointmentById: vi.fn(),
  mockPrismaAppointmentUpdate: vi.fn(),
  mockCheckAppointmentConflict: vi.fn(),
  // מוק ליצירת רשומת היסטוריית סטטוס (משימה 5.8, FR-AP-04)
  mockPrismaStatusHistoryCreate: vi.fn().mockResolvedValue({ id: "hist-1" }),
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
  getAppointmentsByDateRange: mockGetAppointmentsByDateRange,
  createAppointment: mockCreateAppointment,
  getAppointmentById: mockGetAppointmentById,
  checkAppointmentConflict: mockCheckAppointmentConflict,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    appointment: {
      update: mockPrismaAppointmentUpdate,
    },
    // מוק ל-AppointmentStatusHistory (משימה 5.8, FR-AP-04)
    appointmentStatusHistory: {
      create: mockPrismaStatusHistoryCreate,
    },
  },
}));

// מוק הגדרות מרפאה (task 5.7) — מחזיר ברירות מחדל כך שבדיקות POST קיימות ימשיכו לעבוד
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

// --- Import handlers after mocks ---

import { POST } from "@/app/api/appointments/route";
import { PATCH } from "@/app/api/appointments/[id]/route";

// --- עזרים ---

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

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

/** תור מדומה קיים במסד הנתונים — לשימוש בבדיקות PATCH */
const MOCK_EXISTING_APPOINTMENT = {
  id: "appt-1",
  clientId: "client-1",
  treatmentId: "treatment-1",
  therapist: "מג'ידה",
  room: "חדר 1",
  startTime: new Date("2026-11-10T10:00:00.000Z"),
  endTime: new Date("2026-11-10T11:00:00.000Z"),
  status: "SCHEDULED",
  notes: null,
  createdAt: new Date("2026-11-01T00:00:00.000Z"),
  updatedAt: new Date("2026-11-01T00:00:00.000Z"),
  client: {
    id: "client-1",
    firstName: "דנה",
    lastName: "כהן",
    phone: "0501234567",
  },
  treatment: {
    id: "treatment-1",
    name: "פילינג כימי",
    durationMinutes: 60,
    color: "#D2AB2E",
    requiresConsentForm: false,
    authorizedTherapists: null,
  },
  // היסטוריית שינויי סטטוס — ריקה בתור דמה (משימה 5.8, FR-AP-04)
  statusHistory: [] as Array<{
    id: string;
    fromStatus: string;
    toStatus: string;
    changedAt: Date;
    changedBy: string;
  }>,
};

/** תור מדומה שייווצר — לשימוש ב-POST */
const MOCK_CREATED_APPOINTMENT = {
  ...MOCK_EXISTING_APPOINTMENT,
  id: "appt-2",
  therapist: "שרה",
  room: "חדר 2",
  startTime: new Date("2026-11-10T12:00:00.000Z"),
  endTime: new Date("2026-11-10T13:00:00.000Z"),
};

// ===================================================================
// POST /api/appointments — בדיקות חפיפה
// ===================================================================

describe("task 5.6 — POST: חפיפת מטפל/ת מחזירה 409 עם הודעת שגיאה בעברית", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckAppointmentConflict.mockResolvedValue({
      hasConflict: true,
      conflictType: "therapist",
      conflictWith: "10:00–11:00",
    });
  });

  it("מחזיר 409 כאשר המטפל/ת תפוס/ה בטווח הזמן המבוקש", async () => {
    const req = makePostRequest({
      clientId: "client-1",
      therapist: "מג'ידה",
      startTime: "2026-11-10T10:30:00.000Z",
      endTime: "2026-11-10T11:30:00.000Z",
    });
    const res = await POST(req);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBeTruthy();
    // הודעה כוללת את שם המטפל/ת בעברית
    expect(body.error).toContain("מג'ידה");
  });

  it("הודעת השגיאה עבור חפיפת מטפל/ת מכילה את הטווח המתנגש", async () => {
    const req = makePostRequest({
      clientId: "client-1",
      therapist: "מג'ידה",
      startTime: "2026-11-10T10:30:00.000Z",
      endTime: "2026-11-10T11:30:00.000Z",
    });
    const res = await POST(req);
    const body = await res.json();

    // הודעה מכילה את הטווח המתנגש
    expect(body.error).toContain("10:00–11:00");
  });

  it("checkAppointmentConflict נקרא עם therapist ו-startTime/endTime הנכונים", async () => {
    const req = makePostRequest({
      clientId: "client-1",
      therapist: "מג'ידה",
      startTime: "2026-11-10T10:30:00.000Z",
      endTime: "2026-11-10T11:30:00.000Z",
    });
    await POST(req);

    expect(mockCheckAppointmentConflict).toHaveBeenCalledOnce();
    const callArg = mockCheckAppointmentConflict.mock.calls[0][0];
    expect(callArg.therapist).toBe("מג'ידה");
    expect(callArg.startTime).toBeInstanceOf(Date);
    expect(callArg.endTime).toBeInstanceOf(Date);
  });

  it("createAppointment לא נקרא כאשר יש חפיפת מטפל/ת", async () => {
    const req = makePostRequest({
      clientId: "client-1",
      therapist: "מג'ידה",
      startTime: "2026-11-10T10:30:00.000Z",
      endTime: "2026-11-10T11:30:00.000Z",
    });
    await POST(req);

    expect(mockCreateAppointment).not.toHaveBeenCalled();
  });
});

describe("task 5.6 — POST: חפיפת חדר מחזירה 409 עם הודעת שגיאה בעברית", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckAppointmentConflict.mockResolvedValue({
      hasConflict: true,
      conflictType: "room",
      conflictWith: "10:00–11:00",
    });
  });

  it("מחזיר 409 כאשר החדר תפוס בטווח הזמן המבוקש", async () => {
    const req = makePostRequest({
      clientId: "client-1",
      therapist: "שרה",
      room: "חדר 1",
      startTime: "2026-11-10T10:30:00.000Z",
      endTime: "2026-11-10T11:30:00.000Z",
    });
    const res = await POST(req);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBeTruthy();
    // הודעה מכילה את שם החדר
    expect(body.error).toContain("חדר 1");
  });

  it("הודעת השגיאה עבור חפיפת חדר מכילה את הטווח המתנגש", async () => {
    const req = makePostRequest({
      clientId: "client-1",
      therapist: "שרה",
      room: "חדר 1",
      startTime: "2026-11-10T10:30:00.000Z",
      endTime: "2026-11-10T11:30:00.000Z",
    });
    const res = await POST(req);
    const body = await res.json();

    expect(body.error).toContain("10:00–11:00");
  });

  it("createAppointment לא נקרא כאשר יש חפיפת חדר", async () => {
    const req = makePostRequest({
      clientId: "client-1",
      therapist: "שרה",
      room: "חדר 1",
      startTime: "2026-11-10T10:30:00.000Z",
      endTime: "2026-11-10T11:30:00.000Z",
    });
    await POST(req);

    expect(mockCreateAppointment).not.toHaveBeenCalled();
  });
});

describe("task 5.6 — POST: ללא חפיפה — יצירה מוצלחת", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckAppointmentConflict.mockResolvedValue({
      hasConflict: false,
      conflictType: null,
    });
    mockCreateAppointment.mockResolvedValue(MOCK_CREATED_APPOINTMENT);
  });

  it("מחזיר 201 וגוף appointment כאשר אין חפיפה", async () => {
    const req = makePostRequest({
      clientId: "client-1",
      therapist: "שרה",
      room: "חדר 2",
      startTime: "2026-11-10T12:00:00.000Z",
      endTime: "2026-11-10T13:00:00.000Z",
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.appointment).toBeDefined();
    expect(body.appointment.id).toBe("appt-2");
  });

  it("createAppointment נקרא פעם אחת כאשר אין חפיפה", async () => {
    const req = makePostRequest({
      clientId: "client-1",
      therapist: "שרה",
      room: "חדר 2",
      startTime: "2026-11-10T12:00:00.000Z",
      endTime: "2026-11-10T13:00:00.000Z",
    });
    await POST(req);

    expect(mockCreateAppointment).toHaveBeenCalledOnce();
  });

  it("תור לאותה שעה אך למטפל/ת אחר/ת — נשמר בהצלחה (201)", async () => {
    // מקרה: מג'ידה תפוסה, אבל שרה פנויה — אין חפיפה
    const req = makePostRequest({
      clientId: "client-2",
      therapist: "שרה", // מטפל/ת שונה
      startTime: "2026-11-10T10:00:00.000Z", // אותה שעה כמו תור קיים
      endTime: "2026-11-10T11:00:00.000Z",
    });
    const res = await POST(req);

    // checkAppointmentConflict החזיר hasConflict: false (מוגדר ב-beforeEach)
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.appointment).toBeDefined();
  });
});

// ===================================================================
// PATCH /api/appointments/[id] — בדיקות חפיפה
// ===================================================================

describe("task 5.6 — PATCH: חפיפת מטפל/ת בעדכון מחזירה 409", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAppointmentById.mockResolvedValue(MOCK_EXISTING_APPOINTMENT);
    mockCheckAppointmentConflict.mockResolvedValue({
      hasConflict: true,
      conflictType: "therapist",
      conflictWith: "12:00–13:00",
    });
  });

  it("מחזיר 409 כאשר עדכון therapist יוצר חפיפה", async () => {
    const [req, routeCtx] = makePatchRequest("appt-1", {
      therapist: "שרה",
    });
    const res = await PATCH(req, routeCtx);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("מחזיר 409 כאשר עדכון startTime/endTime יוצר חפיפה למטפל/ת הקיים/ת", async () => {
    const [req, routeCtx] = makePatchRequest("appt-1", {
      startTime: "2026-11-10T12:00:00.000Z",
      endTime: "2026-11-10T13:00:00.000Z",
    });
    const res = await PATCH(req, routeCtx);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBeTruthy();
    // הודעה מכילה את המטפל/ת
    expect(body.error).toContain("מג'ידה");
  });

  it("prisma.appointment.update לא נקרא כאשר יש חפיפה בעדכון", async () => {
    const [req, routeCtx] = makePatchRequest("appt-1", {
      startTime: "2026-11-10T12:00:00.000Z",
      endTime: "2026-11-10T13:00:00.000Z",
    });
    await PATCH(req, routeCtx);

    expect(mockPrismaAppointmentUpdate).not.toHaveBeenCalled();
  });

  it("checkAppointmentConflict נקרא עם excludeId שווה ל-id של התור המעודכן", async () => {
    const [req, routeCtx] = makePatchRequest("appt-1", {
      startTime: "2026-11-10T12:00:00.000Z",
      endTime: "2026-11-10T13:00:00.000Z",
    });
    await PATCH(req, routeCtx);

    expect(mockCheckAppointmentConflict).toHaveBeenCalledOnce();
    const callArg = mockCheckAppointmentConflict.mock.calls[0][0];
    expect(callArg.excludeId).toBe("appt-1");
  });
});

describe("task 5.6 — PATCH: עדכון סטטוס בלבד — לא נבדק conflict", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAppointmentById.mockResolvedValue(MOCK_EXISTING_APPOINTMENT);
    mockPrismaAppointmentUpdate.mockResolvedValue({
      ...MOCK_EXISTING_APPOINTMENT,
      status: "CONFIRMED",
    });
    // לא מגדירים mockCheckAppointmentConflict — לא אמור להיקרא
  });

  it("מחזיר 200 כאשר עודכן סטטוס בלבד — ללא בדיקת חפיפה", async () => {
    const [req, routeCtx] = makePatchRequest("appt-1", {
      status: "CONFIRMED",
    });
    const res = await PATCH(req, routeCtx);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.appointment).toBeDefined();
    expect(body.appointment.status).toBe("CONFIRMED");
  });

  it("checkAppointmentConflict לא נקרא כאשר עודכן סטטוס בלבד", async () => {
    const [req, routeCtx] = makePatchRequest("appt-1", {
      status: "CONFIRMED",
    });
    await PATCH(req, routeCtx);

    expect(mockCheckAppointmentConflict).not.toHaveBeenCalled();
  });
});

describe("task 5.6 — PATCH: עדכון זמן ללא חפיפה — נשמר בהצלחה", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAppointmentById.mockResolvedValue(MOCK_EXISTING_APPOINTMENT);
    mockCheckAppointmentConflict.mockResolvedValue({
      hasConflict: false,
      conflictType: null,
    });
    mockPrismaAppointmentUpdate.mockResolvedValue({
      ...MOCK_EXISTING_APPOINTMENT,
      startTime: new Date("2026-11-10T14:00:00.000Z"),
      endTime: new Date("2026-11-10T15:00:00.000Z"),
    });
  });

  it("מחזיר 200 כאשר עדכון זמן אינו יוצר חפיפה", async () => {
    const [req, routeCtx] = makePatchRequest("appt-1", {
      startTime: "2026-11-10T14:00:00.000Z",
      endTime: "2026-11-10T15:00:00.000Z",
    });
    const res = await PATCH(req, routeCtx);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.appointment).toBeDefined();
  });

  it("prisma.appointment.update נקרא כאשר עדכון זמן אינו יוצר חפיפה", async () => {
    const [req, routeCtx] = makePatchRequest("appt-1", {
      startTime: "2026-11-10T14:00:00.000Z",
      endTime: "2026-11-10T15:00:00.000Z",
    });
    await PATCH(req, routeCtx);

    expect(mockPrismaAppointmentUpdate).toHaveBeenCalledOnce();
  });

  it("תור לאותה שעה אך לחדר אחר — נשמר בהצלחה כאשר אין חפיפה", async () => {
    // שינוי חדר: חדר 1 → חדר 2, אך checkAppointmentConflict מחזיר hasConflict: false
    const [req, routeCtx] = makePatchRequest("appt-1", {
      room: "חדר 2",
      startTime: "2026-11-10T10:00:00.000Z",
      endTime: "2026-11-10T11:00:00.000Z",
    });
    const res = await PATCH(req, routeCtx);

    expect(res.status).toBe(200);
  });
});
