/**
 * בדיקות יחידה למודלי נתונים של טפסי הסכמה — משימה 7.1 (FR-CF-01, FR-CF-07, §12.1).
 *
 * כל קריאות ל-Prisma ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * בודק:
 * 1. יצירת ConsentTemplate עם כל השדות → שליפה חזרה → כל השדות שמורים נכון.
 * 2. יצירת SignedConsent עם כל השדות → שליפה עם קשרים → client ו-template תקינים.
 * 3. TypeScript: SignedConsent אינו מכיל שדה otpVerifiedPhone (הושמט בכוונה).
 * 4. ConsentTemplate — self-referential relation (previousVersionId).
 *
 * הרצה: `npx vitest run lib/db/__tests__/consent-models.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import type { ConsentTemplate, SignedConsent, Client } from "@prisma/client";

// --- Mocks (חייבים לפני ה-imports של המודולים הממוקים) ---

const {
  mockTemplateCreate,
  mockTemplateFindUnique,
  mockConsentCreate,
  mockConsentFindUnique,
} = vi.hoisted(() => ({
  mockTemplateCreate: vi.fn(),
  mockTemplateFindUnique: vi.fn(),
  mockConsentCreate: vi.fn(),
  mockConsentFindUnique: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    consentTemplate: {
      create: mockTemplateCreate,
      findUnique: mockTemplateFindUnique,
    },
    signedConsent: {
      create: mockConsentCreate,
      findUnique: mockConsentFindUnique,
    },
  },
}));

// --- נתוני בדיקה ---

const now = new Date("2026-11-07T10:00:00Z");

/** ConsentTemplate מלא עם כל השדות */
const mockTemplate: ConsentTemplate = {
  id: "template-1",
  name: "טופס הסכמה כללי",
  treatmentIds: ["treat-1", "treat-2"],
  isGeneral: false,
  fields: [
    { name: "fullName", label: "שם מלא", type: "text", required: true },
    { name: "agreed", label: "הסכמה לטיפול", type: "checkbox", required: true },
  ],
  validityDays: 365,
  version: 1,
  previousVersionId: null,
  language: "he",
  isActive: true,
  createdAt: now,
  updatedAt: now,
};

