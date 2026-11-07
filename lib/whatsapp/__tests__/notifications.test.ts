/**
 * lib/whatsapp/__tests__/notifications.test.ts
 * Task 6.3 — בדיקות ל-sendAppointmentConfirmation (notifications.ts)
 *
 * כל הקריאות ל-Prisma, ל-WhatsApp service ולבדיקות שעות שקטות ממוקות.
 * אין גישה אמיתית ל-DB או לרשת.
 *
 * בדיקות:
 *  1. יצירת רשומת Message עם sourceType='appointment' ו-status='PENDING'
 *  2. שדה content מכיל שם לקוח, תאריך ושעה בפורמט הנכון (DD/MM/YYYY, 24h)
 *  3. אם client.phone חסר — יציאה מוקדמת ללא יצירת Message
 *  4. אם isQuietHour מחזיר true — sendTemplate לא נקראת (Message נשאר PENDING)
 *  5. אם isShabbat מחזיר true — sendTemplate לא נקראת (Message נשאר PENDING)
 *
 * הרצה: `npx vitest run lib/whatsapp/__tests__/notifications.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// --- מוקים (חייבים להיות לפני ה-imports) ---

const {
  mockFindUnique,
  mockMessageCreate,
  mockSendTemplate,
  mockIsQuietHour,
  mockIsShabbat,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockMessageCreate: vi.fn(),
  mockSendTemplate: vi.fn().mockResolvedValue({ externalId: "MOCK_123" }),
  mockIsQuietHour: vi.fn().mockReturnValue(false),
  mockIsShabbat: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    appointment: {
      findUnique: mockFindUnique,
    },
    message: {
      create: mockMessageCreate,
    },
  },
}));

vi.mock("@/lib/whatsapp/index", () => ({
  whatsappService: {
    sendTemplate: mockSendTemplate,
    parseWebhookEvent: vi.fn().mockReturnValue(null),
  },
}));

vi.mock("@/lib/whatsapp/quiet-hours", () => ({
  isQuietHour: mockIsQuietHour,
  isShabbat: mockIsShabbat,
}));

// --- imports אחרי המוקים ---

import { sendAppointmentConfirmation } from "@/lib/whatsapp/notifications";

// --- נתוני בדיקה ---

/**
 * אובייקט תור מדומה עם כל השדות הדרושים.
 * startTime: 2026-01-15T10:30:00.000Z = 12:30 ישראל (UTC+2 בינואר)
 * כך dateStr = "15/01/2026", timeStr = "12:30"
 */
function makeFakeAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: "appt-1",
    clientId: "client-1",
    startTime: new Date("2026-01-15T10:30:00.000Z"),
    endTime: new Date("2026-01-15T11:30:00.000Z"),
    therapist: "מג'ידה",
    room: "חדר 1",
    notes: null,
    treatmentId: "treatment-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    client: {
      id: "client-1",
      firstName: "שרה",
      lastName: "לוי",
      phone: "+972501234567",
      email: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    treatment: {
      id: "treatment-1",
      name: "טיפול פנים",
      durationMinutes: 60,
      price: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    ...overrides,
  };
}

