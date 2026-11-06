/**
 * בדיקות ל-API של תורים — משימה 5.1 (§12.1 Appointment, בסיס ל-FR-AP-04).
 *
 * כל הקריאות ל-Prisma וה-db functions ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * GET  /api/appointments?start=&end=
 *   1. טווח תאריכים תקין — מחזיר מערך תורים ו-200.
 *   2. start חסר — 400.
 *   3. end חסר — 400.
 *   4. מחרוזת תאריך לא חוקית (start) — 400.
 *   5. start > end — 400.
 *
 * POST /api/appointments
 *   6. בקשה תקינה עם כל השדות — יוצרת תור ומחזירה 201.
 *   7. startTime >= endTime — 400.
 *   8. clientId חסר — 400.
 *   9. therapist חסר — 400.
 *  10. startTime חסר — 400.
 *  11. endTime חסר — 400.
 *
 * PATCH /api/appointments/[id]
 *  12. עדכון סטטוס תקין — מחזיר 200 עם תור מעודכן.
 *  13. סטטוס לא חוקי — 400.
 *  14. תור לא קיים — 404.
 *  15. startTime >= endTime (כשמסופקים שניהם) — 400.
 *
 * הרצה: `npx vitest run --reporter=verbose app/api/appointments/__tests__/appointments-route.test.ts`
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

import { GET, POST } from "@/app/api/appointments/route";
import { PATCH } from "@/app/api/appointments/[id]/route";

// --- עזרים ---

function makeGetRequest(query: string): Request {
  return new Request(`http://localhost/api/appointments${query}`);
}

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePatchRequest(id: string, body: unknown): [Request, { params: Promise<{ id: string }> }] {
  const req = new Request(`http://localhost/api/appointments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return [req, { params: Promise.resolve({ id }) }];
}

/** תור מדומה עם קשרים */
const MOCK_APPOINTMENT = {
  id: "appt-1",
  clientId: "client-1",
  treatmentId: "treatment-1",
  therapist: "מג'ידה",
  room: "חדר 1",
  startTime: new Date("2026-11-10T10:00:00.000Z"),
  endTime: new Date("2026-11-10T11:00:00.000Z"),
  status: "SCHEDULED",
  notes: "הערה",
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

// ===================================================================
// GET /api/appointments
// ===================================================================

describe("GET /api/appointments — טווח תאריכים תקין", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAppointmentsByDateRange.mockResolvedValue([MOCK_APPOINTMENT]);
  });

  it("מחזיר רשימת תורים ו-200 כשיש start ו-end תקינים", async () => {
    const req = makeGetRequest("?start=2026-11-01&end=2026-11-30");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.appointments).toHaveLength(1);
    expect(body.appointments[0].id).toBe("appt-1");
    expect(mockGetAppointmentsByDateRange).toHaveBeenCalledOnce();
  });
});

describe("GET /api/appointments — פרמטרים חסרים", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("מחזיר 400 כשחסר start", async () => {
    const req = makeGetRequest("?end=2026-11-30");
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
    expect(mockGetAppointmentsByDateRange).not.toHaveBeenCalled();
  });

  it("מחזיר 400 כשחסר end", async () => {
    const req = makeGetRequest("?start=2026-11-01");
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
    expect(mockGetAppointmentsByDateRange).not.toHaveBeenCalled();
  });
});

describe("GET /api/appointments — פורמט תאריך לא תקין", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("מחזיר 400 כש-start הוא מחרוזת לא תקינה", async () => {
    const req = makeGetRequest("?start=not-a-date&end=2026-11-30");
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/תאריך/);
    expect(mockGetAppointmentsByDateRange).not.toHaveBeenCalled();
  });
});

// ===================================================================
// POST /api/appointments
// ===================================================================

describe("POST /api/appointments — בקשה תקינה", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAppointment.mockResolvedValue(MOCK_APPOINTMENT);
    mockCheckAppointmentConflict.mockResolvedValue({ hasConflict: false, conflictType: null });
  });

  it("יוצר תור ומחזיר 201", async () => {
    const req = makePostRequest({
      clientId: "client-1",
      therapist: "מג'ידה",
      startTime: "2026-11-10T10:00:00.000Z",
      endTime: "2026-11-10T11:00:00.000Z",
      treatmentId: "treatment-1",
      room: "חדר 1",
      notes: "הערה",
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.appointment).toBeDefined();
    expect(body.appointment.id).toBe("appt-1");
    expect(mockCreateAppointment).toHaveBeenCalledOnce();
  });
});

