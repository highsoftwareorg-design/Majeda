/**
 * בדיקות אבטחה ל-auth() (משימה 13.5, SRS §11) — תחום קמפיינים.
 *
 * כל handler מוגן ב-`auth()` כפקודה הראשונה. ללא session הם מחזירים
 * 401 "נדרשת התחברות" ואינם נוגעים ב-DB, בשירות ה-WhatsApp או במודולי הקמפיין.
 * במיוחד: POST /api/campaigns/:id/send (שליחת WhatsApp לכל הנמענים) ו-POST /test.
 *
 * כל מודולי ה-DB/השירותים ממוקים — אין טעינה אמיתית של Prisma או Twilio.
 *
 * הרצה: `npx vitest run app/api/campaigns/__tests__/auth-guard.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני ה-imports של ה-handlers
// ---------------------------------------------------------------------------

const { mockAuth, mockPrisma, mockWhatsApp, mockLib } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockPrisma = {
    campaign: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    segment: { findUnique: vi.fn() },
    whatsAppTemplate: { findUnique: vi.fn() },
    message: { create: vi.fn(), update: vi.fn() },
  };
  const mockWhatsApp = { sendTemplate: vi.fn() };
  const mockLib = {
    getCampaignReport: vi.fn(),
    getCampaignRecipientSummary: vi.fn(),
  };
  return { mockAuth, mockPrisma, mockWhatsApp, mockLib };
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
  whatsappService: mockWhatsApp,
}));

vi.mock("@/lib/campaigns/report", () => ({
  getCampaignReport: mockLib.getCampaignReport,
}));

vi.mock("@/lib/campaigns/recipients", () => ({
  getCampaignRecipientSummary: mockLib.getCampaignRecipientSummary,
}));

// ---------------------------------------------------------------------------
// Import handlers after mocks
// ---------------------------------------------------------------------------

import { GET as GET_CAMPAIGNS, POST as POST_CAMPAIGNS } from "@/app/api/campaigns/route";
import {
  GET as GET_CAMPAIGN,
  PATCH as PATCH_CAMPAIGN,
  DELETE as DELETE_CAMPAIGN,
} from "@/app/api/campaigns/[id]/route";
import { POST as POST_SEND } from "@/app/api/campaigns/[id]/send/route";
import { POST as POST_TEST } from "@/app/api/campaigns/[id]/test/route";
import { GET as GET_REPORT } from "@/app/api/campaigns/[id]/report/route";
import { GET as GET_RECIPIENT_COUNT } from "@/app/api/campaigns/[id]/recipients/count/route";

// ---------------------------------------------------------------------------
// עזרים
// ---------------------------------------------------------------------------

const BASE = "http://localhost";

function req(path: string, method = "GET", body?: unknown): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function ctx(id = "camp-1") {
  return { params: Promise.resolve({ id }) };
}

async function expectUnauthorized(res: Response) {
  expect(res.status).toBe(401);
  const body = await res.json();
  expect(body.error).toBe("נדרשת התחברות");
}

/** אף קריאה ל-DB או לשירות WhatsApp/קמפיין לא בוצעה. */
function expectNoDbOrServiceCalls() {
  const fns = [
    mockPrisma.campaign.create,
    mockPrisma.campaign.findMany,
    mockPrisma.campaign.findUnique,
    mockPrisma.campaign.update,
    mockPrisma.segment.findUnique,
    mockPrisma.whatsAppTemplate.findUnique,
    mockPrisma.message.create,
    mockPrisma.message.update,
    mockWhatsApp.sendTemplate,
    mockLib.getCampaignReport,
    mockLib.getCampaignRecipientSummary,
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

describe("GET /api/campaigns — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-prisma.campaign.findMany", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET_CAMPAIGNS();

    await expectUnauthorized(res);
    expectNoDbOrServiceCalls();
  });
});

describe("POST /api/campaigns — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-prisma.campaign.create", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await POST_CAMPAIGNS(req("/api/campaigns", "POST", { name: "מבצע" }));

    await expectUnauthorized(res);
    expectNoDbOrServiceCalls();
  });
});

describe("GET /api/campaigns/:id — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-prisma.campaign.findUnique", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET_CAMPAIGN(req("/api/campaigns/camp-1"), ctx());

    await expectUnauthorized(res);
    expectNoDbOrServiceCalls();
  });
});

describe("PATCH /api/campaigns/:id — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-prisma.campaign.update", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await PATCH_CAMPAIGN(
      req("/api/campaigns/camp-1", "PATCH", { name: "שם חדש" }),
      ctx()
    );

    await expectUnauthorized(res);
    expectNoDbOrServiceCalls();
  });
});

describe("DELETE /api/campaigns/:id — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-prisma.campaign.findUnique/update", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await DELETE_CAMPAIGN(req("/api/campaigns/camp-1", "DELETE"), ctx());

    await expectUnauthorized(res);
    expectNoDbOrServiceCalls();
  });
});

describe("POST /api/campaigns/:id/send — אבטחה (שליחה אמיתית)", () => {
  it("ללא session → 401 ואינו קורא ל-WhatsApp service ול-prisma", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await POST_SEND(req("/api/campaigns/camp-1/send", "POST"), ctx());

    await expectUnauthorized(res);
    expect(mockWhatsApp.sendTemplate).not.toHaveBeenCalled();
    expect(mockPrisma.campaign.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.campaign.update).not.toHaveBeenCalled();
    expectNoDbOrServiceCalls();
  });
});

describe("POST /api/campaigns/:id/test — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-WhatsApp service ול-prisma", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await POST_TEST(req("/api/campaigns/camp-1/test", "POST"), ctx());

    await expectUnauthorized(res);
    expect(mockWhatsApp.sendTemplate).not.toHaveBeenCalled();
    expect(mockPrisma.message.create).not.toHaveBeenCalled();
    expectNoDbOrServiceCalls();
  });
});

describe("GET /api/campaigns/:id/report — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-getCampaignReport", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET_REPORT(req("/api/campaigns/camp-1/report"), ctx());

    await expectUnauthorized(res);
    expect(mockLib.getCampaignReport).not.toHaveBeenCalled();
    expectNoDbOrServiceCalls();
  });
});

describe("GET /api/campaigns/:id/recipients/count — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-getCampaignRecipientSummary", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET_RECIPIENT_COUNT(
      req("/api/campaigns/camp-1/recipients/count"),
      ctx()
    );

    await expectUnauthorized(res);
    expect(mockLib.getCampaignRecipientSummary).not.toHaveBeenCalled();
    expectNoDbOrServiceCalls();
  });
});
