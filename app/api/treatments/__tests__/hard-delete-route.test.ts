/**
 * בדיקות ל-DELETE /api/treatments/:id — מחיקה לצמיתות של טיפול (משימה 12.3, §12).
 *
 * אימות ה-session ו-hardDeleteTreatment ממוקים. אין גישה אמיתית ל-DB.
 * (ה-route מייבא גם prisma + validations עבור PATCH — ממוקים כדי לבודד את DELETE.)
 *
 * בודק:
 * 1. ללא session → 401 (בלי לקרוא ל-hardDeleteTreatment).
 * 2. טיפול קיים → 200 { success: true }.
 * 3. hardDeleteTreatment מחזיר false → 404 "טיפול לא נמצא".
 * 4. hardDeleteTreatment זורק שגיאה → 500 עם הודעה בעברית (rollback — לא בוצע שינוי).
 *
 * הרצה: `npx vitest run app/api/treatments/__tests__/hard-delete-route.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני ה-imports של המודולים הממוקים
// ---------------------------------------------------------------------------

const { mockAuth, mockHardDeleteTreatment } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockHardDeleteTreatment: vi.fn(),
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

vi.mock("@/lib/db/hard-delete-treatment", () => ({
  hardDeleteTreatment: mockHardDeleteTreatment,
}));

// ייבואים של PATCH ברמת המודול — ממוקים כדי לא לטעון Prisma אמיתי בבדיקת DELETE.
vi.mock("@/lib/db/prisma", () => ({
  prisma: { treatment: { findUnique: vi.fn(), update: vi.fn() } },
}));

vi.mock("@prisma/client", () => ({
  Prisma: { PrismaClientKnownRequestError: class {} },
}));

vi.mock("@/lib/validations/treatments", () => ({
  isTreatmentValid: vi.fn(),
  parseTreatmentInput: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import handler after mocks
// ---------------------------------------------------------------------------

import { DELETE } from "@/app/api/treatments/[id]/route";

// ---------------------------------------------------------------------------
// עזרים
// ---------------------------------------------------------------------------

function makeParams(id = "treat-1") {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(id = "treat-1"): Request {
  return new Request(`http://localhost/api/treatments/${id}`, {
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

describe("DELETE /api/treatments/:id — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-hardDeleteTreatment", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await DELETE(makeRequest(), makeParams());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("נדרשת התחברות");
    expect(mockHardDeleteTreatment).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/treatments/:id — הצלחה", () => {
  it("טיפול קיים → 200 עם success וקורא ל-hardDeleteTreatment עם המזהה", async () => {
    mockAuth.mockResolvedValueOnce(SESSION);
    mockHardDeleteTreatment.mockResolvedValueOnce(true);

    const res = await DELETE(makeRequest("treat-1"), makeParams("treat-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
    expect(mockHardDeleteTreatment).toHaveBeenCalledWith("treat-1");
  });
});

describe("DELETE /api/treatments/:id — טיפול לא קיים", () => {
  it("hardDeleteTreatment מחזיר false → 404", async () => {
    mockAuth.mockResolvedValueOnce(SESSION);
    mockHardDeleteTreatment.mockResolvedValueOnce(false);

    const res = await DELETE(makeRequest("missing"), makeParams("missing"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("טיפול לא נמצא");
  });
});

describe("DELETE /api/treatments/:id — כשל", () => {
  it("hardDeleteTreatment זורק → 500 עם הודעה בעברית", async () => {
    mockAuth.mockResolvedValueOnce(SESSION);
    mockHardDeleteTreatment.mockRejectedValueOnce(new Error("db failure"));

    const res = await DELETE(makeRequest(), makeParams());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("לא בוצע שינוי");
  });
});
