/**
 * בדיקות אבטחה ל-auth() (משימה 13.2, SRS §11) — תחום לקוחות וסגמנטים.
 *
 * כל handler מוגן ב-`auth()` כפקודה הראשונה. ללא session הם מחזירים
 * 401 "נדרשת התחברות" ואינם נוגעים ב-DB או בשירותים.
 *
 * קובץ זה כולל גם את מסלול ה-401 של routes שאין להם קובץ בדיקה משלהם
 * (`merge`, `duplicates`), וגם את מסלול ה-401 של נתיבי הסגמנטים.
 *
 * כל מודולי ה-DB/השירותים ממוקים — אין טעינה אמיתית של Prisma.
 *
 * הרצה: `npx vitest run app/api/clients/__tests__/auth-guard.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני ה-imports של ה-handlers
// ---------------------------------------------------------------------------

const { mockAuth, mockPrisma, mockLib } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockPrisma = {
    client: { create: vi.fn(), update: vi.fn() },
    clientTag: { createMany: vi.fn() },
    tag: { findUnique: vi.fn() },
    signedConsent: { findMany: vi.fn() },
    message: { findMany: vi.fn() },
    visit: { create: vi.fn() },
    segment: { create: vi.fn(), findMany: vi.fn(), delete: vi.fn() },
  };
  const mockLib = {
    getClientById: vi.fn(),
    listClients: vi.fn(),
    findDuplicateClientGroups: vi.fn(),
    createFollowUpsForVisit: vi.fn(),
    mergeClients: vi.fn(),
  };
  return { mockAuth, mockPrisma, mockLib };
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

vi.mock("@/lib/db/clients", () => ({
  getClientById: mockLib.getClientById,
  listClients: mockLib.listClients,
  findDuplicateClientGroups: mockLib.findDuplicateClientGroups,
}));

vi.mock("@/lib/db/visits", () => ({
  createFollowUpsForVisit: mockLib.createFollowUpsForVisit,
}));

vi.mock("@/lib/db/merge-clients", () => ({
  mergeClients: mockLib.mergeClients,
  MergeClientNotFoundError: class MergeClientNotFoundError extends Error {},
}));

vi.mock("@prisma/client", () => ({
  Prisma: {},
  Gender: {},
  MarketingConsentChannel: {},
}));

// ---------------------------------------------------------------------------
// Import handlers after mocks
// ---------------------------------------------------------------------------

import { GET as GET_CLIENTS, POST as POST_CLIENTS } from "@/app/api/clients/route";
import {
  GET as GET_CLIENT,
  PATCH as PATCH_CLIENT,
  DELETE as DELETE_CLIENT,
} from "@/app/api/clients/[id]/route";
import { POST as POST_RESTORE } from "@/app/api/clients/[id]/restore/route";
import { POST as POST_VISIT } from "@/app/api/clients/[id]/visits/route";
import { GET as GET_CONSENTS } from "@/app/api/clients/[id]/consents/route";
import { GET as GET_MESSAGES } from "@/app/api/clients/[id]/messages/route";
import { POST as POST_BULK_TAG } from "@/app/api/clients/bulk-tag/route";
import { POST as POST_MERGE } from "@/app/api/clients/merge/route";
import { GET as GET_DUPLICATES } from "@/app/api/clients/duplicates/route";
import { GET as GET_SEGMENTS, POST as POST_SEGMENTS } from "@/app/api/segments/route";
import { DELETE as DELETE_SEGMENT } from "@/app/api/segments/[id]/route";

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

function ctx(id = "id-1") {
  return { params: Promise.resolve({ id }) };
}

async function expectUnauthorized(res: Response) {
  expect(res.status).toBe(401);
  const body = await res.json();
  expect(body.error).toBe("נדרשת התחברות");
}

/** אף קריאה ל-DB או לשירות לא בוצעה. */
function expectNoDbOrServiceCalls() {
  const fns = [
    mockPrisma.client.create,
    mockPrisma.client.update,
    mockPrisma.clientTag.createMany,
    mockPrisma.tag.findUnique,
    mockPrisma.signedConsent.findMany,
    mockPrisma.message.findMany,
    mockPrisma.visit.create,
    mockPrisma.segment.create,
    mockPrisma.segment.findMany,
    mockPrisma.segment.delete,
    mockLib.getClientById,
    mockLib.listClients,
    mockLib.findDuplicateClientGroups,
    mockLib.createFollowUpsForVisit,
    mockLib.mergeClients,
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

describe("GET /api/clients — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-listClients", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET_CLIENTS(req("/api/clients?status=archived"));

    await expectUnauthorized(res);
    expectNoDbOrServiceCalls();
  });
});

