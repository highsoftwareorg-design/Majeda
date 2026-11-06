/**
 * בדיקות יחידה לשילוב פילטרים במקביל — משימה 3.10 (FR-CL-08).
 *
 * קריטריון הקבלה מה-SRS: הפעלת שלושת הפילטרים יחד
 *   (טיפול + מין=נקבה + לא ביקרה מעל 60 ימים)
 * מחזירה רק לקוחות שעומדות בכל השלושה, והמספר המוצג תואם לאורך הרשימה בפועל.
 *
 * כל קריאות ל-Prisma ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * הרצה: `npx vitest run --reporter=verbose lib/db/__tests__/clients-task-3-10-combined-filters.test.ts`
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// ─── Mocks (חייבים לפני ה-imports של המודולים הממוקים) ─────────────────────

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

vi.mock("@/lib/validations/hebrew-search", () => ({
  normalizeHebrewSearchTerm: (s: string) => s,
}));

// ─── Import after mocks ─────────────────────────────────────────────────────
import { listClients } from "@/lib/db/clients";
import { Gender } from "@prisma/client";

// ─── קבועים ─────────────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const FIXED_NOW = new Date("2025-06-15T12:00:00.000Z");

// ─── עזרים ──────────────────────────────────────────────────────────────────

function getWhereClause() {
  return mockFindMany.mock.calls[0][0].where;
}

/** מחלץ כל הרשומות ב-AND הראשי (שטוח) */
function getAndArray(where: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(where.AND)) {
    return where.AND as Record<string, unknown>[];
  }
  return [];
}

// ─── בדיקות ─────────────────────────────────────────────────────────────────

