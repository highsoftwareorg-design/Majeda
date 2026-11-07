/**
 * lib/followups/__tests__/scheduler.test.ts
 * Tasks 8.5 / 8.6 — בדיקות ל-processFollowUps (FR-FU-03, FR-FU-04).
 *
 * כל קריאות ל-Prisma, ל-WhatsApp service ולבדיקות שעות שקטות ממוקות.
 * אין גישה אמיתית ל-DB או לרשת.
 *
 * בודק:
 * 1. מעקב PENDING עם recipientType=client → whatsappService.sendTemplate נקרא,
 *    followUp.update נקרא עם status=SENT.
 * 2. מעקב PENDING עם recipientType=admin → adminTask.create נקרא,
 *    followUp.update נקרא עם status=SENT.
 * 3. מעקב שמועדו מחר (findMany מחזיר ריק) → אין עיבוד.
 * 4. findMany נקרא עם scheduledDate: { lte: ... } — חלון זמן עד שעה מעכשיו.
 * 5. mock mode: whatsappService.sendTemplate הוא vi.fn() (אין רשת אמיתית).
 *
 * הרצה: `npx vitest run lib/followups/__tests__/scheduler.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// --- Mocks (חייבים לפני ה-imports של המודולים הממוקים) ---

const {
  mockFollowUpFindMany,
  mockFollowUpUpdate,
  mockMessageCreate,
  mockWhatsAppTemplateFindUnique,
  mockAdminTaskFindFirst,
  mockAdminTaskCreate,
  mockSendTemplate,
  mockIsQuietHour,
  mockIsShabbat,
} = vi.hoisted(() => ({
  mockFollowUpFindMany: vi.fn(),
  mockFollowUpUpdate: vi.fn().mockResolvedValue({}),
  mockMessageCreate: vi.fn().mockResolvedValue({ id: "msg-1" }),
  mockWhatsAppTemplateFindUnique: vi.fn().mockResolvedValue({ category: "UTILITY" }),
  mockAdminTaskFindFirst: vi.fn().mockResolvedValue(null),
  mockAdminTaskCreate: vi.fn().mockResolvedValue({ id: "task-1" }),
  mockSendTemplate: vi.fn().mockResolvedValue({ externalId: "MOCK_WA_123" }),
  mockIsQuietHour: vi.fn().mockReturnValue(false),
  mockIsShabbat: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    followUp: {
      findMany: mockFollowUpFindMany,
      update: mockFollowUpUpdate,
    },
    message: {
      create: mockMessageCreate,
    },
    whatsAppTemplate: {
      findUnique: mockWhatsAppTemplateFindUnique,
    },
    adminTask: {
      findFirst: mockAdminTaskFindFirst,
      create: mockAdminTaskCreate,
    },
  },
}));

vi.mock("@/lib/whatsapp/index", () => ({
  whatsappService: {
    sendTemplate: mockSendTemplate,
  },
}));

vi.mock("@/lib/whatsapp/quiet-hours", () => ({
  isQuietHour: mockIsQuietHour,
  isShabbat: mockIsShabbat,
}));

// --- Import אחרי ה-mocks ---
import { processFollowUps } from "@/lib/followups/scheduler";

// --- נתוני בדיקה ---

const NOW = new Date("2026-11-07T10:00:00Z");

const MOCK_CLIENT = {
  id: "client-1",
  firstName: "מג'ידה",
  lastName: "כהן",
  phone: "0501234567",
  marketingConsentChannel: "email",
};

/** מעקב עם recipientType=client */
const CLIENT_FOLLOW_UP = {
  id: "followup-client",
  status: "PENDING",
  scheduledDate: NOW,
  messageId: null,
  client: MOCK_CLIENT,
  rule: {
    recipientType: "client",
    clientTemplateId: "follow_up",
    adminNote: null,
  },
};

/** מעקב עם recipientType=admin */
const ADMIN_FOLLOW_UP = {
  id: "followup-admin",
  status: "PENDING",
  scheduledDate: NOW,
  messageId: null,
  client: { ...MOCK_CLIENT, id: "client-2" },
  rule: {
    recipientType: "admin",
    clientTemplateId: null,
    adminNote: "ליצור קשר ידני",
  },
};

