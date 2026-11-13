/**
 * בדיקות אבטחה ל-auth() (משימה 13.4, SRS §11) — יצירת קישור חתימה (מנהלי).
 *
 * POST /api/consent-tokens מוגן ב-`auth()` כפקודה הראשונה. ללא session הוא מחזיר
 * 401 "נדרשת התחברות" ואינו נוגע ב-DB או ב-WhatsApp.
 *
 * הנתיב הציבורי `/api/sign/[token]/submit` אינו נבדק כאן — הוא ציבורי בכוונה.
 *
 * הרצה: `npx vitest run app/api/consent-tokens/__tests__/auth-guard.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני ה-imports של ה-handlers
// ---------------------------------------------------------------------------

const { mockAuth, mockPrisma, mockSendTemplate } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockPrisma = {
    signedConsent: { findFirst: vi.fn(), create: vi.fn() },
    client: { findUnique: vi.fn() },
    consentTemplate: { findUnique: vi.fn() },
    message: { create: vi.fn() },
  };
  const mockSendTemplate = vi.fn();
  return { mockAuth, mockPrisma, mockSendTemplate };
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

vi.mock("@/lib/whatsapp/index", () => ({
  whatsappService: { sendTemplate: mockSendTemplate },
}));

// ---------------------------------------------------------------------------
// Import handler after mocks
// ---------------------------------------------------------------------------

import { POST } from "@/app/api/consent-tokens/route";

// ---------------------------------------------------------------------------
// עזרים
// ---------------------------------------------------------------------------

function req(body: unknown): Request {
  return new Request("http://localhost/api/consent-tokens", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** אף קריאה ל-DB או ל-WhatsApp לא בוצעה. */
function expectNoDbOrServiceCalls() {
  const fns = [
    mockPrisma.signedConsent.findFirst,
    mockPrisma.signedConsent.create,
    mockPrisma.client.findUnique,
    mockPrisma.consentTemplate.findUnique,
    mockPrisma.message.create,
    mockSendTemplate,
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

describe("POST /api/consent-tokens — אבטחה", () => {
  it("ללא session → 401 ואינו יוצר SignedConsent ואינו שולח WhatsApp", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await POST(
      req({ clientId: "client-1", templateId: "tpl-1" }) as never
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("נדרשת התחברות");
    expectNoDbOrServiceCalls();
  });
});
