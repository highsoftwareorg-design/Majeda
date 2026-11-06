/**
 * בדיקות ל-GET/POST /api/segments ו-DELETE /api/segments/[id] — משימה 3.11.
 *
 * כל הקריאות ל-Prisma ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * בודק:
 * 1. POST יוצר סגמנט עם שם ופילטרים נכונים ומחזיר 201.
 * 2. POST מחזיר 409 לשם כפול (שגיאת Prisma P2002).
 * 3. POST מחזיר 400 כאשר חסר שם.
 * 4. POST מחזיר 400 כאשר filters אינו אובייקט.
 * 5. GET מחזיר רשימת סגמנטים.
 * 6. DELETE מחזיר 404 לסגמנט שאינו קיים (שגיאת Prisma P2025).
 * 7. DELETE מחזיר { success: true } לסגמנט קיים.
 *
 * הרצה: `npx vitest run --reporter=verbose app/api/segments/__tests__/route.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// --- Mocks (חייבים לפני ה-imports של המודולים הממוקים) ---

const { mockSegmentCreate, mockSegmentFindMany, mockSegmentDelete } = vi.hoisted(() => ({
  mockSegmentCreate: vi.fn(),
  mockSegmentFindMany: vi.fn(),
  mockSegmentDelete: vi.fn(),
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
    segment: {
      create: mockSegmentCreate,
      findMany: mockSegmentFindMany,
      delete: mockSegmentDelete,
    },
  },
}));

// --- Import after mocks ---
import { GET, POST } from "@/app/api/segments/route";
import { DELETE } from "@/app/api/segments/[id]/route";

// --- נתוני דמה ---

const MOCK_SEGMENT = {
  id: "seg-1",
  name: "לקוחות פעילות",
  filters: { tags: ["tag-1"], treatmentIds: ["t1"] },
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

const MOCK_SEGMENTS = [
  MOCK_SEGMENT,
  {
    id: "seg-2",
    name: "לקוחות חדשות",
    filters: { source: "landing_page" },
    createdAt: new Date("2026-01-02T00:00:00Z"),
  },
];

/** עוזר ליצירת Request מדומה עם body JSON */
function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/segments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** עוזר ליצירת params Promise עבור נתיב [id] */
function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

// --- בדיקות ---

describe("POST /api/segments — משימה 3.11", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSegmentCreate.mockResolvedValue(MOCK_SEGMENT);
  });

  it("יוצר סגמנט עם שם ופילטרים נכונים ומחזיר status 201", async () => {
    const req = makePostRequest({
      name: "לקוחות פעילות",
      filters: { tags: ["tag-1"], treatmentIds: ["t1"] },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("body כולל את שדה segment עם id, name, filters, createdAt", async () => {
    const req = makePostRequest({
      name: "לקוחות פעילות",
      filters: { tags: ["tag-1"] },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body).toHaveProperty("segment");
    expect(body.segment).toEqual(MOCK_SEGMENT);
  });

  it("קורא ל-prisma.segment.create עם השם והפילטרים שהתקבלו", async () => {
    const filters = { tags: ["tag-1"], treatmentIds: ["t1"] };
    const req = makePostRequest({ name: "  לקוחות פעילות  ", filters });
    await POST(req);
    expect(mockSegmentCreate).toHaveBeenCalledOnce();
    const callArg = mockSegmentCreate.mock.calls[0][0];
    // בודק שהשם עבר trim
    expect(callArg.data.name).toBe("לקוחות פעילות");
    expect(callArg.data.filters).toEqual(filters);
  });

  it("מחזיר 409 לשם כפול — שגיאת Prisma P2002", async () => {
    const p2002 = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    mockSegmentCreate.mockRejectedValue(p2002);

    const req = makePostRequest({
      name: "לקוחות פעילות",
      filters: { tags: [] },
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("מחזיר 400 כאשר שם חסר", async () => {
    const req = makePostRequest({ filters: { tags: [] } });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("מחזיר 400 כאשר שם הוא מחרוזת ריקה", async () => {
    const req = makePostRequest({ name: "   ", filters: { tags: [] } });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("מחזיר 400 כאשר filters הוא מערך ולא אובייקט", async () => {
    const req = makePostRequest({ name: "בדיקה", filters: ["tag1"] });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("מחזיר 400 כאשר filters חסר", async () => {
    const req = makePostRequest({ name: "בדיקה" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("מחזיר 400 כאשר body אינו JSON תקין", async () => {
    const req = new Request("http://localhost/api/segments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-valid-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/segments — משימה 3.11", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSegmentFindMany.mockResolvedValue(MOCK_SEGMENTS);
  });

  it("מחזיר status 200 ומפתח segments ב-body", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("segments");
  });

  it("segments מכיל את הנתונים שהוחזרו מ-prisma", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.segments).toEqual(MOCK_SEGMENTS);
  });

  it("קורא ל-prisma.segment.findMany פעם אחת בלבד", async () => {
    await GET();
    expect(mockSegmentFindMany).toHaveBeenCalledOnce();
  });

  it("מעביר orderBy לפי createdAt בסדר יורד", async () => {
    await GET();
    const callArg = mockSegmentFindMany.mock.calls[0][0];
    expect(callArg.orderBy).toEqual({ createdAt: "desc" });
  });

  it("רשימה ריקה — מחזיר segments: []", async () => {
    mockSegmentFindMany.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.segments).toEqual([]);
  });
});

describe("DELETE /api/segments/[id] — משימה 3.11", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSegmentDelete.mockResolvedValue(MOCK_SEGMENT);
  });

  it("מחזיר { success: true } לסגמנט קיים", async () => {
    const res = await DELETE(new Request("http://localhost"), makeParams("seg-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it("קורא ל-prisma.segment.delete עם ה-id הנכון", async () => {
    await DELETE(new Request("http://localhost"), makeParams("seg-1"));
    expect(mockSegmentDelete).toHaveBeenCalledOnce();
    const callArg = mockSegmentDelete.mock.calls[0][0];
    expect(callArg.where).toEqual({ id: "seg-1" });
  });

  it("מחזיר 404 לסגמנט שאינו קיים — שגיאת Prisma P2025", async () => {
    const p2025 = Object.assign(new Error("Record to delete does not exist"), { code: "P2025" });
    mockSegmentDelete.mockRejectedValue(p2025);

    const res = await DELETE(new Request("http://localhost"), makeParams("non-existent-id"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("מחזיר 500 לשגיאת DB שאינה P2025", async () => {
    mockSegmentDelete.mockRejectedValue(new Error("DB connection failed"));

    const res = await DELETE(new Request("http://localhost"), makeParams("seg-1"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});
