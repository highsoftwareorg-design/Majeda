/**
 * בדיקות ולידציית שעות פעילות מרפאה ב-POST /api/appointments — משימה 5.7 (FR-AP-05).
 *
 * המוק של getClinicSettings מוחזר עם openHour=9 / closeHour=19 לכל הבדיקות בקובץ זה
 * כך שניתן לבדוק גבולות שונים מברירות המחדל (8/21).
 *
 *  1. startTime לפני שעת הפתיחה → 409 "מחוץ לשעות פעילות"
 *  2. endTime אחרי שעת הסגירה  → 409 "מחוץ לשעות פעילות"
 *  3. תור תקין בתוך שעות הפעילות → 201
 *
 * הרצה: `npx vitest run --reporter=verbose app/api/appointments/__tests__/appointments-clinic-hours.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// --- Mocks (חייבים לפני ה-imports) ---

const {
  mockGetAppointmentsByDateRange,
  mockCreateAppointment,
  mockGetAppointmentById,
  mockPrismaAppointmentUpdate,
  mockCheckAppointmentConflict,
  mockGetClinicSettings,
} = vi.hoisted(() => ({
  mockGetAppointmentsByDateRange: vi.fn(),
  mockCreateAppointment: vi.fn(),
  mockGetAppointmentById: vi.fn(),
  mockPrismaAppointmentUpdate: vi.fn(),
  mockCheckAppointmentConflict: vi.fn(),
  mockGetClinicSettings: vi.fn(),
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
  },
}));

// הגדרות מרפאה: פתיחה 09:00, סגירה 19:00
vi.mock("@/lib/db/clinicSettings", () => ({
  getClinicSettings: mockGetClinicSettings,
}));

// --- Import handler after mocks ---
import { POST } from "@/app/api/appointments/route";

// --- עזרים ---

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** תור מדומה */
const MOCK_APPOINTMENT = {
  id: "appt-hours-1",
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
  client: { id: "client-1", firstName: "דנה", lastName: "כהן", phone: "0501234567" },
  treatment: { id: "treatment-1", name: "פילינג כימי", durationMinutes: 60 },
};

/** הגדרות מרפאה: פתיחה 09:00, סגירה 19:00 */
const CLINIC_HOURS_9_19 = {
  openHour: 9,
  closeHour: 19,
  breakStartHour: null,
  breakStartMin: null,
  breakEndHour: null,
  breakEndMin: null,
};

// ===================================================================
// POST /api/appointments — ולידציה מול שעות פעילות מרפאה
// ===================================================================

describe("POST /api/appointments — startTime לפני שעת פתיחה 09:00 (UTC+2 ישראל)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClinicSettings.mockResolvedValue(CLINIC_HOURS_9_19);
    mockCheckAppointmentConflict.mockResolvedValue({ hasConflict: false, conflictType: null });
  });

  it("מחזיר 409 עם 'מחוץ לשעות פעילות' כש-startTime לפני פתיחה 09:00 שעון ישראל", async () => {
    // הגדרות מרפאה: פתיחה 09:00. השרת משתמש ב-getHours() (שעון מקומי — UTC+2 ישראל בחורף).
    // UTC 06:00 = 08:00 ישראל = לפני פתיחה 09:00.
    const req = makePostRequest({
      clientId: "client-1",
      therapist: "מג'ידה",
      startTime: "2026-11-10T06:00:00.000Z",
      endTime: "2026-11-10T06:30:00.000Z",
      treatmentId: "treatment-1",
    });

    const res = await POST(req);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/מחוץ לשעות פעילות/);
    expect(mockCreateAppointment).not.toHaveBeenCalled();
  });
});

describe("POST /api/appointments — endTime אחרי שעת סגירה (19:00)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClinicSettings.mockResolvedValue(CLINIC_HOURS_9_19);
    mockCheckAppointmentConflict.mockResolvedValue({ hasConflict: false, conflictType: null });
  });

  it("מחזיר 409 עם 'מחוץ לשעות פעילות' כש-endTime ב-20:00 (אחרי סגירה 19:00)", async () => {
    // start 10:00, end 20:00 — endTime אחרי סגירה
    const req = makePostRequest({
      clientId: "client-1",
      therapist: "מג'ידה",
      startTime: "2026-11-10T10:00:00.000Z",
      endTime: "2026-11-10T20:00:00.000Z",
      treatmentId: "treatment-1",
    });

    const res = await POST(req);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/מחוץ לשעות פעילות/);
    expect(mockCreateAppointment).not.toHaveBeenCalled();
  });
});

describe("POST /api/appointments — תור תקין בתוך שעות פעילות (09:00–19:00)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClinicSettings.mockResolvedValue(CLINIC_HOURS_9_19);
    mockCreateAppointment.mockResolvedValue(MOCK_APPOINTMENT);
    mockCheckAppointmentConflict.mockResolvedValue({ hasConflict: false, conflictType: null });
  });

  it("יוצר תור ומחזיר 201 כש-startTime=10:00 ו-endTime=11:00 (בתוך 09:00–19:00)", async () => {
    const req = makePostRequest({
      clientId: "client-1",
      therapist: "מג'ידה",
      startTime: "2026-11-10T10:00:00.000Z",
      endTime: "2026-11-10T11:00:00.000Z",
      treatmentId: "treatment-1",
    });

    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.appointment).toBeDefined();
    expect(body.appointment.id).toBe("appt-hours-1");
    expect(mockCreateAppointment).toHaveBeenCalledOnce();
  });
});
