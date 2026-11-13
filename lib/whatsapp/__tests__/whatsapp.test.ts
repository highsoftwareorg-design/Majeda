/**
 * lib/whatsapp/__tests__/whatsapp.test.ts
 * Task 6.1 — בדיקות ל-WhatsApp service (Mock ו-Twilio).
 *
 * כל הקריאות ל-Prisma ול-Twilio ממוקות — אין גישה אמיתית ל-DB או לרשת.
 *
 * בדיקות:
 *  1. MockWhatsAppService.sendTemplate — מחזיר externalId שמתחיל ב-MOCK_
 *  2. MockWhatsAppService.sendTemplate — קורא ל-prisma.message.update עם status: 'MOCK'
 *  3. MockWhatsAppService.parseWebhookEvent — מחזיר null תמיד
 *  4. TwilioWhatsAppService — יכול להיווצר ללא שגיאות
 *  5. TwilioWhatsAppService.parseWebhookEvent — מחזיר null כאשר אין שדות רלוונטיים
 *  6. TwilioWhatsAppService.parseWebhookEvent — מחזיר status_update כאשר יש MessageStatus ו-MessageSid
 *  7. TwilioWhatsAppService.parseWebhookEvent — מחזיר inbound_message כאשר יש Body ו-From
 *  8. index.ts — מייצא MockWhatsAppService כאשר WHATSAPP_MODE לא מוגדר
 *  9. index.ts — מייצא TwilioWhatsAppService כאשר WHATSAPP_MODE=real
 *
 * הרצה: `npx vitest run lib/whatsapp`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// --- מוקים (חייבים להיות לפני ה-imports) ---

const { mockPrismaMessageUpdate, mockTwilioCreate, mockValidateRequest } = vi.hoisted(() => ({
  mockPrismaMessageUpdate: vi.fn(),
  mockTwilioCreate: vi.fn().mockResolvedValue({ sid: "TWILIO_SID_123" }),
  mockValidateRequest: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    message: {
      update: mockPrismaMessageUpdate,
    },
  },
}));

// מוק לחבילת twilio — מונע קריאות רשת אמיתיות
vi.mock("twilio", () => {
  const mockTwilioFn = vi.fn(() => ({
    messages: { create: mockTwilioCreate },
  })) as ReturnType<typeof vi.fn> & {
    validateRequest: ReturnType<typeof vi.fn>;
  };
  mockTwilioFn.validateRequest = mockValidateRequest;
  return { default: mockTwilioFn };
});

// --- Imports אחרי המוקים ---

import { MockWhatsAppService } from "@/lib/whatsapp/mock";
import { TwilioWhatsAppService } from "@/lib/whatsapp/twilio";

// --- בדיקות MockWhatsAppService ---

describe("MockWhatsAppService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendTemplate", () => {
    it("מחזיר externalId שמתחיל ב-MOCK_", async () => {
      mockPrismaMessageUpdate.mockResolvedValue({ id: "msg-1", status: "MOCK" });

      const service = new MockWhatsAppService();
      const result = await service.sendTemplate({
        to: "+972501234567",
        templateName: "reminder_template",
        variables: { name: "לקוח בדיקה", date: "15/01/2025" },
        messageId: "msg-1",
      });

      expect(result).toHaveProperty("externalId");
      expect(result.externalId).toMatch(/^MOCK_/);
    });

    it("קורא ל-prisma.message.update עם status: 'MOCK' וה-messageId הנכון", async () => {
      mockPrismaMessageUpdate.mockResolvedValue({ id: "msg-42", status: "MOCK" });

      const service = new MockWhatsAppService();
      await service.sendTemplate({
        to: "+972509876543",
        templateName: "follow_up",
        variables: { treatment: "פנים" },
        messageId: "msg-42",
      });

      expect(mockPrismaMessageUpdate).toHaveBeenCalledOnce();
      expect(mockPrismaMessageUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "msg-42" },
          data: expect.objectContaining({ status: "MOCK" }),
        })
      );
    });

    it("ה-externalId הנמצא ב-DB update זהה לזה שמוחזר", async () => {
      let capturedExternalId: string | undefined;

      mockPrismaMessageUpdate.mockImplementation(
        (args: { data: { externalId?: string } }) => {
          capturedExternalId = args.data.externalId;
          return Promise.resolve({ id: "msg-99", status: "MOCK" });
        }
      );

      const service = new MockWhatsAppService();
      const result = await service.sendTemplate({
        to: "+972501234567",
        templateName: "test",
        variables: {},
        messageId: "msg-99",
      });

      expect(capturedExternalId).toBe(result.externalId);
    });
  });

  describe("parseWebhookEvent", () => {
    it("מחזיר null תמיד (אין webhook אמיתי במצב Mock)", () => {
      const service = new MockWhatsAppService();
      const result = service.parseWebhookEvent({}, "some-signature");
      expect(result).toBeNull();
    });

    it("מחזיר null גם עם payload לא ריק", () => {
      const service = new MockWhatsAppService();
      const result = service.parseWebhookEvent(
        { MessageStatus: "delivered", MessageSid: "SM123" },
        "sig"
      );
      expect(result).toBeNull();
    });
  });
});

// --- בדיקות TwilioWhatsAppService ---

describe("TwilioWhatsAppService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("יכול להיווצר ללא שגיאות (גם עם credentials ריקים)", () => {
    // הקונסטרקטור אינו קורא ל-getTwilioClient — הוא נקרא רק ב-sendTemplate
    expect(() => new TwilioWhatsAppService()).not.toThrow();
  });

  describe("parseWebhookEvent", () => {
    it("מחזיר null כאשר הגוף אינו מכיל שדות רלוונטיים", () => {
      const service = new TwilioWhatsAppService();
      // twilio.validateRequest ממוק ומחזיר true, אך הגוף ריק
      const result = service.parseWebhookEvent({}, "valid-sig");
      expect(result).toBeNull();
    });

    it("מחזיר status_update כאשר יש MessageStatus ו-MessageSid", () => {
      const service = new TwilioWhatsAppService();
      const result = service.parseWebhookEvent(
        { MessageStatus: "delivered", MessageSid: "SM_ABC123", Timestamp: "2025-01-01T12:00:00Z" },
        "valid-sig"
      );

      expect(result).toMatchObject({
        type: "status_update",
        messageId: "SM_ABC123",
        status: "delivered",
        timestamp: "2025-01-01T12:00:00Z",
      });
    });

    it("מחזיר inbound_message כאשר יש Body ו-From", () => {
      const service = new TwilioWhatsAppService();
      const result = service.parseWebhookEvent(
        { Body: "שלום, אני רוצה לקבוע תור", From: "+972501234567", DateSent: "2025-01-01" },
        "valid-sig"
      );

      expect(result).toMatchObject({
        type: "inbound_message",
        from: "+972501234567",
        body: "שלום, אני רוצה לקבוע תור",
        timestamp: "2025-01-01",
      });
    });

    it("מחזיר null כאשר אימות החתימה נכשל", () => {
      // הגדר את המוק להחזיר false לאימות חתימה עבור קריאה אחת
      mockValidateRequest.mockReturnValueOnce(false);

      const service = new TwilioWhatsAppService();
      const result = service.parseWebhookEvent(
        { MessageStatus: "delivered", MessageSid: "SM_XYZ" },
        "invalid-sig"
      );

      expect(result).toBeNull();
    });

    it("validateRequest=false → null גם עם payload תקין של inbound_message (Body + From)", () => {
      mockValidateRequest.mockReturnValueOnce(false);

      const body = { Body: "מאשרת", From: "whatsapp:+972501234567", DateSent: "2025-01-01" };
      const service = new TwilioWhatsAppService();
      const result = service.parseWebhookEvent(body, "invalid-sig");

      expect(mockValidateRequest).toHaveBeenCalledWith(
        expect.any(String),
        "invalid-sig",
        expect.any(String),
        body
      );
      expect(result).toBeNull();
    });
  });
});

// --- בדיקות index.ts (בחירת מימוש לפי WHATSAPP_MODE) ---

describe("whatsappService (בחירת מימוש לפי WHATSAPP_MODE)", () => {
  it("מייצא MockWhatsAppService כאשר WHATSAPP_MODE לא מוגדר", async () => {
    vi.resetModules();
    const originalMode = process.env.WHATSAPP_MODE;
    delete process.env.WHATSAPP_MODE;

    const { whatsappService } = await import("@/lib/whatsapp/index");
    const { MockWhatsAppService: MockCls } = await import("@/lib/whatsapp/mock");

    expect(whatsappService).toBeInstanceOf(MockCls);

    // שחזר את הסביבה המקורית
    if (originalMode !== undefined) {
      process.env.WHATSAPP_MODE = originalMode;
    }
  });

  it("מייצא MockWhatsAppService כאשר WHATSAPP_MODE=mock", async () => {
    vi.resetModules();
    process.env.WHATSAPP_MODE = "mock";

    const { whatsappService } = await import("@/lib/whatsapp/index");
    const { MockWhatsAppService: MockCls } = await import("@/lib/whatsapp/mock");

    expect(whatsappService).toBeInstanceOf(MockCls);

    delete process.env.WHATSAPP_MODE;
  });

  it("מייצא TwilioWhatsAppService כאשר WHATSAPP_MODE=real", async () => {
    vi.resetModules();
    process.env.WHATSAPP_MODE = "real";

    const { whatsappService } = await import("@/lib/whatsapp/index");
    const { TwilioWhatsAppService: TwilioCls } = await import("@/lib/whatsapp/twilio");

    expect(whatsappService).toBeInstanceOf(TwilioCls);

    delete process.env.WHATSAPP_MODE;
  });
});
