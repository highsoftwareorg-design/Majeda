/**
 * בדיקות ל-PATCH /api/clients/:id/visits/:visitId — משימה 4.6 (FR-PR-03).
 *
 * כל הקריאות ל-Prisma ול-getClientById ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * בודק:
 * 1. עדכון notes בלבד — מחזיר 200 עם הביקור המעודכן.
 * 2. עדכון clientReaction בלבד — מחזיר 200 עם הביקור המעודכן.
 * 3. עדכון שני השדות יחד — מחזיר 200.
 * 4. body ריק (ללא notes/clientReaction) — מחזיר 400.
 * 5. לקוח לא קיים — מחזיר 404.
 * 6. לקוח בארכיון — מחזיר 409.
 * 7. ביקור לא קיים / לא שייך ללקוח — מחזיר 404.
 * 8. body לא JSON — מחזיר 400.
 * 9. שגיאת DB — מחזיר 500.
 * 10. notes ריק (מחרוזת ריקה) — נשמר כ-null.
 *
 * הרצה: `npx vitest run --reporter=verbose app/api/clients/__tests__/visits-patch-route.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// --- Mocks ---

const { mockVisitUpdate, mockVisitFindFirst, mockGetClientById } = vi.hoisted(
  () => ({
    mockVisitUpdate: vi.fn(),
    mockVisitFindFirst: vi.fn(),
    mockGetClientById: vi.fn(),
  })
);

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

// Mock next-auth/auth — prevents deep import chain from next-auth
vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { email: "test@example.com" } }),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    visit: {
      update: mockVisitUpdate,
      findFirst: mockVisitFindFirst,
    },
  },
}));

vi.mock("@/lib/db/clients", () => ({
  getClientById: mockGetClientById,
}));

import { PATCH } from "@/app/api/clients/[id]/visits/[visitId]/route";

// --- עזרים ---

function makeRequest(body: unknown): Request {
  return new Request(
    "http://localhost/api/clients/client-1/visits/visit-99",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

const ACTIVE_CLIENT = {
  id: "client-1",
  status: "active",
  firstName: "דנה",
  lastName: "כהן",
};

const EXISTING_VISIT = {
  id: "visit-99",
  clientId: "client-1",
  visitDate: new Date("2026-11-05"),
  notes: null,
  clientReaction: null,
  visitTreatments: [],
  amendments: [],
  // createdAt חייב להיות "עדכני" (פחות מ-24 שעות) כדי שהביקור לא ייחשב נעול בבדיקות אלו.
  createdAt: new Date(),
};

const UPDATED_VISIT = {
  ...EXISTING_VISIT,
  notes: "תוצאות מצוינות",
  clientReaction: "שביעות רצון גבוהה",
  amendments: [],
};

function makeParams(id = "client-1", visitId = "visit-99") {
  return { params: Promise.resolve({ id, visitId }) };
}

// --- בדיקות ---

describe("PATCH /api/clients/:id/visits/:visitId — עדכון תקין", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClientById.mockResolvedValue(ACTIVE_CLIENT);
    mockVisitFindFirst.mockResolvedValue(EXISTING_VISIT);
    mockVisitUpdate.mockResolvedValue(UPDATED_VISIT);
  });

  it("עדכון notes בלבד — מחזיר 200 עם ביקור מעודכן", async () => {
    const req = makeRequest({ notes: "תוצאות מצוינות" });
    const res = await PATCH(req, makeParams());

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("visit");
  });

  it("עדכון clientReaction בלבד — מחזיר 200", async () => {
    const req = makeRequest({ clientReaction: "שביעות רצון גבוהה" });
    const res = await PATCH(req, makeParams());

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("visit");
  });

  it("עדכון שני השדות יחד — מחזיר 200", async () => {
    const req = makeRequest({
      notes: "תוצאות מצוינות",
      clientReaction: "שביעות רצון גבוהה",
    });
    const res = await PATCH(req, makeParams());

    expect(res.status).toBe(200);
  });

  it("קורא ל-prisma.visit.update עם notes נכון", async () => {
    const req = makeRequest({ notes: "סיכום חופשי" });
    await PATCH(req, makeParams());

    expect(mockVisitUpdate).toHaveBeenCalledOnce();
    const callData = mockVisitUpdate.mock.calls[0][0].data;
    expect(callData.notes).toBe("סיכום חופשי");
  });

  it("קורא ל-prisma.visit.update עם clientReaction נכון", async () => {
    const req = makeRequest({ clientReaction: "תגובה חיובית" });
    await PATCH(req, makeParams());

    const callData = mockVisitUpdate.mock.calls[0][0].data;
    expect(callData.clientReaction).toBe("תגובה חיובית");
  });

  it("notes ריק (מחרוזת ריקה) — נשמר כ-null", async () => {
    const req = makeRequest({ notes: "" });
    await PATCH(req, makeParams());

    const callData = mockVisitUpdate.mock.calls[0][0].data;
    expect(callData.notes).toBeNull();
  });

  it("clientReaction ריק — נשמר כ-null", async () => {
    const req = makeRequest({ clientReaction: "   " });
    await PATCH(req, makeParams());

    const callData = mockVisitUpdate.mock.calls[0][0].data;
    expect(callData.clientReaction).toBeNull();
  });

  it("קורא ל-prisma.visit.findFirst עם visitId ו-clientId נכונים", async () => {
    const req = makeRequest({ notes: "בדיקה" });
    await PATCH(req, makeParams("client-1", "visit-99"));

    expect(mockVisitFindFirst).toHaveBeenCalledWith({
      where: { id: "visit-99", clientId: "client-1" },
    });
  });
});

describe("PATCH /api/clients/:id/visits/:visitId — ולידציה", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClientById.mockResolvedValue(ACTIVE_CLIENT);
    mockVisitFindFirst.mockResolvedValue(EXISTING_VISIT);
  });

  it("body ריק (ללא שדות מוכרים) — מחזיר 400", async () => {
    const req = makeRequest({});
    const res = await PATCH(req, makeParams());

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeTruthy();
    expect(mockVisitUpdate).not.toHaveBeenCalled();
  });

  it("body עם שדה שאינו notes/clientReaction — מחזיר 400", async () => {
    const req = makeRequest({ price: 500 });
    const res = await PATCH(req, makeParams());

    expect(res.status).toBe(400);
    expect(mockVisitUpdate).not.toHaveBeenCalled();
  });

  it("body לא JSON — מחזיר 400", async () => {
    const req = new Request(
      "http://localhost/api/clients/client-1/visits/visit-99",
      {
        method: "PATCH",
        headers: { "Content-Type": "text/plain" },
        body: "not json",
      }
    );
    const res = await PATCH(req, makeParams());

    expect(res.status).toBe(400);
    expect(mockVisitUpdate).not.toHaveBeenCalled();
  });

  it("body הוא מערך — מחזיר 400", async () => {
    const req = new Request(
      "http://localhost/api/clients/client-1/visits/visit-99",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ notes: "test" }]),
      }
    );
    const res = await PATCH(req, makeParams());

    expect(res.status).toBe(400);
    expect(mockVisitUpdate).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/clients/:id/visits/:visitId — ולידציה: לקוח וביקור", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("לקוח לא קיים — מחזיר 404", async () => {
    mockGetClientById.mockResolvedValue(null);
    const req = makeRequest({ notes: "test" });
    const res = await PATCH(req, makeParams("nonexistent"));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBeTruthy();
    expect(mockVisitUpdate).not.toHaveBeenCalled();
  });

  it("לקוח בארכיון — מחזיר 409", async () => {
    mockGetClientById.mockResolvedValue({
      ...ACTIVE_CLIENT,
      status: "archived",
    });
    const req = makeRequest({ notes: "test" });
    const res = await PATCH(req, makeParams());

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("ארכיון");
    expect(mockVisitUpdate).not.toHaveBeenCalled();
  });

  it("ביקור לא קיים — מחזיר 404", async () => {
    mockGetClientById.mockResolvedValue(ACTIVE_CLIENT);
    mockVisitFindFirst.mockResolvedValue(null);
    const req = makeRequest({ notes: "test" });
    const res = await PATCH(req, makeParams("client-1", "nonexistent-visit"));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBeTruthy();
    expect(mockVisitUpdate).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/clients/:id/visits/:visitId — שגיאת שרת", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClientById.mockResolvedValue(ACTIVE_CLIENT);
    mockVisitFindFirst.mockResolvedValue(EXISTING_VISIT);
  });

  it("כאשר prisma.visit.update זורק שגיאה — מחזיר 500", async () => {
    mockVisitUpdate.mockRejectedValue(new Error("DB error"));
    const req = makeRequest({ notes: "test" });
    const res = await PATCH(req, makeParams());

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// task 4.7 — תמיכה בשדה returnDate ב-PATCH (FR-PR-05)
// ---------------------------------------------------------------------------

describe("PATCH /api/clients/:id/visits/:visitId — returnDate (task 4.7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClientById.mockResolvedValue(ACTIVE_CLIENT);
    mockVisitFindFirst.mockResolvedValue(EXISTING_VISIT);
    mockVisitUpdate.mockResolvedValue({
      ...EXISTING_VISIT,
      returnDate: new Date("2026-05-01"),
    });
  });

  it("עדכון returnDate בלבד — מחזיר 200", async () => {
    const req = makeRequest({ returnDate: "2026-05-01" });
    const res = await PATCH(req, makeParams());

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("visit");
  });

  it("קורא ל-prisma.visit.update עם returnDate כאובייקט Date", async () => {
    const req = makeRequest({ returnDate: "2026-05-01" });
    await PATCH(req, makeParams());

    expect(mockVisitUpdate).toHaveBeenCalledOnce();
    const callData = mockVisitUpdate.mock.calls[0][0].data;
    expect(callData.returnDate).toBeInstanceOf(Date);
    // 2026-05-01 ב-UTC
    expect(callData.returnDate.toISOString().slice(0, 10)).toBe("2026-05-01");
  });

  it("returnDate = null — נשמר כ-null", async () => {
    mockVisitUpdate.mockResolvedValue({ ...EXISTING_VISIT, returnDate: null });
    const req = makeRequest({ returnDate: null });
    const res = await PATCH(req, makeParams());

    expect(res.status).toBe(200);
    const callData = mockVisitUpdate.mock.calls[0][0].data;
    expect(callData.returnDate).toBeNull();
  });

  it("returnDate = מחרוזת ריקה — נשמר כ-null", async () => {
    mockVisitUpdate.mockResolvedValue({ ...EXISTING_VISIT, returnDate: null });
    const req = makeRequest({ returnDate: "" });
    const res = await PATCH(req, makeParams());

    expect(res.status).toBe(200);
    const callData = mockVisitUpdate.mock.calls[0][0].data;
    expect(callData.returnDate).toBeNull();
  });

  it("returnDate = מחרוזת לא תקינה — מחזיר 400 ואינו קורא ל-update", async () => {
    const req = makeRequest({ returnDate: "not-a-date" });
    const res = await PATCH(req, makeParams());

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeTruthy();
    expect(mockVisitUpdate).not.toHaveBeenCalled();
  });

  it("returnDate = מספר (לא מחרוזת/null) — מחזיר 400", async () => {
    const req = makeRequest({ returnDate: 1234567890 });
    const res = await PATCH(req, makeParams());

    expect(res.status).toBe(400);
    expect(mockVisitUpdate).not.toHaveBeenCalled();
  });

  it("returnDate יחד עם notes — שניהם נשמרים ב-updateData", async () => {
    mockVisitUpdate.mockResolvedValue({
      ...EXISTING_VISIT,
      notes: "סיכום",
      returnDate: new Date("2026-05-01"),
    });
    const req = makeRequest({ notes: "סיכום", returnDate: "2026-05-01" });
    const res = await PATCH(req, makeParams());

    expect(res.status).toBe(200);
    const callData = mockVisitUpdate.mock.calls[0][0].data;
    expect(callData.notes).toBe("סיכום");
    expect(callData.returnDate).toBeInstanceOf(Date);
  });
});