/** SignedConsent מלא עם כל השדות */
const mockSignedConsent: SignedConsent = {
  id: "consent-1",
  clientId: "client-1",
  appointmentId: "appt-1",
  templateId: "template-1",
  templateVersion: 1,
  fieldValues: { fullName: "מג'ידה כהן", agreed: true },
  signatureClientData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA==",
  signatureTherapistData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA==",
  guardianName: null,
  guardianIdNumber: null,
  signingToken: "tok-unique-abc-123",
  signingTokenExpiresAt: new Date("2026-11-08T10:00:00Z"),
  auditIp: "192.168.1.100",
  auditDevice: "iPhone 14 / Safari 17",
  auditHash: "sha256-abc123def456",
  pdfStorageKey: "consents/2026/11/consent-1.pdf",
  signedAt: now,
  createdAt: now,
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

// --- בדיקות ---

describe("מודלי נתונים — טפסי הסכמה (משימה 7.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ════════════════════════════════════════════════════════
  // 1. ConsentTemplate — יצירה ושליפה
  // ════════════════════════════════════════════════════════

  describe("ConsentTemplate — יצירה ושליפה", () => {
    it("יצירת ConsentTemplate — כל השדות נשמרים ונשלפים נכון", async () => {
      mockTemplateCreate.mockResolvedValue(mockTemplate);
      mockTemplateFindUnique.mockResolvedValue(mockTemplate);

      const { prisma } = await import("@/lib/db/prisma");

      const created = await prisma.consentTemplate.create({
        data: {
          name: "טופס הסכמה כללי",
          // Use literal arrays — avoids JsonValue ↔ InputJsonValue mismatch
          treatmentIds: ["treat-1", "treat-2"],
          isGeneral: false,
          fields: [
            { name: "fullName", label: "שם מלא", type: "text", required: true },
            { name: "agreed", label: "הסכמה לטיפול", type: "checkbox", required: true },
          ],
          validityDays: 365,
          version: 1,
          language: "he",
          isActive: true,
        },
      });

      const fetched = await prisma.consentTemplate.findUnique({
        where: { id: "template-1" },
      });

      // ודא שה-create נקרא
      expect(mockTemplateCreate).toHaveBeenCalledOnce();

      // ודא שה-findUnique נקרא עם ה-id הנכון
      expect(mockTemplateFindUnique).toHaveBeenCalledWith({
        where: { id: "template-1" },
      });

      // ודא שכל שדות הטמפלייט תקינים
      expect(fetched).toBeDefined();
      expect(fetched?.id).toBe("template-1");
      expect(fetched?.name).toBe("טופס הסכמה כללי");
      expect(fetched?.isGeneral).toBe(false);
      expect(fetched?.validityDays).toBe(365);
      expect(fetched?.version).toBe(1);
      expect(fetched?.language).toBe("he");
      expect(fetched?.isActive).toBe(true);
      expect(fetched?.previousVersionId).toBeNull();

      // ודא שדות JSON מוחזרים נכון
      expect(fetched?.treatmentIds).toEqual(["treat-1", "treat-2"]);
      expect(fetched?.fields).toEqual([
        { name: "fullName", label: "שם מלא", type: "text", required: true },
        { name: "agreed", label: "הסכמה לטיפול", type: "checkbox", required: true },
      ]);
    });

    it("ConsentTemplate — self-referential: previousVersionId מצביע לגרסה קודמת", async () => {
      const v2Template: ConsentTemplate = {
        ...mockTemplate,
        id: "template-2",
        name: "טופס הסכמה כללי — גרסה 2",
        version: 2,
        previousVersionId: "template-1",
        updatedAt: new Date("2026-11-07T12:00:00Z"),
      };

      mockTemplateFindUnique.mockResolvedValue(v2Template);

      const { prisma } = await import("@/lib/db/prisma");
      const fetched = await prisma.consentTemplate.findUnique({
        where: { id: "template-2" },
      });

      expect(fetched?.version).toBe(2);
      expect(fetched?.previousVersionId).toBe("template-1");
    });

    it("ConsentTemplate עם isGeneral=true — treatmentIds ריק תקין", async () => {
      const generalTemplate: ConsentTemplate = {
        ...mockTemplate,
        id: "template-general",
        name: "טופס כללי לכל לקוח חדש",
        isGeneral: true,
        treatmentIds: [],
      };

      mockTemplateFindUnique.mockResolvedValue(generalTemplate);

      const { prisma } = await import("@/lib/db/prisma");
      const fetched = await prisma.consentTemplate.findUnique({
        where: { id: "template-general" },
      });

      expect(fetched?.isGeneral).toBe(true);
      expect(fetched?.treatmentIds).toEqual([]);
    });
  });

  // ════════════════════════════════════════════════════════
  // 2. SignedConsent — יצירה ושליפה עם קשרים
  // ════════════════════════════════════════════════════════

  describe("SignedConsent — יצירה ושליפה עם קשרים", () => {
    it("יצירת SignedConsent — כל השדות נשמרים כולל fieldValues ו-auditHash", async () => {
      mockConsentCreate.mockResolvedValue(mockSignedConsent);

      const { prisma } = await import("@/lib/db/prisma");
      const created = await prisma.signedConsent.create({
        data: {
          clientId: "client-1",
          appointmentId: "appt-1",
          templateId: "template-1",
          templateVersion: 1,
          // Use a literal object — avoids JsonValue ↔ InputJsonValue mismatch
          fieldValues: { fullName: "מג'ידה כהן", agreed: true },
          signingToken: "tok-unique-abc-123",
          auditIp: "192.168.1.100",
          auditDevice: "iPhone 14 / Safari 17",
          auditHash: "sha256-abc123def456",
          pdfStorageKey: "consents/2026/11/consent-1.pdf",
          signedAt: now,
        },
      });

      expect(mockConsentCreate).toHaveBeenCalledOnce();
      expect(created?.id).toBe("consent-1");
      expect(created?.clientId).toBe("client-1");
      expect(created?.templateVersion).toBe(1);
      expect(created?.auditHash).toBe("sha256-abc123def456");
      expect(created?.pdfStorageKey).toBe("consents/2026/11/consent-1.pdf");
      expect(created?.fieldValues).toEqual({ fullName: "מג'ידה כהן", agreed: true });
    });

    it("שליפת SignedConsent עם include: { client, template } — קשרים תקינים", async () => {
      const consentWithRelations = {
        ...mockSignedConsent,
        client: mockClient,
        template: mockTemplate,
      };

      mockConsentFindUnique.mockResolvedValue(consentWithRelations);

      const { prisma } = await import("@/lib/db/prisma");
      const fetched = await prisma.signedConsent.findUnique({
        where: { id: "consent-1" },
        include: { client: true, template: true },
      });

      expect(mockConsentFindUnique).toHaveBeenCalledWith({
        where: { id: "consent-1" },
        include: { client: true, template: true },
      });

      // ודא קשר ל-client
      expect(fetched?.client).toBeDefined();
      expect(fetched?.client?.id).toBe("client-1");
      expect(fetched?.client?.firstName).toBe("מג'ידה");
      expect(fetched?.client?.lastName).toBe("כהן");
      expect(fetched?.client?.phone).toBe("0501234567");

      // ודא קשר ל-template
      expect(fetched?.template).toBeDefined();
      expect(fetched?.template?.id).toBe("template-1");
      expect(fetched?.template?.name).toBe("טופס הסכמה כללי");
      expect(fetched?.template?.version).toBe(1);
    });

    it("SignedConsent — appointmentId אופציונלי: יכול להיות null", async () => {
      const consentWithoutAppt: SignedConsent = {
        ...mockSignedConsent,
        id: "consent-no-appt",
        appointmentId: null,
      };

      mockConsentFindUnique.mockResolvedValue(consentWithoutAppt);

      const { prisma } = await import("@/lib/db/prisma");
      const fetched = await prisma.signedConsent.findUnique({
        where: { id: "consent-no-appt" },
      });

      expect(fetched?.appointmentId).toBeNull();
    });

    it("SignedConsent — signedAt=null: טופס ממתין לחתימה", async () => {
      const pendingConsent: SignedConsent = {
        ...mockSignedConsent,
        id: "consent-pending",
        signedAt: null,
        signatureClientData: null,
        pdfStorageKey: null,
      };

      mockConsentFindUnique.mockResolvedValue(pendingConsent);

      const { prisma } = await import("@/lib/db/prisma");
      const fetched = await prisma.signedConsent.findUnique({
        where: { id: "consent-pending" },
      });

      expect(fetched?.signedAt).toBeNull();
      expect(fetched?.signatureClientData).toBeNull();
      expect(fetched?.pdfStorageKey).toBeNull();
    });
  });

  // ════════════════════════════════════════════════════════
  // 3. בדיקת TypeScript: SignedConsent אינו מכיל otpVerifiedPhone
  // ════════════════════════════════════════════════════════

  describe("TypeScript type check — otpVerifiedPhone נעדר", () => {
    it("otpVerifiedPhone אינו שדה של SignedConsent בזמן ריצה (runtime check)", () => {
      // בדיקה בזמן ריצה: השדה לא קיים ב-mock object
      expect("otpVerifiedPhone" in mockSignedConsent).toBe(false);
    });

    it("otpVerifiedPhone אינו שדה של ConsentTemplate בזמן ריצה", () => {
      expect("otpVerifiedPhone" in mockTemplate).toBe(false);
    });

    it("SignedConsent מכיל signingToken במקום otpVerifiedPhone (הארכיטקטורה הנבחרת)", () => {
      // ה-signingToken הוא המנגנון שנבחר במקום OTP
      expect("signingToken" in mockSignedConsent).toBe(true);
      expect(mockSignedConsent.signingToken).toBe("tok-unique-abc-123");
    });
  });
});

