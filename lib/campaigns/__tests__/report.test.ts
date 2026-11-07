/**
 * בדיקות ל-lib/campaigns/report.ts — משימה 9.6 (FR-MK-06).
 *
 * בודק:
 * 1. קמפיין עם 3 הודעות (2 DELIVERED, 1 FAILED) →
 *    stats: total=3, delivered=2, failed=1.
 * 2. bookedCount: תור שנוצר בתוך 14 יום ל-sentAt → booked=1.
 *
 * הרצה: `npx vitest run lib/campaigns/__tests__/report.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted
// ---------------------------------------------------------------------------

const {
  mockCampaignFindUnique,
  mockMessageFindMany,
  mockAppointmentCount,
} = vi.hoisted(() => ({
  mockCampaignFindUnique: vi.fn(),
  mockMessageFindMany: vi.fn(),
  mockAppointmentCount: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    campaign: {
      findUnique: mockCampaignFindUnique,
    },
    message: {
      findMany: mockMessageFindMany,
    },
    appointment: {
      count: mockAppointmentCount,
    },
  },
}));

// ---------------------------------------------------------------------------
// Import לאחר ה-mocks
// ---------------------------------------------------------------------------

import { getCampaignReport } from "@/lib/campaigns/report";

// ---------------------------------------------------------------------------
// נתוני עזר
// ---------------------------------------------------------------------------

const BASE_CAMPAIGN = {
  id: "campaign-1",
  name: "קמפיין בדיקה",
  status: "SENT",
  sentAt: null as Date | null,
  scheduledAt: null,
  recipientCount: 3,
  sentCount: 2,
  failedCount: 1,
  createdAt: new Date("2026-11-01T10:00:00Z"),
  updatedAt: new Date("2026-11-01T12:00:00Z"),
  segmentId: "seg-1",
  templateId: "tmpl-1",
  segment: { id: "seg-1", name: "כל הלקוחות" },
  template: {
    id: "tmpl-1",
    name: "test_template",
    body: "שלום {name}!",
    variables: [],
  },
};

function makeMessage(overrides: Partial<{
  id: string;
  clientId: string | null;
  status: string;
  createdAt: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  errorMessage: string | null;
  client: { firstName: string; lastName: string } | null;
}> = {}) {
  return {
    id: "msg-default",
    clientId: "client-1",
    status: "DELIVERED",
    createdAt: new Date("2026-11-01T10:00:00Z"),
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    errorMessage: null,
    client: { firstName: "שרה", lastName: "לוי" },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// בדיקות — 3 הודעות (2 DELIVERED, 1 FAILED)
// ---------------------------------------------------------------------------

describe("getCampaignReport — 3 הודעות (2 DELIVERED, 1 FAILED)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaignFindUnique.mockResolvedValue({ ...BASE_CAMPAIGN, sentAt: null });
    mockMessageFindMany.mockResolvedValue([
      makeMessage({ id: "msg-1", status: "DELIVERED", clientId: "client-1" }),
      makeMessage({ id: "msg-2", status: "DELIVERED", clientId: "client-2" }),
      makeMessage({ id: "msg-3", status: "FAILED", clientId: "client-3", errorMessage: "שגיאה" }),
    ]);
  });

  it("stats.total = 3", async () => {
    const report = await getCampaignReport("campaign-1");
    expect(report).not.toBeNull();
    expect(report!.stats.total).toBe(3);
  });

  it("stats.delivered = 2", async () => {
    const report = await getCampaignReport("campaign-1");
    expect(report!.stats.delivered).toBe(2);
  });

  it("stats.failed = 1", async () => {
    const report = await getCampaignReport("campaign-1");
    expect(report!.stats.failed).toBe(1);
  });

  it("stats.booked = 0 כשאין sentAt", async () => {
    const report = await getCampaignReport("campaign-1");
    expect(report!.stats.booked).toBe(0);
    expect(mockAppointmentCount).not.toHaveBeenCalled();
  });

  it("messages מכיל 3 פריטים", async () => {
    const report = await getCampaignReport("campaign-1");
    expect(report!.messages).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// בדיקות — bookedCount: תור שנוצר בחלון 14 יום
// ---------------------------------------------------------------------------

describe("getCampaignReport — bookedCount עם sentAt", () => {
  const sentAt = new Date("2026-11-01T10:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaignFindUnique.mockResolvedValue({ ...BASE_CAMPAIGN, sentAt });
    // הודעה 1 — SENT (נמסרה) ללקוח-1
    mockMessageFindMany.mockResolvedValue([
      makeMessage({ id: "msg-1", status: "SENT", clientId: "client-1" }),
    ]);
    // תור שנוצר בתוך 14 יום
    mockAppointmentCount.mockResolvedValue(1);
  });

  it("stats.booked = 1 כשיש תור שנוצר בחלון 14 יום", async () => {
    const report = await getCampaignReport("campaign-1");
    expect(report!.stats.booked).toBe(1);
  });

  it("prisma.appointment.count נקרא עם clientId ו-createdAt בחלון נכון", async () => {
    await getCampaignReport("campaign-1");

    expect(mockAppointmentCount).toHaveBeenCalledOnce();
    const callArg = mockAppointmentCount.mock.calls[0][0];

    // clientId חייב לכלול את client-1
    expect(callArg.where.clientId.in).toContain("client-1");
    // createdAt.gte = sentAt
    expect(callArg.where.createdAt.gte).toEqual(sentAt);
    // createdAt.lte = sentAt + 14 ימים
    const expectedWindowEnd = new Date(
      sentAt.getTime() + 14 * 24 * 60 * 60 * 1000
    );
    expect(callArg.where.createdAt.lte).toEqual(expectedWindowEnd);
  });
});

// ---------------------------------------------------------------------------
// בדיקות — קמפיין לא קיים → null
// ---------------------------------------------------------------------------

describe("getCampaignReport — קמפיין לא קיים", () => {
  it("מחזיר null כשהקמפיין לא נמצא", async () => {
    vi.clearAllMocks();
    mockCampaignFindUnique.mockResolvedValue(null);

    const report = await getCampaignReport("non-existent");
    expect(report).toBeNull();
  });
});
