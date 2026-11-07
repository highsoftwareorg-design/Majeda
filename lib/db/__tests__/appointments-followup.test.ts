/**
 * בדיקות יחידה לאינטגרציה בין createAppointment לבין עדכון מעקבים ממתינים — משימה 8.4 (FR-FU-05).
 *
 * כל קריאות ל-Prisma ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * בודק:
 * 1. מעקב עם scheduledDate עתידי → createAppointment קורא ל-updateMany עם { status: 'PENDING', scheduledDate: { gte: startTime } } → סטטוס הופך ל-BOOKED.
 * 2. מעקב עם scheduledDate בעבר (לפני startTime) → לא מעודכן (אינו עומד בתנאי gte).
 * 3. updateMany נקרא עם ה-clientId הנכון.
 *
 * הרצה: `npx vitest run lib/db/__tests__/appointments-followup.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני ה-imports של המודולים הממוקים
// ---------------------------------------------------------------------------

const {
  mockAppointmentCreate,
  mockFollowUpUpdateMany,
} = vi.hoisted(() => ({
  mockAppointmentCreate: vi.fn(),
  mockFollowUpUpdateMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    appointment: {
      create: mockAppointmentCreate,
    },
    followUp: {
      updateMany: mockFollowUpUpdateMany,
    },
  },
}));

// ---------------------------------------------------------------------------
// Import לאחר המוקים
// ---------------------------------------------------------------------------

import { createAppointment } from "@/lib/db/appointments";

// ---------------------------------------------------------------------------
// נתוני בדיקה משותפים
// ---------------------------------------------------------------------------

const START_TIME = new Date("2026-11-10T10:00:00.000Z");
const END_TIME   = new Date("2026-11-10T11:00:00.000Z");
const CLIENT_ID  = "client-abc-123";

/** תור מדומה שמוחזר מ-prisma.appointment.create */
const MOCK_CREATED_APPOINTMENT = {
  id: "appt-1",
  clientId: CLIENT_ID,
  treatmentId: "treatment-1",
  therapist: "מג'ידה",
  room: "חדר 1",
  startTime: START_TIME,
  endTime: END_TIME,
  notes: null,
  status: "SCHEDULED",
  createdAt: new Date("2026-11-07T00:00:00.000Z"),
  updatedAt: new Date("2026-11-07T00:00:00.000Z"),
  client: {
    id: CLIENT_ID,
    firstName: "דנה",
    lastName: "כהן",
    phone: "0501234567",
  },
  treatment: {
    id: "treatment-1",
    name: "פילינג",
    durationMinutes: 60,
    color: null,
    requiresConsentForm: false,
    authorizedTherapists: [],
  },
  statusHistory: [] as Array<{
    id: string;
    fromStatus: string;
    toStatus: string;
    changedAt: Date;
    changedBy: string;
  }>,
};

// ---------------------------------------------------------------------------
// בדיקות
// ---------------------------------------------------------------------------

