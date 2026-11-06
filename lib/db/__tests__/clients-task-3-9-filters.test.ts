/**
 * בדיקות יחידה לפילטרים החדשים ב-listClients() — משימה 3.9 (FR-CL-07).
 *
 * כל קריאות ל-Prisma ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * פילטרים הנבדקים:
 *  - notVisitedDays  → visits.none עם visitDate >= threshold
 *  - ageMin          → birthDate lte (היום − ageMin * 365.25 ימים)
 *  - ageMax          → birthDate gt  (היום − (ageMax+1) * 365.25 ימים)
 *  - source          → contains, insensitive
 *  - tagIds          → AND של tags.some לכל תגית (סמנטיקת AND)
 *  - therapist       → visits.some.therapist contains, insensitive
 *  - marketingConsentChannel → שדה מדויק
 *  - שילוב מספר פילטרים ביחד → כל התנאים נוכחים ב-where
 *
 * הרצה: `npx vitest run --reporter=verbose lib/db/__tests__/clients-task-3-9-filters.test.ts`
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
import { MarketingConsentChannel } from "@prisma/client";

// ─── קבועים ─────────────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_YEAR = 365.25 * MS_PER_DAY;

// תאריך קבוע לכל בדיקות הזמן
const FIXED_NOW = new Date("2025-06-15T12:00:00.000Z");

// ─── עזרים ──────────────────────────────────────────────────────────────────

/** מחזיר את ה-where clause מהקריאה האחרונה ל-mockFindMany */
function getWhereClause() {
  return mockFindMany.mock.calls[0][0].where;
}

/**
 * חילוץ פילטר ספציפי מתוך where clause.
 * כשיש פילטרים מרובים, where הוא { AND: [...] }.
 * כשיש פילטר יחיד, where === הפילטר עצמו.
 */
function extractFilter(where: Record<string, unknown>, matchKey: string): unknown {
  if (!where) return undefined;
  // מקרה: AND עם מספר פילטרים
  if (Array.isArray(where.AND)) {
    return (where.AND as Record<string, unknown>[]).find(
      (f) => f && matchKey in f
    );
  }
  // מקרה: פילטר יחיד
  if (matchKey in where) return where;
  return undefined;
}

// ─── בדיקות ─────────────────────────────────────────────────────────────────

