/**
 * בדיקות ל-DELETE /api/clients/:id/hard-delete — מחיקה לצמיתות (משימה 12.2, §12).
 *
 * אימות ה-session ו-hardDeleteClient ממוקים. אין גישה אמיתית ל-DB.
 *
 * בודק:
 * 1. ללא session → 401 (בלי לקרוא ל-hardDeleteClient).
 * 2. לקוח/ה קיים/ת → 200 { success: true, orphanedPdfKeys }.
 * 3. hardDeleteClient מחזיר null → 404.
 * 4. hardDeleteClient זורק שגיאה → 500 עם הודעה בעברית.
 *
 * הרצה: `npx vitest run app/api/clients/__tests__/hard-delete-route.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני ה-imports של המודולים הממוקים
// ---------------------------------------------------------------------------

const { mockAuth, mockHardDeleteClient } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockHardDeleteClient: vi.fn(),
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

vi.mock("@/lib/db/hard-delete-client", () => ({
  hardDeleteClient: mockHardDeleteClient,
}));

// ---------------------------------------------------------------------------
// Import handler after mocks
// ---------------------------------------------------------------------------

import { DELETE } from "@/app/api/clients/[id]/hard-delete/route";

// ---------------------------------------------------------------------------
// עזרים
// ---------------------------------------------------------------------------

function makeParams(id = "client-1") {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(id = "client-1"): Request {
  return new Request(`http://localhost/api/clients/${id}/hard-delete`, {
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

describe("DELETE /api/clients/:id/hard-delete — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-hardDeleteClient", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await DELETE(makeRequest(), makeParams());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("נדרשת התחברות");
    expect(mockHardDeleteClient).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/clients/:id/hard-delete — הצלחה", () => {
  it("לקוח/ה קיים/ת → 200 עם success ו-orphanedPdfKeys", async () => {
    mockAuth.mockResolvedValueOnce(SESSION);
    mockHardDeleteClient.mockResolvedValueOnce({
      orphanedPdfKeys: ["consents/client-1/a.pdf", "consents/client-1/b.pdf"],
    });

    const res = await DELETE(makeRequest("client-1"), makeParams("client-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      orphanedPdfKeys: ["consents/client-1/a.pdf", "consents/client-1/b.pdf"],
    });
    expect(mockHardDeleteClient).toHaveBeenCalledWith("client-1");
  });
});

describe("DELETE /api/clients/:id/hard-delete — לקוח/ה לא קיים/ת", () => {
  it("hardDeleteClient מחזיר null → 404", async () => {
    mockAuth.mockResolvedValueOnce(SESSION);
    mockHardDeleteClient.mockResolvedValueOnce(null);

    const res = await DELETE(makeRequest("missing"), makeParams("missing"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("לקוח לא נמצא");
  });
});

describe("DELETE /api/clients/:id/hard-delete — כשל", () => {
  it("hardDeleteClient זורק → 500 עם הודעה בעברית", async () => {
    mockAuth.mockResolvedValueOnce(SESSION);
    mockHardDeleteClient.mockRejectedValueOnce(new Error("db failure"));

    const res = await DELETE(makeRequest(), makeParams());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("לא בוצע שינוי");
  });
});
