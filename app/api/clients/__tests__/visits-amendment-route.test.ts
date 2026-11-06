/**
 * בדיקות ל-PATCH /api/clients/:id/visits/:visitId — משימה 4.8 (FR-PR-07): נעילת 24 שעות ותיקונים.
 *
 * כל הקריאות ל-Prisma ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * בודק:
 * 1. ביקור נעול (createdAt > 24 שעות): notes → יוצר VisitAmendment, לא מעדכן notes ישירות.
 * 2. ביקור נעול: clientReaction → יוצר VisitAmendment, לא מעדכן clientReaction ישירות.
 * 3. ביקור נעול: שני שדות (notes + clientReaction) → שני תיקונים נוצרים.
 * 4. ביקור נעול: רק returnDate → עדכון ישיר (לא נעול), אין תיקון.
 * 5. ביקור נעול: notes + returnDate → תיקון ל-notes + עדכון ישיר ל-returnDate.
 * 6. ביקור לא נעול (createdAt < 24 שעות): notes → עדכון ישיר, אין תיקון.
 * 7. ביקור נעול: התגובה מכילה locked=true.
 * 8. ביקור לא נעול: התגובה מכילה locked=false.
 * 9. הסיכום המקורי בביקור הנעול נשמר (visitAmendment.create מקבל את oldValue הנכון).
 * 10. visitAmendment.create מקבל את editedBy מה-session.
 *
 * הרצה: `npx vitest run --reporter=verbose app/api/clients/__tests__/visits-amendment-route.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// --- Mocks (vi.hoisted חייב לפני ה-imports) ---

const {
  mockVisitUpdate,
  mockVisitFindFirst,
  mockVisitFindUnique,
  mockAmendmentCreate,
  mockTransaction,
  mockGetClientById,
  mockAuth,
} = vi.hoisted(() => {
  const mockAmendmentCreate = vi.fn().mockResolvedValue({});
  const mockVisitUpdate = vi.fn().mockResolvedValue({});

  // מדמה $transaction: מקבל callback ומריץ אותו עם אובייקט tx מדומה
  const mockTransaction = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      visit: { update: mockVisitUpdate },
      visitAmendment: { create: mockAmendmentCreate },
    };
    return cb(tx);
  });

  return {
    mockVisitUpdate,
    mockVisitFindFirst: vi.fn(),
    mockVisitFindUnique: vi.fn(),
    mockAmendmentCreate,
    mockTransaction,
    mockGetClientById: vi.fn(),
    mockAuth: vi.fn(),
  };
});

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    visit: {
      update: mockVisitUpdate,
      findFirst: mockVisitFindFirst,
      findUnique: mockVisitFindUnique,
    },
    visitAmendment: {
      create: mockAmendmentCreate,
    },
    $transaction: mockTransaction,
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

function makeParams(id = "client-1", visitId = "visit-99") {
  return { params: Promise.resolve({ id, visitId }) };
}

/** createdAt שנמצא 25 שעות בעבר — ביקור נעול */
function oldCreatedAt(): Date {
  return new Date(Date.now() - 25 * 60 * 60 * 1000);
}

/** createdAt שנמצא שעה בלבד בעבר — ביקור לא נעול */
function recentCreatedAt(): Date {
  return new Date(Date.now() - 60 * 60 * 1000);
}

const ACTIVE_CLIENT = {
  id: "client-1",
  status: "active",
  firstName: "דנה",
  lastName: "כהן",
};

/** ביקור נעול עם notes קיים */
function lockedVisit(overrides: Record<string, unknown> = {}) {
  return {
    id: "visit-99",
    clientId: "client-1",
    visitDate: new Date("2026-01-01"),
    notes: "סיכום מקורי",
    clientReaction: "תגובה מקורית",
    returnDate: null,
    visitTreatments: [],
    amendments: [],
    createdAt: oldCreatedAt(),
    ...overrides,
  };
}

/** ביקור לא נעול */
function freshVisit(overrides: Record<string, unknown> = {}) {
  return {
    id: "visit-99",
    clientId: "client-1",
    visitDate: new Date("2026-11-05"),
    notes: "סיכום ראשוני",
    clientReaction: null,
    returnDate: null,
    visitTreatments: [],
    amendments: [],
    createdAt: recentCreatedAt(),
    ...overrides,
  };
}

/** ביקור מלא המוחזר מ-findUnique לאחר הטרנזקציה */
const VISIT_WITH_AMENDMENT = {
  id: "visit-99",
  clientId: "client-1",
  visitDate: new Date("2026-01-01"),
  notes: "סיכום מקורי",
  clientReaction: "תגובה מקורית",
  returnDate: null,
  visitTreatments: [],
  amendments: [
    {
      id: "amend-1",
      visitId: "visit-99",
      field: "notes",
      oldValue: "סיכום מקורי",
      newValue: "סיכום מתוקן",
      editedBy: "admin@example.com",
      editedAt: new Date(),
    },
  ],
};

// --- בדיקות ---

