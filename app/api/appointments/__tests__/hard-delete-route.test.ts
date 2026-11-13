/**
 * בדיקות ל-DELETE /api/appointments/:id — מחיקה לצמיתות של תור (משימה 12.4, §12).
 *
 * אימות ה-session ו-hardDeleteAppointment ממוקים. אין גישה אמיתית ל-DB.
 * (ה-route מייבא גם prisma + עזרי appointments עבור PATCH — ממוקים כדי לבודד את DELETE.)
 *
 * בודק:
 * 1. ללא session → 401 (בלי לקרוא ל-hardDeleteAppointment).
 * 2. תור קיים → 200 { success: true } וקריאה ל-hardDeleteAppointment עם המזהה.
 * 3. hardDeleteAppointment מחזיר false → 404 "תור לא נמצא".
 * 4. hardDeleteAppointment זורק שגיאה → 500 עם הודעה בעברית (rollback — לא בוצע שינוי).
 *
 * הרצה: `npx vitest run app/api/appointments/__tests__/hard-delete-route.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני ה-imports של המודולים הממוקים
// ---------------------------------------------------------------------------

const { mockAuth, mockHardDeleteAppointment } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockHardDeleteAppointment: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/db/hard-delete-appointment", () => ({
  hardDeleteAppointment: mockHardDeleteAppointment,
}));

// ייבואים של PATCH ברמת המודול — ממוקים כדי לא לטעון Prisma אמיתי בבדיקת DELETE.
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    appointment: { update: vi.fn() },
    appointmentStatusHistory: { create: vi.fn() },
    consentOverride: { create: vi.fn() },
    consentTemplate: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/db/appointments", () => ({
  getAppointmentById: vi.fn(),
  checkAppointmentConflict: vi.fn(),
  checkClientHasValidConsent: vi.fn(),
}));

vi.mock("@prisma/client", () => ({
  AppointmentStatus: {
    SCHEDULED: "SCHEDULED",
    CONFIRMED: "CONFIRMED",
    ARRIVED: "ARRIVED",
    COMPLETED: "COMPLETED",
    CANCELLED: "CANCELLED",
    NO_SHOW: "NO_SHOW",
  },
}));

// ---------------------------------------------------------------------------
// Import handler after mocks
// ---------------------------------------------------------------------------

import { DELETE } from "@/app/api/appointments/[id]/route";

// ---------------------------------------------------------------------------
// עזרים
// ---------------------------------------------------------------------------

function makeParams(id = "apt-1") {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(id = "apt-1"): Request {
  return new Request(`http://localhost/api/appointments/${id}`, {
    method: "DELETE",
  });
}

const SESSION = { user: { id: "admin-1", name: "מנהלת" } };

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// בדיקות
// ---------------------------------------------------------------------------

describe("DELETE /api/appointments/:id — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-hardDeleteAppointment", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await DELETE(makeRequest(), makeParams());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("נדרשת התחברות");
    expect(mockHardDeleteAppointment).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/appointments/:id — הצלחה", () => {
  it("תור קיים → 200 עם success וקורא ל-hardDeleteAppointment עם המזהה", async () => {
    mockAuth.mockResolvedValueOnce(SESSION);
    mockHardDeleteAppointment.mockResolvedValueOnce(true);

    const res = await DELETE(makeRequest("apt-1"), makeParams("apt-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
    expect(mockHardDeleteAppointment).toHaveBeenCalledWith("apt-1");
  });
});

describe("DELETE /api/appointments/:id — תור לא קיים", () => {
  it("hardDeleteAppointment מחזיר false → 404", async () => {
    mockAuth.mockResolvedValueOnce(SESSION);
    mockHardDeleteAppointment.mockResolvedValueOnce(false);

    const res = await DELETE(makeRequest("missing"), makeParams("missing"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("תור לא נמצא");
  });
});

describe("DELETE /api/appointments/:id — כשל", () => {
  it("hardDeleteAppointment זורק → 500 עם הודעה בעברית", async () => {
    mockAuth.mockResolvedValueOnce(SESSION);
    mockHardDeleteAppointment.mockRejectedValueOnce(new Error("db failure"));

    const res = await DELETE(makeRequest(), makeParams());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("לא בוצע שינוי");
  });
});
