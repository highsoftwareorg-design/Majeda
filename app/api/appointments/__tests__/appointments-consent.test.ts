/**
 * בדיקות ל-PATCH /api/appointments/[id] — חסימת הסכמה (task 7.10, FR-CF-10).
 *
 * כל הקריאות ל-Prisma וה-db functions ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * בודק:
 * 1. PATCH עם status=COMPLETED + requiresConsentForm=true + אין הסכמה בתוקף → 422 עם code=CONSENT_REQUIRED.
 * 2. PATCH עם status=COMPLETED + overrideReason + approvedBy → 200 (דריסת אדמין).
 *
 * הרצה: `npx vitest run app/api/appointments/__tests__/appointments-consent.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני ה-imports של המודולים הממוקים
// ---------------------------------------------------------------------------

const {
  mockGetAppointmentById,
  mockCheckAppointmentConflict,
  mockCheckClientHasValidConsent,
  mockPrismaAppointmentUpdate,
  mockPrismaStatusHistoryCreate,
  mockPrismaConsentTemplateFindFirst,
  mockPrismaConsentOverrideCreate,
} = vi.hoisted(() => ({
  mockGetAppointmentById: vi.fn(),
  mockCheckAppointmentConflict: vi.fn(),
  mockCheckClientHasValidConsent: vi.fn(),
  mockPrismaAppointmentUpdate: vi.fn(),
  mockPrismaStatusHistoryCreate: vi.fn().mockResolvedValue({ id: "hist-1" }),
  mockPrismaConsentTemplateFindFirst: vi.fn(),
  mockPrismaConsentOverrideCreate: vi.fn().mockResolvedValue({ id: "override-1" }),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

// session מאומת קבוע — PATCH דורש התחברות (§11); ה-middleware לא מכסה /api.
vi.mock("@/lib/auth/auth", () => ({
  auth: () => Promise.resolve({ user: { id: "admin", email: "admin@test" } }),
}));

vi.mock("@/lib/db/appointments", () => ({
  getAppointmentById: mockGetAppointmentById,
  checkAppointmentConflict: mockCheckAppointmentConflict,
  checkClientHasValidConsent: mockCheckClientHasValidConsent,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    appointment: {
      update: mockPrismaAppointmentUpdate,
    },
    appointmentStatusHistory: {
      create: mockPrismaStatusHistoryCreate,
    },
    consentTemplate: {
      findFirst: mockPrismaConsentTemplateFindFirst,
    },
    consentOverride: {
      create: mockPrismaConsentOverrideCreate,
    },
  },
}));

// ---------------------------------------------------------------------------
// Import handler after mocks
// ---------------------------------------------------------------------------

import { PATCH } from "@/app/api/appointments/[id]/route";

// ---------------------------------------------------------------------------
// עזרים
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

/** תור מדומה עם requiresConsentForm=true */
const MOCK_APPOINTMENT_WITH_CONSENT = {
  id: "appt-consent-1",
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
    color: null,
    requiresConsentForm: true,
    authorizedTherapists: [],
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

describe("PATCH /api/appointments/[id] — חסימת הסכמה (task 7.10, FR-CF-10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAppointmentById.mockResolvedValue(MOCK_APPOINTMENT_WITH_CONSENT);
    mockCheckAppointmentConflict.mockResolvedValue({
      hasConflict: false,
      conflictType: null,
    });
  });

  it("מחזיר 422 עם code=CONSENT_REQUIRED כאשר אין הסכמה בתוקף ואין override", async () => {
    mockCheckClientHasValidConsent.mockResolvedValue(false);
    mockPrismaConsentTemplateFindFirst.mockResolvedValue({ id: "tmpl-1" });

    const [req, routeCtx] = makePatchRequest("appt-consent-1", {
      status: "COMPLETED",
    });
    const res = await PATCH(req, routeCtx);

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("CONSENT_REQUIRED");
    expect(body.consentTemplateId).toBe("tmpl-1");
    expect(body.error).toMatch(/הסכמה/);

    // הפעולה לא הושלמה — לא עדכנו את התור
    expect(mockPrismaAppointmentUpdate).not.toHaveBeenCalled();
  });

  it("מחזיר 200 כאשר מסופקים overrideReason ו-approvedBy (דריסת אדמין)", async () => {
    mockCheckClientHasValidConsent.mockResolvedValue(false);
    mockPrismaConsentOverrideCreate.mockResolvedValue({ id: "override-1" });
    mockPrismaAppointmentUpdate.mockResolvedValue({
      ...MOCK_APPOINTMENT_WITH_CONSENT,
      status: "COMPLETED",
      statusHistory: [],
    });
    mockPrismaStatusHistoryCreate.mockResolvedValue({ id: "hist-new" });

    const [req, routeCtx] = makePatchRequest("appt-consent-1", {
      status: "COMPLETED",
      overrideReason: "לקוח חתם ידנית על הטופס",
      approvedBy: "מג'ידה",
    });
    const res = await PATCH(req, routeCtx);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.appointment).toBeDefined();

    // ודא שרשומת ה-audit נוצרה
    expect(mockPrismaConsentOverrideCreate).toHaveBeenCalledOnce();
    expect(mockPrismaConsentOverrideCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appointmentId: "appt-consent-1",
          reason: "לקוח חתם ידנית על הטופס",
          approvedBy: "מג'ידה",
        }),
      })
    );
  });
});
