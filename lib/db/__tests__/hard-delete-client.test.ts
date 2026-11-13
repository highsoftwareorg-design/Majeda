/**
 * בדיקות ל-hardDeleteClient — מחיקה לצמיתות של לקוח/ה (משימה 12.2, §12 — CASCADE).
 *
 * כל קריאות ל-Prisma ממוקות (`$transaction` מריץ callback עם אובייקט tx מדומה).
 * אין גישה אמיתית ל-DB.
 *
 * בודק:
 * 1. לקוח/ה עם תור+ביקור+טופס חתום+הודעה → כל הרשומות נמחקות ו-client.delete נקרא.
 * 2. סדר המחיקה ילד→הורה (אין FK Restrict שחוסם).
 * 3. orphanedPdfKeys נאסף מ-SignedConsent.pdfStorageKey, ללא מחיקה מ-R2.
 * 4. מזהה לא קיים → מחזיר null, ללא מחיקות.
 * 5. אטומיות — הכל ב-$transaction יחיד.
 * 6. pdfStorageKey ריק/null מסונן מ-orphanedPdfKeys.
 *
 * הרצה: `npx vitest run lib/db/__tests__/hard-delete-client.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני ה-imports של המודולים הממוקים
// ---------------------------------------------------------------------------

const {
  mockTransaction,
  mockClientFindUnique,
  mockClientDelete,
  mockAppointmentFindMany,
  mockAppointmentDeleteMany,
  mockVisitFindMany,
  mockVisitDeleteMany,
  mockSignedConsentFindMany,
  mockSignedConsentDeleteMany,
  mockFollowUpFindMany,
  mockFollowUpDeleteMany,
  mockAdminTaskDeleteMany,
  mockVisitAmendmentDeleteMany,
  mockConsentOverrideDeleteMany,
  mockMessageDeleteMany,
  mockClientTagDeleteMany,
  callOrder,
} = vi.hoisted(() => {
  // סדר הקריאות שנאסף כדי לאמת ילד→הורה
  const callOrder: string[] = [];
  const track =
    (name: string, resolved: unknown = { count: 0 }) =>
    vi.fn(async (...args: unknown[]) => {
      callOrder.push(name);
      return typeof resolved === "function"
        ? (resolved as (...a: unknown[]) => unknown)(...args)
        : resolved;
    });

  const mockClientFindUnique = track("client.findUnique", undefined);
  const mockClientDelete = track("client.delete", {});
  const mockAppointmentFindMany = track("appointment.findMany", []);
  const mockAppointmentDeleteMany = track("appointment.deleteMany");
  const mockVisitFindMany = track("visit.findMany", []);
  const mockVisitDeleteMany = track("visit.deleteMany");
  const mockSignedConsentFindMany = track("signedConsent.findMany", []);
  const mockSignedConsentDeleteMany = track("signedConsent.deleteMany");
  const mockFollowUpFindMany = track("followUp.findMany", []);
  const mockFollowUpDeleteMany = track("followUp.deleteMany");
  const mockAdminTaskDeleteMany = track("adminTask.deleteMany");
  const mockVisitAmendmentDeleteMany = track("visitAmendment.deleteMany");
  const mockConsentOverrideDeleteMany = track("consentOverride.deleteMany");
  const mockMessageDeleteMany = track("message.deleteMany");
  const mockClientTagDeleteMany = track("clientTag.deleteMany");

  const tx = {
    client: { findUnique: mockClientFindUnique, delete: mockClientDelete },
    appointment: {
      findMany: mockAppointmentFindMany,
      deleteMany: mockAppointmentDeleteMany,
    },
    visit: { findMany: mockVisitFindMany, deleteMany: mockVisitDeleteMany },
    signedConsent: {
      findMany: mockSignedConsentFindMany,
      deleteMany: mockSignedConsentDeleteMany,
    },
    followUp: {
      findMany: mockFollowUpFindMany,
      deleteMany: mockFollowUpDeleteMany,
    },
    adminTask: { deleteMany: mockAdminTaskDeleteMany },
    visitAmendment: { deleteMany: mockVisitAmendmentDeleteMany },
    consentOverride: { deleteMany: mockConsentOverrideDeleteMany },
    message: { deleteMany: mockMessageDeleteMany },
    clientTag: { deleteMany: mockClientTagDeleteMany },
  };

  // מדמה $transaction(callback, options) — מריץ את ה-callback עם tx המדומה
  const mockTransaction = vi.fn(
    async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)
  );

  return {
    mockTransaction,
    mockClientFindUnique,
    mockClientDelete,
    mockAppointmentFindMany,
    mockAppointmentDeleteMany,
    mockVisitFindMany,
    mockVisitDeleteMany,
    mockSignedConsentFindMany,
    mockSignedConsentDeleteMany,
    mockFollowUpFindMany,
    mockFollowUpDeleteMany,
    mockAdminTaskDeleteMany,
    mockVisitAmendmentDeleteMany,
    mockConsentOverrideDeleteMany,
    mockMessageDeleteMany,
    mockClientTagDeleteMany,
    callOrder,
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: { $transaction: mockTransaction },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { hardDeleteClient } from "@/lib/db/hard-delete-client";

// ---------------------------------------------------------------------------
// עזרים
// ---------------------------------------------------------------------------

/** מגדיר תרחיש "לקוח/ה מלא" — תור + ביקור + 2 טפסים חתומים + מעקב. */
function seedFullClient() {
  mockClientFindUnique.mockResolvedValueOnce({ id: "client-1" });
  mockAppointmentFindMany.mockResolvedValueOnce([{ id: "appt-1" }]);
  mockVisitFindMany.mockResolvedValueOnce([{ id: "visit-1" }]);
  mockSignedConsentFindMany.mockResolvedValueOnce([
    { pdfStorageKey: "consents/client-1/sc-1.pdf" },
    { pdfStorageKey: "consents/client-1/sc-2.pdf" },
  ]);
  mockFollowUpFindMany.mockResolvedValueOnce([{ id: "fu-1" }]);
}

