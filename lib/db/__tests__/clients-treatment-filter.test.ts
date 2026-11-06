/**
 * בדיקות יחידה לפילטר הטיפולים ב-listClients() — משימה 3.6 (FR-CL-04).
 *
 * כל קריאות ל-Prisma ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * בודק:
 * 1. ללא treatmentIds — לא מוסיף תנאי טיפול ל-where.
 * 2. treatmentIds כמערך ריק — לא מוסיף תנאי.
 * 3. OR (ברירת מחדל): טיפול יחיד — where עם treatmentId: { in: ['tid1'] }.
 * 4. OR: מספר טיפולים — where עם treatmentId: { in: ['tid1', 'tid2'] }.
 * 5. AND: טיפול יחיד — AND עם תנאי visits.some יחיד.
 * 6. AND: שני טיפולים — AND עם שני תנאי visits.some נפרדים.
 *
 * הרצה: `npx vitest run --reporter=verbose lib/db/__tests__/clients-treatment-filter.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// --- Mocks (חייבים לפני ה-imports של המודולים הממוקים) ---

const { mockFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    client: {
      findMany: mockFindMany,
    },
  },
}));

// מנרמל את מונח החיפוש — מוחזר ללא שינוי בבדיקות אלו
vi.mock("@/lib/validations/hebrew-search", () => ({
  normalizeHebrewSearchTerm: (s: string) => s,
}));

// --- Import after mocks ---
import { listClients } from "@/lib/db/clients";

// --- עזרים ---

/** מחזיר את ה-where clause מהקריאה האחרונה ל-mockFindMany */
function getWhereClause() {
  return mockFindMany.mock.calls[0][0].where;
}

// --- בדיקות ---