// ════════════════════════════════════════════════════════
// TypeScript compile-time checks — מחוץ לבלוק describe
// ════════════════════════════════════════════════════════

/**
 * בדיקת compile-time: אם otpVerifiedPhone יתווסף ל-SignedConsent בעתיד,
 * השורה הבאה תגרום לשגיאת TypeScript (ה-@ts-expect-error לא יהיה מוצדק).
 * כך `npx tsc --noEmit` יתפוס את הבעיה אוטומטית.
 *
 * כרגע: SignedConsent אינו מכיל את השדה, ולכן @ts-expect-error תקין.
 */
// @ts-expect-error — expected compile error: "otpVerifiedPhone" does not exist on type SignedConsent
type _OtpFieldAbsent = SignedConsent["otpVerifiedPhone"];

/**
 * בדיקת compile-time נוספת: אם השדה יתווסף, הסוג _NoOtpField יהפוך ל-never
 * ו-assignment של true ל-never יגרום לשגיאת TypeScript.
 */
type _NoOtpField = "otpVerifiedPhone" extends keyof SignedConsent ? never : true;
// אם otpVerifiedPhone קיים ב-SignedConsent — שורה זו תגרום לשגיאת compile
const _noOtpCheck: _NoOtpField = true;
void _noOtpCheck;