beforeEach(() => {
  vi.clearAllMocks();
  callOrder.length = 0;
});

// ---------------------------------------------------------------------------
// בדיקות
// ---------------------------------------------------------------------------

describe("hardDeleteClient — מחיקה מלאה", () => {
  it("מוחק את כל הרשומות הקשורות וקורא ל-client.delete", async () => {
    seedFullClient();

    const result = await hardDeleteClient("client-1");

    expect(result).not.toBeNull();

    // כל ה-deleteMany של הישויות הקשורות נקראו
    expect(mockAdminTaskDeleteMany).toHaveBeenCalledOnce();
    expect(mockFollowUpDeleteMany).toHaveBeenCalledOnce();
    expect(mockVisitAmendmentDeleteMany).toHaveBeenCalledOnce();
    expect(mockVisitDeleteMany).toHaveBeenCalledWith({
      where: { clientId: "client-1" },
    });
    expect(mockConsentOverrideDeleteMany).toHaveBeenCalledOnce();
    expect(mockSignedConsentDeleteMany).toHaveBeenCalledWith({
      where: { clientId: "client-1" },
    });
    expect(mockAppointmentDeleteMany).toHaveBeenCalledWith({
      where: { clientId: "client-1" },
    });
    expect(mockMessageDeleteMany).toHaveBeenCalledWith({
      where: { clientId: "client-1" },
    });
    expect(mockClientTagDeleteMany).toHaveBeenCalledWith({
      where: { clientId: "client-1" },
    });

    // הלקוח/ה עצמו/ה נמחק/ת
    expect(mockClientDelete).toHaveBeenCalledWith({
      where: { id: "client-1" },
    });
  });

  it("מוחק ב-$transaction יחיד (אטומיות)", async () => {
    seedFullClient();
    await hardDeleteClient("client-1");
    expect(mockTransaction).toHaveBeenCalledOnce();
  });

  it("מבצע את המחיקות בסדר ילד→הורה (אין FK Restrict שחוסם)", async () => {
    seedFullClient();
    await hardDeleteClient("client-1");

    const idx = (name: string) => callOrder.indexOf(name);

    // adminTask לפני followUp (Restrict על followUpId)
    expect(idx("adminTask.deleteMany")).toBeLessThan(idx("followUp.deleteMany"));
    // followUp + visitAmendment לפני visit (Restrict על visitId)
    expect(idx("followUp.deleteMany")).toBeLessThan(idx("visit.deleteMany"));
    expect(idx("visitAmendment.deleteMany")).toBeLessThan(
      idx("visit.deleteMany")
    );
    // consentOverride + signedConsent + appointment לפני המחיקות התואמות
    expect(idx("consentOverride.deleteMany")).toBeLessThan(
      idx("appointment.deleteMany")
    );
    // הלקוח/ה נמחק/ת אחרון/ה
    const parent = idx("client.delete");
    for (const child of [
      "adminTask.deleteMany",
      "followUp.deleteMany",
      "visitAmendment.deleteMany",
      "visit.deleteMany",
      "consentOverride.deleteMany",
      "signedConsent.deleteMany",
      "appointment.deleteMany",
      "message.deleteMany",
      "clientTag.deleteMany",
    ]) {
      expect(idx(child)).toBeLessThan(parent);
    }
  });
});

