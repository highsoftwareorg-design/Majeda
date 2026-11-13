/**
 * בדיקות API לכללי מעקב — משימה 8.2 (FR-FU-01).
 *
 * כל הקריאות ל-Prisma ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * בודק:
 * 1. POST יוצר FollowUpRule עם השדות הנכונים (name, offsetDays, recipientType).
 * 2. POST עם name חסר → 400.
 * 3. DELETE מסמן isActive=false (לא prisma.delete) → 200.
 *
 * הרצה: `npx vitest run app/api/treatments/__tests__/follow-up-rules.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// --- Mocks (חייבים לפני ה-imports של המודולים הממוקים) ---

const {
  mockTreatmentFindUnique,
  mockRuleFindMany,
  mockRuleCreate,
  mockRuleFindFirst,
  mockRuleUpdate,
} = vi.hoisted(() => ({
  mockTreatmentFindUnique: vi.fn(),
  mockRuleFindMany: vi.fn(),
  mockRuleCreate: vi.fn(),
  mockRuleFindFirst: vi.fn(),
  mockRuleUpdate: vi.fn(),
}));

// session מאומת קבוע — GET/POST/DELETE דורשים התחברות (§11); ה-middleware לא מכסה /api.
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
    treatment: {
      findUnique: mockTreatmentFindUnique,
    },
    followUpRule: {
      findMany: mockRuleFindMany,
      create: mockRuleCreate,
      findFirst: mockRuleFindFirst,
      update: mockRuleUpdate,
    },
  },
}));

// --- Imports אחרי ה-mocks ---
import { GET, POST } from "@/app/api/treatments/[id]/follow-up-rules/route";
import { DELETE } from "@/app/api/treatments/[id]/follow-up-rules/[ruleId]/route";

// --- עזרים ---

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function makeRuleParams(id: string, ruleId: string): {
  params: Promise<{ id: string; ruleId: string }>;
} {
  return { params: Promise.resolve({ id, ruleId }) };
}

function makeRequest(body: unknown): Request {
  return {
    json: () => Promise.resolve(body),
  } as unknown as Request;
}

const MOCK_TREATMENT = { id: "treat-1" };

const MOCK_RULE = {
  id: "rule-1",
  treatmentId: "treat-1",
  name: "בדיקת שלומות",
  offsetDays: 7,
  recipientType: "client",
  adminNote: null,
  isActive: true,
  createdAt: new Date("2026-11-07T10:00:00Z"),
  updatedAt: new Date("2026-11-07T10:00:00Z"),
};

// --- בדיקות ---

describe("POST /api/treatments/:id/follow-up-rules — יצירת כלל מעקב", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTreatmentFindUnique.mockResolvedValue(MOCK_TREATMENT);
    mockRuleCreate.mockResolvedValue(MOCK_RULE);
  });

  it("יוצר FollowUpRule עם name, offsetDays ו-recipientType נכונים → status 201", async () => {
    const req = makeRequest({ name: "בדיקת שלומות", offsetDays: 7, recipientType: "client" });
    const res = await POST(req, makeParams("treat-1"));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("rule");
    expect(body.rule.name).toBe("בדיקת שלומות");
    expect(body.rule.offsetDays).toBe(7);
    expect(body.rule.recipientType).toBe("client");
  });

  it("קורא ל-prisma.followUpRule.create עם הנתונים הנכונים", async () => {
    const req = makeRequest({ name: "המלצה לחידוש", offsetDays: 30, recipientType: "both" });
    await POST(req, makeParams("treat-1"));

    expect(mockRuleCreate).toHaveBeenCalledOnce();
    const createArg = mockRuleCreate.mock.calls[0][0];
    expect(createArg.data.name).toBe("המלצה לחידוש");
    expect(createArg.data.offsetDays).toBe(30);
    expect(createArg.data.recipientType).toBe("both");
    expect(createArg.data.treatmentId).toBe("treat-1");
  });

  it("POST עם name ריק → status 400", async () => {
    const req = makeRequest({ name: "", offsetDays: 7 });
    const res = await POST(req, makeParams("treat-1"));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(mockRuleCreate).not.toHaveBeenCalled();
  });

  it("POST ללא שדה name כלל → status 400", async () => {
    const req = makeRequest({ offsetDays: 7 });
    const res = await POST(req, makeParams("treat-1"));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(mockRuleCreate).not.toHaveBeenCalled();
  });

  it("POST ללא offsetDays → status 400", async () => {
    const req = makeRequest({ name: "שלומות" });
    const res = await POST(req, makeParams("treat-1"));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(mockRuleCreate).not.toHaveBeenCalled();
  });

  it("POST עם recipientType ברירת מחדל — 'client' כשלא מסופק", async () => {
    const req = makeRequest({ name: "שלומות", offsetDays: 3 });
    await POST(req, makeParams("treat-1"));

    const createArg = mockRuleCreate.mock.calls[0][0];
    expect(createArg.data.recipientType).toBe("client");
  });

  it("POST לטיפול שאינו קיים → status 404", async () => {
    mockTreatmentFindUnique.mockResolvedValue(null);
    const req = makeRequest({ name: "שלומות", offsetDays: 7 });
    const res = await POST(req, makeParams("treat-nonexistent"));

    expect(res.status).toBe(404);
    expect(mockRuleCreate).not.toHaveBeenCalled();
  });
});

describe("GET /api/treatments/:id/follow-up-rules — רשימת כללים", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTreatmentFindUnique.mockResolvedValue(MOCK_TREATMENT);
    mockRuleFindMany.mockResolvedValue([MOCK_RULE]);
  });

  it("מחזיר status 200 ומפתח rules", async () => {
    const res = await GET({} as Request, makeParams("treat-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("rules");
    expect(Array.isArray(body.rules)).toBe(true);
  });

  it("רשימה ריקה — מחזיר rules: []", async () => {
    mockRuleFindMany.mockResolvedValue([]);
    const res = await GET({} as Request, makeParams("treat-1"));
    const body = await res.json();
    expect(body.rules).toEqual([]);
  });
});

describe("DELETE /api/treatments/:id/follow-up-rules/:ruleId — מחיקה רכה", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRuleFindFirst.mockResolvedValue({ id: "rule-1" });
    mockRuleUpdate.mockResolvedValue({ ...MOCK_RULE, isActive: false });
  });

  it("מחזיר status 200 עם success:true", async () => {
    const res = await DELETE({} as Request, makeRuleParams("treat-1", "rule-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("קורא ל-prisma.followUpRule.update עם isActive=false (לא prisma.delete)", async () => {
    await DELETE({} as Request, makeRuleParams("treat-1", "rule-1"));

    // ודא שנקרא update ולא delete
    expect(mockRuleUpdate).toHaveBeenCalledOnce();
    const updateArg = mockRuleUpdate.mock.calls[0][0];
    expect(updateArg.where.id).toBe("rule-1");
    expect(updateArg.data.isActive).toBe(false);
  });

  it("כלל שלא נמצא → status 404", async () => {
    mockRuleFindFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeRuleParams("treat-1", "nonexistent-rule"));
    expect(res.status).toBe(404);
    expect(mockRuleUpdate).not.toHaveBeenCalled();
  });
});
