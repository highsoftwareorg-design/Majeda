/**
 * בדיקות ל-lib/campaigns/sender.ts — משימה 9.5 (FR-MK-04, FR-MK-05).
 *
 * בודק:
 * 1. קמפיין SCHEDULED עם 5 לקוחות → 5 Messages נוצרים עם sourceType='campaign',
 *    Campaign.sentCount=5, Campaign.status='SENT'.
 * 2. לקוח מאורכב אינו בנמענים — getSegmentRecipients מחזיר רק 4 → 4 Messages.
 * 3. קמפיין DRAFT לא נשלח (אינו SCHEDULED/SENDING) → אין Messages.
 *
 * הרצה: `npx vitest run lib/campaigns/__tests__/sender.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted — כל המוקים חייבים להיות מוגדרים לפני ה-import
// ---------------------------------------------------------------------------

const {
  mockCampaignFindMany,
  mockCampaignUpdateMany,
  mockCampaignUpdate,
  mockMessageFindMany,
  mockMessageCreate,
  mockMessageUpdate,
  mockMessageCount,
  mockWhatsappSendTemplate,
  mockGetSegmentRecipients,
} = vi.hoisted(() => ({
  mockCampaignFindMany: vi.fn(),
  mockCampaignUpdateMany: vi.fn(),
  mockCampaignUpdate: vi.fn(),
  mockMessageFindMany: vi.fn(),
  mockMessageCreate: vi.fn(),
  mockMessageUpdate: vi.fn(),
  mockMessageCount: vi.fn(),
  mockWhatsappSendTemplate: vi.fn(),
  mockGetSegmentRecipients: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    campaign: {
      findMany: mockCampaignFindMany,
      updateMany: mockCampaignUpdateMany,
      update: mockCampaignUpdate,
    },
    message: {
      findMany: mockMessageFindMany,
      create: mockMessageCreate,
      update: mockMessageUpdate,
      count: mockMessageCount,
    },
  },
}));

vi.mock("@/lib/whatsapp/index", () => ({
  whatsappService: {
    sendTemplate: mockWhatsappSendTemplate,
  },
}));

vi.mock("@/lib/campaigns/recipients", () => ({
  getSegmentRecipients: mockGetSegmentRecipients,
}));

// ---------------------------------------------------------------------------
// Import לאחר ה-mocks
// ---------------------------------------------------------------------------

import { processCampaigns } from "@/lib/campaigns/sender";

// ---------------------------------------------------------------------------
// נתוני עזר
// ---------------------------------------------------------------------------

function makeRecipient(id: string) {
  return {
    id,
    firstName: "שרה",
    lastName: "לוי",
    phone: "0501234567",
  };
}

const CAMPAIGN = {
  id: "campaign-1",
  segmentId: "seg-1",
  template: { name: "test_template", body: "שלום {name}!" },
};

// ---------------------------------------------------------------------------
// בדיקות — קמפיין SCHEDULED עם 5 לקוחות
// ---------------------------------------------------------------------------

describe("processCampaigns — 5 לקוחות פעילים עם הסכמה, קמפיין SCHEDULED", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // קמפיין SCHEDULED שמועדו הגיע
    mockCampaignFindMany.mockResolvedValueOnce([{ id: "campaign-1" }]);
    // תפיסת הקמפיין (claim SCHEDULED → SENDING)
    mockCampaignUpdateMany.mockResolvedValue({ count: 1 });
    // קמפיין SENDING לעיבוד
    mockCampaignFindMany.mockResolvedValueOnce([CAMPAIGN]);

    // 5 נמענים תקינים
    const recipients = Array.from({ length: 5 }, (_, i) => makeRecipient(`client-${i + 1}`));
    mockGetSegmentRecipients.mockResolvedValue({
      eligible: recipients,
      summary: {
        total: 5,
        withConsent: 5,
        excluded: { noConsent: 0, archived: 0 },
      },
    });

    // אין נמענים שכבר קיבלו הודעה
    mockMessageFindMany.mockResolvedValue([]);

    // יצירת הודעות
    let idx = 0;
    mockMessageCreate.mockImplementation(() =>
      Promise.resolve({ id: `msg-${++idx}` })
    );

    // שליחת WhatsApp מוצלחת
    mockWhatsappSendTemplate.mockResolvedValue({ messageId: "wa-123" });

    // ספירת הודעות: sentCount=5, failedCount=0
    mockMessageCount
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(0);

    mockCampaignUpdate.mockResolvedValue({});
  });

  it("5 Messages נוצרים עם sourceType='campaign'", async () => {
    await processCampaigns();

    expect(mockMessageCreate).toHaveBeenCalledTimes(5);
    for (const call of mockMessageCreate.mock.calls) {
      expect(call[0].data.sourceType).toBe("campaign");
    }
  });

  it("Campaign מתעדכן עם sentCount=5 ו-status='SENT'", async () => {
    await processCampaigns();

    expect(mockCampaignUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "campaign-1" },
        data: expect.objectContaining({
          sentCount: 5,
          status: "SENT",
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// בדיקות — לקוח מאורכב אינו בנמענים
// ---------------------------------------------------------------------------

describe("processCampaigns — לקוח מאורכב אינו בנמענים", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCampaignFindMany.mockResolvedValueOnce([{ id: "campaign-1" }]);
    mockCampaignUpdateMany.mockResolvedValue({ count: 1 });
    mockCampaignFindMany.mockResolvedValueOnce([CAMPAIGN]);

    // מתוך 5 לקוחות בסגמנט, 1 מאורכב → 4 נמענים תקינים בלבד
    const recipients = Array.from({ length: 4 }, (_, i) => makeRecipient(`client-${i + 1}`));
    mockGetSegmentRecipients.mockResolvedValue({
      eligible: recipients,
      summary: {
        total: 5,
        withConsent: 4,
        excluded: { noConsent: 0, archived: 1 },
      },
    });

    mockMessageFindMany.mockResolvedValue([]);
    mockMessageCreate.mockResolvedValue({ id: "msg-x" });
    mockWhatsappSendTemplate.mockResolvedValue({});
    mockMessageCount
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(0);
    mockCampaignUpdate.mockResolvedValue({});
  });

  it("רק 4 Messages נוצרים (לא 5) כי לקוח מאורכב מוחרג", async () => {
    await processCampaigns();

    expect(mockMessageCreate).toHaveBeenCalledTimes(4);
  });
});

// ---------------------------------------------------------------------------
// בדיקות — קמפיין DRAFT לא נשלח
// ---------------------------------------------------------------------------

describe("processCampaigns — קמפיין DRAFT לא נשלח", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // אין קמפיינים SCHEDULED שמועדם הגיע
    mockCampaignFindMany.mockResolvedValueOnce([]);
    // אין קמפיינים SENDING
    mockCampaignFindMany.mockResolvedValueOnce([]);
  });

  it("אין Messages שנוצרים כשאין קמפיינים SCHEDULED/SENDING", async () => {
    await processCampaigns();

    expect(mockMessageCreate).not.toHaveBeenCalled();
    expect(mockWhatsappSendTemplate).not.toHaveBeenCalled();
  });

  it("processCampaigns מחזיר sent=0, claimed=0", async () => {
    const result = await processCampaigns();

    expect(result.sent).toBe(0);
    expect(result.claimed).toBe(0);
    expect(result.completed).toBe(0);
  });
});