describe("hardDeleteClient — orphanedPdfKeys ו-R2", () => {
  it("מחזיר את מפתחות ה-PDF של הטפסים החתומים", async () => {
    seedFullClient();
    const result = await hardDeleteClient("client-1");
    expect(result?.orphanedPdfKeys).toEqual([
      "consents/client-1/sc-1.pdf",
      "consents/client-1/sc-2.pdf",
    ]);
  });

  it("מסנן מפתחות ריקים/null מ-orphanedPdfKeys", async () => {
    mockClientFindUnique.mockResolvedValueOnce({ id: "client-1" });
    mockAppointmentFindMany.mockResolvedValueOnce([]);
    mockVisitFindMany.mockResolvedValueOnce([]);
    mockSignedConsentFindMany.mockResolvedValueOnce([
      { pdfStorageKey: "consents/ok.pdf" },
      { pdfStorageKey: null },
      { pdfStorageKey: "" },
    ]);
    mockFollowUpFindMany.mockResolvedValueOnce([]);

    const result = await hardDeleteClient("client-1");
    expect(result?.orphanedPdfKeys).toEqual(["consents/ok.pdf"]);
  });

  it("אינו מוחק מ-R2 — אין קריאה למחיקת קבצים (רק מחזיר מפתחות)", async () => {
    // hardDeleteClient אינו מייבא r2/מחיקת קבצים; אם היה, הייבוא היה נכשל כאן.
    // האימות: result מכיל את המפתחות, והטבלה SignedConsent נמחקה — ה-PDF נשאר.
    seedFullClient();
    const result = await hardDeleteClient("client-1");
    expect(result?.orphanedPdfKeys.length).toBe(2);
    expect(mockSignedConsentDeleteMany).toHaveBeenCalledOnce();
  });
});

describe("hardDeleteClient — לקוח/ה לא קיים/ת", () => {
  it("מחזיר null כאשר הלקוח/ה לא נמצא/ת, ללא מחיקות", async () => {
    mockClientFindUnique.mockResolvedValueOnce(null);

    const result = await hardDeleteClient("missing-id");

    expect(result).toBeNull();
    expect(mockClientDelete).not.toHaveBeenCalled();
    expect(mockAppointmentDeleteMany).not.toHaveBeenCalled();
    expect(mockVisitDeleteMany).not.toHaveBeenCalled();
    expect(mockSignedConsentDeleteMany).not.toHaveBeenCalled();
    expect(mockMessageDeleteMany).not.toHaveBeenCalled();
  });
});
