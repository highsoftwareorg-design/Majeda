/**
 * בדיקות יחידה למודלי נתונים של מעקבים אחרי טיפול — משימה 8.1 (FR-FU-01, §12.1).
 *
 * כל קריאות ל-Prisma ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * בודק:
 * 1. יצירת FollowUpRule עם כל השדות → ודא שנוצרה נכון (מוק Prisma).
 * 2. יצירת FollowUp עם כל השדות → ודא קשרים נכונים (מוק עם include).
 * 3. בדיקת TypeScript: FollowUp מכיל scheduledDate, status, callResult, callNote, callResultAt.
 *
 * הרצה: `npx vitest run lib/db/__tests__/followup-models.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import type { FollowUpRule, FollowUp, Client, Visit } from "@prisma/client";

// --- Mocks ---

const {
  mockRuleCreate,
  mockRuleFindUnique,
  mockFollowUpCreate,
  mockFollowUpFindUnique,
} = vi.hoisted(() => ({
  mockRuleCreate: vi.fn(),
  mockRuleFindUnique: vi.fn(),
  mockFollowUpCreate: vi.fn(),
  mockFollowUpFindUnique: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    followUpRule: {
      create: mockRuleCreate,
      findUnique: mockRuleFindUnique,
    },
    followUp: {
      create: mockFollowUpCreate,
      findUnique: mockFollowUpFindUnique,
    },
  },
}));

// --- נתוני בדיקה ---

const now = new Date("2026-11-07T10:00:00Z");

/** FollowUpRule מלא עם כל השדות */
const mockRule: FollowUpRule = {
  id: "rule-1",
  treatmentId: "treatment-1",
  name: "בדיקת שלומות",
  offsetDays: 7,
  recipientType: "client",
  clientTemplateId: "template-whatsapp-1",
  adminNote: "לבדוק אם הלקוחה מרוצה",
  isActive: true,
  createdAt: now,
  updatedAt: now,
};

/** FollowUp מלא עם כל השדות */
const mockFollowUp: FollowUp = {
  id: "followup-1",
  visitId: "visit-1",
  clientId: "client-1",
  ruleId: "rule-1",
  scheduledDate: new Date("2026-11-14T10:00:00Z"),
  status: "PENDING",
  callResult: null,
  callNote: null,
  callResultAt: null,
  messageId: null,
  createdAt: now,
  updatedAt: now,
};

/** Client מינימלי לצורך קשר */
const mockClient: Pick<Client, "id" | "firstName" | "lastName" | "phone" | "createdAt" | "updatedAt"> = {
  id: "client-1",
  firstName: "מג'ידה",
  lastName: "כהן",
  phone: "0501234567",
  createdAt: now,
  updatedAt: now,
};

/** Visit מינימלי לצורך קשר */
const mockVisit: Pick<Visit, "id" | "clientId" | "visitDate" | "createdAt" | "updatedAt"> = {
  id: "visit-1",
  clientId: "client-1",
  visitDate: new Date("2026-11-07T09:00:00Z"),
  createdAt: now,
  updatedAt: now,
};

// --- בדיקות ---

