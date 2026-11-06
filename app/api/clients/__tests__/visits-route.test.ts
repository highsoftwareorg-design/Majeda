/**
 * בדיקות ל-POST /api/clients/:id/visits — משימה 4.5 (FR-PR-02).
 *
 * כל הקריאות ל-Prisma ול-getClientById ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * בודק:
 * 1. בקשה תקינה עם כל השדות — יוצרת visit ומחזירה 201.
 * 2. בקשה תקינה ללא treatmentIds — יוצרת visit ללא קשרי טיפולים.
 * 3. תאריך חסר — 400 עם הודעה עברית.
 * 4. תאריך לא תקין — 400.
 * 5. מחיר שלילי — 400.
 * 6. לקוח לא קיים — 404.
 * 7. לקוח בארכיון — 409.
 * 8. body לא JSON — 400.
 * 9. מחיר 0 (אי-שלילי תקין) — יוצר visit עם price=0.
 * 10. מחיר null/undefined (אופציונלי) — יוצר visit עם price=null.
 *
 * הרצה: `npx vitest run --reporter=verbose app/api/clients/__tests__/visits-route.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// --- Mocks (חייבים לפני ה-imports של המודולים הממוקים) ---

// vi.hoisted מבטיח שהמשתנים מאותחלים לפני הרמת vi.mock לראש הקובץ
const { mockVisitCreate, mockGetClientById } = vi.hoisted(() => ({
  mockVisitCreate: vi.fn(),
  mockGetClientById: vi.fn(),
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
    visit: {
      create: mockVisitCreate,
    },
  },
}));

vi.mock("@/lib/db/clients", () => ({
  getClientById: mockGetClientById,
}));

// --- Import handler after mocks ---

import { POST } from "@/app/api/clients/[id]/visits/route";

// --- עזרים ---

/** יוצר Request מדומה עם body JSON */
function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/clients/client-1/visits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** לקוח פעיל מדומה */
const ACTIVE_CLIENT = {
  id: "client-1",
  status: "active",
  firstName: "דנה",
  lastName: "כהן",
};

/** ביקור מדומה שמוחזר מ-prisma.visit.create */
const MOCK_VISIT = {
  id: "visit-new",
  clientId: "client-1",
  visitDate: new Date("2026-11-05"),
  therapist: "מג'ידה",
  treatedArea: "פנים",
  products: "חומצה היאלורונית — אצווה 2024-B",
  parameters: "15J",
  notes: "תוצאות מצוינות",
  price: 350,
  visitTreatments: [],
  createdAt: new Date("2026-11-05"),
  updatedAt: new Date("2026-11-05"),
};

/** params מדומה (Promise) */
function makeParams(id = "client-1") {
  return { params: Promise.resolve({ id }) };
}

// --- בדיקות ---

describe("POST /api/clients/:id/visits — נתונים תקינים", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClientById.mockResolvedValue(ACTIVE_CLIENT);
    mockVisitCreate.mockResolvedValue(MOCK_VISIT);
  });

  it("בקשה תקינה עם כל השדות — מחזירה 201", async () => {
    const req = makeRequest({
      visitDate: "2026-11-05",
      treatmentIds: ["t-1"],
      therapist: "מג'ידה",
      treatedArea: "פנים",
      products: "חומצה היאלורונית — אצווה 2024-B",
      parameters: "15J",
      notes: "תוצאות מצוינות",
      price: 350,
    });

    const res = await POST(req, makeParams());

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toHaveProperty("visit");
  });

  it("קורא ל-prisma.visit.create עם clientId נכון", async () => {
    const req = makeRequest({ visitDate: "2026-11-05" });
    await POST(req, makeParams("client-42"));

    // getClientById נקרא עם ה-id
    expect(mockGetClientById).toHaveBeenCalledWith("client-42");
  });

  it("בקשה ללא treatmentIds — נוצר visit ללא visitTreatments", async () => {
    const req = makeRequest({ visitDate: "2026-11-05" });
    await POST(req, makeParams());

    expect(mockVisitCreate).toHaveBeenCalledOnce();
    const callArg = mockVisitCreate.mock.calls[0][0].data;
    // ללא treatmentIds — לא נוצר visitTreatments.create
    expect(callArg).not.toHaveProperty("visitTreatments");
  });

  it("מחיר 0 (אי-שלילי) — נוצר visit עם price=0", async () => {
    const req = makeRequest({ visitDate: "2026-11-05", price: 0 });
    const res = await POST(req, makeParams());

    expect(res.status).toBe(201);
    const callArg = mockVisitCreate.mock.calls[0][0].data;
    expect(callArg.price).toBe(0);
  });

  it("מחיר לא מסופק (undefined) — נוצר visit עם price=undefined (null ב-DB)", async () => {
    const req = makeRequest({ visitDate: "2026-11-05" });
    await POST(req, makeParams());

    const callArg = mockVisitCreate.mock.calls[0][0].data;
    // price undefined (לא נשלח) → price: undefined (Prisma מתייחס כ-null)
    expect(callArg.price).toBeUndefined();
  });

  it("מספר אצווה (products) נשמר נכון", async () => {
    const batchText = "חומצה היאלורונית — אצווה 2024-B, 1ml";
    const req = makeRequest({ visitDate: "2026-11-05", products: batchText });
    await POST(req, makeParams());

    const callArg = mockVisitCreate.mock.calls[0][0].data;
    expect(callArg.products).toBe(batchText);
  });

  it("מחיר כמספר עשרוני — נשמר נכון (350.5)", async () => {
    const req = makeRequest({ visitDate: "2026-11-05", price: 350.5 });
    await POST(req, makeParams());

    const callArg = mockVisitCreate.mock.calls[0][0].data;
    expect(callArg.price).toBe(350.5);
  });
});

