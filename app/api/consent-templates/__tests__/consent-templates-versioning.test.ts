/**
 * בדיקות ניהול גרסאות תבניות הסכמה — משימה 7.3 (FR-CF-03).
 *
 * בודק:
 * 1. PATCH על תבנית קיימת → גרסה ישנה מסומנת isActive=false, גרסה חדשה נוצרת עם version=2,
 *    previousVersionId=old.id, isActive=true; מחזיר { id, version: 2 }.
 * 2. PATCH אינו נוגע ב-SignedConsent — לא נקראת אף פעולה על prisma.signedConsent.
 * 3. PATCH על תבנית שאינה קיימת → 404.
 *
 * הרצה: `npx vitest run app/api/consent-templates/__tests__/consent-templates-versioning.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// --- Mocks (חייבים להגיע לפני imports של המודולים הממוקים) ---

const {
  mockFindUnique,
  mockUpdate,
  mockCreate,
  mockTransaction,
  mockSignedConsentFindMany,
  mockSignedConsentUpdate,
  mockSignedConsentDelete,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockCreate: vi.fn(),
  mockTransaction: vi.fn(),
  mockSignedConsentFindMany: vi.fn(),
  mockSignedConsentUpdate: vi.fn(),
  mockSignedConsentDelete: vi.fn(),
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
    consentTemplate: {
      findUnique: mockFindUnique,
      update: mockUpdate,
      create: mockCreate,
    },
    signedConsent: {
      findMany: mockSignedConsentFindMany,
      update: mockSignedConsentUpdate,
      delete: mockSignedConsentDelete,
    },
    $transaction: mockTransaction,
  },
}));

// --- Import handler after mocks ---

import { PATCH } from "@/app/api/consent-templates/[id]/route";

// --- עזרים ---

function makePatchRequest(id: string, body: unknown): Request {
  return new Request(`http://localhost/api/consent-templates/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** תבנית מדומה — גרסה 1, פעילה */
const OLD_TEMPLATE = {
  id: "template-old",
  name: "טופס הסכמה כללי",
  isGeneral: true,
  treatmentIds: [],
  validityDays: 365,
  language: "he" as const,
  version: 1,
  isActive: true,
  previousVersionId: null,
  fields: [{ id: "f1", type: "checkbox", label: "קראתי והסכמתי", required: true }],
  createdAt: new Date("2026-11-07T10:00:00Z"),
  updatedAt: new Date("2026-11-07T10:00:00Z"),
};

/** תבנית חדשה שתיווצר עם version=2 */
const NEW_TEMPLATE = {
  ...OLD_TEMPLATE,
  id: "template-new",
  version: 2,
  previousVersionId: "template-old",
  isActive: true,
  name: "טופס הסכמה כללי מעודכן",
};

// --- בדיקות ---

describe("PATCH /api/consent-templates/[id] — ניהול גרסאות (משימה 7.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue(OLD_TEMPLATE);

    // מדמה את prisma.$transaction: מפעיל את ה-callback עם אובייקט tx מדומה
    mockTransaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => {
        const txUpdate = vi.fn().mockResolvedValue({ ...OLD_TEMPLATE, isActive: false });
        const txCreate = vi.fn().mockResolvedValue(NEW_TEMPLATE);

        const tx = {
          consentTemplate: {
            update: txUpdate,
            create: txCreate,
          },
        };

        const result = await callback(tx);

        // שמור הפניות לפונקציות ה-tx כדי שנוכל לבדוק אותן
        (mockTransaction as unknown as Record<string, unknown>)._lastTxUpdate = txUpdate;
        (mockTransaction as unknown as Record<string, unknown>)._lastTxCreate = txCreate;

        return result;
      }
    );
  });

  it("גרסה ישנה מסומנת isActive=false בתוך ה-transaction", async () => {
    const req = makePatchRequest("template-old", { name: "טופס הסכמה כללי מעודכן" });

    const res = await PATCH(req, makeParams("template-old"));

    expect(res.status).toBe(200);
    expect(mockTransaction).toHaveBeenCalledOnce();

    const txUpdate = (mockTransaction as unknown as Record<string, ReturnType<typeof vi.fn>>)._lastTxUpdate;
    expect(txUpdate).toBeDefined();
    expect(txUpdate).toHaveBeenCalledOnce();
    expect(txUpdate).toHaveBeenCalledWith({
      where: { id: "template-old" },
      data: { isActive: false },
    });
  });

  it("גרסה חדשה נוצרת עם version=2, previousVersionId=old.id, isActive=true", async () => {
    const req = makePatchRequest("template-old", { name: "טופס הסכמה כללי מעודכן" });

    const res = await PATCH(req, makeParams("template-old"));

    expect(res.status).toBe(200);

    const txCreate = (mockTransaction as unknown as Record<string, ReturnType<typeof vi.fn>>)._lastTxCreate;
    expect(txCreate).toBeDefined();
    expect(txCreate).toHaveBeenCalledOnce();

    const createArg = txCreate.mock.calls[0][0];
    expect(createArg.data.version).toBe(2);
    expect(createArg.data.previousVersionId).toBe("template-old");
    expect(createArg.data.isActive).toBe(true);
  });

  it("תגובה מחזירה { id, version: 2 } של הגרסה החדשה", async () => {
    const req = makePatchRequest("template-old", { name: "טופס הסכמה כללי מעודכן" });

    const res = await PATCH(req, makeParams("template-old"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect((body as Record<string, unknown>).id).toBe("template-new");
    expect((body as Record<string, unknown>).version).toBe(2);
  });

  it("PATCH אינו נוגע ב-SignedConsent — אין קריאה ל-signedConsent", async () => {
    const req = makePatchRequest("template-old", { name: "שם מעודכן" });

    await PATCH(req, makeParams("template-old"));

    expect(mockSignedConsentFindMany).not.toHaveBeenCalled();
    expect(mockSignedConsentUpdate).not.toHaveBeenCalled();
    expect(mockSignedConsentDelete).not.toHaveBeenCalled();
  });

  it("תבנית שאינה קיימת → 404", async () => {
    mockFindUnique.mockResolvedValue(null);

    const req = makePatchRequest("does-not-exist", { name: "שם כלשהו" });

    const res = await PATCH(req, makeParams("does-not-exist"));

    expect(res.status).toBe(404);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
