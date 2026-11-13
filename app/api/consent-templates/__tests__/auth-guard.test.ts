/**
 * בדיקות אבטחה ל-auth() (משימה 13.4, SRS §11) — תבניות הסכמה.
 *
 * כל handler מוגן ב-`auth()` כפקודה הראשונה. ללא session הם מחזירים
 * 401 "נדרשת התחברות" ואינם נוגעים ב-DB.
 *
 * כל גישה ל-Prisma ממוקת — אין טעינה אמיתית של Prisma.
 *
 * הרצה: `npx vitest run app/api/consent-templates/__tests__/auth-guard.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני ה-imports של ה-handlers
// ---------------------------------------------------------------------------

const { mockAuth, mockPrisma } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockPrisma = {
    consentTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return { mockAuth, mockPrisma };
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

// ---------------------------------------------------------------------------
// Import handlers after mocks
// ---------------------------------------------------------------------------

import { GET as GET_LIST, POST } from "@/app/api/consent-templates/route";
import {
  GET as GET_ONE,
  PATCH,
  DELETE,
} from "@/app/api/consent-templates/[id]/route";

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

function ctx(id = "tpl-1") {
  return { params: Promise.resolve({ id }) };
}

async function expectUnauthorized(res: Response) {
  expect(res.status).toBe(401);
  const body = await res.json();
  expect(body.error).toBe("נדרשת התחברות");
}

/** אף קריאה ל-DB לא בוצעה. */
function expectNoDbCalls() {
  const fns = [
    mockPrisma.consentTemplate.findMany,
    mockPrisma.consentTemplate.findUnique,
    mockPrisma.consentTemplate.create,
    mockPrisma.consentTemplate.update,
    mockPrisma.$transaction,
  ];
  for (const fn of fns) {
    expect(fn).not.toHaveBeenCalled();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// בדיקות — ללא session → 401, בלי גישה ל-DB
// ---------------------------------------------------------------------------

describe("GET /api/consent-templates — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-consentTemplate.findMany", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET_LIST(req("/api/consent-templates") as never);

    await expectUnauthorized(res);
    expectNoDbCalls();
  });
});

describe("POST /api/consent-templates — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-consentTemplate.create", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await POST(
      req("/api/consent-templates", "POST", { name: "טופס" })
    );

    await expectUnauthorized(res);
    expectNoDbCalls();
  });
});

describe("GET /api/consent-templates/:id — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-consentTemplate.findUnique", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET_ONE(req("/api/consent-templates/tpl-1"), ctx("tpl-1"));

    await expectUnauthorized(res);
    expectNoDbCalls();
  });
});

describe("PATCH /api/consent-templates/:id — אבטחה", () => {
  it("ללא session → 401 ואינו פותח טרנזקציה", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await PATCH(
      req("/api/consent-templates/tpl-1", "PATCH", { name: "חדש" }),
      ctx("tpl-1")
    );

    await expectUnauthorized(res);
    expectNoDbCalls();
  });
});

describe("DELETE /api/consent-templates/:id — אבטחה", () => {
  it("ללא session → 401 ואינו מבטל את התבנית", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await DELETE(
      req("/api/consent-templates/tpl-1", "DELETE"),
      ctx("tpl-1")
    );

    await expectUnauthorized(res);
    expectNoDbCalls();
  });
});
