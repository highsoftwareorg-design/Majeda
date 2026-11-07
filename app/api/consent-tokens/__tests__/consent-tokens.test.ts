/**
 * בדיקות API לנקודת קצה POST /api/consent-tokens — משימה 7.4 (FR-CF-06 חלק א').
 *
 * כל קריאות ל-Prisma ו-WhatsAppService ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * בודק:
 * 1. POST תקין → prisma.signedConsent.create נקרא עם signingToken (UUID) ו-signingTokenExpiresAt ~72 שעות.
 * 2. הודעה נוצרת עם sourceType='consent'.
 * 3. קישור החתימה (signingUrl) מכיל '/sign/' + UUID.
 * 4. whatsappService.sendTemplate נקרא עם ה-URL של הטוקן.
 * 5. אידמפוטנטיות: POST שני עם אותם פרמטרים מחזיר existing:true ולא יוצר רשומות חדשות.
 * 6. clientId חסר → 400.
 * 7. לקוח/ה לא נמצאו → 404.
 *
 * הרצה: `npx vitest run app/api/consent-tokens/__tests__/`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני ה-imports של המודולים הממוקים
// ---------------------------------------------------------------------------

const {
  mockSignedConsentFindFirst,
  mockClientFindUnique,
  mockConsentTemplateFindUnique,
  mockSignedConsentCreate,
  mockMessageCreate,
  mockSendTemplate,
} = vi.hoisted(() => ({
  mockSignedConsentFindFirst: vi.fn(),
  mockClientFindUnique: vi.fn(),
  mockConsentTemplateFindUnique: vi.fn(),
  mockSignedConsentCreate: vi.fn(),
  mockMessageCreate: vi.fn(),
  mockSendTemplate: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextRequest: class {
    constructor(public url: string, public init: RequestInit = {}) {}
    async json() {
      return JSON.parse((this.init.body as string) ?? "{}");
    }
  },
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    signedConsent: {
      findFirst: mockSignedConsentFindFirst,
      create: mockSignedConsentCreate,
    },
    client: {
      findUnique: mockClientFindUnique,
    },
    consentTemplate: {
      findUnique: mockConsentTemplateFindUnique,
    },
    message: {
      create: mockMessageCreate,
    },
  },
}));

vi.mock("@/lib/whatsapp/index", () => ({
  whatsappService: {
    sendTemplate: mockSendTemplate,
  },
}));

// ---------------------------------------------------------------------------
// Import handler after mocks
// ---------------------------------------------------------------------------

import { POST } from "@/app/api/consent-tokens/route";

// ---------------------------------------------------------------------------
// נתוני עזר
// ---------------------------------------------------------------------------

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MOCK_CLIENT = {
  id: "client-1",
  firstName: "שרה",
  lastName: "כהן",
  phone: "+972501234567",
};

const MOCK_TEMPLATE = {
  id: "template-1",
  name: "טופס הסכמה כללי",
  version: 1,
  isActive: true,
};

const MOCK_SIGNED_CONSENT = {
  id: "sc-1",
  clientId: "client-1",
  templateId: "template-1",
  appointmentId: null,
  signingToken: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  signingTokenExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
  signedAt: null,
  templateVersion: 1,
  fieldValues: {},
};

const MOCK_MESSAGE = {
  id: "msg-1",
  clientId: "client-1",
  channel: "whatsapp",
  templateId: "consent_signing_link",
  content: { name: "שרה כהן", signingUrl: "https://localhost:3000/sign/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" },
  direction: "outbound",
  status: "PENDING",
  sourceType: "consent",
  sourceId: "sc-1",
};

/** יוצר NextRequest מדומה עם body JSON */
function makeRequest(body: unknown): import("next/server").NextRequest {
  const { NextRequest } = require("next/server");
  return new NextRequest("http://localhost/api/consent-tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as import("next/server").NextRequest;
}

// ---------------------------------------------------------------------------
// בדיקות
// ---------------------------------------------------------------------------

describe("POST /api/consent-tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // ברירת מחדל: אין רשומה קיימת
    mockSignedConsentFindFirst.mockResolvedValue(null);

    // לקוח ותבנית קיימים
    mockClientFindUnique.mockResolvedValue(MOCK_CLIENT);
    mockConsentTemplateFindUnique.mockResolvedValue(MOCK_TEMPLATE);

    // יצירת רשומות מוצלחת
    mockSignedConsentCreate.mockResolvedValue(MOCK_SIGNED_CONSENT);
    mockMessageCreate.mockResolvedValue(MOCK_MESSAGE);

    // שליחת WhatsApp מוצלחת
    mockSendTemplate.mockResolvedValue({ success: true });
  });

  // ---- בדיקה 1: POST תקין יוצר SignedConsent עם signingToken ו-signingTokenExpiresAt ----

  it("POST תקין → prisma.signedConsent.create נקרא עם signingToken (UUID) ו-signingTokenExpiresAt ~72 שעות", async () => {
    const before = Date.now();
    const req = makeRequest({ clientId: "client-1", templateId: "template-1" });

    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockSignedConsentCreate).toHaveBeenCalledOnce();

    const callArg = mockSignedConsentCreate.mock.calls[0][0];
    const data = callArg.data;

    // signingToken צריך להיות UUID
    expect(typeof data.signingToken).toBe("string");
    expect(data.signingToken).toMatch(UUID_REGEX);

    // signedAt לא מוגדר בעת יצירה (טרם חתום)
    expect(data.signedAt).toBeUndefined();

    // signingTokenExpiresAt צריך להיות בין 71.9 ל-72.1 שעות מעכשיו
    const after = Date.now();
    const expiresAt: Date = data.signingTokenExpiresAt;
    expect(expiresAt).toBeInstanceOf(Date);
    const diff = expiresAt.getTime() - before;
    const seventyTwoHoursMs = 72 * 60 * 60 * 1000;
    expect(diff).toBeGreaterThanOrEqual(seventyTwoHoursMs - 1000); // תוך שנייה של ריצה
    expect(diff).toBeLessThanOrEqual(seventyTwoHoursMs + (after - before) + 1000);
  });

  // ---- בדיקה 2: message.create נקרא עם sourceType='consent' ----

  it("prisma.message.create נקרא עם sourceType='consent'", async () => {
    const req = makeRequest({ clientId: "client-1", templateId: "template-1" });

    await POST(req);

    expect(mockMessageCreate).toHaveBeenCalledOnce();
    const callArg = mockMessageCreate.mock.calls[0][0];
    expect(callArg.data.sourceType).toBe("consent");
  });

  // ---- בדיקה 3: signingUrl מכיל '/sign/' + UUID ----

  it("signingUrl ב-content של ההודעה מכיל '/sign/' + UUID", async () => {
    const req = makeRequest({ clientId: "client-1", templateId: "template-1" });

    await POST(req);

    expect(mockMessageCreate).toHaveBeenCalledOnce();
    const callArg = mockMessageCreate.mock.calls[0][0];
    const content = callArg.data.content as Record<string, string>;

    expect(typeof content.signingUrl).toBe("string");
    expect(content.signingUrl).toContain("/sign/");

    // החלק אחרי '/sign/' צריך להיות UUID
    const parts = content.signingUrl.split("/sign/");
    expect(parts.length).toBe(2);
    expect(parts[1]).toMatch(UUID_REGEX);
  });

  // ---- בדיקה 4: whatsappService.sendTemplate נקרא עם ה-URL של הטוקן ----

  it("whatsappService.sendTemplate נקרא עם signingUrl המכיל את הטוקן", async () => {
    const req = makeRequest({ clientId: "client-1", templateId: "template-1" });

    await POST(req);

    expect(mockSendTemplate).toHaveBeenCalledOnce();
    const callArg = mockSendTemplate.mock.calls[0][0];

    // variables.url צריך להכיל '/sign/'
    expect(callArg.variables.url).toContain("/sign/");
    expect(callArg.variables.url).toMatch(/\/sign\/[0-9a-f-]{36}/i);

    // phone של הלקוח
    expect(callArg.to).toBe(MOCK_CLIENT.phone);

    // שם תבנית
    expect(callArg.templateName).toBe("consent_signing_link");
  });

  // ---- בדיקה 5: אידמפוטנטיות ----

  it("אידמפוטנטיות: כשקיים SignedConsent לא חתום בתוקף → מחזיר existing:true, ללא יצירת רשומות חדשות", async () => {
    // מדמה רשומה קיימת לא חתומה
    mockSignedConsentFindFirst.mockResolvedValue(MOCK_SIGNED_CONSENT);

    const req = makeRequest({ clientId: "client-1", templateId: "template-1" });
    const res = await POST(req);

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.existing).toBe(true);
    expect(body.signedConsentId).toBe(MOCK_SIGNED_CONSENT.id);
    expect(body.signingToken).toBe(MOCK_SIGNED_CONSENT.signingToken);

    // לא נוצרו רשומות חדשות
    expect(mockSignedConsentCreate).not.toHaveBeenCalled();
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  // ---- בדיקה 6: clientId חסר → 400 ----

  it("clientId חסר → 400 עם הודעת שגיאה", async () => {
    const req = makeRequest({ templateId: "template-1" });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect((body as Record<string, string>).error).toBeTruthy();

    // לא נגעים ב-DB
    expect(mockSignedConsentCreate).not.toHaveBeenCalled();
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  // ---- בדיקה 7: לקוח/ה לא נמצאו → 404 ----

  it("לקוח/ה לא נמצאו → 404", async () => {
    mockClientFindUnique.mockResolvedValue(null);

    const req = makeRequest({ clientId: "nonexistent-client", templateId: "template-1" });

    const res = await POST(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect((body as Record<string, string>).error).toBeTruthy();

    // לא נוצרו רשומות
    expect(mockSignedConsentCreate).not.toHaveBeenCalled();
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  // ---- בדיקה 8: templateId חסר → 400 ----

  it("templateId חסר → 400 עם הודעת שגיאה", async () => {
    const req = makeRequest({ clientId: "client-1" });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockSignedConsentCreate).not.toHaveBeenCalled();
  });

  // ---- בדיקה 9: body לא-JSON → 400 ----

  it("body לא-JSON → 400", async () => {
    const { NextRequest } = require("next/server");
    const req = new NextRequest("http://localhost/api/consent-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    }) as import("next/server").NextRequest;

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockSignedConsentCreate).not.toHaveBeenCalled();
  });
});