describe("listClients — פילטרים נוספים משימה 3.9 (FR-CL-07)", () => {
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
  // 1. notVisitedDays
  // ══════════════════════════════════════════════════════════════

  describe("notVisitedDays", () => {
    it("30 ימים — מייצר visits.none עם visitDate >= (היום − 30 ימים)", async () => {
      await listClients({ notVisitedDays: 30 });
      const where = getWhereClause();

      const expectedThreshold = new Date(FIXED_NOW.getTime() - 30 * MS_PER_DAY);
      const visitsFilter = extractFilter(where, "visits");

      expect(visitsFilter).toEqual({
        visits: {
          none: {
            visitDate: { gte: expectedThreshold },
          },
        },
      });
    });

    it("7 ימים — הסף הוא 7 ימים לפני FIXED_NOW", async () => {
      await listClients({ notVisitedDays: 7 });
      const where = getWhereClause();

      const expectedThreshold = new Date(FIXED_NOW.getTime() - 7 * MS_PER_DAY);
      const visitsFilter = extractFilter(where, "visits");

      expect(visitsFilter).toEqual({
        visits: {
          none: {
            visitDate: { gte: expectedThreshold },
          },
        },
      });
    });

    it("notVisitedDays=0 — לא מוסיף פילטר (ערך אינו חיובי)", async () => {
      await listClients({ notVisitedDays: 0 });
      const where = getWhereClause();
      // רק statusFilter נשאר
      expect(where).toEqual({ status: "active" });
    });

    it("notVisitedDays לא מסופק — לא מוסיף פילטר", async () => {
      await listClients();
      const where = getWhereClause();
      expect(where).toEqual({ status: "active" });
    });

    it("none ולא some — ודא שהמבנה משתמש ב-none", async () => {
      await listClients({ notVisitedDays: 90 });
      const where = getWhereClause();
      const visitsFilter = extractFilter(where, "visits") as Record<string, unknown>;
      expect(visitsFilter?.visits).toHaveProperty("none");
      expect(visitsFilter?.visits).not.toHaveProperty("some");
    });
  });

  // ══════════════════════════════════════════════════════════════
  // 2. ageMin
  // ══════════════════════════════════════════════════════════════

  describe("ageMin", () => {
    it("ageMin=18 — מייצר birthDate: { lte: היום − 18*365.25 ימים }", async () => {
      await listClients({ ageMin: 18 });
      const where = getWhereClause();

      const expectedDate = new Date(FIXED_NOW.getTime() - 18 * MS_PER_YEAR);
      const birthFilter = extractFilter(where, "birthDate");

      expect(birthFilter).toEqual({
        birthDate: { lte: expectedDate },
      });
    });

    it("ageMin=30 — birthDate lte לתאריך הנכון", async () => {
      await listClients({ ageMin: 30 });
      const where = getWhereClause();

      const expectedDate = new Date(FIXED_NOW.getTime() - 30 * MS_PER_YEAR);
      const birthFilter = extractFilter(where, "birthDate");

      expect(birthFilter).toEqual({
        birthDate: { lte: expectedDate },
      });
    });

    it("ageMin — משתמש ב-lte ולא ב-lt", async () => {
      await listClients({ ageMin: 25 });
      const where = getWhereClause();
      const birthFilter = extractFilter(where, "birthDate") as Record<string, unknown>;
      const birthDate = birthFilter?.birthDate as Record<string, unknown>;
      expect(birthDate).toHaveProperty("lte");
      expect(birthDate).not.toHaveProperty("lt");
      expect(birthDate).not.toHaveProperty("gt");
      expect(birthDate).not.toHaveProperty("gte");
    });
  });

  // ══════════════════════════════════════════════════════════════
  // 3. ageMax
  // ══════════════════════════════════════════════════════════════

  describe("ageMax", () => {
    it("ageMax=65 — מייצר birthDate: { gt: היום − 66*365.25 ימים }", async () => {
      await listClients({ ageMax: 65 });
      const where = getWhereClause();

      const expectedDate = new Date(FIXED_NOW.getTime() - (65 + 1) * MS_PER_YEAR);
      const birthFilter = extractFilter(where, "birthDate");

      expect(birthFilter).toEqual({
        birthDate: { gt: expectedDate },
      });
    });

    it("ageMax=40 — birthDate gt לתאריך הנכון (ageMax+1)*365.25", async () => {
      await listClients({ ageMax: 40 });
      const where = getWhereClause();

      const expectedDate = new Date(FIXED_NOW.getTime() - 41 * MS_PER_YEAR);
      const birthFilter = extractFilter(where, "birthDate");

      expect(birthFilter).toEqual({
        birthDate: { gt: expectedDate },
      });
    });

    it("ageMax — משתמש ב-gt ולא ב-gte", async () => {
      await listClients({ ageMax: 50 });
      const where = getWhereClause();
      const birthFilter = extractFilter(where, "birthDate") as Record<string, unknown>;
      const birthDate = birthFilter?.birthDate as Record<string, unknown>;
      expect(birthDate).toHaveProperty("gt");
      expect(birthDate).not.toHaveProperty("gte");
      expect(birthDate).not.toHaveProperty("lte");
      expect(birthDate).not.toHaveProperty("lt");
    });
  });

  // ══════════════════════════════════════════════════════════════
  // 4. ageMin + ageMax ביחד
  // ══════════════════════════════════════════════════════════════

  describe("ageMin + ageMax ביחד", () => {
    it("ageMin=20, ageMax=40 — שני תנאי birthDate נפרדים ב-where", async () => {
      await listClients({ ageMin: 20, ageMax: 40 });
      const where = getWhereClause();

      // must have AND array with both birthDate filters
      expect(where).toHaveProperty("AND");
      const andArray = where.AND as Record<string, unknown>[];
      const birthDateFilters = andArray.filter((f) => "birthDate" in f);
      expect(birthDateFilters).toHaveLength(2);

      const lteFilter = birthDateFilters.find(
        (f) => (f.birthDate as Record<string, unknown>).lte
      );
      const gtFilter = birthDateFilters.find(
        (f) => (f.birthDate as Record<string, unknown>).gt
      );

      expect(lteFilter).toEqual({
        birthDate: { lte: new Date(FIXED_NOW.getTime() - 20 * MS_PER_YEAR) },
      });
      expect(gtFilter).toEqual({
        birthDate: { gt: new Date(FIXED_NOW.getTime() - 41 * MS_PER_YEAR) },
      });
    });
  });

  // ══════════════════════════════════════════════════════════════
  // 5. source
  // ══════════════════════════════════════════════════════════════

  describe("source", () => {
    it("source='instagram' — מייצר contains insensitive", async () => {
      await listClients({ source: "instagram" });
      const where = getWhereClause();

      const sourceFilter = extractFilter(where, "source");
      expect(sourceFilter).toEqual({
        source: { contains: "instagram", mode: "insensitive" },
      });
    });

    it("source עם רווחים מובילים/נגררים — מנוקה (trim)", async () => {
      await listClients({ source: "  whatsapp  " });
      const where = getWhereClause();

      const sourceFilter = extractFilter(where, "source");
      expect(sourceFilter).toEqual({
        source: { contains: "whatsapp", mode: "insensitive" },
      });
    });

    it("source ריק לחלוטין — לא מוסיף פילטר", async () => {
      await listClients({ source: "" });
      const where = getWhereClause();
      expect(where).toEqual({ status: "active" });
    });

    it("source רווחים בלבד — לא מוסיף פילטר (trim → ריק)", async () => {
      await listClients({ source: "   " });
      const where = getWhereClause();
      expect(where).toEqual({ status: "active" });
    });
  });

  // ══════════════════════════════════════════════════════════════
  // 6. tagIds (AND semantics)
  // ══════════════════════════════════════════════════════════════

  describe("tagIds", () => {
    it("tagId יחיד — מייצר tags.some ישיר (ללא AND עוטף)", async () => {
      await listClients({ tagIds: ["tag-1"] });
      const where = getWhereClause();

      const tagFilter = extractFilter(where, "tags");
      expect(tagFilter).toEqual({
        tags: { some: { tagId: "tag-1" } },
      });
    });

    it("שני tagIds — מייצר AND עם שני תנאי tags.some", async () => {
      await listClients({ tagIds: ["tag-1", "tag-2"] });
      const where = getWhereClause();

      // מחפש את תנאי התגיות ב-AND הראשי
      expect(where).toHaveProperty("AND");
      const andArray = where.AND as Record<string, unknown>[];

      // מחפש את הפילטר שמכיל AND פנימי (הפילטר של התגיות)
      const innerTagFilter = andArray.find(
        (f) => Array.isArray((f as Record<string, unknown>).AND)
      );

      expect(innerTagFilter).toEqual({
        AND: [
          { tags: { some: { tagId: "tag-1" } } },
          { tags: { some: { tagId: "tag-2" } } },
        ],
      });
    });

    it("שלושה tagIds — AND עם שלושה תנאי tags.some", async () => {
      await listClients({ tagIds: ["tag-1", "tag-2", "tag-3"] });
      const where = getWhereClause();

      const andArray = where.AND as Record<string, unknown>[];
      const innerTagFilter = andArray.find(
        (f) => Array.isArray((f as Record<string, unknown>).AND)
      ) as Record<string, unknown>;

      expect((innerTagFilter?.AND as unknown[])?.length).toBe(3);
    });

    it("tagIds ריק — לא מוסיף פילטר", async () => {
      await listClients({ tagIds: [] });
      const where = getWhereClause();
      expect(where).toEqual({ status: "active" });
    });

    it("tagIds עם ערכים ריקים — מסוננים ע\"י filter(Boolean), לא מוסיף פילטר", async () => {
      await listClients({ tagIds: ["", ""] });
      const where = getWhereClause();
      expect(where).toEqual({ status: "active" });
    });
  });

  // ══════════════════════════════════════════════════════════════
  // 7. therapist
  // ══════════════════════════════════════════════════════════════

  describe("therapist", () => {
    it("therapist='ריינה' — מייצר visits.some.therapist contains insensitive", async () => {
      await listClients({ therapist: "ריינה" });
      const where = getWhereClause();

      const therapistFilter = extractFilter(where, "visits");
      expect(therapistFilter).toEqual({
        visits: {
          some: {
            therapist: { contains: "ריינה", mode: "insensitive" },
          },
        },
      });
    });

    it("therapist עם רווחים — מנוקה (trim)", async () => {
      await listClients({ therapist: "  מג'ידה  " });
      const where = getWhereClause();

      const therapistFilter = extractFilter(where, "visits");
      expect(therapistFilter).toEqual({
        visits: {
          some: {
            therapist: { contains: "מג'ידה", mode: "insensitive" },
          },
        },
      });
    });

    it("therapist ריק — לא מוסיף פילטר", async () => {
      await listClients({ therapist: "" });
      const where = getWhereClause();
      expect(where).toEqual({ status: "active" });
    });

    it("therapist רק רווחים — לא מוסיף פילטר", async () => {
      await listClients({ therapist: "   " });
      const where = getWhereClause();
      expect(where).toEqual({ status: "active" });
    });
  });

  // ══════════════════════════════════════════════════════════════
  // 8. marketingConsentChannel
  // ══════════════════════════════════════════════════════════════

  describe("marketingConsentChannel", () => {
    it("whatsapp — פילטר מדויק על ה-enum", async () => {
      await listClients({ marketingConsentChannel: MarketingConsentChannel.whatsapp });
      const where = getWhereClause();

      const consentFilter = extractFilter(where, "marketingConsentChannel");
      expect(consentFilter).toEqual({
        marketingConsentChannel: MarketingConsentChannel.whatsapp,
      });
    });

    it("landing_page — פילטר מדויק", async () => {
      await listClients({ marketingConsentChannel: MarketingConsentChannel.landing_page });
      const where = getWhereClause();

      const consentFilter = extractFilter(where, "marketingConsentChannel");
      expect(consentFilter).toEqual({
        marketingConsentChannel: MarketingConsentChannel.landing_page,
      });
    });

    it("none — פילטר מדויק (ערוץ 'none' תקני)", async () => {
      await listClients({ marketingConsentChannel: MarketingConsentChannel.none });
      const where = getWhereClause();

      const consentFilter = extractFilter(where, "marketingConsentChannel");
      expect(consentFilter).toEqual({
        marketingConsentChannel: MarketingConsentChannel.none,
      });
    });

    it("ללא marketingConsentChannel — לא מוסיף פילטר", async () => {
      await listClients();
      const where = getWhereClause();
      expect(where).toEqual({ status: "active" });
    });

    it("פילטר ב-contains ולא ב-mode — פילטר מדויק, לא contains", async () => {
      await listClients({ marketingConsentChannel: MarketingConsentChannel.sms });
      const where = getWhereClause();
      const consentFilter = extractFilter(where, "marketingConsentChannel") as Record<string, unknown>;
      // ודא שאין 'contains' בתוך marketingConsentChannel — הוא ערך ישיר
      const channelValue = consentFilter?.marketingConsentChannel;
      expect(typeof channelValue).toBe("string");
      expect(channelValue).toBe("sms");
    });
  });

  // ══════════════════════════════════════════════════════════════
  // 9. שילוב מספר פילטרים ביחד
  // ══════════════════════════════════════════════════════════════

  describe("שילוב פילטרים מרובים", () => {
    it("notVisitedDays + source + therapist — כל שלושת התנאים נוכחים ב-AND", async () => {
      await listClients({
        notVisitedDays: 60,
        source: "instagram",
        therapist: "ריינה",
      });
      const where = getWhereClause();

      expect(where).toHaveProperty("AND");
      const andArray = where.AND as Record<string, unknown>[];

      // status filter
      expect(andArray).toContainEqual({ status: "active" });

      // source filter
      expect(andArray).toContainEqual({
        source: { contains: "instagram", mode: "insensitive" },
      });

      // notVisitedDays filter — visits.none
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

      // therapist filter — visits.some
      const therapistCond = andArray.find(
        (f) =>
          typeof f === "object" &&
          f !== null &&
          "visits" in f &&
          typeof (f as Record<string, unknown>).visits === "object" &&
          (f as Record<string, unknown>).visits !== null &&
          "some" in ((f as Record<string, unknown>).visits as Record<string, unknown>)
      );
      expect(therapistCond).toBeDefined();
    });

    it("ageMin + ageMax + marketingConsentChannel + tagId — כל הפילטרים נוכחים", async () => {
      await listClients({
        ageMin: 18,
        ageMax: 60,
        marketingConsentChannel: MarketingConsentChannel.email,
        tagIds: ["tag-vip"],
      });
      const where = getWhereClause();

      expect(where).toHaveProperty("AND");
      const andArray = where.AND as Record<string, unknown>[];

      // status
      expect(andArray).toContainEqual({ status: "active" });

      // marketingConsentChannel
      expect(andArray).toContainEqual({
        marketingConsentChannel: MarketingConsentChannel.email,
      });

      // ageMin — birthDate lte
      const agMinCond = andArray.find(
        (f) =>
          typeof f === "object" &&
          f !== null &&
          "birthDate" in f &&
          (f as Record<string, unknown>).birthDate !== null &&
          "lte" in ((f as Record<string, unknown>).birthDate as Record<string, unknown>)
      );
      expect(agMinCond).toBeDefined();

      // ageMax — birthDate gt
      const ageMaxCond = andArray.find(
        (f) =>
          typeof f === "object" &&
          f !== null &&
          "birthDate" in f &&
          (f as Record<string, unknown>).birthDate !== null &&
          "gt" in ((f as Record<string, unknown>).birthDate as Record<string, unknown>)
      );
      expect(ageMaxCond).toBeDefined();

      // tag — tags.some
      const tagCond = andArray.find(
        (f) =>
          typeof f === "object" &&
          f !== null &&
          "tags" in f
      );
      expect(tagCond).toBeDefined();
      expect(tagCond).toEqual({ tags: { some: { tagId: "tag-vip" } } });
    });

    it("orderBy תמיד createdAt: 'desc' בלי קשר לפילטרים", async () => {
      await listClients({ notVisitedDays: 30, source: "instagram" });
      const callArg = mockFindMany.mock.calls[0][0];
      expect(callArg.orderBy).toEqual({ createdAt: "desc" });
    });
  });
});
