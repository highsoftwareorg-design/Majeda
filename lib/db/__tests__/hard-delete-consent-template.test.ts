/**
 * בדיקות ל-hardDeleteConsentTemplate — מחיקה לצמיתות של תבנית הסכמה (משימה 12.5, §12 — CASCADE).
 *
 * כל קריאות ל-Prisma ממוקות (`$transaction` מריץ callback עם אובייקט tx מדומה).
 * אין גישה אמיתית ל-DB.
 *
 * בודק:
 * 1. תבנית עם גרסה עוקבת (previousVersionId) + SignedConsent → הקשר העצמי מנותק,
 *    הטפסים החתומים נמחקים (cascade מאושר), והתבנית נמחקת אחרונה.
 * 2. סדר הטרנזקציה — מנתק/מוחק את אילוצי ה-FK (Restrict על templateId + self-ref) לפני מחיקת התבנית.
 * 3. orphanedPdfKeys נאסף מ-SignedConsent.pdfStorageKey לפני המחיקה, ללא מחיקה מ-R2.
 * 4. pdfStorageKey ריק/null מסונן מ-orphanedPdfKeys.
 * 5. מזהה לא קיים → מחזיר null, ללא ניתוק/מחיקה.
 * 6. אטומיות — הכל ב-$transaction יחיד.
 *
 * הרצה: `npx vitest run lib/db/__tests__/hard-delete-consent-template.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני ה-imports של המודולים הממוקים
// ---------------------------------------------------------------------------

const {
  mockTransaction,
  mockTemplateFindUnique,
  mockTemplateUpdateMany,
  mockTemplateDelete,
  mockSignedConsentFindMany,
  mockSignedConsentDeleteMany,
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

  const mockTemplateFindUnique = track("consentTemplate.findUnique", undefined);
  const mockTemplateUpdateMany = track("consentTemplate.updateMany");
  const mockTemplateDelete = track("consentTemplate.delete", {});
  const mockSignedConsentFindMany = track("signedConsent.findMany", []);
  const mockSignedConsentDeleteMany = track("signedConsent.deleteMany");

  const tx = {
    consentTemplate: {
      findUnique: mockTemplateFindUnique,
      updateMany: mockTemplateUpdateMany,
      delete: mockTemplateDelete,
    },
    signedConsent: {
      findMany: mockSignedConsentFindMany,
      deleteMany: mockSignedConsentDeleteMany,
    },
  };

  // מדמה $transaction(callback, options) — מריץ את ה-callback עם tx המדומה
  const mockTransaction = vi.fn(
    async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)
  );

  return {
    mockTransaction,
    mockTemplateFindUnique,
    mockTemplateUpdateMany,
    mockTemplateDelete,
    mockSignedConsentFindMany,
    mockSignedConsentDeleteMany,
    callOrder,
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: { $transaction: mockTransaction },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { hardDeleteConsentTemplate } from "@/lib/db/hard-delete-consent-template";

// ---------------------------------------------------------------------------
// עזרים
// ---------------------------------------------------------------------------

/** מגדיר תרחיש "תבנית מקושרת" — קיימת + שני טפסים חתומים עם PDF. */
function seedLinkedTemplate() {
  mockTemplateFindUnique.mockResolvedValueOnce({ id: "tpl-1" });
  mockSignedConsentFindMany.mockResolvedValueOnce([
    { pdfStorageKey: "consents/tpl-1/sc-1.pdf" },
    { pdfStorageKey: "consents/tpl-1/sc-2.pdf" },
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  callOrder.length = 0;
});

// ---------------------------------------------------------------------------
// בדיקות
// ---------------------------------------------------------------------------

describe("hardDeleteConsentTemplate — תבנית מקושרת", () => {
  it("מנתק את הקשר העצמי (previousVersionId), מוחק את הטפסים החתומים ואת התבנית", async () => {
    seedLinkedTemplate();

    const result = await hardDeleteConsentTemplate("tpl-1");

    expect(result).not.toBeNull();

    // 2. ניתוק הקשר העצמי — גרסאות שמצביעות לתבנית זו
    expect(mockTemplateUpdateMany).toHaveBeenCalledWith({
      where: { previousVersionId: "tpl-1" },
      data: { previousVersionId: null },
    });

    // 3. טפסים חתומים שמבוססים על התבנית (Restrict על templateId) נמחקים
    expect(mockSignedConsentDeleteMany).toHaveBeenCalledWith({
      where: { templateId: "tpl-1" },
    });

    // 4. התבנית עצמה נמחקת אחרונה
    expect(mockTemplateDelete).toHaveBeenCalledWith({
      where: { id: "tpl-1" },
    });
  });

  it("מבצע את הטרנזקציה בסדר שמשחרר את אילוצי ה-FK לפני מחיקת התבנית", async () => {
    seedLinkedTemplate();
    await hardDeleteConsentTemplate("tpl-1");

    const idx = (name: string) => callOrder.indexOf(name);

    // איסוף מפתחות PDF לפני מחיקת הטפסים החתומים
    expect(idx("signedConsent.findMany")).toBeLessThan(
      idx("signedConsent.deleteMany")
    );

    const parent = idx("consentTemplate.delete");
    // ניתוק הקשר העצמי + מחיקת הטפסים החתומים לפני מחיקת התבנית
    for (const child of [
      "consentTemplate.updateMany",
      "signedConsent.deleteMany",
    ]) {
      expect(idx(child)).toBeGreaterThanOrEqual(0);
      expect(idx(child)).toBeLessThan(parent);
    }
  });

  it("מבצע את המחיקה ב-$transaction יחיד (אטומיות)", async () => {
    seedLinkedTemplate();
    await hardDeleteConsentTemplate("tpl-1");
    expect(mockTransaction).toHaveBeenCalledOnce();
  });
});

describe("hardDeleteConsentTemplate — orphanedPdfKeys ו-R2", () => {
  it("מחזיר את מפתחות ה-PDF של הטפסים החתומים (נאספים לפני המחיקה)", async () => {
    seedLinkedTemplate();
    const result = await hardDeleteConsentTemplate("tpl-1");
    expect(result?.orphanedPdfKeys).toEqual([
      "consents/tpl-1/sc-1.pdf",
      "consents/tpl-1/sc-2.pdf",
    ]);
  });

  it("מסנן מפתחות ריקים/null מ-orphanedPdfKeys", async () => {
    mockTemplateFindUnique.mockResolvedValueOnce({ id: "tpl-1" });
    mockSignedConsentFindMany.mockResolvedValueOnce([
      { pdfStorageKey: "consents/ok.pdf" },
      { pdfStorageKey: null },
      { pdfStorageKey: "" },
    ]);

    const result = await hardDeleteConsentTemplate("tpl-1");
    expect(result?.orphanedPdfKeys).toEqual(["consents/ok.pdf"]);
  });

  it("אינו מוחק מ-R2 — רק מחזיר מפתחות; שורת SignedConsent נמחקת", async () => {
    // hardDeleteConsentTemplate אינו מייבא r2/מחיקת קבצים; אם היה, הייבוא היה נכשל כאן.
    seedLinkedTemplate();
    const result = await hardDeleteConsentTemplate("tpl-1");
    expect(result?.orphanedPdfKeys.length).toBe(2);
    expect(mockSignedConsentDeleteMany).toHaveBeenCalledOnce();
  });

  it("תבנית ללא טפסים חתומים → orphanedPdfKeys ריק, אך ניתוק+מחיקה עדיין רצים", async () => {
    mockTemplateFindUnique.mockResolvedValueOnce({ id: "tpl-2" });
    mockSignedConsentFindMany.mockResolvedValueOnce([]);

    const result = await hardDeleteConsentTemplate("tpl-2");

    expect(result?.orphanedPdfKeys).toEqual([]);
    expect(mockTemplateUpdateMany).toHaveBeenCalledWith({
      where: { previousVersionId: "tpl-2" },
      data: { previousVersionId: null },
    });
    expect(mockSignedConsentDeleteMany).toHaveBeenCalledWith({
      where: { templateId: "tpl-2" },
    });
    expect(mockTemplateDelete).toHaveBeenCalledOnce();
  });
});

describe("hardDeleteConsentTemplate — תבנית לא קיימת", () => {
  it("מחזיר null ואינו מנתק/מוחק דבר", async () => {
    mockTemplateFindUnique.mockResolvedValueOnce(null);

    const result = await hardDeleteConsentTemplate("missing-id");

    expect(result).toBeNull();
    expect(mockTemplateUpdateMany).not.toHaveBeenCalled();
    expect(mockSignedConsentDeleteMany).not.toHaveBeenCalled();
    expect(mockTemplateDelete).not.toHaveBeenCalled();
  });
});
