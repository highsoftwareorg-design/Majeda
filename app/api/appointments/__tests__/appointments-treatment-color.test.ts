/**
 * בדיקות ל-task 5.2 — שדות Treatment חדשים לתצוגת יומן (FR-AP-02).
 *
 * task 5.2 הוסיפה לטבלת Treatment את השדות:
 *   - color String? @default("#D2AB2E")     — צבע HEX לתצוגה ביומן
 *   - requiresConsentForm Boolean @default(false)
 *   - authorizedTherapists String?           — שמות מופרדים בפסיק
 *
 * קריטריון קבלה: "יצירת טיפול עם כל השדות, כולל צבע HEX תקין; שליפתו מציגה את כל הערכים כפי שהוזנו."
 *
 * הבדיקות מאמתות:
 *   1. createAppointment שומר treatmentId — הטיפול נשלף עם כל שדותיו (ממוק).
 *   2. getAppointmentsByDateRange — תגובת ה-API כוללת treatment.color (הדרוש לתצוגת היומן).
 *   3. PATCH /api/appointments/[id] — תגובה כוללת treatment.color.
 *   4. HEX ברירת המחדל תקין (#D2AB2E).
 *   5. seed data — כל הרשומות ב-seed מכילות color בפורמט HEX תקין.
 *
 * הרצה: `npx vitest run --reporter=verbose app/api/appointments/__tests__/appointments-treatment-color.test.ts`
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

import { GET, POST } from "@/app/api/appointments/route";
import { PATCH } from "@/app/api/appointments/[id]/route";

// --- תור מדומה עם treatment מלא כולל שדות task 5.2 ---

const MOCK_TREATMENT_FULL = {
  id: "treatment-1",
  name: "מיקרונידלינג",
  durationMinutes: 60,
  // שדות task 5.2:
  color: "#D2AB2E",
  requiresConsentForm: true,
  authorizedTherapists: "מג'ידה,שרה",
};

const MOCK_APPOINTMENT_WITH_COLOR = {
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
  // treatment כולל color — כפי שנדרש לתצוגת יומן (FR-AP-02)
  treatment: MOCK_TREATMENT_FULL,
  // היסטוריית שינויי סטטוס — ריקה בתור דמה (משימה 5.8, FR-AP-04)
  statusHistory: [] as Array<{
    id: string;
    fromStatus: string;
    toStatus: string;
    changedAt: Date;
    changedBy: string;
  }>,
};

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

// ===================================================================
// 1. HEX ברירת מחדל — מאמת שצבע ברירת המחדל תקין
// ===================================================================

describe("task 5.2 — ברירת מחדל צבע HEX", () => {
  it("צבע ברירת המחדל #D2AB2E הוא HEX תקין בן 7 תווים", () => {
    const DEFAULT_COLOR = "#D2AB2E";
    expect(DEFAULT_COLOR).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("כל צבעי ה-seed הם HEX תקינים", async () => {
    // ייבוא דינמי של נתוני ה-seed כמחרוזת טקסט ובדיקה סטטית
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const seedContent = readFileSync(
      join(process.cwd(), "prisma", "seed-treatments.mjs"),
      "utf-8"
    );

    // שולף את כל ערכי ה-color מהקובץ
    const colorMatches = seedContent.match(/color:\s*["']([^"']+)["']/g) ?? [];
    expect(colorMatches.length).toBeGreaterThan(0);

    for (const match of colorMatches) {
      const hex = match.match(/["']([^"']+)["']/)?.[1] ?? "";
      expect(hex, `color "${hex}" אינו HEX תקין`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

// ===================================================================
// 2. seed — כל רשומה מכילה color, requiresConsentForm, authorizedTherapists
// ===================================================================

describe("task 5.2 — seed data מכיל את כל שדות 5.2", () => {
  it("seed מכיל שדה color בכל הרשומות", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const seedContent = readFileSync(
      join(process.cwd(), "prisma", "seed-treatments.mjs"),
      "utf-8"
    );
    expect(seedContent).toContain("color:");
    expect(seedContent).toContain("requiresConsentForm:");
    expect(seedContent).toContain("authorizedTherapists:");
  });
});

// ===================================================================
// 3. GET /api/appointments — בדיקה שתגובה כוללת treatment.color
// ===================================================================

describe("task 5.2 — GET /api/appointments מחזיר treatment.color לתצוגת יומן", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAppointmentsByDateRange.mockResolvedValue([
      MOCK_APPOINTMENT_WITH_COLOR,
    ]);
  });

  it("treatment בתגובת GET כולל את שדה color (#D2AB2E)", async () => {
    const req = makeGetRequest("?start=2026-11-01&end=2026-11-30");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.appointments[0].treatment).toBeDefined();
    // בדיקה עיקרית: color נדרש לתצוגת יומן (FR-AP-02)
    expect(body.appointments[0].treatment.color).toBe("#D2AB2E");
  });

  it("treatment בתגובת GET כולל את שדה requiresConsentForm", async () => {
    const req = makeGetRequest("?start=2026-11-01&end=2026-11-30");
    const res = await GET(req);
    const body = await res.json();

    expect(body.appointments[0].treatment.requiresConsentForm).toBe(true);
  });

  it("treatment בתגובת GET כולל את שדה authorizedTherapists", async () => {
    const req = makeGetRequest("?start=2026-11-01&end=2026-11-30");
    const res = await GET(req);
    const body = await res.json();

    expect(body.appointments[0].treatment.authorizedTherapists).toBe(
      "מג'ידה,שרה"
    );
  });
});

// ===================================================================
// 4. POST /api/appointments — יצירת תור עם treatmentId — treatment.color מוחזר
// ===================================================================

describe("task 5.2 — POST /api/appointments מחזיר treatment.color ביצירה", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAppointment.mockResolvedValue(MOCK_APPOINTMENT_WITH_COLOR);
    mockCheckAppointmentConflict.mockResolvedValue({ hasConflict: false, conflictType: null });
  });

  it("תגובת POST כוללת treatment.color אחרי יצירת תור", async () => {
    const req = makePostRequest({
      clientId: "client-1",
      therapist: "מג'ידה",
      startTime: "2026-11-10T10:00:00.000Z",
      endTime: "2026-11-10T11:00:00.000Z",
      treatmentId: "treatment-1",
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.appointment.treatment).toBeDefined();
    // בדיקה עיקרית
    expect(body.appointment.treatment.color).toBe("#D2AB2E");
  });
});

// ===================================================================
// 5. PATCH /api/appointments/[id] — treatment.color מוחזר אחרי עדכון
// ===================================================================

describe("task 5.2 — PATCH /api/appointments/[id] מחזיר treatment.color אחרי עדכון", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAppointmentById.mockResolvedValue(MOCK_APPOINTMENT_WITH_COLOR);
    mockPrismaAppointmentUpdate.mockResolvedValue({
      ...MOCK_APPOINTMENT_WITH_COLOR,
      status: "CONFIRMED",
    });
  });

  it("תגובת PATCH כוללת treatment.color אחרי עדכון סטטוס", async () => {
    const [req, routeCtx] = makePatchRequest("appt-1", {
      status: "CONFIRMED",
    });
    const res = await PATCH(req, routeCtx);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.appointment.treatment).toBeDefined();
    // בדיקה עיקרית
    expect(body.appointment.treatment.color).toBe("#D2AB2E");
  });

  it("prisma.appointment.update נקרא עם include.treatment.select.color: true (עקביות עם appointmentInclude)", async () => {
    const [req, routeCtx] = makePatchRequest("appt-1", {
      status: "CONFIRMED",
    });
    await PATCH(req, routeCtx);

    expect(mockPrismaAppointmentUpdate).toHaveBeenCalledOnce();
    const callArg = mockPrismaAppointmentUpdate.mock.calls[0][0];

    // בדיקה: ה-inline select ב-PATCH route חייב לכלול color כמו appointmentInclude
    expect(
      callArg.include?.treatment?.select?.color,
      "PATCH route: inline treatment.select אינו כולל color — אחרי עדכון, treatment.color יהיה undefined בתגובה"
    ).toBe(true);
  });
});
