/**
 * בדיקות ל-GET /api/clients/:id/consents — משימה 7.9 (FR-PR-08, FR-CF-09).
 *
 * כל הקריאות ל-Prisma ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * בודק חישוב סטטוס:
 * 1. signedAt לפני יומיים + validityDays=1 → "פג תוקף"
 * 2. signedAt מוגדר + validityDays=null → "בתוקף"
 * 3. signedAt=null → "ממתין לחתימה"
 *
 * הרצה: `npx vitest run app/api/clients/__tests__/consents-route.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני ה-imports של המודולים הממוקים
// ---------------------------------------------------------------------------

const { mockSignedConsentFindMany } = vi.hoisted(() => ({
  mockSignedConsentFindMany: vi.fn(),
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
    signedConsent: {
      findMany: mockSignedConsentFindMany,
    },
  },
}));

// ---------------------------------------------------------------------------
// Import handler after mocks
// ---------------------------------------------------------------------------

import { GET } from "@/app/api/clients/[id]/consents/route";

// ---------------------------------------------------------------------------
// עזרים
// ---------------------------------------------------------------------------

function makeParams(id = "client-1") {
  return { params: Promise.resolve({ id }) };
}

// ---------------------------------------------------------------------------
// בדיקות
// ---------------------------------------------------------------------------

describe("GET /api/clients/[id]/consents — סטטוס 'פג תוקף'", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("מחזיר 'פג תוקף' כאשר validityDays=1 ו-signedAt לפני יומיים", async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    mockSignedConsentFindMany.mockResolvedValueOnce([
      {
        id: "sc-1",
        clientId: "client-1",
        pdfStorageKey: null,
        templateVersion: 1,
        createdAt: twoDaysAgo,
        signedAt: twoDaysAgo,
        template: { name: "טופס כימי", validityDays: 1 },
      },
    ]);

    const res = await GET({} as never, makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].status).toBe("פג תוקף");
  });
});

describe("GET /api/clients/[id]/consents — סטטוס 'בתוקף'", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("מחזיר 'בתוקף' כאשר signedAt מוגדר ואין validityDays", async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    mockSignedConsentFindMany.mockResolvedValueOnce([
      {
        id: "sc-2",
        clientId: "client-1",
        pdfStorageKey: null,
        templateVersion: 1,
        createdAt: yesterday,
        signedAt: yesterday,
        template: { name: "טופס ניסוי", validityDays: null },
      },
    ]);

    const res = await GET({} as never, makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].status).toBe("בתוקף");
  });
});

describe("GET /api/clients/[id]/consents — סטטוס 'ממתין לחתימה'", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("מחזיר 'ממתין לחתימה' כאשר signedAt הוא null", async () => {
    const now = new Date();

    mockSignedConsentFindMany.mockResolvedValueOnce([
      {
        id: "sc-3",
        clientId: "client-1",
        pdfStorageKey: null,
        templateVersion: 1,
        createdAt: now,
        signedAt: null,
        template: { name: "טופס סטנדרטי", validityDays: 30 },
      },
    ]);

    const res = await GET({} as never, makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].status).toBe("ממתין לחתימה");
  });
});