describe("listClients — שילוב פילטרים מקביל (משימה 3.10, FR-CL-08)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ══════════════════════════════════════════════════════════════
  // 1. קריטריון הקבלה: טיפול + מין=נקבה + לא ביקרה מעל 60 ימים
  // ══════════════════════════════════════════════════════════════

  describe("קריטריון קבלה SRS: טיפול + מין=נקבה + לא ביקרה מעל 60 ימים", () => {
    const TREATMENT_ID = "treatment-hair-removal";

    it("ה-where clause מכיל את כל שלושת התנאים ב-AND", async () => {
      await listClients({
        treatmentIds: [TREATMENT_ID],
        treatmentOperator: "AND",
        gender: Gender.female,
        notVisitedDays: 60,
      });

      const where = getWhereClause();

      // חייב להיות AND עם מספר תנאים
      expect(where).toHaveProperty("AND");
      const andArray = getAndArray(where);
      expect(andArray.length).toBeGreaterThan(1);
    });

    it("תנאי המין (female) נוכח ב-AND", async () => {
      await listClients({
        treatmentIds: [TREATMENT_ID],
        treatmentOperator: "AND",
        gender: Gender.female,
        notVisitedDays: 60,
      });

      const where = getWhereClause();
      const andArray = getAndArray(where);

      const genderCond = andArray.find(
        (f) =>
          typeof f === "object" &&
          f !== null &&
          "gender" in f &&
          f.gender === "female"
      );
      expect(genderCond).toBeDefined();
      expect(genderCond).toEqual({ gender: "female" });
    });

    it("תנאי visits.some לטיפול נוכח ב-AND (AND אופרטור)", async () => {
      await listClients({
        treatmentIds: [TREATMENT_ID],
        treatmentOperator: "AND",
        gender: Gender.female,
        notVisitedDays: 60,
      });

      const where = getWhereClause();
      const andArray = getAndArray(where);

      // מחפש AND פנימי — הפילטר של הטיפולים עם AND אופרטור
      const treatmentAndFilter = andArray.find(
        (f) =>
          typeof f === "object" &&
          f !== null &&
          Array.isArray((f as Record<string, unknown>).AND) &&
          ((f as Record<string, unknown>).AND as unknown[]).some(
            (inner) =>
              typeof inner === "object" &&
              inner !== null &&
              "visits" in (inner as Record<string, unknown>) &&
              typeof (inner as Record<string, unknown>).visits === "object" &&
              (inner as Record<string, unknown>).visits !== null &&
              "some" in ((inner as Record<string, unknown>).visits as Record<string, unknown>)
          )
      );
      expect(treatmentAndFilter).toBeDefined();
    });

    it("תנאי visits.none לימי אי-ביקור (60 יום) נוכח ב-AND", async () => {
      await listClients({
        treatmentIds: [TREATMENT_ID],
        treatmentOperator: "AND",
        gender: Gender.female,
        notVisitedDays: 60,
      });

      const where = getWhereClause();
      const andArray = getAndArray(where);

      const expectedThreshold = new Date(FIXED_NOW.getTime() - 60 * MS_PER_DAY);

      const notVisitedCond = andArray.find(
        (f) =>
          typeof f === "object" &&
          f !== null &&
          "visits" in f &&
          typeof (f as Record<string, unknown>).visits === "object" &&
          (f as Record<string, unknown>).visits !== null &&
          "none" in ((f as Record<string, unknown>).visits as Record<string, unknown>)
      );
      expect(notVisitedCond).toBeDefined();
      expect(notVisitedCond).toEqual({
        visits: {
          none: {
            visitDate: { gte: expectedThreshold },
          },
        },
      });
    });

    it("visits.some ו-visits.none נוכחים שניהם (AND ביניהם — לא OR)", async () => {
      await listClients({
        treatmentIds: [TREATMENT_ID],
        treatmentOperator: "AND",
        gender: Gender.female,
        notVisitedDays: 60,
      });

      const where = getWhereClause();
      const andArray = getAndArray(where);

      // visits.some — פילטר הטיפולים
      const hasVisitsSome = andArray.some(
        (f) => {
          if (
            typeof f === "object" &&
            f !== null &&
            Array.isArray((f as Record<string, unknown>).AND)
          ) {
            return ((f as Record<string, unknown>).AND as unknown[]).some(
              (inner) =>
                typeof inner === "object" &&
                inner !== null &&
                "visits" in (inner as Record<string, unknown>) &&
                "some" in ((inner as Record<string, unknown>).visits as Record<string, unknown>)
            );
          }
          return false;
        }
      );
      expect(hasVisitsSome).toBe(true);

      // visits.none — פילטר ימי אי-ביקור
      const hasVisitsNone = andArray.some(
        (f) =>
          typeof f === "object" &&
          f !== null &&
          "visits" in f &&
          "none" in ((f as Record<string, unknown>).visits as Record<string, unknown>)
      );
      expect(hasVisitsNone).toBe(true);
    });

    it("OR אופרטור לטיפולים עם מין=נקבה ו-notVisitedDays — visits.some ב-OR מופיע ב-AND הראשי", async () => {
      await listClients({
        treatmentIds: [TREATMENT_ID],
        treatmentOperator: "OR",
        gender: Gender.female,
        notVisitedDays: 60,
      });

      const where = getWhereClause();
      const andArray = getAndArray(where);

      // visits.some ב-OR: { visits: { some: { visitTreatments: { some: { treatmentId: { in: [...] } } } } } }
      const hasVisitsSomeOr = andArray.some(
        (f) =>
          typeof f === "object" &&
          f !== null &&
          "visits" in f &&
          typeof (f as Record<string, unknown>).visits === "object" &&
          (f as Record<string, unknown>).visits !== null &&
          "some" in ((f as Record<string, unknown>).visits as Record<string, unknown>)
      );
      expect(hasVisitsSomeOr).toBe(true);

      // מין
      const genderCond = andArray.find(
        (f) => typeof f === "object" && f !== null && "gender" in f
      );
      expect(genderCond).toEqual({ gender: "female" });

      // notVisitedDays
      const hasVisitsNone = andArray.some(
        (f) =>
          typeof f === "object" &&
          f !== null &&
          "visits" in f &&
          "none" in ((f as Record<string, unknown>).visits as Record<string, unknown>)
      );
      expect(hasVisitsNone).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // 2. ספירת תוצאות — mockFindMany מחזיר רשימה, וודא שהיא מתועדת
  // ══════════════════════════════════════════════════════════════

  describe("ספירת תוצאות: listClients מחזיר מערך התואם לתוצאות ה-mock", () => {
    it("3 לקוחות מוחזרים כשכל שלושת הפילטרים פעילים", async () => {
      const mockClients = [
        { id: "c1", firstName: "דנה", lastName: "לוי", phone: "0501111111" },
        { id: "c2", firstName: "רחל", lastName: "כהן", phone: "0502222222" },
        { id: "c3", firstName: "מרים", lastName: "ישראלי", phone: "0503333333" },
      ];
      mockFindMany.mockResolvedValue(mockClients);

      const result = await listClients({
        treatmentIds: ["treatment-hair-removal"],
        treatmentOperator: "AND",
        gender: Gender.female,
        notVisitedDays: 60,
      });

      expect(result).toHaveLength(3);
      expect(result).toEqual(mockClients);
    });

    it("0 לקוחות מוחזרים כשאין תואמות", async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await listClients({
        treatmentIds: ["treatment-laser"],
        treatmentOperator: "AND",
        gender: Gender.female,
        notVisitedDays: 60,
      });

      expect(result).toHaveLength(0);
      expect(Array.isArray(result)).toBe(true);
    });

    it("listClients קוראת ל-findMany פעם אחת בלבד", async () => {
      await listClients({
        treatmentIds: ["treatment-hair-removal"],
        gender: Gender.female,
        notVisitedDays: 60,
      });

      expect(mockFindMany).toHaveBeenCalledTimes(1);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // 3. status=active תמיד קיים אפילו עם שלושת הפילטרים
  // ══════════════════════════════════════════════════════════════

  describe("status filter", () => {
    it("status='active' תמיד נוכח ב-AND גם עם שלושת הפילטרים", async () => {
      await listClients({
        treatmentIds: ["treatment-hair-removal"],
        gender: Gender.female,
        notVisitedDays: 60,
      });

      const where = getWhereClause();
      const andArray = getAndArray(where);
      expect(andArray).toContainEqual({ status: "active" });
    });
  });
});