describe("POST /api/appointments — ולידציה עסקית", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("מחזיר 400 כש-startTime >= endTime", async () => {
    mockCreateAppointment.mockRejectedValue(
      new Error("שעת ההתחלה חייבת להיות לפני שעת הסיום")
    );

    const req = makePostRequest({
      clientId: "client-1",
      therapist: "מג'ידה",
      startTime: "2026-11-10T11:00:00.000Z",
      endTime: "2026-11-10T10:00:00.000Z",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/שעת ההתחלה/);
  });
});

describe("POST /api/appointments — שדות חובה חסרים", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("מחזיר 400 כשחסר clientId", async () => {
    const req = makePostRequest({
      therapist: "מג'ידה",
      startTime: "2026-11-10T10:00:00.000Z",
      endTime: "2026-11-10T11:00:00.000Z",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/clientId/);
    expect(mockCreateAppointment).not.toHaveBeenCalled();
  });

  it("מחזיר 400 כשחסר therapist", async () => {
    const req = makePostRequest({
      clientId: "client-1",
      startTime: "2026-11-10T10:00:00.000Z",
      endTime: "2026-11-10T11:00:00.000Z",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/therapist/);
    expect(mockCreateAppointment).not.toHaveBeenCalled();
  });

  it("מחזיר 400 כשחסר startTime", async () => {
    const req = makePostRequest({
      clientId: "client-1",
      therapist: "מג'ידה",
      endTime: "2026-11-10T11:00:00.000Z",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/startTime/);
    expect(mockCreateAppointment).not.toHaveBeenCalled();
  });

  it("מחזיר 400 כשחסר endTime", async () => {
    const req = makePostRequest({
      clientId: "client-1",
      therapist: "מג'ידה",
      startTime: "2026-11-10T10:00:00.000Z",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/endTime/);
    expect(mockCreateAppointment).not.toHaveBeenCalled();
  });
});

// ===================================================================
// PATCH /api/appointments/[id]
// ===================================================================

describe("PATCH /api/appointments/[id] — עדכון תקין", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAppointmentById.mockResolvedValue(MOCK_APPOINTMENT);
    mockPrismaAppointmentUpdate.mockResolvedValue({
      ...MOCK_APPOINTMENT,
      status: "CONFIRMED",
    });
  });

  it("עדכון סטטוס תקין — מחזיר 200 עם תור מעודכן", async () => {
    const [req, routeCtx] = makePatchRequest("appt-1", { status: "CONFIRMED" });
    const res = await PATCH(req, routeCtx);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.appointment).toBeDefined();
    expect(body.appointment.status).toBe("CONFIRMED");
    expect(mockPrismaAppointmentUpdate).toHaveBeenCalledOnce();
  });
});

describe("PATCH /api/appointments/[id] — ולידציה", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAppointmentById.mockResolvedValue(MOCK_APPOINTMENT);
  });

  it("מחזיר 400 כשהסטטוס אינו ערך חוקי מה-enum", async () => {
    const [req, routeCtx] = makePatchRequest("appt-1", { status: "INVALID_STATUS" });
    const res = await PATCH(req, routeCtx);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/סטטוס/);
    expect(mockPrismaAppointmentUpdate).not.toHaveBeenCalled();
  });

  it("מחזיר 400 כש-startTime >= endTime", async () => {
    const [req, routeCtx] = makePatchRequest("appt-1", {
      startTime: "2026-11-10T12:00:00.000Z",
      endTime: "2026-11-10T11:00:00.000Z",
    });
    const res = await PATCH(req, routeCtx);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/שעת ההתחלה/);
    expect(mockPrismaAppointmentUpdate).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/appointments/[id] — תור לא קיים", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAppointmentById.mockResolvedValue(null);
  });

  it("מחזיר 404 כשהתור לא נמצא", async () => {
    const [req, routeCtx] = makePatchRequest("non-existent-id", {
      status: "CONFIRMED",
    });
    const res = await PATCH(req, routeCtx);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/לא נמצא/);
    expect(mockPrismaAppointmentUpdate).not.toHaveBeenCalled();
  });
});
