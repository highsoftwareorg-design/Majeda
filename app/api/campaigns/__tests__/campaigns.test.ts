/**
 * בדיקות API קמפיינים — משימות 9.1 (FR-MK-01).
 *
 * כל הקריאות ל-Prisma ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * בודק:
 * 1. POST עם נתונים תקינים → prisma.campaign.create נקרא עם status='DRAFT' → 201.
 * 2. POST עם שם חסר → 400.
 * 3. GET → מחזיר רשימת קמפיינים.
 * 4. DELETE → מעדכן status ל-CANCELLED (soft cancel) → { success: true, status: 'CANCELLED' }.
 *
 * הרצה: `npx vitest run app/api/campaigns/__tests__/campaigns.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני ה-imports של המודולים הממוקים
// ---------------------------------------------------------------------------

const {
  mockCampaignCreate,
  mockCampaignFindMany,
  mockCampaignFindUnique,
  mockCampaignUpdate,
  mockSegmentFindUnique,
  mockWhatsAppTemplateFindUnique,
} = vi.hoisted(() => ({
  mockCampaignCreate: vi.fn(),
  mockCampaignFindMany: vi.fn(),
  mockCampaignFindUnique: vi.fn(),
  mockCampaignUpdate: vi.fn(),
  mockSegmentFindUnique: vi.fn(),
  mockWhatsAppTemplateFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: () => Promise.resolve({ user: { id: "admin", email: "admin@test" } }),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    campaign: {
      create: mockCampaignCreate,
      findMany: mockCampaignFindMany,
      findUnique: mockCampaignFindUnique,
      update: mockCampaignUpdate,
    },
    segment: {
      findUnique: mockSegmentFindUnique,
    },
    whatsAppTemplate: {
      findUnique: mockWhatsAppTemplateFindUnique,
    },
  },
}));

// ---------------------------------------------------------------------------
// Import handlers after mocks
// ---------------------------------------------------------------------------

import { GET, POST } from "@/app/api/campaigns/route";
import { DELETE } from "@/app/api/campaigns/[id]/route";

// ---------------------------------------------------------------------------
// עזרים
// ---------------------------------------------------------------------------

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/campaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** קמפיין דמה */
const MOCK_CAMPAIGN = {
  id: "camp-1",
  name: "מבצע חורף",
  status: "DRAFT",
  segmentId: null,
  templateId: null,
  mediaUrl: null,
  linkButtonUrl: null,
  linkButtonText: null,
  scheduledAt: null,
  createdAt: new Date("2026-11-07T10:00:00.000Z"),
  updatedAt: new Date("2026-11-07T10:00:00.000Z"),
  segment: null,
  template: null,
};

// ---------------------------------------------------------------------------
// בדיקות
// ---------------------------------------------------------------------------

describe("POST /api/campaigns — יצירת קמפיין חדש", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaignCreate.mockResolvedValue(MOCK_CAMPAIGN);
    // אין צורך לאמת סגמנט/תבנית — לא מסופקים בבקשה
  });

  it("POST עם שם תקין → prisma.campaign.create נקרא עם status='DRAFT' → 201", async () => {
    const req = makePostRequest({ name: "מבצע חורף" });
    const res = await POST(req);

    expect(res.status).toBe(201);

    // בדיקה שנקרא עם status='DRAFT'
    expect(mockCampaignCreate).toHaveBeenCalledOnce();
    const callArg = mockCampaignCreate.mock.calls[0][0];
    expect(callArg.data).toMatchObject({
      name: "מבצע חורף",
      status: "DRAFT",
    });
  });

  it("POST עם שם תקין → body מכיל campaign", async () => {
    const req = makePostRequest({ name: "מבצע חורף" });
    const res = await POST(req);
    const body = await res.json();

    expect(body).toHaveProperty("campaign");
    expect(body.campaign.name).toBe("מבצע חורף");
  });

  it("POST עם שם חסר → 400 ו-prisma.campaign.create לא נקרא", async () => {
    const req = makePostRequest({ name: "" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockCampaignCreate).not.toHaveBeenCalled();
  });

  it("POST ללא שדה name בכלל → 400", async () => {
    const req = makePostRequest({ segmentId: "seg-1" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockCampaignCreate).not.toHaveBeenCalled();
  });
});

describe("GET /api/campaigns — רשימת קמפיינים", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaignFindMany.mockResolvedValue([MOCK_CAMPAIGN]);
  });

  it("מחזיר 200 ומפתח campaigns ב-body", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("campaigns");
    expect(Array.isArray(body.campaigns)).toBe(true);
  });

  it("campaigns מכיל את הנתונים שהוחזרו מ-prisma", async () => {
    const res = await GET();
    const body = await res.json();

    expect(body.campaigns).toHaveLength(1);
    expect(body.campaigns[0].name).toBe("מבצע חורף");
  });

  it("רשימה ריקה — מחזיר campaigns: []", async () => {
    mockCampaignFindMany.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.campaigns).toEqual([]);
  });
});

describe("DELETE /api/campaigns/:id — ביטול קמפיין (soft cancel)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaignFindUnique.mockResolvedValue({ id: "camp-1", status: "DRAFT" });
    mockCampaignUpdate.mockResolvedValue({ id: "camp-1", status: "CANCELLED" });
  });

  it("DELETE על קמפיין DRAFT → prisma.campaign.update נקרא עם status='CANCELLED'", async () => {
    const req = new Request("http://localhost/api/campaigns/camp-1", {
      method: "DELETE",
    });
    await DELETE(req, makeDeleteParams("camp-1"));

    expect(mockCampaignUpdate).toHaveBeenCalledOnce();
    const callArg = mockCampaignUpdate.mock.calls[0][0];
    expect(callArg.data).toEqual({ status: "CANCELLED" });
  });

  it("DELETE מחזיר { success: true, status: 'CANCELLED' }", async () => {
    const req = new Request("http://localhost/api/campaigns/camp-1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeDeleteParams("camp-1"));
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.status).toBe("CANCELLED");
  });

  it("DELETE על קמפיין שלא קיים → 404", async () => {
    mockCampaignFindUnique.mockResolvedValue(null);

    const req = new Request("http://localhost/api/campaigns/no-such-id", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeDeleteParams("no-such-id"));

    expect(res.status).toBe(404);
    expect(mockCampaignUpdate).not.toHaveBeenCalled();
  });

  it("DELETE על קמפיין CANCELLED — אידמפוטנטי → 200 וללא קריאה ל-update", async () => {
    mockCampaignFindUnique.mockResolvedValue({ id: "camp-1", status: "CANCELLED" });

    const req = new Request("http://localhost/api/campaigns/camp-1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeDeleteParams("camp-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("CANCELLED");
    expect(mockCampaignUpdate).not.toHaveBeenCalled();
  });
});