describe("PATCH — ביקור נעול (createdAt > 24 שעות): לוגיקת תיקונים", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { email: "admin@example.com" } });
    mockGetClientById.mockResolvedValue(ACTIVE_CLIENT);
    mockVisitFindFirst.mockResolvedValue(lockedVisit());
    mockVisitFindUnique.mockResolvedValue(VISIT_WITH_AMENDMENT);
    // $transaction: מאפס ומגדיר מחדש את ה-callback runner
    mockTransaction.mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          visit: { update: mockVisitUpdate },
          visitAmendment: { create: mockAmendmentCreate },
        };
        return cb(tx);
      }
    );
    mockAmendmentCreate.mockResolvedValue({});
    mockVisitUpdate.mockResolvedValue({});
  });

  it("notes בביקור נעול — קורא ל-$transaction ולא ל-visit.update ישירות עם notes", async () => {
    const req = makeRequest({ notes: "סיכום מתוקן" });
    const res = await PATCH(req, makeParams());

    expect(res.status).toBe(200);
    // $transaction חייב להיקרא
    expect(mockTransaction).toHaveBeenCalledOnce();
    // visit.update (ב-top-level, לא בטרנזקציה) לא אמור להיקרא עבור notes
    // (הוא עשוי להיקרא בתוך ה-tx אך רק ל-returnDate; כאן אין returnDate)
    // בדיקה: data.notes לא אמור להיות מועבר ל-visit.update ב-top-level
    const topLevelUpdateCalls = mockVisitUpdate.mock.calls.filter(
      (call) => call[0]?.data?.notes !== undefined
    );
    expect(topLevelUpdateCalls).toHaveLength(0);
  });

  it("notes בביקור נעול — visitAmendment.create נקרא עם field='notes' ו-newValue נכון", async () => {
    const req = makeRequest({ notes: "סיכום מתוקן" });
    await PATCH(req, makeParams());

    expect(mockAmendmentCreate).toHaveBeenCalledOnce();
    const callData = mockAmendmentCreate.mock.calls[0][0].data;
    expect(callData.field).toBe("notes");
    expect(callData.newValue).toBe("סיכום מתוקן");
    expect(callData.visitId).toBe("visit-99");
  });

  it("notes בביקור נעול — oldValue בתיקון הוא הסיכום המקורי", async () => {
    const req = makeRequest({ notes: "סיכום מתוקן" });
    await PATCH(req, makeParams());

    const callData = mockAmendmentCreate.mock.calls[0][0].data;
    expect(callData.oldValue).toBe("סיכום מקורי");
  });

  it("clientReaction בביקור נעול — visitAmendment.create נקרא עם field='clientReaction'", async () => {
    const req = makeRequest({ clientReaction: "תגובה מעודכנת" });
    await PATCH(req, makeParams());

    expect(mockAmendmentCreate).toHaveBeenCalledOnce();
    const callData = mockAmendmentCreate.mock.calls[0][0].data;
    expect(callData.field).toBe("clientReaction");
    expect(callData.newValue).toBe("תגובה מעודכנת");
    expect(callData.oldValue).toBe("תגובה מקורית");
  });

  it("notes + clientReaction בביקור נעול — שני תיקונים נוצרים", async () => {
    const req = makeRequest({
      notes: "סיכום חדש",
      clientReaction: "תגובה חדשה",
    });
    await PATCH(req, makeParams());

    expect(mockAmendmentCreate).toHaveBeenCalledTimes(2);
    const fields = mockAmendmentCreate.mock.calls.map((c) => c[0].data.field);
    expect(fields).toContain("notes");
    expect(fields).toContain("clientReaction");
  });

  it("רק returnDate בביקור נעול — עדכון ישיר (לא transaction), אין amendment", async () => {
    // returnDate תמיד מותר ישירות גם כשנעול
    mockVisitUpdate.mockResolvedValue({
      ...lockedVisit(),
      returnDate: new Date("2027-03-01"),
      amendments: [],
      visitTreatments: [],
    });

    const req = makeRequest({ returnDate: "2027-03-01" });
    const res = await PATCH(req, makeParams());

    expect(res.status).toBe(200);
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockAmendmentCreate).not.toHaveBeenCalled();
    // visit.update נקרא ישירות (לא דרך טרנזקציה)
    expect(mockVisitUpdate).toHaveBeenCalledOnce();
    const callData = mockVisitUpdate.mock.calls[0][0].data;
    expect(callData.returnDate).toBeInstanceOf(Date);
  });

  it("notes + returnDate בביקור נעול — $transaction עבור notes + visit.update בתוך הטרנזקציה ל-returnDate", async () => {
    const req = makeRequest({ notes: "סיכום", returnDate: "2027-03-01" });
    await PATCH(req, makeParams());

    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockAmendmentCreate).toHaveBeenCalledOnce();

    // visit.update בתוך הטרנזקציה צריך לכלול returnDate
    const updateCallsWithReturnDate = mockVisitUpdate.mock.calls.filter(
      (call) => call[0]?.data?.returnDate !== undefined
    );
    expect(updateCallsWithReturnDate).toHaveLength(1);
    expect(updateCallsWithReturnDate[0][0].data.returnDate).toBeInstanceOf(Date);
  });

  it("ביקור נעול — התגובה מכילה locked=true", async () => {
    const req = makeRequest({ notes: "שינוי" });
    const res = await PATCH(req, makeParams());

    const data = await res.json();
    expect(data.locked).toBe(true);
  });

  it("editedBy בתיקון לקוח מגיע מה-session", async () => {
    mockAuth.mockResolvedValue({ user: { email: "therapist@clinic.com" } });

    const req = makeRequest({ notes: "הערה מהמטפלת" });
    await PATCH(req, makeParams());

    const callData = mockAmendmentCreate.mock.calls[0][0].data;
    expect(callData.editedBy).toBe("therapist@clinic.com");
  });

  it("ביקור נעול ללא session — editedBy='system'", async () => {
    mockAuth.mockResolvedValue(null);

    const req = makeRequest({ notes: "הערה ללא משתמש" });
    await PATCH(req, makeParams());

    const callData = mockAmendmentCreate.mock.calls[0][0].data;
    expect(callData.editedBy).toBe("system");
  });
});

