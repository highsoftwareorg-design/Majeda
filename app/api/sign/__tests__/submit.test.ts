/**
 * בדיקות API לנקודת קצה POST /api/sign/[token]/submit — משימה 7.7 (FR-CF-07).
 *
 * כל קריאות ל-Prisma ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * בודק:
 * 1. POST תקין → prisma.signedConsent.update נקרא עם signedAt, auditHash, fieldValues.
 * 2. auditHash הוא SHA-256 — 64 תווים hex.
 * 3. POST שני עם אותו טוקן (signedAt כבר מוגדר) → 410.
 * 4. אין צורך ב-cookie (OTP מדולג) — הנקודת קצה עובדת ללא cookie.
 * 5. טוקן לא נמצא → 410.
 * 6. טוקן פג תוקף → 410.
 * 7. auditIp נלקח מה-header x-forwarded-for.
 * 8. auditDevice נלקח מה-header user-agent.
 *
 * הרצה: `npx vitest run app/api/sign/__tests__/`
 */

import crypto from "crypto";
import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני ה-imports של המודולים הממוקים
// ---------------------------------------------------------------------------

const { mockFindFirst, mockUpdate } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    signedConsent: {
      findFirst: mockFindFirst,
      update: mockUpdate,
    },
  },
}));

vi.mock("next/server", () => ({
  NextRequest: class {
    url: string;
    _body: string;
    _headers: Record<string, string>;

    constructor(
      url: string,
      init: { method?: string; body?: string; headers?: Record<string, string> } = {}
    ) {
      this.url = url;
      this._body = init.body ?? "{}";
      this._headers = init.headers ?? {};
    }

    async json() {
      return JSON.parse(this._body);
    }

    headers = {
      get: (key: string): string | null => {
        const lowerKey = key.toLowerCase();
        const entry = Object.entries(this._headers).find(
          ([k]) => k.toLowerCase() === lowerKey
        );
        return entry ? entry[1] : null;
      },
    };
  },
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

// ---------------------------------------------------------------------------
// Import handler after mocks
// ---------------------------------------------------------------------------

import { POST } from "@/app/api/sign/[token]/submit/route";

// ---------------------------------------------------------------------------
// נתוני עזר
// ---------------------------------------------------------------------------

const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;

const MOCK_CONSENT = {
  id: "sc-1",
  clientId: "client-1",
  signingToken: "test-token-123",
  signingTokenExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 שעות קדימה
  signedAt: null,
  fieldValues: null,
};

const MOCK_UPDATED_CONSENT = {
  ...MOCK_CONSENT,
  signedAt: new Date(),
  fieldValues: { question1: "yes", agree: true },
  signatureClientData: "data:image/png;base64,abc123",
  auditHash: "a".repeat(64),
  auditIp: "1.2.3.4",
  auditDevice: "Mozilla/5.0",
};

/** יוצר NextRequest מדומה */
function makeRequest(
  token: string,
  body: unknown,
  headers: Record<string, string> = {}
): {
  req: import("next/server").NextRequest;
  contextParams: { params: Promise<{ token: string }> };
} {
  const { NextRequest } = require("next/server");
  const req = new NextRequest(`http://localhost/api/sign/${token}/submit`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  }) as import("next/server").NextRequest;

  const contextParams = { params: Promise.resolve({ token }) };
  return { req, contextParams };
}

// ---------------------------------------------------------------------------
// בדיקות
// ---------------------------------------------------------------------------

describe("POST /api/sign/[token]/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // ברירת מחדל: consent קיים ולא חתום
    mockFindFirst.mockResolvedValue(MOCK_CONSENT);
    mockUpdate.mockResolvedValue(MOCK_UPDATED_CONSENT);
  });

  // ---- בדיקה 1: POST תקין → update נקרא עם signedAt, auditHash, fieldValues ----

  it("POST תקין → prisma.signedConsent.update נקרא עם signedAt מוגדר, auditHash לא null, fieldValues נשמרים", async () => {
    const payload = {
      fieldValues: { question1: "yes", agree: true },
      signatureClientData: "data:image/png;base64,abc123",
    };

    const { req, contextParams } = makeRequest("test-token-123", payload);
    const res = await POST(req, contextParams);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.signedConsentId).toBe(MOCK_UPDATED_CONSENT.id);

    expect(mockUpdate).toHaveBeenCalledOnce();
    const callData = mockUpdate.mock.calls[0][0].data;

    // signedAt מוגדר (Date)
    expect(callData.signedAt).toBeInstanceOf(Date);

    // auditHash לא null ואינו מחרוזת ריקה
    expect(callData.auditHash).toBeTruthy();
    expect(typeof callData.auditHash).toBe("string");

    // fieldValues נשמרים
    expect(callData.fieldValues).toEqual(payload.fieldValues);
  });

  // ---- בדיקה 2: auditHash הוא SHA-256 — 64 תווים hex ----

  it("auditHash הוא מחרוזת SHA-256 של 64 תווים hex הנגזרת נכון מה-payload", async () => {
    const payload = {
      fieldValues: { name: "שרה" },
      signatureClientData: "sig-data",
    };

    const { req, contextParams } = makeRequest("test-token-123", payload);
    await POST(req, contextParams);

    expect(mockUpdate).toHaveBeenCalledOnce();
    const callData = mockUpdate.mock.calls[0][0].data;

    // פורמט SHA-256
    expect(callData.auditHash).toMatch(SHA256_HEX_REGEX);

    // חישוב ידני לאימות
    const signedAt: Date = callData.signedAt;
    const expectedInput = JSON.stringify({
      fieldValues: payload.fieldValues,
      signatureClientData: payload.signatureClientData,
      signedAt: signedAt.toISOString(),
    });
    const expectedHash = crypto
      .createHash("sha256")
      .update(expectedInput)
      .digest("hex");

    expect(callData.auditHash).toBe(expectedHash);
  });

  // ---- בדיקה 3: POST שני עם אותו טוקן (signedAt כבר מוגדר) → 410 ----

  it("POST שני עם אותו טוקן — signedAt כבר מוגדר → 410", async () => {
    // מדמה consent שכבר נחתם
    mockFindFirst.mockResolvedValue({
      ...MOCK_CONSENT,
      signedAt: new Date("2026-01-01T12:00:00Z"),
    });

    const { req, contextParams } = makeRequest("test-token-123", {
      fieldValues: {},
      signatureClientData: "sig",
    });

    const res = await POST(req, contextParams);

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBeTruthy();

    // update לא נקרא
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // ---- בדיקה 4: הנקודת קצה עובדת ללא cookie (OTP מדולג) ----

  it("הנקודת קצה מחזירה 200 ללא cookie — OTP לא נדרש", async () => {
    const payload = {
      fieldValues: { agree: true },
      signatureClientData: "data:image/png;base64,xyz",
    };

    // בקשה ללא כל header של cookie
    const { req, contextParams } = makeRequest("test-token-123", payload, {});
    const res = await POST(req, contextParams);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  // ---- בדיקה 5: טוקן לא נמצא → 410 ----

  it("טוקן לא נמצא — findFirst מחזיר null → 410", async () => {
    mockFindFirst.mockResolvedValue(null);

    const { req, contextParams } = makeRequest("nonexistent-token", {
      fieldValues: {},
      signatureClientData: "sig",
    });

    const res = await POST(req, contextParams);

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBeTruthy();

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // ---- בדיקה 6: טוקן פג תוקף → 410 ----

  it("signingTokenExpiresAt בעבר → 410 (טוקן פג תוקף)", async () => {
    mockFindFirst.mockResolvedValue({
      ...MOCK_CONSENT,
      signingTokenExpiresAt: new Date(Date.now() - 1000), // שנייה בעבר
    });

    const { req, contextParams } = makeRequest("test-token-123", {
      fieldValues: {},
      signatureClientData: "sig",
    });

    const res = await POST(req, contextParams);

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBeTruthy();

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // ---- בדיקה 7: auditIp נלקח מ-x-forwarded-for ----

  it("auditIp נלקח מה-header x-forwarded-for", async () => {
    const { req, contextParams } = makeRequest(
      "test-token-123",
      { fieldValues: {}, signatureClientData: "sig" },
      { "x-forwarded-for": "203.0.113.42" }
    );

    await POST(req, contextParams);

    expect(mockUpdate).toHaveBeenCalledOnce();
    const callData = mockUpdate.mock.calls[0][0].data;
    expect(callData.auditIp).toBe("203.0.113.42");
  });

  // ---- בדיקה 8: auditDevice נלקח מ-user-agent ----

  it("auditDevice נלקח מה-header user-agent", async () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)";

    const { req, contextParams } = makeRequest(
      "test-token-123",
      { fieldValues: {}, signatureClientData: "sig" },
      { "user-agent": ua }
    );

    await POST(req, contextParams);

    expect(mockUpdate).toHaveBeenCalledOnce();
    const callData = mockUpdate.mock.calls[0][0].data;
    expect(callData.auditDevice).toBe(ua);
  });
});