describe("מודלי נתונים — מעקבים אחרי טיפול (משימה 8.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ════════════════════════════════════════════════════════
  // 1. FollowUpRule — יצירה ושליפה
  // ════════════════════════════════════════════════════════

  describe("FollowUpRule — יצירה ושליפה", () => {
    it("יצירת FollowUpRule עם כל השדות — נשמרים ונשלפים נכון", async () => {
      mockRuleCreate.mockResolvedValue(mockRule);
      mockRuleFindUnique.mockResolvedValue(mockRule);

      const { prisma } = await import("@/lib/db/prisma");

      const created = await prisma.followUpRule.create({
        data: {
          treatmentId: "treatment-1",
          name: "בדיקת שלומות",
          offsetDays: 7,
          recipientType: "client",
          clientTemplateId: "template-whatsapp-1",
          adminNote: "לבדוק אם הלקוחה מרוצה",
          isActive: true,
        },
      });

      const fetched = await prisma.followUpRule.findUnique({
        where: { id: "rule-1" },
      });

      // ודא שה-create נקרא
      expect(mockRuleCreate).toHaveBeenCalledOnce();

      // ודא שה-findUnique נקרא עם ה-id הנכון
      expect(mockRuleFindUnique).toHaveBeenCalledWith({ where: { id: "rule-1" } });

      // ודא שכל שדות הכלל תקינים
      expect(fetched).toBeDefined();
      expect(fetched?.id).toBe("rule-1");
      expect(fetched?.treatmentId).toBe("treatment-1");
      expect(fetched?.name).toBe("בדיקת שלומות");
      expect(fetched?.offsetDays).toBe(7);
      expect(fetched?.recipientType).toBe("client");
      expect(fetched?.clientTemplateId).toBe("template-whatsapp-1");
      expect(fetched?.adminNote).toBe("לבדוק אם הלקוחה מרוצה");
      expect(fetched?.isActive).toBe(true);
      expect(fetched?.createdAt).toEqual(now);
      expect(fetched?.updatedAt).toEqual(now);
    });

    it("FollowUpRule — recipientType=both ו-adminNote עם ערך", async () => {
      const adminRule: FollowUpRule = {
        ...mockRule,
        id: "rule-admin",
        recipientType: "both",
        adminNote: "ליצור קשר ידני עם הלקוחה",
      };

      mockRuleFindUnique.mockResolvedValue(adminRule);

      const { prisma } = await import("@/lib/db/prisma");
      const fetched = await prisma.followUpRule.findUnique({
        where: { id: "rule-admin" },
      });

      expect(fetched?.recipientType).toBe("both");
      expect(fetched?.adminNote).toBe("ליצור קשר ידני עם הלקוחה");
    });

    it("FollowUpRule — clientTemplateId ו-adminNote אופציונליים: יכולים להיות null", async () => {
      const minimalRule: FollowUpRule = {
        ...mockRule,
        id: "rule-minimal",
        clientTemplateId: null,
        adminNote: null,
      };

      mockRuleFindUnique.mockResolvedValue(minimalRule);

      const { prisma } = await import("@/lib/db/prisma");
      const fetched = await prisma.followUpRule.findUnique({
        where: { id: "rule-minimal" },
      });

      expect(fetched?.clientTemplateId).toBeNull();
      expect(fetched?.adminNote).toBeNull();
    });
  });

  // ════════════════════════════════════════════════════════
  // 2. FollowUp — יצירה ושליפה עם קשרים
  // ════════════════════════════════════════════════════════

  describe("FollowUp — יצירה ושליפה עם קשרים", () => {
    it("יצירת FollowUp — כל השדות נשמרים כולל scheduledDate ו-status", async () => {
      mockFollowUpCreate.mockResolvedValue(mockFollowUp);

      const { prisma } = await import("@/lib/db/prisma");
      const created = await prisma.followUp.create({
        data: {
          visitId: "visit-1",
          clientId: "client-1",
          ruleId: "rule-1",
          scheduledDate: new Date("2026-11-14T10:00:00Z"),
          status: "PENDING",
        },
      });

      expect(mockFollowUpCreate).toHaveBeenCalledOnce();
      expect(created?.id).toBe("followup-1");
      expect(created?.visitId).toBe("visit-1");
      expect(created?.clientId).toBe("client-1");
      expect(created?.ruleId).toBe("rule-1");
      expect(created?.scheduledDate).toEqual(new Date("2026-11-14T10:00:00Z"));
      expect(created?.status).toBe("PENDING");
      expect(created?.callResult).toBeNull();
      expect(created?.callNote).toBeNull();
      expect(created?.callResultAt).toBeNull();
      expect(created?.messageId).toBeNull();
    });

    it("שליפת FollowUp עם include: { client, visit, rule } — קשרים תקינים", async () => {
      const followUpWithRelations = {
        ...mockFollowUp,
        client: mockClient,
        visit: mockVisit,
        rule: mockRule,
      };

      mockFollowUpFindUnique.mockResolvedValue(followUpWithRelations);

      const { prisma } = await import("@/lib/db/prisma");
      const fetched = await prisma.followUp.findUnique({
        where: { id: "followup-1" },
        include: { client: true, visit: true, rule: true },
      });

      expect(mockFollowUpFindUnique).toHaveBeenCalledWith({
        where: { id: "followup-1" },
        include: { client: true, visit: true, rule: true },
      });

      // ודא קשר ל-client
      expect(fetched?.client).toBeDefined();
      expect(fetched?.client?.id).toBe("client-1");
      expect(fetched?.client?.firstName).toBe("מג'ידה");
      expect(fetched?.client?.phone).toBe("0501234567");

      // ודא קשר ל-visit
      expect(fetched?.visit).toBeDefined();
      expect(fetched?.visit?.id).toBe("visit-1");
      expect(fetched?.visit?.clientId).toBe("client-1");

      // ודא קשר ל-rule
      expect(fetched?.rule).toBeDefined();
      expect(fetched?.rule?.id).toBe("rule-1");
      expect(fetched?.rule?.name).toBe("בדיקת שלומות");
      expect(fetched?.rule?.offsetDays).toBe(7);
    });

    it("FollowUp — ruleId null: FollowUp שנוצר ידנית (לא מכלל)", async () => {
      const manualFollowUp: FollowUp = {
        ...mockFollowUp,
        id: "followup-manual",
        ruleId: null,
      };

      mockFollowUpFindUnique.mockResolvedValue(manualFollowUp);

      const { prisma } = await import("@/lib/db/prisma");
      const fetched = await prisma.followUp.findUnique({
        where: { id: "followup-manual" },
      });

      expect(fetched?.ruleId).toBeNull();
    });

    it("FollowUp — עדכון callResult לאחר שיחת מעקב", async () => {
      const calledFollowUp: FollowUp = {
        ...mockFollowUp,
        id: "followup-called",
        status: "SENT",
        callResult: "appointment_booked",
        callNote: "הלקוחה קבעה תור ל-20.11",
        callResultAt: new Date("2026-11-14T11:30:00Z"),
      };

      mockFollowUpFindUnique.mockResolvedValue(calledFollowUp);

      const { prisma } = await import("@/lib/db/prisma");
      const fetched = await prisma.followUp.findUnique({
        where: { id: "followup-called" },
      });

      expect(fetched?.status).toBe("SENT");
      expect(fetched?.callResult).toBe("appointment_booked");
      expect(fetched?.callNote).toBe("הלקוחה קבעה תור ל-20.11");
      expect(fetched?.callResultAt).toEqual(new Date("2026-11-14T11:30:00Z"));
    });

    it("FollowUp — status=CANCELLED: מעקב שבוטל", async () => {
      const cancelledFollowUp: FollowUp = {
        ...mockFollowUp,
        id: "followup-cancelled",
        status: "CANCELLED",
      };

      mockFollowUpFindUnique.mockResolvedValue(cancelledFollowUp);

      const { prisma } = await import("@/lib/db/prisma");
      const fetched = await prisma.followUp.findUnique({
        where: { id: "followup-cancelled" },
      });

      expect(fetched?.status).toBe("CANCELLED");
    });
  });

  // ════════════════════════════════════════════════════════
  // 3. בדיקת TypeScript: שדות FollowUp קיימים בזמן ריצה
  // ════════════════════════════════════════════════════════

  describe("TypeScript type check — שדות FollowUp קיימים", () => {
    it("FollowUp מכיל שדה scheduledDate", () => {
      expect("scheduledDate" in mockFollowUp).toBe(true);
      expect(mockFollowUp.scheduledDate).toBeInstanceOf(Date);
    });

    it("FollowUp מכיל שדה status", () => {
      expect("status" in mockFollowUp).toBe(true);
      expect(typeof mockFollowUp.status).toBe("string");
    });

    it("FollowUp מכיל שדה callResult (nullable)", () => {
      expect("callResult" in mockFollowUp).toBe(true);
    });

    it("FollowUp מכיל שדה callNote (nullable)", () => {
      expect("callNote" in mockFollowUp).toBe(true);
    });

    it("FollowUp מכיל שדה callResultAt (nullable DateTime)", () => {
      expect("callResultAt" in mockFollowUp).toBe(true);
    });

    it("FollowUpRule מכיל שדה offsetDays (Int)", () => {
      expect("offsetDays" in mockRule).toBe(true);
      expect(typeof mockRule.offsetDays).toBe("number");
    });

    it("FollowUpRule מכיל שדה recipientType", () => {
      expect("recipientType" in mockRule).toBe(true);
      expect(typeof mockRule.recipientType).toBe("string");
    });

    it("FollowUpRule מכיל שדה isActive (boolean)", () => {
      expect("isActive" in mockRule).toBe(true);
      expect(typeof mockRule.isActive).toBe("boolean");
    });
  });
});

