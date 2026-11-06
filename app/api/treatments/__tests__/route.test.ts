/**
 * בדיקות ל-GET /api/treatments — משימה 3.6.
 *
 * כל הקריאות ל-Prisma ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * בודק:
 * 1. מחזיר 200 עם רשימת טיפולים.
 * 2. קורא ל-prisma.treatment.findMany עם select וסדר מיון אלפביתי נכונים.
 * 3. רשימה ריקה — מחזיר treatments: [].
 * 4. שגיאת DB — נזרקת (לא נבלעת בשקט).
 *
 * הרצה: `npx vitest run --reporter=verbose app/api/treatments/__tests__/route.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// --- Mocks (חייבים לפני ה-imports של המודולים הממוקים) ---

const { mockTreatmentFindMany } = vi.hoisted(() => ({
  mockTreatmentFindMany: vi.fn(),
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
      findMany: mockTreatmentFindMany,
    },
  },
}));

// --- Import after mocks ---
import { GET } from "@/app/api/treatments/route";

// --- נתוני דמה ---

const MOCK_TREATMENTS = [
  { id: "t1", name: "בוטוקס", durationMinutes: 30 },
  { id: "t2", name: "פילינג כימי", durationMinutes: 60 },
  { id: "t3", name: "ניידל", durationMinutes: 45 },
];

// --- בדיקות ---

describe("GET /api/treatments — משימה 3.6", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTreatmentFindMany.mockResolvedValue(MOCK_TREATMENTS);
  });

  it("מחזיר status 200 ומפתח treatments ב-body", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("treatments");
  });

  it("treatments מכיל את הנתונים שהוחזרו מ-prisma", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.treatments).toEqual(MOCK_TREATMENTS);
  });

  it("קורא ל-prisma.treatment.findMany פעם אחת בלבד", async () => {
    await GET();
    expect(mockTreatmentFindMany).toHaveBeenCalledOnce();
  });

  it("מעביר select עם id, name, durationMinutes בלבד", async () => {
    await GET();
    const callArg = mockTreatmentFindMany.mock.calls[0][0];
    expect(callArg.select).toEqual({
      id: true,
      name: true,
      durationMinutes: true,
    });
  });

  it("מעביר orderBy לפי name בסדר עולה (אלפביתי)", async () => {
    await GET();
    const callArg = mockTreatmentFindMany.mock.calls[0][0];
    expect(callArg.orderBy).toEqual({ name: "asc" });
  });

  it("רשימה ריקה — מחזיר treatments: []", async () => {
    mockTreatmentFindMany.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.treatments).toEqual([]);
  });

  it("שגיאת DB — השגיאה נזרקת ולא נבלעת בשקט", async () => {
    mockTreatmentFindMany.mockRejectedValue(new Error("DB connection error"));
    await expect(GET()).rejects.toThrow("DB connection error");
  });
});
