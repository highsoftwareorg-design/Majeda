/**
 * בדיקות ל-GET /api/clients/:id/messages — משימה 6.7 (FR-WA-06).
 *
 * כל הקריאות ל-Prisma ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * בודק:
 * 1. mock עם 3 הודעות → response עם status 200 ו-3 פריטים ב-JSON.
 *
 * הרצה: `npx vitest run app/api/clients/__tests__/messages-route.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני ה-imports של המודולים הממוקים
// ---------------------------------------------------------------------------

const { mockMessageFindMany } = vi.hoisted(() => ({
  mockMessageFindMany: vi.fn(),
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
    message: {
      findMany: mockMessageFindMany,
    },
  },
}));

// ---------------------------------------------------------------------------
// Import handler after mocks
// ---------------------------------------------------------------------------

import { GET } from "@/app/api/clients/[id]/messages/route";

// ---------------------------------------------------------------------------
// נתוני עזר
// ---------------------------------------------------------------------------

/** params מדומה (Promise) */
function makeParams(id = "client-1") {
  return { params: Promise.resolve({ id }) };
}

/** 3 הודעות מדומות כפי שמגיעות מ-Prisma */
const MOCK_MESSAGES = [
  {
    id: "msg-1",
    channel: "whatsapp",
    templateId: "reminder_v1",
    status: "SENT",
    sourceType: "appointment",
    externalId: "wa-ext-1",
    sentAt: new Date("2026-11-07T10:00:00.000Z"),
    deliveredAt: null,
    readAt: null,
    createdAt: new Date("2026-11-07T10:00:00.000Z"),
    content: "תזכורת לתורך מחר",
  },
  {
    id: "msg-2",
    channel: "whatsapp",
    templateId: "followup_v1",
    status: "DELIVERED",
    sourceType: "follow_up",
    externalId: "wa-ext-2",
    sentAt: new Date("2026-11-06T10:00:00.000Z"),
    deliveredAt: new Date("2026-11-06T10:05:00.000Z"),
    readAt: null,
    createdAt: new Date("2026-11-06T10:00:00.000Z"),
    content: "מעקב אחרי הטיפול",
  },
  {
    id: "msg-3",
    channel: "whatsapp",
    templateId: null,
    status: "MOCK",
    sourceType: "campaign",
    externalId: null,
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    createdAt: new Date("2026-11-05T10:00:00.000Z"),
    content: "הודעת קמפיין",
  },
];

// ---------------------------------------------------------------------------
// בדיקות
// ---------------------------------------------------------------------------

describe("GET /api/clients/:id/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mock עם 3 הודעות → response עם status 200 ו-3 פריטים ב-JSON", async () => {
    mockMessageFindMany.mockResolvedValue(MOCK_MESSAGES);

    const req = new Request(
      "http://localhost/api/clients/client-1/messages"
    );
    const response = await GET(req as never, makeParams("client-1"));

    // בדיקת status
    expect(response.status).toBe(200);

    // בדיקת גוף התשובה — 3 פריטים
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(3);
  });

  it("prisma.message.findMany נקרא עם clientId ו-orderBy desc", async () => {
    mockMessageFindMany.mockResolvedValue(MOCK_MESSAGES);

    const req = new Request(
      "http://localhost/api/clients/client-99/messages"
    );
    await GET(req as never, makeParams("client-99"));

    expect(mockMessageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId: "client-99" },
        orderBy: { createdAt: "desc" },
      })
    );
  });
});