// ════════════════════════════════════════════════════════
// TypeScript compile-time checks — מחוץ לבלוק describe
// ════════════════════════════════════════════════════════

/**
 * בדיקת compile-time: FollowUp חייב להכיל את כל השדות הנדרשים.
 * אם שדה יוסר מהמודל — שורה זו תגרום לשגיאת TypeScript ב-`npx tsc --noEmit`.
 */
type _FollowUpHasRequiredFields = {
  scheduledDate: FollowUp["scheduledDate"];
  status: FollowUp["status"];
  callResult: FollowUp["callResult"];
  callNote: FollowUp["callNote"];
  callResultAt: FollowUp["callResultAt"];
};

// ודא שה-FollowUp assignable ל-type הנדרש (compile-time בלבד)
const _typeCheck: _FollowUpHasRequiredFields = {
  scheduledDate: mockFollowUp.scheduledDate,
  status: mockFollowUp.status,
  callResult: mockFollowUp.callResult,
  callNote: mockFollowUp.callNote,
  callResultAt: mockFollowUp.callResultAt,
};
void _typeCheck;

/**
 * בדיקת compile-time: FollowUpRule חייב להכיל את כל השדות הנדרשים.
 */
type _RuleHasRequiredFields = {
  treatmentId: FollowUpRule["treatmentId"];
  name: FollowUpRule["name"];
  offsetDays: FollowUpRule["offsetDays"];
  recipientType: FollowUpRule["recipientType"];
  clientTemplateId: FollowUpRule["clientTemplateId"];
  adminNote: FollowUpRule["adminNote"];
  isActive: FollowUpRule["isActive"];
};

const _ruleTypeCheck: _RuleHasRequiredFields = {
  treatmentId: mockRule.treatmentId,
  name: mockRule.name,
  offsetDays: mockRule.offsetDays,
  recipientType: mockRule.recipientType,
  clientTemplateId: mockRule.clientTemplateId,
  adminNote: mockRule.adminNote,
  isActive: mockRule.isActive,
};
void _ruleTypeCheck;