describe("PATCH — ביקור לא נעול (createdAt < 24 שעות): עדכון ישיר", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { email: "admin@example.com" } });
    mockGetClientById.mockResolvedValue(ACTIVE_CLIENT);
    mockVisitFindFirst.mockResolvedValue(freshVisit());
    mockVisitUpdate.mockResolvedValue({
      ...freshVisit(),
      notes: "סיכום מעודכן",
      amendments: [],
      visitTreatments: [],
    });
  });

  it("notes בביקור לא נעול — עדכון ישיר (visit.update), ללא $transaction", async () => {
    const req = makeRequest({ notes: "סיכום מעודכן" });
    const res = await PATCH(req, makeParams());

    expect(res.status).toBe(200);
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockAmendmentCreate).not.toHaveBeenCalled();
    expect(mockVisitUpdate).toHaveBeenCalledOnce();
    const callData = mockVisitUpdate.mock.calls[0][0].data;
    expect(callData.notes).toBe("סיכום מעודכן");
  });

  it("clientReaction בביקור לא נעול — עדכון ישיר, ללא amendment", async () => {
    mockVisitUpdate.mockResolvedValue({
      ...freshVisit(),
      clientReaction: "תגובה מעולה",
      amendments: [],
      visitTreatments: [],
    });

    const req = makeRequest({ clientReaction: "תגובה מעולה" });
    const res = await PATCH(req, makeParams());

    expect(res.status).toBe(200);
    expect(mockAmendmentCreate).not.toHaveBeenCalled();
    const callData = mockVisitUpdate.mock.calls[0][0].data;
    expect(callData.clientReaction).toBe("תגובה מעולה");
  });

  it("ביקור לא נעול — התגובה מכילה locked=false", async () => {
    const req = makeRequest({ notes: "שינוי" });
    const res = await PATCH(req, makeParams());

    const data = await res.json();
    expect(data.locked).toBe(false);
  });
});

describe("PATCH — גבול 24 שעות: חישוב נכון של isVisitLocked", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { email: "admin@example.com" } });
    mockGetClientById.mockResolvedValue(ACTIVE_CLIENT);
  });

  it("createdAt לפני בדיוק 24 שעות + שנייה — נעול", async () => {
    const twentyFourHoursPlusOneSec = new Date(
      Date.now() - (24 * 60 * 60 + 1) * 1000
    );
    mockVisitFindFirst.mockResolvedValue(
      lockedVisit({ createdAt: twentyFourHoursPlusOneSec })
    );
    mockVisitFindUnique.mockResolvedValue(VISIT_WITH_AMENDMENT);
    mockTransaction.mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          visit: { update: mockVisitUpdate },
          visitAmendment: { create: mockAmendmentCreate },
        };
        return cb(tx);
      }
    );
    mockAmendmentCreate.mockResolvedValue({});

    const req = makeRequest({ notes: "שינוי" });
    const res = await PATCH(req, makeParams());
    const data = await res.json();

    expect(data.locked).toBe(true);
    expect(mockAmendmentCreate).toHaveBeenCalled();
  });

  it("createdAt לפני בדיוק 23 שעות — לא נעול", async () => {
    const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000);
    mockVisitFindFirst.mockResolvedValue(
      freshVisit({ createdAt: twentyThreeHoursAgo })
    );
    mockVisitUpdate.mockResolvedValue({
      ...freshVisit({ createdAt: twentyThreeHoursAgo }),
      notes: "שינוי",
      amendments: [],
      visitTreatments: [],
    });

    const req = makeRequest({ notes: "שינוי" });
    const res = await PATCH(req, makeParams());
    const data = await res.json();

    expect(data.locked).toBe(false);
    expect(mockAmendmentCreate).not.toHaveBeenCalled();
    expect(mockVisitUpdate).toHaveBeenCalledOnce();
  });
});
