/**
 * בדיקות אבטחה ל-auth() (משימה 13.3, SRS §11) — תחום טיפולים וכללי מעקב.
 *
 * מכסה: GET+POST `/api/treatments`, GET+POST `/api/treatments/:id/follow-up-rules`,
 * DELETE `/api/treatments/:id/follow-up-rules/:ruleId`.
 *
 * כל handler מוגן ב-`auth()` כפקודה הראשונה. ללא session הם מחזירים
 * 401 "נדרשת התחברות" ואינם נוגעים ב-DB.
 *
 * הקובץ מופרד כי לקבצי הבדיקה האחרים בתיקייה יש מוק קבוע ל-auth (תמיד מחובר).
 * כל מודולי ה-DB ממוקים — אין טעינה אמיתית של Prisma.
 *
 * הרצה: `npx vitest run app/api/treatments/__tests__/auth-guard.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני ה-imports של ה-handlers
// ---------------------------------------------------------------------------

const { mockAuth, mockPrisma } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockPrisma = {
    treatment: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
    followUpRule: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
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

vi.mock("@prisma/client", () => ({
  Prisma: {},
}));

// ---------------------------------------------------------------------------
// Import handlers after mocks
// ---------------------------------------------------------------------------

import { GET as GET_TREATMENTS, POST as POST_TREATMENTS } from "@/app/api/treatments/route";
import {
  GET as GET_RULES,
  POST as POST_RULES,
} from "@/app/api/treatments/[id]/follow-up-rules/route";
import { DELETE as DELETE_RULE } from "@/app/api/treatments/[id]/follow-up-rules/[ruleId]/route";

// ---------------------------------------------------------------------------
// עזרים
// ---------------------------------------------------------------------------

function req(path: string, method = "GET", body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function ctx(id = "treatment-1") {
  return { params: Promise.resolve({ id }) };
}

function ruleCtx(id = "treatment-1", ruleId = "rule-1") {
  return { params: Promise.resolve({ id, ruleId }) };
}

async function expectUnauthorized(res: Response) {
  expect(res.status).toBe(401);
  const body = await res.json();
  expect(body.error).toBe("נדרשת התחברות");
}

/** אף קריאה ל-DB לא בוצעה. */
function expectNoDbCalls() {
  const fns = [
    mockPrisma.treatment.findMany,
    mockPrisma.treatment.create,
    mockPrisma.treatment.findUnique,
    mockPrisma.followUpRule.findMany,
    mockPrisma.followUpRule.create,
    mockPrisma.followUpRule.findFirst,
    mockPrisma.followUpRule.update,
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

describe("GET /api/treatments — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-treatment.findMany", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET_TREATMENTS();

    await expectUnauthorized(res);
    expectNoDbCalls();
  });
});

describe("POST /api/treatments — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-treatment.create", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await POST_TREATMENTS(
      req("/api/treatments", "POST", { name: "טיפול", durationMinutes: 60, price: 100 })
    );

    await expectUnauthorized(res);
    expectNoDbCalls();
  });
});

describe("GET /api/treatments/:id/follow-up-rules — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-followUpRule.findMany", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET_RULES(req("/api/treatments/treatment-1/follow-up-rules"), ctx());

    await expectUnauthorized(res);
    expectNoDbCalls();
  });
});

describe("POST /api/treatments/:id/follow-up-rules — אבטחה", () => {
  it("ללא session → 401 ואינו קורא ל-followUpRule.create", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await POST_RULES(
      req("/api/treatments/treatment-1/follow-up-rules", "POST", {
        name: "בדיקת שלומות",
        offsetDays: 7,
      }),
      ctx()
    );

    await expectUnauthorized(res);
    expectNoDbCalls();
  });
});

describe("DELETE /api/treatments/:id/follow-up-rules/:ruleId — אבטחה", () => {
  it("ללא session → 401 ואינו מסמן את הכלל כלא פעיל", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await DELETE_RULE(
      req("/api/treatments/treatment-1/follow-up-rules/rule-1", "DELETE"),
      ruleCtx("treatment-1", "rule-1")
    );

    await expectUnauthorized(res);
    expectNoDbCalls();
  });
});
