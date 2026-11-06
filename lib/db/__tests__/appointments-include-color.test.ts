/**
 * בדיקה ישירה ל-lib/db/appointments.ts — task 5.2.
 *
 * בודק שה-appointmentInclude שמשמש את כל שאילתות הבסיס (getAppointmentsByDateRange,
 * createAppointment, getAppointmentById) כולל את treatment.color בתוך ה-select.
 *
 * ללא שינוי זה, היומן לא יוכל להציג תורים בצבע הטיפול המתאים (FR-AP-02).
 *
 * הרצה: `npx vitest run --reporter=verbose lib/db/__tests__/appointments-include-color.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// --- Mock ל-Prisma ברמה נמוכה ---

const { mockFindMany, mockCreate, mockFindUnique } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCreate: vi.fn(),
  mockFindUnique: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    appointment: {
      findMany: mockFindMany,
      create: mockCreate,
      findUnique: mockFindUnique,
    },
  },
}));

// --- Import after mocks ---
import {
  getAppointmentsByDateRange,
  createAppointment,
  getAppointmentById,
} from "@/lib/db/appointments";

const MOCK_RESULT = [
  {
    id: "appt-1",
    clientId: "client-1",
    treatmentId: "treatment-1",
    therapist: "מג'ידה",
    room: null,
    startTime: new Date("2026-11-10T10:00:00.000Z"),
    endTime: new Date("2026-11-10T11:00:00.000Z"),
    status: "SCHEDULED",
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    client: { id: "client-1", firstName: "דנה", lastName: "כהן", phone: "0501234567" },
    treatment: {
      id: "treatment-1",
      name: "מיקרונידלינג",
      durationMinutes: 60,
      color: "#D2AB2E",
      requiresConsentForm: true,
      authorizedTherapists: "מג'ידה",
    },
  },
];

// ===================================================================
// getAppointmentsByDateRange — בודק שה-include מכיל treatment.color
// ===================================================================

describe("task 5.2 — lib/db/appointments: appointmentInclude מכיל color (getAppointmentsByDateRange)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue(MOCK_RESULT);
  });

  it("קורא ל-prisma.appointment.findMany עם include.treatment.select.color: true", async () => {
    await getAppointmentsByDateRange(
      new Date("2026-11-01"),
      new Date("2026-11-30")
    );

    expect(mockFindMany).toHaveBeenCalledOnce();
    const callArg = mockFindMany.mock.calls[0][0];

    // בדיקה עיקרית: treatment.select חייב לכלול color
    expect(
      callArg.include?.treatment?.select?.color,
      "appointmentInclude.treatment.select אינו כולל color — יומן לא יוכל להציג צבעי טיפול (FR-AP-02)"
    ).toBe(true);
  });

  it("קורא ל-prisma.appointment.findMany עם include.treatment.select.requiresConsentForm: true", async () => {
    await getAppointmentsByDateRange(
      new Date("2026-11-01"),
      new Date("2026-11-30")
    );
    const callArg = mockFindMany.mock.calls[0][0];
    expect(
      callArg.include?.treatment?.select?.requiresConsentForm,
      "appointmentInclude.treatment.select אינו כולל requiresConsentForm"
    ).toBe(true);
  });
});

// ===================================================================
// createAppointment — בודק שה-include מכיל treatment.color
// ===================================================================

describe("task 5.2 — lib/db/appointments: appointmentInclude מכיל color (createAppointment)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue(MOCK_RESULT[0]);
  });

  it("קורא ל-prisma.appointment.create עם include.treatment.select.color: true", async () => {
    await createAppointment({
      clientId: "client-1",
      therapist: "מג'ידה",
      startTime: new Date("2026-11-10T10:00:00.000Z"),
      endTime: new Date("2026-11-10T11:00:00.000Z"),
    });

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArg = mockCreate.mock.calls[0][0];

    expect(
      callArg.include?.treatment?.select?.color,
      "createAppointment include אינו כולל color"
    ).toBe(true);
  });
});

// ===================================================================
// getAppointmentById — בודק שה-include מכיל treatment.color
// ===================================================================

describe("task 5.2 — lib/db/appointments: appointmentInclude מכיל color (getAppointmentById)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue(MOCK_RESULT[0]);
  });

  it("קורא ל-prisma.appointment.findUnique עם include.treatment.select.color: true", async () => {
    await getAppointmentById("appt-1");

    expect(mockFindUnique).toHaveBeenCalledOnce();
    const callArg = mockFindUnique.mock.calls[0][0];

    expect(
      callArg.include?.treatment?.select?.color,
      "getAppointmentById include אינו כולל color"
    ).toBe(true);
  });
});

// ===================================================================
// authorizedTherapists — בודק שה-include מכיל את השדה
// ===================================================================

describe("task 5.2 — lib/db/appointments: appointmentInclude מכיל authorizedTherapists (getAppointmentsByDateRange)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue(MOCK_RESULT);
  });

  it("קורא ל-prisma.appointment.findMany עם include.treatment.select.authorizedTherapists: true", async () => {
    await getAppointmentsByDateRange(
      new Date("2026-11-01"),
      new Date("2026-11-30")
    );
    const callArg = mockFindMany.mock.calls[0][0];
    expect(
      callArg.include?.treatment?.select?.authorizedTherapists,
      "appointmentInclude.treatment.select אינו כולל authorizedTherapists"
    ).toBe(true);
  });
});
