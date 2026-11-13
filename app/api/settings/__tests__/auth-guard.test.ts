/**
 * בדיקות אבטחה ל-auth() (משימה 13.4, SRS §11) — הגדרות מרפאה.
 *
 * GET ו-PUT ב-/api/settings/clinic מוגנים ב-`auth()` כפקודה הראשונה. ללא session
 * הם מחזירים 401 "נדרשת התחברות" ואינם נוגעים ב-DB.
 *
 * הרצה: `npx vitest run app/api/settings/__tests__/auth-guard.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני ה-imports של ה-handlers
// ---------------------------------------------------------------------------

const { mockAuth, mockGetClinicSettings, mockUpsertClinicSettings } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockGetClinicSettings: vi.fn(),
  mockUpsertClinicSettings: vi.fn(),
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

vi.mock("@/lib/db/clinicSettings", () => ({
  getClinicSettings: mockGetClinicSettings,
  upsertClinicSettings: mockUpsertClinicSettings,
}));

// ---------------------------------------------------------------------------
// Import handlers after mocks
// ---------------------------------------------------------------------------

import { GET, PUT } from "@/app/api/settings/clinic/route";

// ---------------------------------------------------------------------------
// עזרים
// ---------------------------------------------------------------------------

function req(body?: unknown): Request {
  return new Request("http://localhost/api/settings/clinic", {
    method: body === undefined ? "GET" : "PUT",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** אף קריאה ל-DB לא בוצעה. */
function expectNoDbCalls() {
  expect(mockGetClinicSettings).not.toHaveBeenCalled();
  expect(mockUpsertClinicSettings).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// בדיקות — ללא session → 401, בלי גישה ל-DB
// ---------------------------------------------------------------------------

describe("GET /api/settings/clinic — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-getClinicSettings", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET();

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("נדרשת התחברות");
    expectNoDbCalls();
  });
});

describe("PUT /api/settings/clinic — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-upsertClinicSettings", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await PUT(req({ openHour: 8, closeHour: 21 }) as never);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("נדרשת התחברות");
    expectNoDbCalls();
  });
});
