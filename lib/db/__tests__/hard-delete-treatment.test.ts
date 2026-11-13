/**
 * בדיקות ל-hardDeleteTreatment — מחיקה לצמיתות של טיפול מהקטלוג (משימה 12.3, §12).
 *
 * כל קריאות ל-Prisma ממוקות (`$transaction` מריץ callback עם אובייקט tx מדומה).
 * אין גישה אמיתית ל-DB.
 *
 * בודק:
 * 1. טיפול מקושר (תור + client.requested + FollowUpRule + VisitTreatment) →
 *    תורים ולקוחות מנותקים (treatmentId/requestedTreatmentId=null, לא נמחקים);
 *    FollowUp.ruleId מנותק ואז FollowUpRule נמחק; VisitTreatment נמחק; treatment.delete אחרון.
 * 2. סדר הטרנזקציה מפורש — מנתק/מוחק את כל אילוצי ה-FK (Restrict) לפני מחיקת הטיפול.
 * 3. בלי כללי מעקב → followUp.updateMany לא נקרא, אך followUpRule.deleteMany כן.
 * 4. מזהה לא קיים → מחזיר false, ללא ניתוק/מחיקה.
 * 5. אטומיות — הכל ב-$transaction יחיד.
 *
 * הרצה: `npx vitest run lib/db/__tests__/hard-delete-treatment.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני ה-imports של המודולים הממוקים
// ---------------------------------------------------------------------------

const {
  mockTransaction,
  mockTreatmentFindUnique,
  mockTreatmentDelete,
  mockAppointmentUpdateMany,
  mockClientUpdateMany,
  mockFollowUpRuleFindMany,
  mockFollowUpRuleDeleteMany,
  mockFollowUpUpdateMany,
  mockVisitTreatmentDeleteMany,
  callOrder,
} = vi.hoisted(() => {
  // סדר הקריאות שנאסף כדי לאמת את סדר הטרנזקציה
  const callOrder: string[] = [];
  const track =
    (name: string, resolved: unknown = { count: 0 }) =>
    vi.fn(async (...args: unknown[]) => {
      callOrder.push(name);
      return typeof resolved === "function"
        ? (resolved as (...a: unknown[]) => unknown)(...args)
        : resolved;
    });

  const mockTreatmentFindUnique = track("treatment.findUnique", undefined);
  const mockTreatmentDelete = track("treatment.delete", {});
  const mockAppointmentUpdateMany = track("appointment.updateMany");
  const mockClientUpdateMany = track("client.updateMany");
  const mockFollowUpRuleFindMany = track("followUpRule.findMany", []);
  const mockFollowUpRuleDeleteMany = track("followUpRule.deleteMany");
  const mockFollowUpUpdateMany = track("followUp.updateMany");
  const mockVisitTreatmentDeleteMany = track("visitTreatment.deleteMany");

  const tx = {
    treatment: {
      findUnique: mockTreatmentFindUnique,
      delete: mockTreatmentDelete,
    },
    appointment: { updateMany: mockAppointmentUpdateMany },
    client: { updateMany: mockClientUpdateMany },
    followUpRule: {
      findMany: mockFollowUpRuleFindMany,
      deleteMany: mockFollowUpRuleDeleteMany,
    },
    followUp: { updateMany: mockFollowUpUpdateMany },
    visitTreatment: { deleteMany: mockVisitTreatmentDeleteMany },
  };

  // מדמה $transaction(callback, options) — מריץ את ה-callback עם tx המדומה
  const mockTransaction = vi.fn(
    async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)
  );

  return {
    mockTransaction,
    mockTreatmentFindUnique,
    mockTreatmentDelete,
    mockAppointmentUpdateMany,
    mockClientUpdateMany,
    mockFollowUpRuleFindMany,
    mockFollowUpRuleDeleteMany,
    mockFollowUpUpdateMany,
    mockVisitTreatmentDeleteMany,
    callOrder,
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: { $transaction: mockTransaction },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { hardDeleteTreatment } from "@/lib/db/hard-delete-treatment";

// ---------------------------------------------------------------------------
// עזרים
// ---------------------------------------------------------------------------

/** מגדיר תרחיש "טיפול מקושר" — קיים + כלל מעקב אחד. */
function seedLinkedTreatment() {
  mockTreatmentFindUnique.mockResolvedValueOnce({ id: "treat-1" });
  mockFollowUpRuleFindMany.mockResolvedValueOnce([{ id: "rule-1" }]);
}

beforeEach(() => {
  vi.clearAllMocks();
  callOrder.length = 0;
});

// ---------------------------------------------------------------------------
// בדיקות
// ---------------------------------------------------------------------------

