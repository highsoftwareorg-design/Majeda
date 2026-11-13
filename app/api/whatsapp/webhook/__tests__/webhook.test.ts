/**
 * app/api/whatsapp/webhook/__tests__/webhook.test.ts
 * Task 6.6 — בדיקות ל-webhook WhatsApp (GET + POST).
 *
 * בדיקות:
 *  1. POST עם payload "מאשרת" → Appointment.status=CONFIRMED + AppointmentStatusHistory נוצרת
 *  2. POST עם status_update "delivered" → Message.status=DELIVERED ו-deliveredAt מוגדר
 *  3. GET עם verify_token נכון → מחזיר את ה-challenge (200)
 *  4. GET עם verify_token שגוי → 403
 *
 * הרצה: `npx vitest run app/api/whatsapp/webhook`
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים להיות לפני כל import
// ---------------------------------------------------------------------------

const {
  mockParseWebhookEvent,
  mockMessageUpdateMany,
  mockClientFindFirst,
  mockAppointmentFindFirst,
  mockAppointmentUpdate,
  mockAppointmentStatusHistoryCreate,
  mockTransaction,
  mockClientUpdateMany,
} = vi.hoisted(() => ({
  mockParseWebhookEvent: vi.fn(),
  mockMessageUpdateMany: vi.fn().mockResolvedValue({ count: 1 }),
  mockClientFindFirst: vi.fn(),
  mockAppointmentFindFirst: vi.fn(),
  mockAppointmentUpdate: vi.fn(),
  mockAppointmentStatusHistoryCreate: vi.fn(),
  mockTransaction: vi.fn(),
  mockClientUpdateMany: vi.fn().mockResolvedValue({ count: 1 }),
}));

vi.mock("@/lib/whatsapp/index", () => ({
  whatsappService: {
    parseWebhookEvent: mockParseWebhookEvent,
    sendTemplate: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    message: {
      updateMany: mockMessageUpdateMany,
    },
    client: {
      findFirst: mockClientFindFirst,
      updateMany: mockClientUpdateMany,
    },
    appointment: {
      findFirst: mockAppointmentFindFirst,
      update: mockAppointmentUpdate,
    },
    appointmentStatusHistory: {
      create: mockAppointmentStatusHistoryCreate,
    },
    $transaction: mockTransaction,
  },
}));

// ---------------------------------------------------------------------------
// Imports אחרי המוקים
// ---------------------------------------------------------------------------

import { GET, POST } from "@/app/api/whatsapp/webhook/route";

// ---------------------------------------------------------------------------
// עזרים
// ---------------------------------------------------------------------------

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/whatsapp/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(params: Record<string, string>): Request {
  const url = new URL("http://localhost/api/whatsapp/webhook");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url.toString(), { method: "GET" });
}

// ---------------------------------------------------------------------------
// בדיקות
// ---------------------------------------------------------------------------

describe("POST /api/whatsapp/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("payload 'מאשרת' — מעדכן Appointment לסטטוס CONFIRMED ויוצר AppointmentStatusHistory", async () => {
    // הכנת מוקים
    mockParseWebhookEvent.mockReturnValue({
      type: "inbound_message",
      from: "whatsapp:+972501234567",
      body: "מאשרת",
    });

    const fakeClient = { id: "client-1", phone: "+972501234567" };
    const fakeAppointment = {
      id: "appt-1",
      clientId: "client-1",
      status: "SCHEDULED",
      notes: null,
    };

    mockClientFindFirst.mockResolvedValue(fakeClient);
    mockAppointmentFindFirst.mockResolvedValue(fakeAppointment);

    // $transaction מבצע את הפעולות שמועברות אליו
    mockTransaction.mockImplementation(
      async (ops: Array<Promise<unknown>>) => Promise.all(ops)
    );
    mockAppointmentUpdate.mockResolvedValue({ ...fakeAppointment, status: "CONFIRMED" });
    mockAppointmentStatusHistoryCreate.mockResolvedValue({ id: "hist-1" });

    const req = makePostRequest({ dummy: true });
    const response = await POST(req as Parameters<typeof POST>[0]);

    // תמיד 200
    expect(response.status).toBe(200);

    // ה-$transaction נקראה
    expect(mockTransaction).toHaveBeenCalledOnce();

    // appointment.update נקרא עם הארגומנטים הנכונים
    expect(mockAppointmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "appt-1" },
        data: { status: "CONFIRMED" },
      })
    );

    // appointmentStatusHistory.create נקרא עם fromStatus/toStatus נכון
    expect(mockAppointmentStatusHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appointmentId: "appt-1",
          fromStatus: "SCHEDULED",
          toStatus: "CONFIRMED",
          changedBy: "whatsapp_reply",
        }),
      })
    );
  });

  it("status_update 'delivered' — מעדכן Message.status=DELIVERED ומגדיר deliveredAt", async () => {
    mockParseWebhookEvent.mockReturnValue({
      type: "status_update",
      messageId: "SM123",
      status: "delivered",
    });

    const req = makePostRequest({ dummy: true });
    const response = await POST(req as Parameters<typeof POST>[0]);

    expect(response.status).toBe(200);

    expect(mockMessageUpdateMany).toHaveBeenCalledOnce();
    expect(mockMessageUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { externalId: "SM123" },
        data: expect.objectContaining({
          status: "DELIVERED",
          deliveredAt: expect.any(Date),
        }),
      })
    );
  });

  it("מחזיר 200 גם כאשר parseWebhookEvent מחזיר null (אין אירוע)", async () => {
    mockParseWebhookEvent.mockReturnValue(null);

    const req = makePostRequest({ anything: true });
    const response = await POST(req as Parameters<typeof POST>[0]);

    expect(response.status).toBe(200);
    // לא צריך לקרוא לשום עדכון ב-DB
    expect(mockMessageUpdateMany).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("חתימת Twilio לא תקינה (parseWebhookEvent → null) — 200 { received: true } וללא קריאות DB", async () => {
    // payload שהיה מעובד (inbound "מאשרת" עם לקוחה ותור) — אך החתימה נדחית ב-parseWebhookEvent
    mockParseWebhookEvent.mockReturnValue(null);
    mockClientFindFirst.mockResolvedValue({ id: "client-1", phone: "+972501234567" });
    mockAppointmentFindFirst.mockResolvedValue({
      id: "appt-1",
      clientId: "client-1",
      status: "SCHEDULED",
      notes: null,
    });

    const req = new Request("http://localhost/api/whatsapp/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-twilio-signature": "bad-sig",
      },
      body: JSON.stringify({ Body: "מאשרת", From: "whatsapp:+972501234567" }),
    });
    const response = await POST(req as Parameters<typeof POST>[0]);

    // החתימה מועברת ל-parseWebhookEvent מה-header
    expect(mockParseWebhookEvent).toHaveBeenCalledWith(expect.anything(), "bad-sig");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });

    // אף מוק של DB לא נקרא
    expect(mockMessageUpdateMany).not.toHaveBeenCalled();
    expect(mockClientFindFirst).not.toHaveBeenCalled();
    expect(mockClientUpdateMany).not.toHaveBeenCalled();
    expect(mockAppointmentFindFirst).not.toHaveBeenCalled();
    expect(mockAppointmentUpdate).not.toHaveBeenCalled();
    expect(mockAppointmentStatusHistoryCreate).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("מחזיר 200 גם כאשר זורקת שגיאה פנימית (מניעת retry-storm)", async () => {
    mockParseWebhookEvent.mockImplementation(() => {
      throw new Error("network error");
    });

    const req = makePostRequest({ dummy: true });
    const response = await POST(req as Parameters<typeof POST>[0]);

    expect(response.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET — VERIFY_TOKEN נקרא ברמת המודול, לכן כל בדיקה טוענת מחדש את המודול
// עם משתנה הסביבה הנכון כבר מוגדר (vi.resetModules + dynamic import).
// ---------------------------------------------------------------------------

describe("GET /api/whatsapp/webhook", () => {
  afterEach(() => {
    delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  });

  it("verify_token נכון — מחזיר את ה-challenge עם status 200", async () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "testtoken";
    vi.resetModules();
    // טוען מחדש את המסלול אחרי הגדרת ה-env
    const { GET: GETfresh } = await import("@/app/api/whatsapp/webhook/route");

    const req = makeGetRequest({
      "hub.mode": "subscribe",
      "hub.verify_token": "testtoken",
      "hub.challenge": "12345",
    });

    const response = await GETfresh(req as Parameters<typeof GETfresh>[0]);

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("12345");
  });

  it("verify_token שגוי — מחזיר 403", async () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "correcttoken";
    vi.resetModules();
    const { GET: GETfresh } = await import("@/app/api/whatsapp/webhook/route");

    const req = makeGetRequest({
      "hub.mode": "subscribe",
      "hub.verify_token": "wrongtoken",
      "hub.challenge": "99999",
    });

    const response = await GETfresh(req as Parameters<typeof GETfresh>[0]);

    expect(response.status).toBe(403);
  });

  it("hub.mode שגוי — מחזיר 403 גם אם ה-token נכון", async () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "testtoken";
    vi.resetModules();
    const { GET: GETfresh } = await import("@/app/api/whatsapp/webhook/route");

    const req = makeGetRequest({
      "hub.mode": "unsubscribe",
      "hub.verify_token": "testtoken",
      "hub.challenge": "12345",
    });

    const response = await GETfresh(req as Parameters<typeof GETfresh>[0]);

    expect(response.status).toBe(403);
  });
});
