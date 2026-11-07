/**
 * בדיקות ל-createFollowUpsForVisit — משימה 8.3 (FR-FU-02).
 *
 * כל הקריאות ל-Prisma ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * בודק:
 * 1. ביקור עם 2 כללים פעילים → prisma.followUp.createMany נקרא עם 2 רשומות ב-scheduledDate נכון.
 * 2. ביקור ללא כללים פעילים → 0 מעקבים נוצרים.
 * 3. scheduledDate = visitDate + offsetDays (למשל visitDate=היום, offsetDays=7 → היום+7).
 * 4. ביקור לא קיים → מחזיר 0.
 * 5. אידמפוטנטיות: כלל שכבר קיים לביקור אינו נוצר שוב.
 *
 * הרצה: `npx vitest run lib/db/__tests__/visits-followups.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// --- Mocks (חייבים לפני ה-imports של המודולים הממוקים) ---

const {
  mockVisitFindUnique,
  mockFollowUpFindMany,
  mockFollowUpCreateMany,
} = vi.hoisted(() => ({
  mockVisitFindUnique: vi.fn(),
  mockFollowUpFindMany: vi.fn(),
  mockFollowUpCreateMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    visit: {
      findUnique: mockVisitFindUnique,
    },
    followUp: {
      findMany: mockFollowUpFindMany,
      createMany: mockFollowUpCreateMany,
    },
  },
}));

// --- Import אחרי ה-mock ---
import { createFollowUpsForVisit } from "@/lib/db/visits";

// --- עזרים ---

/** מחזיר תאריך ביקור בסיסי */
const VISIT_DATE = new Date("2026-11-07T00:00:00Z");
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** מבנה ביקור עם כללים פעילים */
function makeVisit(
  rules: { id: string; offsetDays: number }[]
) {
  return {
    id: "visit-1",
    clientId: "client-1",
    visitDate: VISIT_DATE,
    visitTreatments: [
      {
        treatment: {
          followUpRules: rules,
        },
      },
    ],
  };
}

// --- בדיקות ---