describe("POST /api/clients — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-prisma.client.create", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await POST_CLIENTS(req("/api/clients", "POST", { firstName: "א" }));

    await expectUnauthorized(res);
    expectNoDbOrServiceCalls();
  });
});

describe("GET /api/clients/:id — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-getClientById", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET_CLIENT(req("/api/clients/client-1"), ctx("client-1"));

    await expectUnauthorized(res);
    expectNoDbOrServiceCalls();
  });
});

describe("PATCH /api/clients/:id — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-prisma.client.update", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await PATCH_CLIENT(
      req("/api/clients/client-1", "PATCH", { city: "תל אביב" }),
      ctx("client-1")
    );

    await expectUnauthorized(res);
    expectNoDbOrServiceCalls();
  });
});

describe("DELETE /api/clients/:id — אבטחה", () => {
  it("ללא session → 401 ואינו מארכב את הלקוח", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await DELETE_CLIENT(req("/api/clients/client-1", "DELETE"), ctx("client-1"));

    await expectUnauthorized(res);
    expectNoDbOrServiceCalls();
  });
});

describe("POST /api/clients/:id/restore — אבטחה", () => {
  it("ללא session → 401 ואינו משחזר לקוח", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await POST_RESTORE(req("/api/clients/client-1/restore", "POST"), ctx("client-1"));

    await expectUnauthorized(res);
    expectNoDbOrServiceCalls();
  });
});

describe("POST /api/clients/:id/visits — אבטחה", () => {
  it("ללא session → 401 ואינו יוצר ביקור", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await POST_VISIT(
      req("/api/clients/client-1/visits", "POST", { visitDate: "2026-01-01" }),
      ctx("client-1")
    );

    await expectUnauthorized(res);
    expectNoDbOrServiceCalls();
  });
});

describe("GET /api/clients/:id/consents — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-signedConsent.findMany", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET_CONSENTS(
      req("/api/clients/client-1/consents") as never,
      ctx("client-1")
    );

    await expectUnauthorized(res);
    expectNoDbOrServiceCalls();
  });
});

describe("GET /api/clients/:id/messages — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-message.findMany", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET_MESSAGES(
      req("/api/clients/client-1/messages") as never,
      ctx("client-1")
    );

    await expectUnauthorized(res);
    expectNoDbOrServiceCalls();
  });
});

describe("POST /api/clients/bulk-tag — אבטחה", () => {
  it("ללא session → 401 ואינו מוסיף תגיות", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await POST_BULK_TAG(
      req("/api/clients/bulk-tag", "POST", { clientIds: ["client-1"], tagId: "tag-1" })
    );

    await expectUnauthorized(res);
    expectNoDbOrServiceCalls();
  });
});

describe("POST /api/clients/merge — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-mergeClients", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await POST_MERGE(
      req("/api/clients/merge", "POST", {
        survivorId: "client-1",
        duplicateId: "client-2",
        resolved: {},
      })
    );

    await expectUnauthorized(res);
    expectNoDbOrServiceCalls();
  });
});

describe("GET /api/clients/duplicates — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-findDuplicateClientGroups", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET_DUPLICATES();

    await expectUnauthorized(res);
    expectNoDbOrServiceCalls();
  });
});

describe("GET /api/segments — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-segment.findMany", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET_SEGMENTS();

    await expectUnauthorized(res);
    expectNoDbOrServiceCalls();
  });
});

describe("POST /api/segments — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-segment.create", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await POST_SEGMENTS(
      req("/api/segments", "POST", { name: "סגמנט", filters: {} })
    );

    await expectUnauthorized(res);
    expectNoDbOrServiceCalls();
  });
});

describe("DELETE /api/segments/:id — אבטחה", () => {
  it("ללא session → 401 ואינו מוחק סגמנט", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await DELETE_SEGMENT(req("/api/segments/seg-1", "DELETE"), ctx("seg-1"));

    await expectUnauthorized(res);
    expectNoDbOrServiceCalls();
  });
});