describe("POST /api/clients/:id/visits — ולידציה: תאריך", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClientById.mockResolvedValue(ACTIVE_CLIENT);
  });

  it("תאריך חסר — מחזירה 400 עם הודעה על שדה חובה", async () => {
    const req = makeRequest({ therapist: "מישהי" }); // בלי visitDate
    const res = await POST(req, makeParams());

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeTruthy();
    expect(mockVisitCreate).not.toHaveBeenCalled();
  });

  it("תאריך לא תקין (string שאינה ISO) — מחזירה 400", async () => {
    const req = makeRequest({ visitDate: "not-a-date" });
    const res = await POST(req, makeParams());

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("תקין");
    expect(mockVisitCreate).not.toHaveBeenCalled();
  });

  it("visitDate הוא null — מחזירה 400", async () => {
    const req = makeRequest({ visitDate: null });
    const res = await POST(req, makeParams());

    expect(res.status).toBe(400);
    expect(mockVisitCreate).not.toHaveBeenCalled();
  });
});

describe("POST /api/clients/:id/visits — ולידציה: מחיר", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClientById.mockResolvedValue(ACTIVE_CLIENT);
  });

  it("מחיר שלילי (-100) — מחזירה 400", async () => {
    const req = makeRequest({ visitDate: "2026-11-05", price: -100 });
    const res = await POST(req, makeParams());

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("אי-שלילי");
    expect(mockVisitCreate).not.toHaveBeenCalled();
  });

  it("מחיר שהוא string שאינה מספר — מחזירה 400", async () => {
    const req = makeRequest({ visitDate: "2026-11-05", price: "abc" });
    const res = await POST(req, makeParams());

    expect(res.status).toBe(400);
    expect(mockVisitCreate).not.toHaveBeenCalled();
  });

  it('מחיר "" (מחרוזת ריקה) — נחשב כ-null, לא שגיאה', async () => {
    mockVisitCreate.mockResolvedValue(MOCK_VISIT);
    const req = makeRequest({ visitDate: "2026-11-05", price: "" });
    const res = await POST(req, makeParams());

    expect(res.status).toBe(201);
  });
});

describe("POST /api/clients/:id/visits — ולידציה: לקוח", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("לקוח לא קיים — מחזירה 404", async () => {
    mockGetClientById.mockResolvedValue(null);
    const req = makeRequest({ visitDate: "2026-11-05" });
    const res = await POST(req, makeParams("nonexistent-id"));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBeTruthy();
    expect(mockVisitCreate).not.toHaveBeenCalled();
  });

  it("לקוח בארכיון — מחזירה 409", async () => {
    mockGetClientById.mockResolvedValue({
      ...ACTIVE_CLIENT,
      status: "archived",
    });
    const req = makeRequest({ visitDate: "2026-11-05" });
    const res = await POST(req, makeParams());

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("ארכיון");
    expect(mockVisitCreate).not.toHaveBeenCalled();
  });
});

describe("POST /api/clients/:id/visits — ולידציה: body", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClientById.mockResolvedValue(ACTIVE_CLIENT);
  });

  it("body שאינו JSON — מחזירה 400", async () => {
    const req = new Request("http://localhost/api/clients/client-1/visits", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "not json at all",
    });
    const res = await POST(req, makeParams());

    expect(res.status).toBe(400);
    expect(mockVisitCreate).not.toHaveBeenCalled();
  });

  it("body הוא מערך (לא אובייקט) — מחזירה 400", async () => {
    const req = new Request("http://localhost/api/clients/client-1/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ visitDate: "2026-11-05" }]),
    });
    const res = await POST(req, makeParams());

    expect(res.status).toBe(400);
    expect(mockVisitCreate).not.toHaveBeenCalled();
  });
});

describe("POST /api/clients/:id/visits — טיפול בשגיאת שרת", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClientById.mockResolvedValue(ACTIVE_CLIENT);
  });

  it("כאשר prisma.visit.create זורק שגיאה — מחזירה 500", async () => {
    mockVisitCreate.mockRejectedValue(new Error("DB error"));
    const req = makeRequest({ visitDate: "2026-11-05" });
    const res = await POST(req, makeParams());

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });
});