const FAKE_MESSAGE = {
  id: "msg-1",
  clientId: "client-1",
  channel: "whatsapp",
  templateId: "appointment_confirmation",
  status: "PENDING",
  sourceType: "appointment",
  sourceId: "appt-1",
  direction: "outbound",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// --- בדיקות ---

describe("sendAppointmentConfirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // ברירת מחדל: לא שעת שקט, לא שבת
    mockIsQuietHour.mockReturnValue(false);
    mockIsShabbat.mockReturnValue(false);
    // ברירת מחדל: מחזיר Message תקין
    mockMessageCreate.mockResolvedValue(FAKE_MESSAGE);
    // ברירת מחדל: שליחה מוצלחת
    mockSendTemplate.mockResolvedValue({ externalId: "MOCK_123" });
  });

  // ===== בדיקה 1: יצירת רשומת Message עם sourceType ו-status נכונים =====

  it("1. יוצר רשומת Message עם sourceType='appointment' ו-status='PENDING'", async () => {
    const fakeAppt = makeFakeAppointment();
    mockFindUnique.mockResolvedValue(fakeAppt);

    await sendAppointmentConfirmation("appt-1");

    expect(mockMessageCreate).toHaveBeenCalledOnce();
    expect(mockMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceType: "appointment",
          status: "PENDING",
          sourceId: "appt-1",
        }),
      })
    );
  });

  // ===== בדיקה 2: content מכיל שם לקוח, תאריך ושעה בפורמט הנכון =====

  it("2. שדה content מכיל שם לקוח, תאריך DD/MM/YYYY ושעה HH:mm (24h)", async () => {
    const fakeAppt = makeFakeAppointment();
    mockFindUnique.mockResolvedValue(fakeAppt);

    await sendAppointmentConfirmation("appt-1");

    expect(mockMessageCreate).toHaveBeenCalledOnce();

    // שליפת ה-data שהועברה ל-prisma.message.create
    const callArgs = mockMessageCreate.mock.calls[0][0] as {
      data: { content: Record<string, string> };
    };
    const content = callArgs.data.content;

    // שם לקוח
    expect(content.name).toBe("שרה לוי");

    // תאריך: 2026-01-15T10:30:00Z = 12:30 ישראל → "15/01/2026"
    expect(content.date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(content.date).toBe("15/01/2026");

    // שעה: 12:30 ישראל (UTC+2 בינואר) → "12:30"
    expect(content.time).toMatch(/^\d{2}:\d{2}$/);
    expect(content.time).toBe("12:30");
  });

  // ===== בדיקה 3: phone חסר — יציאה מוקדמת ללא יצירת Message =====

  it("3. אם client.phone הוא null — לא נוצרת רשומת Message ולא נשלחת הודעה", async () => {
    const fakeAppt = makeFakeAppointment({
      client: {
        id: "client-1",
        firstName: "שרה",
        lastName: "לוי",
        phone: null, // phone חסר
        email: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    mockFindUnique.mockResolvedValue(fakeAppt);

    await sendAppointmentConfirmation("appt-1");

    expect(mockMessageCreate).not.toHaveBeenCalled();
    expect(mockSendTemplate).not.toHaveBeenCalled();
  });

  it("3b. אם appointment לא נמצא ב-DB — לא נוצרת רשומת Message", async () => {
    mockFindUnique.mockResolvedValue(null);

    await sendAppointmentConfirmation("nonexistent-id");

    expect(mockMessageCreate).not.toHaveBeenCalled();
    expect(mockSendTemplate).not.toHaveBeenCalled();
  });

  // ===== בדיקה 4: isQuietHour מחזיר true — sendTemplate לא נקראת =====

  it("4. בשעות שקטות — נוצרת רשומת Message (PENDING) אך sendTemplate לא נקראת", async () => {
    mockIsQuietHour.mockReturnValue(true);
    mockIsShabbat.mockReturnValue(false);

    const fakeAppt = makeFakeAppointment();
    mockFindUnique.mockResolvedValue(fakeAppt);

    await sendAppointmentConfirmation("appt-1");

    // Message נוצרת (PENDING)
    expect(mockMessageCreate).toHaveBeenCalledOnce();
    // sendTemplate לא נקראת
    expect(mockSendTemplate).not.toHaveBeenCalled();
  });

  // ===== בדיקה 5: isShabbat מחזיר true — sendTemplate לא נקראת =====

  it("5. בשבת — נוצרת רשומת Message (PENDING) אך sendTemplate לא נקראת", async () => {
    mockIsQuietHour.mockReturnValue(false);
    mockIsShabbat.mockReturnValue(true);

    const fakeAppt = makeFakeAppointment();
    mockFindUnique.mockResolvedValue(fakeAppt);

    await sendAppointmentConfirmation("appt-1");

    // Message נוצרת (PENDING)
    expect(mockMessageCreate).toHaveBeenCalledOnce();
    // sendTemplate לא נקראת
    expect(mockSendTemplate).not.toHaveBeenCalled();
  });

  // ===== בדיקה נוספת: בזמן מותר — sendTemplate נקראת עם הפרמטרים הנכונים =====

  it("6. בזמן מותר (לא שקט, לא שבת) — sendTemplate נקראת עם phone ו-templateName הנכונים", async () => {
    const fakeAppt = makeFakeAppointment();
    mockFindUnique.mockResolvedValue(fakeAppt);
    mockMessageCreate.mockResolvedValue({ ...FAKE_MESSAGE, id: "msg-77" });

    await sendAppointmentConfirmation("appt-1");

    expect(mockSendTemplate).toHaveBeenCalledOnce();
    expect(mockSendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+972501234567",
        templateName: "appointment_confirmation",
        messageId: "msg-77",
      })
    );
  });
});
