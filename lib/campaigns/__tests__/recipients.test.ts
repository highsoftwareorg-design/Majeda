/**
 * בדיקות ל-lib/campaigns/recipients.ts — משימה 9.4 (FR-MK-03).
 *
 * בודק:
 * 1. סגמנט עם 10 לקוחות, 3 ללא הסכמה → withConsent=7.
 * 2. סגמנט עם 0 לקוחות → total=0, withConsent=0.
 *
 * הרצה: `npx vitest run lib/campaigns/__tests__/recipients.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted
// ---------------------------------------------------------------------------

const { mockSegmentFindUnique, mockListClients } = vi.hoisted(() => ({
  mockSegmentFindUnique: vi.fn(),
  mockListClients: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    segment: {
      findUnique: mockSegmentFindUnique,
    },
  },
}));

vi.mock("@/lib/db/clients", () => ({
  listClients: mockListClients,
}));

// ---------------------------------------------------------------------------
// Import לאחר ה-mocks
// ---------------------------------------------------------------------------

import {
  getSegmentRecipients,
  getCampaignRecipientSummary,
} from "@/lib/campaigns/recipients";

// ---------------------------------------------------------------------------
// נתוני עזר
// ---------------------------------------------------------------------------

function makeClient(overrides: Partial<{
  id: string;
  status: string;
  marketingConsentChannel: string;
  phone: string | null;
  firstName: string;
  lastName: string;
}> = {}) {
  return {
    id: "client-default",
    status: "active",
    marketingConsentChannel: "whatsapp",
    phone: "0501234567",
    firstName: "שרה",
    lastName: "לוי",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// בדיקות — סגמנט עם 10 לקוחות, 3 ללא הסכמה
// ---------------------------------------------------------------------------

describe("getSegmentRecipients — 10 לקוחות, 3 ללא הסכמה", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSegmentFindUnique.mockResolvedValue({ filters: {} });

    // 7 פעילים עם הסכמה + 3 ללא הסכמה (marketingConsentChannel='none')
    const clients = [
      ...Array.from({ length: 7 }, (_, i) =>
        makeClient({ id: `client-active-${i + 1}`, marketingConsentChannel: "whatsapp" })
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        makeClient({ id: `client-noconsent-${i + 1}`, marketingConsentChannel: "none" })
      ),
    ];
    mockListClients.mockResolvedValue(clients);
  });

  it("summary.total = 10", async () => {
    const { summary } = await getSegmentRecipients("seg-1");
    expect(summary.total).toBe(10);
  });

  it("summary.withConsent = 7", async () => {
    const { summary } = await getSegmentRecipients("seg-1");
    expect(summary.withConsent).toBe(7);
  });

  it("summary.excluded.noConsent = 3", async () => {
    const { summary } = await getSegmentRecipients("seg-1");
    expect(summary.excluded.noConsent).toBe(3);
  });

  it("eligible מכיל 7 נמענים עם phone", async () => {
    const { eligible } = await getSegmentRecipients("seg-1");
    expect(eligible).toHaveLength(7);
    for (const r of eligible) {
      expect(r.phone).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// בדיקות — סגמנט עם 0 לקוחות
// ---------------------------------------------------------------------------

describe("getSegmentRecipients — סגמנט ריק (0 לקוחות)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSegmentFindUnique.mockResolvedValue({ filters: {} });
    mockListClients.mockResolvedValue([]);
  });

  it("summary.total = 0", async () => {
    const { summary } = await getSegmentRecipients("seg-empty");
    expect(summary.total).toBe(0);
  });

  it("summary.withConsent = 0", async () => {
    const { summary } = await getSegmentRecipients("seg-empty");
    expect(summary.withConsent).toBe(0);
  });

  it("eligible ריק", async () => {
    const { eligible } = await getSegmentRecipients("seg-empty");
    expect(eligible).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// בדיקות — segmentId null
// ---------------------------------------------------------------------------

describe("getSegmentRecipients — segmentId=null", () => {
  it("מחזיר ספירות אפס ללא שאילתת DB", async () => {
    vi.clearAllMocks();
    const result = await getSegmentRecipients(null);
    expect(result.summary.total).toBe(0);
    expect(result.eligible).toHaveLength(0);
    expect(mockSegmentFindUnique).not.toHaveBeenCalled();
  });
});
