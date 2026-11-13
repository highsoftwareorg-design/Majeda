/**
 * בדיקות ל-hardDeleteAppointment — מחיקה לצמיתות של תור ביומן (משימה 12.4, §12).
 *
 * כל קריאות ל-Prisma ממוקות (`$transaction` מריץ callback עם אובייקט tx מדומה).
 * אין גישה אמיתית ל-DB.
 *
 * בודק (PLAN.md 12.4, שורות 1011–1021):
 * 1. תור עם היסטוריית סטטוס + ConsentOverride + SignedConsent מקושר →
 *    SignedConsent מנותק (appointmentId=null, לא נמחק); ConsentOverride נמחק;
 *    AppointmentStatusHistory נמחק; appointment.delete אחרון.
 * 2. סדר הטרנזקציה מפורש — ניתוק/מחיקה של כל אילוצי ה-FK לפני מחיקת התור
 *    (ConsentOverride.appointment = Restrict; SignedConsent.appointmentId אופציונלי).
 * 3. שורות Message של תזכורות אינן נמחקות — הטרנזקציה אינה נוגעת ב-Message.
 * 4. מזהה לא קיים → מחזיר false, ללא ניתוק/מחיקה.
 * 5. אטומיות — הכל ב-$transaction יחיד.
 *
 * הרצה: `npx vitest run lib/db/__tests__/hard-delete-appointment.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני ה-imports של המודולים הממוקים
// ---------------------------------------------------------------------------

const {
  mockTransaction,
  mockAppointmentFindUnique,
  mockAppointmentDelete,
  mockSignedConsentUpdateMany,
  mockConsentOverrideDeleteMany,
  mockStatusHistoryDeleteMany,
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

  const mockAppointmentFindUnique = track("appointment.findUnique", undefined);
  const mockAppointmentDelete = track("appointment.delete", {});
  const mockSignedConsentUpdateMany = track("signedConsent.updateMany");
  const mockConsentOverrideDeleteMany = track("consentOverride.deleteMany");
  const mockStatusHistoryDeleteMany = track(
    "appointmentStatusHistory.deleteMany"
  );

  const tx = {
    appointment: {
      findUnique: mockAppointmentFindUnique,
      delete: mockAppointmentDelete,
    },
    signedConsent: { updateMany: mockSignedConsentUpdateMany },
    consentOverride: { deleteMany: mockConsentOverrideDeleteMany },
    appointmentStatusHistory: { deleteMany: mockStatusHistoryDeleteMany },
    // הערה מכוונת: אין כאן `message` — קריאה כלשהי ל-Message תזרוק ותיכשל בבדיקה.
  };

  // מדמה $transaction(callback, options) — מריץ את ה-callback עם tx המדומה
  const mockTransaction = vi.fn(
    async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)
  );

  return {
    mockTransaction,
    mockAppointmentFindUnique,
    mockAppointmentDelete,
    mockSignedConsentUpdateMany,
    mockConsentOverrideDeleteMany,
    mockStatusHistoryDeleteMany,
    callOrder,
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: { $transaction: mockTransaction },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { hardDeleteAppointment } from "@/lib/db/hard-delete-appointment";

// ---------------------------------------------------------------------------
// עזרים
// ---------------------------------------------------------------------------

/** מגדיר תרחיש "תור קיים ומקושר". */
function seedExistingAppointment(id = "apt-1") {
  // mockImplementationOnce (ולא mockResolvedValueOnce) — כדי שהקריאה עדיין תירשם ב-callOrder
  mockAppointmentFindUnique.mockImplementationOnce(async () => {
    callOrder.push("appointment.findUnique");
    return { id };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  callOrder.length = 0;
});

// ---------------------------------------------------------------------------
// בדיקות
// ---------------------------------------------------------------------------

describe("hardDeleteAppointment — תור מקושר", () => {
  it("מנתק טופס חתום (לא מוחק), מוחק override והיסטוריית סטטוס, ומוחק את התור", async () => {
    seedExistingAppointment("apt-1");

    const result = await hardDeleteAppointment("apt-1");

    expect(result).toBe(true);

    // 1. טופס חתום — ניתוק בלבד (appointmentId=null), לא מחיקה
    expect(mockSignedConsentUpdateMany).toHaveBeenCalledWith({
      where: { appointmentId: "apt-1" },
      data: { appointmentId: null },
    });

    // 2. דריסות הסכמה — מחיקה (Restrict על appointmentId)
    expect(mockConsentOverrideDeleteMany).toHaveBeenCalledWith({
      where: { appointmentId: "apt-1" },
    });

    // 3. היסטוריית סטטוס — מחיקה
    expect(mockStatusHistoryDeleteMany).toHaveBeenCalledWith({
      where: { appointmentId: "apt-1" },
    });

    // 4. התור עצמו — נמחק אחרון
    expect(mockAppointmentDelete).toHaveBeenCalledWith({
      where: { id: "apt-1" },
    });
  });

  it("אינו מוחק את הטופס החתום — רק מנתק אותו (אין deleteMany על signedConsent)", async () => {
    seedExistingAppointment("apt-1");
    await hardDeleteAppointment("apt-1");

    // הניתוק דרך updateMany בלבד; קריאה ל-signedConsent.deleteMany הייתה זורקת
    // (אין מתודה כזו ב-tx המדומה).
    expect(mockSignedConsentUpdateMany).toHaveBeenCalledOnce();
    expect(mockSignedConsentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { appointmentId: null } })
    );
  });

  it("מבצע את הטרנזקציה בסדר שמשחרר את כל אילוצי ה-FK לפני מחיקת התור", async () => {
    seedExistingAppointment("apt-1");
    await hardDeleteAppointment("apt-1");

    const idx = (name: string) => callOrder.indexOf(name);

    const parent = idx("appointment.delete");
    expect(parent).toBeGreaterThanOrEqual(0);

    // כל הניתוקים/המחיקות של רשומות הבת לפני מחיקת התור עצמו
    for (const child of [
      "signedConsent.updateMany",
      "consentOverride.deleteMany",
      "appointmentStatusHistory.deleteMany",
    ]) {
      expect(idx(child)).toBeGreaterThanOrEqual(0);
      expect(idx(child)).toBeLessThan(parent);
    }

    // findUnique קודם לכל הפעולות
    expect(idx("appointment.findUnique")).toBe(0);
  });

  it("אינו נוגע ב-Message של תזכורות (קישור רך sourceType/sourceId)", async () => {
    seedExistingAppointment("apt-1");

    // אם הקוד היה מנסה לגשת ל-tx.message.* הוא היה זורק (אין message ב-tx המדומה),
    // והבדיקה הייתה נכשלת. העובדה שההרצה מצליחה מוכיחה שאין נגיעה ב-Message.
    const result = await hardDeleteAppointment("apt-1");
    expect(result).toBe(true);
  });

  it("מבצע את המחיקה ב-$transaction יחיד (אטומיות)", async () => {
    seedExistingAppointment("apt-1");
    await hardDeleteAppointment("apt-1");
    expect(mockTransaction).toHaveBeenCalledOnce();
  });
});

describe("hardDeleteAppointment — תור לא קיים", () => {
  it("מחזיר false ואינו מנתק/מוחק דבר", async () => {
    mockAppointmentFindUnique.mockResolvedValueOnce(null);

    const result = await hardDeleteAppointment("missing-id");

    expect(result).toBe(false);
    expect(mockSignedConsentUpdateMany).not.toHaveBeenCalled();
    expect(mockConsentOverrideDeleteMany).not.toHaveBeenCalled();
    expect(mockStatusHistoryDeleteMany).not.toHaveBeenCalled();
    expect(mockAppointmentDelete).not.toHaveBeenCalled();
  });
});