describe("createFollowUpsForVisit — משימה 8.3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFollowUpFindMany.mockResolvedValue([]);
    mockFollowUpCreateMany.mockResolvedValue({ count: 0 });
  });

  // ═══════════════════════════════════════════════════════
  // 1. ביקור עם 2 כללים פעילים
  // ═══════════════════════════════════════════════════════

  describe("ביקור עם 2 כללים פעילים", () => {
    const RULES = [
      { id: "rule-1", offsetDays: 7 },
      { id: "rule-2", offsetDays: 30 },
    ];

    beforeEach(() => {
      mockVisitFindUnique.mockResolvedValue(makeVisit(RULES));
      mockFollowUpCreateMany.mockResolvedValue({ count: 2 });
    });

    it("prisma.followUp.createMany נקרא פעם אחת", async () => {
      await createFollowUpsForVisit("visit-1");
      expect(mockFollowUpCreateMany).toHaveBeenCalledOnce();
    });

    it("createMany מקבל מערך עם 2 רשומות", async () => {
      await createFollowUpsForVisit("visit-1");
      const arg = mockFollowUpCreateMany.mock.calls[0][0];
      expect(arg.data).toHaveLength(2);
    });

    it("מחזיר 2 (מספר המעקבים שנוצרו)", async () => {
      const count = await createFollowUpsForVisit("visit-1");
      expect(count).toBe(2);
    });

    it("scheduledDate של כלל 1 = visitDate + 7 ימים", async () => {
      await createFollowUpsForVisit("visit-1");
      const arg = mockFollowUpCreateMany.mock.calls[0][0];
      const record1 = arg.data.find((d: { ruleId: string }) => d.ruleId === "rule-1");
      expect(record1).toBeDefined();
      expect(record1.scheduledDate.getTime()).toBe(addDays(VISIT_DATE, 7).getTime());
    });

    it("scheduledDate של כלל 2 = visitDate + 30 ימים", async () => {
      await createFollowUpsForVisit("visit-1");
      const arg = mockFollowUpCreateMany.mock.calls[0][0];
      const record2 = arg.data.find((d: { ruleId: string }) => d.ruleId === "rule-2");
      expect(record2).toBeDefined();
      expect(record2.scheduledDate.getTime()).toBe(addDays(VISIT_DATE, 30).getTime());
    });

    it("כל רשומה מכילה visitId, clientId, ruleId, status=PENDING", async () => {
      await createFollowUpsForVisit("visit-1");
      const arg = mockFollowUpCreateMany.mock.calls[0][0];
      for (const record of arg.data) {
        expect(record.visitId).toBe("visit-1");
        expect(record.clientId).toBe("client-1");
        expect(record.status).toBe("PENDING");
        expect(["rule-1", "rule-2"]).toContain(record.ruleId);
      }
    });
  });

  // ═══════════════════════════════════════════════════════
  // 2. ביקור ללא כללים פעילים
  // ═══════════════════════════════════════════════════════

  describe("ביקור ללא כללים פעילים", () => {
    it("ביקור ללא טיפולים → 0 מעקבים ו-createMany לא נקרא", async () => {
      mockVisitFindUnique.mockResolvedValue({
        id: "visit-empty",
        clientId: "client-1",
        visitDate: VISIT_DATE,
        visitTreatments: [],
      });

      const count = await createFollowUpsForVisit("visit-empty");
      expect(count).toBe(0);
      expect(mockFollowUpCreateMany).not.toHaveBeenCalled();
    });

    it("ביקור עם טיפול ללא כללים פעילים → 0 מעקבים", async () => {
      mockVisitFindUnique.mockResolvedValue(makeVisit([]));

      const count = await createFollowUpsForVisit("visit-1");
      expect(count).toBe(0);
      expect(mockFollowUpCreateMany).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════
  // 3. חישוב scheduledDate — visitDate=היום, offsetDays=7
  // ═══════════════════════════════════════════════════════

  describe("חישוב scheduledDate", () => {
    it("offsetDays=0 → scheduledDate = visitDate עצמה", async () => {
      mockVisitFindUnique.mockResolvedValue(
        makeVisit([{ id: "rule-zero", offsetDays: 0 }])
      );
      mockFollowUpCreateMany.mockResolvedValue({ count: 1 });

      await createFollowUpsForVisit("visit-1");
      const arg = mockFollowUpCreateMany.mock.calls[0][0];
      const record = arg.data[0];
      expect(record.scheduledDate.getTime()).toBe(VISIT_DATE.getTime());
    });

    it("offsetDays=1 → scheduledDate = visitDate + 1 יום", async () => {
      mockVisitFindUnique.mockResolvedValue(
        makeVisit([{ id: "rule-one", offsetDays: 1 }])
      );
      mockFollowUpCreateMany.mockResolvedValue({ count: 1 });

      await createFollowUpsForVisit("visit-1");
      const arg = mockFollowUpCreateMany.mock.calls[0][0];
      const record = arg.data[0];
      expect(record.scheduledDate.getTime()).toBe(addDays(VISIT_DATE, 1).getTime());
    });
  });

  // ═══════════════════════════════════════════════════════
  // 4. ביקור לא קיים
  // ═══════════════════════════════════════════════════════

  describe("ביקור לא קיים", () => {
    it("prisma.visit.findUnique מחזיר null → 0 ו-createMany לא נקרא", async () => {
      mockVisitFindUnique.mockResolvedValue(null);

      const count = await createFollowUpsForVisit("nonexistent-visit");
      expect(count).toBe(0);
      expect(mockFollowUpCreateMany).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════
  // 5. אידמפוטנטיות
  // ═══════════════════════════════════════════════════════

  describe("אידמפוטנטיות — כלל קיים אינו נוצר שוב", () => {
    it("כלל שכבר קיים → לא נוצר שוב, רק הכלל החדש נוצר", async () => {
      mockVisitFindUnique.mockResolvedValue(
        makeVisit([
          { id: "rule-existing", offsetDays: 7 },
          { id: "rule-new", offsetDays: 14 },
        ])
      );
      // כלל "rule-existing" כבר קיים
      mockFollowUpFindMany.mockResolvedValue([{ ruleId: "rule-existing" }]);
      mockFollowUpCreateMany.mockResolvedValue({ count: 1 });

      const count = await createFollowUpsForVisit("visit-1");
      expect(count).toBe(1);

      const arg = mockFollowUpCreateMany.mock.calls[0][0];
      expect(arg.data).toHaveLength(1);
      expect(arg.data[0].ruleId).toBe("rule-new");
    });

    it("כל הכללים קיימים כבר → createMany לא נקרא כלל", async () => {
      mockVisitFindUnique.mockResolvedValue(
        makeVisit([{ id: "rule-1", offsetDays: 7 }])
      );
      mockFollowUpFindMany.mockResolvedValue([{ ruleId: "rule-1" }]);

      const count = await createFollowUpsForVisit("visit-1");
      expect(count).toBe(0);
      expect(mockFollowUpCreateMany).not.toHaveBeenCalled();
    });
  });
});
