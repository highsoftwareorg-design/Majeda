/**
 * lib/whatsapp/__tests__/reminders.test.ts
 * Tasks 6.4 / 6.5 — בדיקות ל-sendReminders24h, sendReminders3h וה-cron handler.
 *
 * כל הקריאות ל-Prisma, ל-WhatsApp service ולבדיקות שעות שקטות ממוקות.
 * אין גישה אמיתית ל-DB או לרשת.
 *
 * בדיקות sendReminders24h:
 *  1. תור 24h קדימה עם reminder24hSentAt=null, status=SCHEDULED → Message נוצרת (PENDING), reminder24hSentAt מסומן
 *  2. תור 24h קדימה אך reminder24hSentAt כבר מסומן → לא מעובד (idempotency)
 *  3. תור 48h קדימה (מחוץ לחלון) → לא נשלח
 *
 * בדיקות sendReminders3h:
 *  4. תור 3h קדימה עם reminder3hSentAt=null → Message נוצרת, reminder3hSentAt מסומן
 *  5. תור 3h קדימה אך reminder3hSentAt כבר מסומן → לא מעובד
 *
 * בדיקות cron handler (GET /api/cron/run):
 *  6. GET ללא Authorization header → 401
 *  7. GET עם Authorization: Bearer <CRON_SECRET> נכון → 200 עם { ok: true, results }
 *
 * הרצה: `npx vitest run lib/whatsapp/__tests__/reminders.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// --- מוקים (חייבים להיות לפני ה-imports) ---

const {
  mockFindMany,
  mockMessageCreate,
  mockAppointmentUpdate,
  mockSendTemplate,
  mockIsQuietHour,
  mockIsShabbat,
} = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockMessageCreate: vi.fn(),
  mockAppointmentUpdate: vi.fn(),
  mockSendTemplate: vi.fn().mockResolvedValue({ externalId: "MOCK_TEST_123" }),
  mockIsQuietHour: vi.fn().mockReturnValue(false),
  mockIsShabbat: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    appointment: {
      findMany: mockFindMany,
      update: mockAppointmentUpdate,
    },
    message: {
      create: mockMessageCreate,
    },
  },
}));

vi.mock("@/lib/whatsapp/index", () => ({
  whatsappService: {
    sendTemplate: mockSendTemplate,
    parseWebhookEvent: vi.fn().mockReturnValue(null),
  },
}));

vi.mock("@/lib/whatsapp/quiet-hours", () => ({
  isQuietHour: mockIsQuietHour,
  isShabbat: mockIsShabbat,
}));

// מוק ל-next/server — נדרש לבדיקות ה-cron handler
vi.mock("next/server", () => ({
  NextRequest: class MockNextRequest {
    private _headers: Map<string, string>;
    constructor(_url: string, init?: { headers?: Record<string, string> }) {
      this._headers = new Map(Object.entries(init?.headers ?? {}));
    }
    get headers() {
      return { get: (k: string) => this._headers.get(k) ?? null };
    }
  },
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

// --- imports אחרי המוקים ---

import { sendReminders24h, sendReminders3h } from "@/lib/whatsapp/reminders";

// --- נתוני עזר ---

function makeAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: "appt-1",
    clientId: "client-1",
    startTime: new Date(),
    endTime: new Date(),
    status: "SCHEDULED",
    reminder24hSentAt: null,
    reminder3hSentAt: null,
    treatmentId: "treatment-1",
    therapist: "מג׳ידה",
    room: "חדר 1",
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    client: {
      id: "client-1",
      firstName: "שרה",
      lastName: "לוי",
      phone: "+972501234567",
      email: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    treatment: {
      id: "treatment-1",
      name: "טיפול פנים",
      durationMinutes: 60,
      price: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    ...overrides,
  };
}

const FAKE_MESSAGE = {
  id: "msg-1",
  clientId: "client-1",
  channel: "whatsapp",
  templateId: "appointment_reminder_24h",
  status: "PENDING",
  sourceType: "appointment",
  sourceId: "appt-1",
  direction: "outbound",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ════════════════════════════════════════════════════════════════════════════════
// sendReminders24h
// ════════════════════════════════════════════════════════════════════════════════

describe("sendReminders24h", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsQuietHour.mockReturnValue(false);
    mockIsShabbat.mockReturnValue(false);
    mockMessageCreate.mockResolvedValue(FAKE_MESSAGE);
    mockAppointmentUpdate.mockResolvedValue({});
    mockSendTemplate.mockResolvedValue({ externalId: "MOCK_TEST_123" });
  });

  it("1. תור 24h קדימה עם reminder24hSentAt=null, status=SCHEDULED — יוצר Message ומסמן reminder24hSentAt", async () => {
    const apt = makeAppointment({ status: "SCHEDULED", reminder24hSentAt: null });
    // findMany מחזיר את התור הזה (כי הוא עומד בתנאי החלון)
    mockFindMany.mockResolvedValue([apt]);

    const result = await sendReminders24h();

    // Message נוצרה
    expect(mockMessageCreate).toHaveBeenCalledOnce();
    expect(mockMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: "client-1",
          channel: "whatsapp",
          templateId: "appointment_reminder_24h",
          status: "PENDING",
          sourceType: "appointment",
          sourceId: "appt-1",
          direction: "outbound",
        }),
      })
    );

    // sendTemplate נקראה
    expect(mockSendTemplate).toHaveBeenCalledOnce();
    expect(mockSendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+972501234567",
        templateName: "appointment_reminder_24h",
      })
    );

    // appointment.update נקרא כדי לסמן reminder24hSentAt
    expect(mockAppointmentUpdate).toHaveBeenCalledOnce();
    expect(mockAppointmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "appt-1" },
        data: expect.objectContaining({
          reminder24hSentAt: expect.any(Date),
        }),
      })
    );

    // ספירות
    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it("2. תור עם reminder24hSentAt כבר מסומן — לא מעובד (idempotency)", async () => {
    // findMany מחזיר רשימה ריקה כי Prisma מסנן reminder24hSentAt: null
    // — זה ההתנהגות הנכונה: השאילתה עצמה מסננת את השדה
    mockFindMany.mockResolvedValue([]);

    const result = await sendReminders24h();

    expect(mockMessageCreate).not.toHaveBeenCalled();
    expect(mockSendTemplate).not.toHaveBeenCalled();
    expect(mockAppointmentUpdate).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it("3. תור 48h קדימה (מחוץ לחלון 23:50–24:10) — לא נשלח", async () => {
    // findMany מחזיר ריק כי 48h לא עומד בתנאי startTime בין windowStart ל-windowEnd
    mockFindMany.mockResolvedValue([]);

    const result = await sendReminders24h();

    expect(mockMessageCreate).not.toHaveBeenCalled();
    expect(mockSendTemplate).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
  });

  it("3b. בשעת שקט — תור נדלג (skipped++), לא נשלחת הודעה", async () => {
    mockIsQuietHour.mockReturnValue(true);
    const apt = makeAppointment({ status: "SCHEDULED", reminder24hSentAt: null });
    mockFindMany.mockResolvedValue([apt]);

    const result = await sendReminders24h();

    expect(mockMessageCreate).not.toHaveBeenCalled();
    expect(mockSendTemplate).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("3c. בשבת — תור נדלג, לא נשלחת הודעה", async () => {
    mockIsShabbat.mockReturnValue(true);
    const apt = makeAppointment({ status: "SCHEDULED", reminder24hSentAt: null });
    mockFindMany.mockResolvedValue([apt]);

    const result = await sendReminders24h();

    expect(mockMessageCreate).not.toHaveBeenCalled();
    expect(mockSendTemplate).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("3d. לקוח ללא טלפון — תור נדלג", async () => {
    const apt = makeAppointment({
      status: "SCHEDULED",
      reminder24hSentAt: null,
      client: { id: "client-1", firstName: "שרה", lastName: "לוי", phone: null },
    });
    mockFindMany.mockResolvedValue([apt]);

    const result = await sendReminders24h();

    expect(mockMessageCreate).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("חלון שאילתה — findMany נקרא עם תנאי reminder24hSentAt: null ו-status in [SCHEDULED, CONFIRMED]", async () => {
    mockFindMany.mockResolvedValue([]);

    await sendReminders24h();

    expect(mockFindMany).toHaveBeenCalledOnce();
    const callArgs = mockFindMany.mock.calls[0][0] as {
      where: {
        reminder24hSentAt: null;
        status: { in: string[] };
        startTime: { gte: Date; lte: Date };
      };
    };
    expect(callArgs.where.reminder24hSentAt).toBeNull();
    expect(callArgs.where.status.in).toContain("SCHEDULED");
    expect(callArgs.where.status.in).toContain("CONFIRMED");
    // החלון: windowStart ≈ now+23h50m, windowEnd ≈ now+24h10m
    const now = Date.now();
    const windowStart = callArgs.where.startTime.gte.getTime();
    const windowEnd = callArgs.where.startTime.lte.getTime();
    // windowStart צריך להיות סביב 23:50 מעכשיו (בין 23:40 ל-24:00)
    expect(windowStart).toBeGreaterThan(now + (24 * 60 - 20) * 60 * 1000);
    expect(windowStart).toBeLessThan(now + 24 * 60 * 60 * 1000);
    // windowEnd צריך להיות סביב 24:10 מעכשיו
    expect(windowEnd).toBeGreaterThan(now + 24 * 60 * 60 * 1000);
    expect(windowEnd).toBeLessThan(now + (24 * 60 + 20) * 60 * 1000);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// sendReminders3h
// ════════════════════════════════════════════════════════════════════════════════

describe("sendReminders3h", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsQuietHour.mockReturnValue(false);
    mockIsShabbat.mockReturnValue(false);
    mockMessageCreate.mockResolvedValue({ ...FAKE_MESSAGE, templateId: "appointment_reminder_3h" });
    mockAppointmentUpdate.mockResolvedValue({});
    mockSendTemplate.mockResolvedValue({ externalId: "MOCK_3H_123" });
  });

  it("4. תור 3h קדימה עם reminder3hSentAt=null — יוצר Message ומסמן reminder3hSentAt", async () => {
    const apt = makeAppointment({ status: "SCHEDULED", reminder3hSentAt: null });
    mockFindMany.mockResolvedValue([apt]);

    const result = await sendReminders3h();

    // Message נוצרה
    expect(mockMessageCreate).toHaveBeenCalledOnce();
    expect(mockMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          templateId: "appointment_reminder_3h",
          status: "PENDING",
          sourceType: "appointment",
          sourceId: "appt-1",
        }),
      })
    );

    // sendTemplate נקראה
    expect(mockSendTemplate).toHaveBeenCalledOnce();
    expect(mockSendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+972501234567",
        templateName: "appointment_reminder_3h",
      })
    );

    // appointment.update נקרא כדי לסמן reminder3hSentAt
    expect(mockAppointmentUpdate).toHaveBeenCalledOnce();
    expect(mockAppointmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "appt-1" },
        data: expect.objectContaining({
          reminder3hSentAt: expect.any(Date),
        }),
      })
    );

    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it("5. תור עם reminder3hSentAt כבר מסומן — לא מעובד (idempotency)", async () => {
    // findMany מחזיר ריק כי Prisma מסנן reminder3hSentAt: null
    mockFindMany.mockResolvedValue([]);

    const result = await sendReminders3h();

    expect(mockMessageCreate).not.toHaveBeenCalled();
    expect(mockSendTemplate).not.toHaveBeenCalled();
    expect(mockAppointmentUpdate).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
  });

  it("5b. חלון שאילתה — findMany נקרא עם תנאי reminder3hSentAt: null וחלון 2:50–3:10", async () => {
    mockFindMany.mockResolvedValue([]);

    await sendReminders3h();

    expect(mockFindMany).toHaveBeenCalledOnce();
    const callArgs = mockFindMany.mock.calls[0][0] as {
      where: {
        reminder3hSentAt: null;
        status: { in: string[] };
        startTime: { gte: Date; lte: Date };
      };
    };
    expect(callArgs.where.reminder3hSentAt).toBeNull();
    expect(callArgs.where.status.in).toContain("SCHEDULED");
    expect(callArgs.where.status.in).toContain("CONFIRMED");
    // החלון: windowStart ≈ now+2:50, windowEnd ≈ now+3:10
    const now = Date.now();
    const windowStart = callArgs.where.startTime.gte.getTime();
    const windowEnd = callArgs.where.startTime.lte.getTime();
    expect(windowStart).toBeGreaterThan(now + (3 * 60 - 20) * 60 * 1000);
    expect(windowStart).toBeLessThan(now + 3 * 60 * 60 * 1000);
    expect(windowEnd).toBeGreaterThan(now + 3 * 60 * 60 * 1000);
    expect(windowEnd).toBeLessThan(now + (3 * 60 + 20) * 60 * 1000);
  });

  it("5c. בשבת — תור נדלג (skipped++), לא נשלחת הודעה", async () => {
    mockIsShabbat.mockReturnValue(true);
    const apt = makeAppointment({ status: "CONFIRMED", reminder3hSentAt: null });
    mockFindMany.mockResolvedValue([apt]);

    const result = await sendReminders3h();

    expect(mockMessageCreate).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /api/cron/run — cron handler
// ════════════════════════════════════════════════════════════════════════════════

describe("GET /api/cron/run", () => {
  const CRON_SECRET = "test-cron-secret-xyz";

  // מוקים ל-reminders — מוגדרים כאן ברמת ה-describe
  const mockSendReminders24h = vi.fn().mockResolvedValue({ sent: 2, skipped: 0 });
  const mockSendReminders3h = vi.fn().mockResolvedValue({ sent: 1, skipped: 1 });

  // מוק לרמת ה-describe — לא ניתן להשתמש ב-vi.mock בתוך describe, אז נשתמש ב-vi.doMock
  // הפתרון: test helper שמוק את המודול מחדש עם vi.mock ב-top level
  // ונשתמש ב-dynamic import בתוך כל בדיקה

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
  });

  it("6. GET ללא Authorization header — מחזיר 401", async () => {
    // ייבוא דינמי אחרי הגדרת CRON_SECRET
    const { GET } = await import("@/app/api/cron/run/route");

    // בניית בקשה ללא header
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/api/cron/run", {
      headers: {},
    });

    const res = await GET(req as Parameters<typeof GET>[0]);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("6b. GET עם Authorization header שגוי — מחזיר 401", async () => {
    const { GET } = await import("@/app/api/cron/run/route");
    const { NextRequest } = await import("next/server");

    const req = new NextRequest("http://localhost/api/cron/run", {
      headers: { authorization: "Bearer wrong-secret" },
    });

    const res = await GET(req as Parameters<typeof GET>[0]);
    expect(res.status).toBe(401);
  });

  it("7. GET עם Authorization: Bearer <CRON_SECRET> נכון — מחזיר 200 עם { ok: true, results }", async () => {
    // findMany מחזיר ריק לשתי הפונקציות (הן מממשות את הלוגיקה עצמן)
    mockFindMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/cron/run/route");
    const { NextRequest } = await import("next/server");

    const req = new NextRequest("http://localhost/api/cron/run", {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });

    const res = await GET(req as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("ok", true);
    expect(body).toHaveProperty("results");
    expect(body.results).toHaveProperty("reminders24h");
    expect(body.results).toHaveProperty("reminders3h");
  });
});