describe("hardDeleteTreatment — טיפול מקושר", () => {
  it("מנתק תורים ולקוחות (לא מוחק) ומוחק כללי מעקב, VisitTreatment והטיפול", async () => {
    seedLinkedTreatment();

    const result = await hardDeleteTreatment("treat-1");

    expect(result).toBe(true);

    // 1. תורים — ניתוק בלבד (treatmentId=null), לא מחיקה
    expect(mockAppointmentUpdateMany).toHaveBeenCalledWith({
      where: { treatmentId: "treat-1" },
      data: { treatmentId: null },
    });

    // 2. לקוחות — ניתוק requestedTreatmentId (דף הנחיתה), לא מחיקה
    expect(mockClientUpdateMany).toHaveBeenCalledWith({
      where: { requestedTreatmentId: "treat-1" },
      data: { requestedTreatmentId: null },
    });

    // 3. מעקבים — ניתוק ruleId ואז מחיקת הכללים
    expect(mockFollowUpUpdateMany).toHaveBeenCalledWith({
      where: { ruleId: { in: ["rule-1"] } },
      data: { ruleId: null },
    });
    expect(mockFollowUpRuleDeleteMany).toHaveBeenCalledWith({
      where: { treatmentId: "treat-1" },
    });

    // 4. VisitTreatment — מחיקת פריטי הטיפול מביקורים היסטוריים
    expect(mockVisitTreatmentDeleteMany).toHaveBeenCalledWith({
      where: { treatmentId: "treat-1" },
    });

    // 5. הטיפול עצמו נמחק אחרון
    expect(mockTreatmentDelete).toHaveBeenCalledWith({
      where: { id: "treat-1" },
    });
  });

  it("מבצע את הטרנזקציה בסדר שמשחרר את כל אילוצי ה-FK (Restrict) לפני מחיקת הטיפול", async () => {
    seedLinkedTreatment();
    await hardDeleteTreatment("treat-1");

    const idx = (name: string) => callOrder.indexOf(name);

    // ניתוק ruleId של המעקבים לפני מחיקת FollowUpRule (FollowUp.ruleId אופציונלי)
    expect(idx("followUp.updateMany")).toBeLessThan(
      idx("followUpRule.deleteMany")
    );

    const parent = idx("treatment.delete");
    // כל הניתוקים/המחיקות לפני מחיקת הטיפול
    for (const child of [
      "appointment.updateMany",
      "client.updateMany",
      "followUpRule.deleteMany",
      "visitTreatment.deleteMany",
    ]) {
      expect(idx(child)).toBeGreaterThanOrEqual(0);
      expect(idx(child)).toBeLessThan(parent);
    }
  });

  it("אינו מוחק תורים/לקוחות (ניתוק בלבד — אין deleteMany עליהם)", async () => {
    seedLinkedTreatment();
    await hardDeleteTreatment("treat-1");

    // אם הקוד היה קורא ל-appointment.deleteMany / client.deleteMany הוא היה זורק
    // (אין מתודות כאלה ב-tx המדומה); הניתוק מתבצע דרך updateMany בלבד.
    expect(mockAppointmentUpdateMany).toHaveBeenCalledOnce();
    expect(mockClientUpdateMany).toHaveBeenCalledOnce();
  });

  it("מבצע את המחיקה ב-$transaction יחיד (אטומיות)", async () => {
    seedLinkedTreatment();
    await hardDeleteTreatment("treat-1");
    expect(mockTransaction).toHaveBeenCalledOnce();
  });
});

describe("hardDeleteTreatment — ללא כללי מעקב", () => {
  it("אינו קורא ל-followUp.updateMany אך כן קורא ל-followUpRule.deleteMany", async () => {
    mockTreatmentFindUnique.mockResolvedValueOnce({ id: "treat-2" });
    mockFollowUpRuleFindMany.mockResolvedValueOnce([]);

    const result = await hardDeleteTreatment("treat-2");

    expect(result).toBe(true);
    expect(mockFollowUpUpdateMany).not.toHaveBeenCalled();
    expect(mockFollowUpRuleDeleteMany).toHaveBeenCalledWith({
      where: { treatmentId: "treat-2" },
    });
    expect(mockTreatmentDelete).toHaveBeenCalledOnce();
  });
});

describe("hardDeleteTreatment — טיפול לא קיים", () => {
  it("מחזיר false ואינו מנתק/מוחק דבר", async () => {
    mockTreatmentFindUnique.mockResolvedValueOnce(null);

    const result = await hardDeleteTreatment("missing-id");

    expect(result).toBe(false);
    expect(mockAppointmentUpdateMany).not.toHaveBeenCalled();
    expect(mockClientUpdateMany).not.toHaveBeenCalled();
    expect(mockFollowUpRuleDeleteMany).not.toHaveBeenCalled();
    expect(mockVisitTreatmentDeleteMany).not.toHaveBeenCalled();
    expect(mockTreatmentDelete).not.toHaveBeenCalled();
  });
});
