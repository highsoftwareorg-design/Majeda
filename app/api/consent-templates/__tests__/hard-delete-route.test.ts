/**
 * בדיקות ל-DELETE /api/consent-templates/:id/hard-delete — מחיקה לצמיתות של תבנית הסכמה (משימה 12.5, §12).
 *
 * אימות ה-session ו-hardDeleteConsentTemplate ממוקים. אין גישה אמיתית ל-DB.
 *
 * בודק:
 * 1. ללא session → 401 (בלי לקרוא ל-hardDeleteConsentTemplate).
 * 2. תבנית קיימת → 200 { success: true, orphanedPdfKeys }.
 * 3. hardDeleteConsentTemplate מחזיר null → 404 "תבנית הסכמה לא נמצאה".
 * 4. hardDeleteConsentTemplate זורק שגיאה → 500 עם הודעה בעברית (rollback — לא בוצע שינוי).
 *
 * הרצה: `npx vitest run app/api/consent-templates/__tests__/hard-delete-route.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני ה-imports של המודולים הממוקים
// ---------------------------------------------------------------------------

const { mockAuth, mockHardDeleteConsentTemplate } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockHardDeleteConsentTemplate: vi.fn(),
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

vi.mock("@/lib/db/hard-delete-consent-template", () => ({
  hardDeleteConsentTemplate: mockHardDeleteConsentTemplate,
}));

// ---------------------------------------------------------------------------
// Import handler after mocks
// ---------------------------------------------------------------------------

import { DELETE } from "@/app/api/consent-templates/[id]/hard-delete/route";

// ---------------------------------------------------------------------------
// עזרים
// ---------------------------------------------------------------------------

function makeParams(id = "tpl-1") {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(id = "tpl-1"): Request {
  return new Request(
    `http://localhost/api/consent-templates/${id}/hard-delete`,
    { method: "DELETE" }
  );
}

const SESSION = { user: { id: "admin-1", name: "מנהלת" } };

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// בדיקות
// ---------------------------------------------------------------------------

describe("DELETE /api/consent-templates/:id/hard-delete — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-hardDeleteConsentTemplate", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await DELETE(makeRequest(), makeParams());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("נדרשת התחברות");
    expect(mockHardDeleteConsentTemplate).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/consent-templates/:id/hard-delete — הצלחה", () => {
  it("תבנית קיימת → 200 עם success ו-orphanedPdfKeys", async () => {
    mockAuth.mockResolvedValueOnce(SESSION);
    mockHardDeleteConsentTemplate.mockResolvedValueOnce({
      orphanedPdfKeys: ["consents/tpl-1/a.pdf", "consents/tpl-1/b.pdf"],
    });

    const res = await DELETE(makeRequest("tpl-1"), makeParams("tpl-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      orphanedPdfKeys: ["consents/tpl-1/a.pdf", "consents/tpl-1/b.pdf"],
    });
    expect(mockHardDeleteConsentTemplate).toHaveBeenCalledWith("tpl-1");
  });
});

describe("DELETE /api/consent-templates/:id/hard-delete — תבנית לא קיימת", () => {
  it("hardDeleteConsentTemplate מחזיר null → 404", async () => {
    mockAuth.mockResolvedValueOnce(SESSION);
    mockHardDeleteConsentTemplate.mockResolvedValueOnce(null);

    const res = await DELETE(makeRequest("missing"), makeParams("missing"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("תבנית הסכמה לא נמצאה");
  });
});

describe("DELETE /api/consent-templates/:id/hard-delete — כשל", () => {
  it("hardDeleteConsentTemplate זורק → 500 עם הודעה בעברית", async () => {
    mockAuth.mockResolvedValueOnce(SESSION);
    mockHardDeleteConsentTemplate.mockRejectedValueOnce(new Error("db failure"));

    const res = await DELETE(makeRequest(), makeParams());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("לא בוצע שינוי");
  });
});