describe("listClients — פילטר טיפולים (משימה 3.6, FR-CL-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
  });

  // ════════════════════════════════════════════════════════
  // 1. ללא פילטר טיפולים
  // ════════════════════════════════════════════════════════

  describe("ללא treatmentIds", () => {
    it("ללא שום אפשרויות — where יכיל רק פילטר status (ולא תנאי טיפול)", async () => {
      await listClients();
      const where = getWhereClause();
      // filters.length === 1 → where === statusFilter ישירות
      expect(where).toEqual({ status: "active" });
    });

    it("treatmentIds כמערך ריק — לא מוסיף תנאי טיפול ל-where", async () => {
      await listClients({ treatmentIds: [] });
      const where = getWhereClause();
      expect(where).toEqual({ status: "active" });
    });

    it("treatmentIds עם ערכים ריקים בלבד — מסוננים ע\"י filter(Boolean), לא מוסיף תנאי", async () => {
      await listClients({ treatmentIds: ["", "   ".trim()] });
      const where = getWhereClause();
      // כל הערכים הריקים מסוננים → treatmentFilter === undefined
      expect(where).toEqual({ status: "active" });
    });
  });

  // ════════════════════════════════════════════════════════
  // 2. OR אופרטור (ברירת מחדל)
  // ════════════════════════════════════════════════════════

  describe("OR אופרטור (ברירת מחדל)", () => {
    it("טיפול יחיד ב-OR — where מכיל visits.some עם treatmentId: { in: ['tid1'] }", async () => {
      await listClients({ treatmentIds: ["tid1"] });
      const where = getWhereClause();

      expect(where).toEqual({
        AND: [
          { status: "active" },
          {
            visits: {
              some: {
                visitTreatments: {
                  some: { treatmentId: { in: ["tid1"] } },
                },
              },
            },
          },
        ],
      });
    });

    it("שני טיפולים ב-OR (מפורש) — where מכיל visits.some עם treatmentId: { in: ['tid1','tid2'] }", async () => {
      await listClients({ treatmentIds: ["tid1", "tid2"], treatmentOperator: "OR" });
      const where = getWhereClause();

      expect(where).toEqual({
        AND: [
          { status: "active" },
          {
            visits: {
              some: {
                visitTreatments: {
                  some: { treatmentId: { in: ["tid1", "tid2"] } },
                },
              },
            },
          },
        ],
      });
    });

    it("OR ללא treatmentOperator מפורש — אותה תוצאה כמו OR מפורש (ברירת מחדל)", async () => {
      const resDefault = await (async () => {
        await listClients({ treatmentIds: ["tid1", "tid2"] });
        return getWhereClause();
      })();
      vi.clearAllMocks();
      mockFindMany.mockResolvedValue([]);
      await listClients({ treatmentIds: ["tid1", "tid2"], treatmentOperator: "OR" });
      const resExplicit = getWhereClause();

      expect(resDefault).toEqual(resExplicit);
    });
  });

  // ════════════════════════════════════════════════════════
  // 3. AND אופרטור
  // ════════════════════════════════════════════════════════

  describe("AND אופרטור", () => {
    it("טיפול יחיד ב-AND — where מכיל AND עם תנאי visits.some יחיד ל-tid1", async () => {
      await listClients({ treatmentIds: ["tid1"], treatmentOperator: "AND" });
      const where = getWhereClause();

      expect(where).toEqual({
        AND: [
          { status: "active" },
          {
            AND: [
              {
                visits: {
                  some: {
                    visitTreatments: {
                      some: { treatmentId: "tid1" },
                    },
                  },
                },
              },
            ],
          },
        ],
      });
    });

    it("שני טיפולים ב-AND — where מכיל AND עם שני תנאי visits.some נפרדים לכל טיפול", async () => {
      await listClients({ treatmentIds: ["tid1", "tid2"], treatmentOperator: "AND" });
      const where = getWhereClause();

      expect(where).toEqual({
        AND: [
          { status: "active" },
          {
            AND: [
              {
                visits: {
                  some: {
                    visitTreatments: {
                      some: { treatmentId: "tid1" },
                    },
                  },
                },
              },
              {
                visits: {
                  some: {
                    visitTreatments: {
                      some: { treatmentId: "tid2" },
                    },
                  },
                },
              },
            ],
          },
        ],
      });
    });

    it("שלושה טיפולים ב-AND — AND מכיל שלושה תנאי visits.some", async () => {
      await listClients({ treatmentIds: ["t1", "t2", "t3"], treatmentOperator: "AND" });
      const where = getWhereClause();

      const treatmentFilter = where?.AND?.[1];
      expect(treatmentFilter?.AND).toHaveLength(3);

      // כל תנאי מכיל visits.some עם treatmentId ספציפי
      const tids = treatmentFilter.AND.map(
        (cond: { visits: { some: { visitTreatments: { some: { treatmentId: string } } } } }) =>
          cond.visits.some.visitTreatments.some.treatmentId
      );
      expect(tids).toEqual(["t1", "t2", "t3"]);
    });

    it("AND עם כל treatmentId בתנאי visits.some נפרד — לא treatmentId: { in: ... }", async () => {
      await listClients({ treatmentIds: ["tid1", "tid2"], treatmentOperator: "AND" });
      const where = getWhereClause();

      const treatmentFilter = where?.AND?.[1];
      // AND ולא visits.some עם in
      expect(treatmentFilter).not.toHaveProperty("visits");
      expect(treatmentFilter).toHaveProperty("AND");

      // כל תנאי ב-AND צריך להכיל treatmentId כערך ישיר (לא { in: [...] })
      treatmentFilter.AND.forEach(
        (cond: { visits: { some: { visitTreatments: { some: { treatmentId: unknown } } } } }) => {
          const tid = cond.visits.some.visitTreatments.some.treatmentId;
          expect(typeof tid).toBe("string");
          // לא { in: [...] }
          expect(tid).not.toHaveProperty("in");
        }
      );
    });
  });

  // ════════════════════════════════════════════════════════
  // 4. בדיקות סנטי — לא שוברות פרמטרים אחרים
  // ════════════════════════════════════════════════════════

  describe("שילוב עם פרמטרים אחרים", () => {
    it("treatmentIds עם includeArchived:true — where לא מכיל status filter", async () => {
      await listClients({ treatmentIds: ["tid1"], includeArchived: true });
      const where = getWhereClause();

      // אין statusFilter → filters.length === 1 → where === treatmentFilter ישירות
      expect(where).toEqual({
        visits: {
          some: {
            visitTreatments: {
              some: { treatmentId: { in: ["tid1"] } },
            },
          },
        },
      });
    });

    it("orderBy תמיד createdAt: 'desc' בלי קשר לפילטרים", async () => {
      await listClients({ treatmentIds: ["tid1"] });
      const callArg = mockFindMany.mock.calls[0][0];
      expect(callArg.orderBy).toEqual({ createdAt: "desc" });
    });
  });
});
