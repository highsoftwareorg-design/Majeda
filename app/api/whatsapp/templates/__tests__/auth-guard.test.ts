/**
 * בדיקות אבטחה ל-auth() (משימה 13.5, SRS §11) — תבניות WhatsApp.
 *
 * כל handler מוגן ב-`auth()` כפקודה הראשונה. ללא session הם מחזירים
 * 401 "נדרשת התחברות" ואינם נוגעים ב-DB.
 *
 * הרצה: `npx vitest run app/api/whatsapp/templates/__tests__/auth-guard.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני ה-imports של ה-handlers
// ---------------------------------------------------------------------------

const { mockAuth, mockPrisma } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockPrisma = {
    whatsAppTemplate: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
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

import { GET as GET_LIST, POST as POST_TEMPLATE } from "@/app/api/whatsapp/templates/route";
import {
  GET as GET_TEMPLATE,
  PATCH as PATCH_TEMPLATE,
  DELETE as DELETE_TEMPLATE,
} from "@/app/api/whatsapp/templates/[id]/route";

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

function ctx(id = "template-1") {
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
    mockPrisma.whatsAppTemplate.create,
    mockPrisma.whatsAppTemplate.findMany,
    mockPrisma.whatsAppTemplate.findUnique,
    mockPrisma.whatsAppTemplate.update,
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

describe("GET /api/whatsapp/templates — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-prisma.whatsAppTemplate.findMany", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET_LIST(req("/api/whatsapp/templates?category=MARKETING"));

    await expectUnauthorized(res);
    expectNoDbCalls();
  });
});

describe("POST /api/whatsapp/templates — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-prisma.whatsAppTemplate.create", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await POST_TEMPLATE(
      req("/api/whatsapp/templates", "POST", {
        name: "appointment_confirmation",
        body: "שלום {name}",
      })
    );

    await expectUnauthorized(res);
    expectNoDbCalls();
  });
});

describe("GET /api/whatsapp/templates/:id — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-prisma.whatsAppTemplate.findUnique", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET_TEMPLATE(req("/api/whatsapp/templates/template-1"), ctx());

    await expectUnauthorized(res);
    expectNoDbCalls();
  });
});

describe("PATCH /api/whatsapp/templates/:id — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-prisma.whatsAppTemplate.update", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await PATCH_TEMPLATE(
      req("/api/whatsapp/templates/template-1", "PATCH", { body: "טקסט חדש" }),
      ctx()
    );

    await expectUnauthorized(res);
    expectNoDbCalls();
  });
});

describe("DELETE /api/whatsapp/templates/:id — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-prisma.whatsAppTemplate.update", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await DELETE_TEMPLATE(req("/api/whatsapp/templates/template-1", "DELETE"), ctx());

    await expectUnauthorized(res);
    expectNoDbCalls();
  });
});