describe("createAppointment — עדכון מעקבים ממתינים (משימה 8.4, FR-FU-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppointmentCreate.mockResolvedValue(MOCK_CREATED_APPOINTMENT);
    mockFollowUpUpdateMany.mockResolvedValue({ count: 0 });
  });

  // ════════════════════════════════════════════════════════
  // 1. מעקב עתידי — נעדכן ל-BOOKED
  // ════════════════════════════════════════════════════════

  it("קורא ל-prisma.followUp.updateMany עם { status: PENDING, scheduledDate: { gte: startTime } } לאחר יצירת תור", async () => {
    await createAppointment({
      clientId: CLIENT_ID,
      treatmentId: "treatment-1",
      therapist: "מג'ידה",
      room: "חדר 1",
      startTime: START_TIME,
      endTime: END_TIME,
      notes: null,
    });

    expect(mockFollowUpUpdateMany).toHaveBeenCalledOnce();
    expect(mockFollowUpUpdateMany).toHaveBeenCalledWith({
      where: {
        clientId: CLIENT_ID,
        status: "PENDING",
        scheduledDate: { gte: START_TIME },
      },
      data: { status: "BOOKED" },
    });
  });

  // ════════════════════════════════════════════════════════
  // 2. מעקב בעבר — לא מכוסה על ידי ה-updateMany
  // ════════════════════════════════════════════════════════

  it("מעקב עם scheduledDate לפני startTime אינו עומד בתנאי gte — לא מעודכן", async () => {
    // הבדיקה מאמתת שה-where clause מכיל `gte: startTime`,
    // כלומר רק מעקבים עם scheduledDate >= startTime נכללים.
    // מעקב עם scheduledDate לפני startTime לא יוחזר מה-DB בתנאי זה.

    const PAST_DATE    = new Date("2026-11-09T10:00:00.000Z"); // לפני startTime
    const FUTURE_DATE  = new Date("2026-11-11T10:00:00.000Z"); // אחרי startTime

    await createAppointment({
      clientId: CLIENT_ID,
      treatmentId: "treatment-1",
      therapist: "מג'ידה",
      room: null,
      startTime: START_TIME,
      endTime: END_TIME,
      notes: null,
    });

    // ה-where clause חייב להכיל gte: startTime — לא gte: PAST_DATE
    const callArgs = mockFollowUpUpdateMany.mock.calls[0][0];
    const scheduledDateFilter = callArgs?.where?.scheduledDate;

    // הפילטר אמור להיות gte: startTime (ולא תאריך אחר)
    expect(scheduledDateFilter).toBeDefined();
    expect(scheduledDateFilter.gte).toEqual(START_TIME);

    // לא אמור להיות lt/lte שיכלול את PAST_DATE
    expect(scheduledDateFilter.lt).toBeUndefined();
    expect(scheduledDateFilter.lte).toBeUndefined();
  });

  // ════════════════════════════════════════════════════════
  // 3. clientId נכון מועבר ל-updateMany
  // ════════════════════════════════════════════════════════

  it("מעביר את clientId הנכון מה-appointment שנוצר ל-updateMany", async () => {
    const specificClientId = "client-specific-456";
    const appointmentWithOtherClient = {
      ...MOCK_CREATED_APPOINTMENT,
      clientId: specificClientId,
      client: { ...MOCK_CREATED_APPOINTMENT.client, id: specificClientId },
    };
    mockAppointmentCreate.mockResolvedValue(appointmentWithOtherClient);

    await createAppointment({
      clientId: specificClientId,
      treatmentId: null,
      therapist: "רונית",
      room: null,
      startTime: START_TIME,
      endTime: END_TIME,
      notes: null,
    });

    expect(mockFollowUpUpdateMany).toHaveBeenCalledOnce();
    const callArgs = mockFollowUpUpdateMany.mock.calls[0][0];
    expect(callArgs.where.clientId).toBe(specificClientId);
  });

  // ════════════════════════════════════════════════════════
  // 4. בדיקת שגיאה — startTime >= endTime
  // ════════════════════════════════════════════════════════

  it("זורק שגיאה אם startTime >= endTime — ולא קורא ל-updateMany", async () => {
    await expect(
      createAppointment({
        clientId: CLIENT_ID,
        treatmentId: null,
        therapist: "מג'ידה",
        room: null,
        startTime: END_TIME,   // endTime <= startTime
        endTime: START_TIME,
        notes: null,
      })
    ).rejects.toThrow("שעת ההתחלה חייבת להיות לפני שעת הסיום");

    // במקרה של שגיאה — לא נוצר תור ולא מתבצע updateMany
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
    expect(mockFollowUpUpdateMany).not.toHaveBeenCalled();
  });

  // ════════════════════════════════════════════════════════
  // 5. data.status === "BOOKED" בקריאת updateMany
  // ════════════════════════════════════════════════════════

  it("ה-data שמועבר ל-updateMany מכיל { status: 'BOOKED' }", async () => {
    await createAppointment({
      clientId: CLIENT_ID,
      treatmentId: null,
      therapist: "מג'ידה",
      room: null,
      startTime: START_TIME,
      endTime: END_TIME,
      notes: null,
    });

    const callArgs = mockFollowUpUpdateMany.mock.calls[0][0];
    expect(callArgs.data).toEqual({ status: "BOOKED" });
  });
});
