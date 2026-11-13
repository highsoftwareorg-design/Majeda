/**
 * בדיקות אבטחה ל-auth() (משימה 13.3, SRS §11) — תחום תורים: GET ו-POST של `/api/appointments`.
 *
 * כל handler מוגן ב-`auth()` כפקודה הראשונה. ללא session הם מחזירים
 * 401 "נדרשת התחברות" ואינם נוגעים ב-DB או בשירותים.
 *
 * הקובץ מופרד מ-appointments-route.test.ts כי ל-auth שם יש מוק קבוע (תמיד מחובר).
 * כל מודולי ה-DB/השירותים ממוקים — אין טעינה אמיתית של Prisma.
 *
 * הרצה: `npx vitest run app/api/appointments/__tests__/auth-guard.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני ה-imports של ה-handlers
// ---------------------------------------------------------------------------

const { mockAuth, mockLib, mockPrisma } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockLib = {
    getAppointmentsByDateRange: vi.fn(),
    createAppointment: vi.fn(),
    checkAppointmentConflict: vi.fn(),
    getClinicSettings: vi.fn(),
    sendAppointmentConfirmation: vi.fn(),
  };
  const mockPrisma = {
    appointment: { create: vi.fn(), findMany: vi.fn() },
  };
  return { mockAuth, mockLib, mockPrisma };
});

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
  NextRequest: class {},
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/db/appointments", () => ({
  getAppointmentsByDateRange: mockLib.getAppointmentsByDateRange,
  createAppointment: mockLib.createAppointment,
  checkAppointmentConflict: mockLib.checkAppointmentConflict,
}));

vi.mock("@/lib/db/clinicSettings", () => ({
  getClinicSettings: mockLib.getClinicSettings,
}));

vi.mock("@/lib/whatsapp/notifications", () => ({
  sendAppointmentConfirmation: mockLib.sendAppointmentConfirmation,
}));

// ---------------------------------------------------------------------------
// Import handlers after mocks
// ---------------------------------------------------------------------------

import { GET, POST } from "@/app/api/appointments/route";

// ---------------------------------------------------------------------------
// עזרים
// ---------------------------------------------------------------------------

function req(path: string, method = "GET", body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function expectUnauthorized(res: Response) {
  expect(res.status).toBe(401);
  const body = await res.json();
  expect(body.error).toBe("נדרשת התחברות");
}

/** אף קריאה ל-DB או לשירות לא בוצעה. */
function expectNoDbOrServiceCalls() {
  const fns = [
    mockLib.getAppointmentsByDateRange,
    mockLib.createAppointment,
    mockLib.checkAppointmentConflict,
    mockLib.getClinicSettings,
    mockLib.sendAppointmentConfirmation,
    mockPrisma.appointment.create,
    mockPrisma.appointment.findMany,
  ];
  for (const fn of fns) {
    expect(fn).not.toHaveBeenCalled();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// בדיקות — ללא session → 401, בלי גישה ל-DB/שירותים
// ---------------------------------------------------------------------------

describe("GET /api/appointments — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-getAppointmentsByDateRange", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET(req("/api/appointments?start=2026-01-01&end=2026-01-31"));

    await expectUnauthorized(res);
    expectNoDbOrServiceCalls();
  });
});

describe("POST /api/appointments — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-createAppointment", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await POST(
      req("/api/appointments", "POST", {
        clientId: "client-1",
        therapist: "מטפלת",
        startTime: "2026-01-01T10:00:00.000Z",
        endTime: "2026-01-01T11:00:00.000Z",
      })
    );

    await expectUnauthorized(res);
    expectNoDbOrServiceCalls();
  });
});