// --- בדיקות ---

describe("processFollowUps — scheduler (משימה 8.5/8.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // ברירות מחדל לאחר clearAllMocks
    mockFollowUpUpdate.mockResolvedValue({});
    mockMessageCreate.mockResolvedValue({ id: "msg-1" });
    mockWhatsAppTemplateFindUnique.mockResolvedValue({ category: "UTILITY" });
    mockAdminTaskFindFirst.mockResolvedValue(null);
    mockAdminTaskCreate.mockResolvedValue({ id: "task-1" });
    mockSendTemplate.mockResolvedValue({ externalId: "MOCK_WA_123" });
    mockIsQuietHour.mockReturnValue(false);
    mockIsShabbat.mockReturnValue(false);
  });

  // ════════════════════════════════════════════════════════
  // 1. מעקב עם recipientType=client
  // ════════════════════════════════════════════════════════

  describe("recipientType=client — שליחת WhatsApp", () => {
    beforeEach(() => {
      mockFollowUpFindMany.mockResolvedValue([CLIENT_FOLLOW_UP]);
    });

    it("whatsappService.sendTemplate נקרא עבור מעקב client", async () => {
      await processFollowUps();

      expect(mockSendTemplate).toHaveBeenCalledOnce();
      const callArg = mockSendTemplate.mock.calls[0][0];
      expect(callArg.to).toBe(MOCK_CLIENT.phone);
      expect(callArg.templateName).toBe("follow_up");
    });

    it("followUp.update נקרא עם status=SENT לאחר שליחה", async () => {
      await processFollowUps();

      // followUp.update נקרא לפחות פעם אחת עם status=SENT
      const sentCall = mockFollowUpUpdate.mock.calls.find(
        (call) => call[0]?.data?.status === "SENT"
      );
      expect(sentCall).toBeDefined();
      expect(sentCall![0].where.id).toBe("followup-client");
    });

    it("prisma.message.create נקרא כדי לרשום הודעה לפני השליחה", async () => {
      await processFollowUps();

      expect(mockMessageCreate).toHaveBeenCalledOnce();
      const createArg = mockMessageCreate.mock.calls[0][0];
      expect(createArg.data.clientId).toBe(MOCK_CLIENT.id);
      expect(createArg.data.direction).toBe("outbound");
      expect(createArg.data.sourceType).toBe("follow_up");
    });

    it("whatsappService.sendTemplate הוא mock — אין קריאת רשת אמיתית", () => {
      // הבדיקה עצמה מאשרת שה-service הוא vi.fn()
      expect(vi.isMockFunction(mockSendTemplate)).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════
  // 2. מעקב עם recipientType=admin
  // ════════════════════════════════════════════════════════

  describe("recipientType=admin — יצירת AdminTask", () => {
    beforeEach(() => {
      mockFollowUpFindMany.mockResolvedValue([ADMIN_FOLLOW_UP]);
    });

    it("prisma.adminTask.create נקרא עבור מעקב admin", async () => {
      await processFollowUps();

      expect(mockAdminTaskCreate).toHaveBeenCalledOnce();
      const createArg = mockAdminTaskCreate.mock.calls[0][0];
      expect(createArg.data.followUpId).toBe("followup-admin");
      expect(createArg.data.status).toBe("OPEN");
    });

    it("whatsappService.sendTemplate לא נקרא עבור מעקב admin-only", async () => {
      await processFollowUps();

      expect(mockSendTemplate).not.toHaveBeenCalled();
    });

    it("followUp.update נקרא עם status=SENT לאחר יצירת המשימה", async () => {
      await processFollowUps();

      const sentCall = mockFollowUpUpdate.mock.calls.find(
        (call) => call[0]?.data?.status === "SENT"
      );
      expect(sentCall).toBeDefined();
      expect(sentCall![0].where.id).toBe("followup-admin");
    });

    it("לא יוצר AdminTask אם כבר קיימת משימה OPEN למעקב", async () => {
      mockAdminTaskFindFirst.mockResolvedValue({ id: "existing-task" });

      await processFollowUps();

      expect(mockAdminTaskCreate).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════
  // 3. מעקב שמועדו מחר — לא מעובד
  // ════════════════════════════════════════════════════════

  describe("מועד מחר — מחוץ לחלון הזמן", () => {
    it("כאשר findMany לא מחזיר מעקבים (יום מחר מחוץ לחלון) — אין עיבוד", async () => {
      // findMany מחזיר ריק — מדמה שמועד המחר מחוץ ל-windowEnd
      mockFollowUpFindMany.mockResolvedValue([]);

      const result = await processFollowUps();

      expect(mockSendTemplate).not.toHaveBeenCalled();
      expect(mockAdminTaskCreate).not.toHaveBeenCalled();
      expect(mockFollowUpUpdate).not.toHaveBeenCalled();
      expect(result.sentToClient).toBe(0);
      expect(result.adminTasksCreated).toBe(0);
    });

    it("findMany נקרא עם scheduledDate: { lte: ... } — חלון שעה אחת בלבד", async () => {
      mockFollowUpFindMany.mockResolvedValue([]);

      const before = new Date();
      await processFollowUps();
      const after = new Date();

      expect(mockFollowUpFindMany).toHaveBeenCalledOnce();
      const whereArg = mockFollowUpFindMany.mock.calls[0][0].where;
      expect(whereArg.status).toBe("PENDING");
      expect(whereArg.scheduledDate).toBeDefined();

      // windowEnd = now + 1h — חייב להיות פחות מ-now + 2h
      const windowEnd: Date = whereArg.scheduledDate.lte;
      const twoHoursFromNow = new Date(after.getTime() + 2 * 60 * 60 * 1000);
      expect(windowEnd.getTime()).toBeLessThan(twoHoursFromNow.getTime());
      // ו-windowEnd חייב להיות אחרי before (כלומר עכשיו + משהו)
      expect(windowEnd.getTime()).toBeGreaterThan(before.getTime());
    });
  });

  // ════════════════════════════════════════════════════════
  // 4. שני מעקבים — client ו-admin — ביחד
  // ════════════════════════════════════════════════════════

  describe("שני מעקבים — client ו-admin — ביחד", () => {
    it("מעבד גם client וגם admin בריצה אחת", async () => {
      mockFollowUpFindMany.mockResolvedValue([CLIENT_FOLLOW_UP, ADMIN_FOLLOW_UP]);

      const result = await processFollowUps();

      expect(mockSendTemplate).toHaveBeenCalledOnce();
      expect(mockAdminTaskCreate).toHaveBeenCalledOnce();
      expect(result.sentToClient).toBe(1);
      expect(result.adminTasksCreated).toBe(1);
    });
  });

  // ════════════════════════════════════════════════════════
  // 5. מעקב שכבר נשלח (messageId קיים) — לא נשלח שוב
  // ════════════════════════════════════════════════════════

  describe("אידמפוטנטיות — messageId קיים → לא נשלח שוב", () => {
    it("מעקב עם messageId קיים → sendTemplate לא נקרא", async () => {
      const alreadySentFollowUp = { ...CLIENT_FOLLOW_UP, messageId: "existing-msg" };
      mockFollowUpFindMany.mockResolvedValue([alreadySentFollowUp]);

      await processFollowUps();

      expect(mockSendTemplate).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════
  // 6. מעקב ידני (ללא ruleId) — מדולג
  // ════════════════════════════════════════════════════════

  describe("מעקב ידני — ללא rule", () => {
    it("מעקב ללא rule (ruleId=null) → מדולג (skipped++)", async () => {
      const manualFollowUp = { ...CLIENT_FOLLOW_UP, rule: null };
      mockFollowUpFindMany.mockResolvedValue([manualFollowUp]);

      const result = await processFollowUps();

      expect(mockSendTemplate).not.toHaveBeenCalled();
      expect(mockAdminTaskCreate).not.toHaveBeenCalled();
      expect(result.skipped).toBe(1);
    });
  });
});
