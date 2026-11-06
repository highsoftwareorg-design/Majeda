/**
 * בדיקות ל-WeeklyCalendar — ניהול סטטוס תור (משימה 5.8, FR-AP-04).
 *
 * בודק:
 * 1. Badge סטטוס מוצג עם הטקסט העברי הנכון לכל סטטוס.
 * 2. תפריט שינוי סטטוס מציג רק סטטוסי "הבא" חוקיים (לפי NEXT_STATUSES).
 * 3. סטטוסים סופיים (COMPLETED, CANCELLED, NO_SHOW) — אין כפתור שינוי סטטוס.
 * 4. לחיצה על אפשרות סטטוס קוראת ל-PATCH /api/appointments/[id] עם הסטטוס החדש.
 * 5. rollback: כאשר ה-PATCH נכשל — הסטטוס חוזר לערך המקורי.
 *
 * הרצה: `npx vitest run --reporter=verbose components/calendar/__tests__/WeeklyCalendar.status.test.tsx`
 */

import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { WeeklyCalendar, type SerializedAppointment } from "../WeeklyCalendar";

// ---------------------------------------------------------------------------
// Mock גלובלי ל-fetch
// ---------------------------------------------------------------------------
beforeAll(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ appointments: [] }),
  }) as unknown as typeof fetch;
});

// ---------------------------------------------------------------------------
// נתוני עזר
// ---------------------------------------------------------------------------

const WEEK_START = "2026-11-01";

/**
 * בונה SerializedAppointment עם גובה 80px (60 דקות × 80/60 px/min)
 * — גדול מ-54px ולכן badge הסטטוס יוצג.
 */
function makeApt(
  id: string,
  status: string,
  options: {
    firstName?: string;
    lastName?: string;
    statusHistory?: SerializedAppointment["statusHistory"];
  } = {}
): SerializedAppointment {
  return {
    id,
    clientId: `client-${id}`,
    client: {
      id: `client-${id}`,
      firstName: options.firstName ?? "דנה",
      lastName: options.lastName ?? "כהן",
      phone: "0501234567",
    },
    treatmentId: "treatment-1",
    treatment: {
      id: "treatment-1",
      name: "טיפול פנים",
      durationMinutes: 60,
      color: "#D2AB2E",
    },
    therapist: "מג'ידה",
    room: null,
    // 09:00–10:00 — 60 דקות → height = 80px > 54px → badge גלוי
    startTime: "2026-11-01T09:00:00",
    endTime: "2026-11-01T10:00:00",
    status,
    notes: null,
    statusHistory: options.statusHistory ?? [],
    createdAt: "2026-11-01T08:00:00",
    updatedAt: "2026-11-01T08:00:00",
  };
}

// ---------------------------------------------------------------------------
// 1. Badge סטטוס — טקסט עברי נכון
// ---------------------------------------------------------------------------

describe("WeeklyCalendar — task 5.8: status badge (5.8-1)", () => {
  const statusCases: Array<{ status: string; hebrewLabel: string }> = [
    { status: "SCHEDULED",  hebrewLabel: "נקבע" },
    { status: "CONFIRMED",  hebrewLabel: "אושר" },
    { status: "ARRIVED",    hebrewLabel: "הגיע/ה" },
    { status: "COMPLETED",  hebrewLabel: "בוצע" },
    { status: "CANCELLED",  hebrewLabel: "בוטל" },
    { status: "NO_SHOW",    hebrewLabel: "לא הגיע/ה" },
  ];

  statusCases.forEach(({ status, hebrewLabel }) => {
    it(`badge של סטטוס '${status}' מציג את הטקסט העברי '${hebrewLabel}'`, () => {
      const apt = makeApt(`badge-${status}`, status);
      const { container } = render(
        <WeeklyCalendar
          initialAppointments={[apt]}
          initialWeekStart={WEEK_START}
        />
      );

      // aria-label על ה-badge הוא בדיוק "סטטוס: <label_he>" (ללא תחילית "תור:")
      // משתמשים ב-querySelector עם exact match כדי לא לתפוס את ה-article שיש לו
      // aria-label ארוך יותר שמכיל גם "סטטוס: X"
      const exactSelector = `[aria-label="סטטוס: ${hebrewLabel}"]`;
      const badgeEl = container.querySelector(exactSelector);
      expect(badgeEl).not.toBeNull();

      // הטקסט הנראה גם כן מוצג
      expect(badgeEl!.textContent?.trim()).toBe(hebrewLabel);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. תפריט שינוי סטטוס — סטטוסים חוקיים בלבד
// ---------------------------------------------------------------------------

describe("WeeklyCalendar — task 5.8: status change dropdown (5.8-2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ appointments: [] }),
    }) as unknown as typeof fetch;
  });

  it("סטטוס SCHEDULED — כפתור 'שנה סטטוס' מציג רק אושר ובוטל (ולא הגיע/ה, בוצע, לא הגיע/ה)", () => {
    const apt = makeApt("scheduled-apt", "SCHEDULED", {
      firstName: "שרה",
      lastName: "כהן",
    });
    render(
      <WeeklyCalendar
        initialAppointments={[apt]}
        initialWeekStart={WEEK_START}
      />
    );

    // כפתור שינוי סטטוס — יכול להיות מרובה (desktop + נייד); לוחצים על הראשון
    const statusButtons = screen.getAllByRole("button", {
      name: /שנה סטטוס עבור/,
    });
    expect(statusButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(statusButtons[0]);

    // listbox נפתח
    const listbox = screen.getByRole("listbox", { name: "בחר סטטוס חדש" });
    expect(listbox).toBeInTheDocument();

    // בתוך ה-listbox: "אושר" ו"בוטל" קיימים
    expect(within(listbox).getByText("אושר")).toBeInTheDocument();
    expect(within(listbox).getByText("בוטל")).toBeInTheDocument();

    // "הגיע/ה", "בוצע", "לא הגיע/ה" לא קיימים (לא מעברי SCHEDULED)
    expect(within(listbox).queryByText("הגיע/ה")).not.toBeInTheDocument();
    expect(within(listbox).queryByText("בוצע")).not.toBeInTheDocument();
    expect(within(listbox).queryByText("לא הגיע/ה")).not.toBeInTheDocument();
  });

  it("סטטוס CONFIRMED — כפתור 'שנה סטטוס' מציג הגיע/ה ובוטל (ולא אושר, בוצע)", () => {
    const apt = makeApt("confirmed-apt", "CONFIRMED", {
      firstName: "רחל",
      lastName: "לוי",
    });
    render(
      <WeeklyCalendar
        initialAppointments={[apt]}
        initialWeekStart={WEEK_START}
      />
    );

    const statusButtons = screen.getAllByRole("button", {
      name: /שנה סטטוס עבור/,
    });
    fireEvent.click(statusButtons[0]);

    const listbox = screen.getByRole("listbox", { name: "בחר סטטוס חדש" });
    expect(within(listbox).getByText("הגיע/ה")).toBeInTheDocument();
    expect(within(listbox).getByText("בוטל")).toBeInTheDocument();
    expect(within(listbox).queryByText("אושר")).not.toBeInTheDocument();
    expect(within(listbox).queryByText("בוצע")).not.toBeInTheDocument();
  });

  it("סטטוס ARRIVED — כפתור 'שנה סטטוס' מציג בוצע, לא הגיע/ה ובוטל", () => {
    const apt = makeApt("arrived-apt", "ARRIVED", {
      firstName: "מרים",
      lastName: "אברהם",
    });
    render(
      <WeeklyCalendar
        initialAppointments={[apt]}
        initialWeekStart={WEEK_START}
      />
    );

    const statusButtons = screen.getAllByRole("button", {
      name: /שנה סטטוס עבור/,
    });
    fireEvent.click(statusButtons[0]);

    const listbox = screen.getByRole("listbox", { name: "בחר סטטוס חדש" });
    expect(within(listbox).getByText("בוצע")).toBeInTheDocument();
    expect(within(listbox).getByText("לא הגיע/ה")).toBeInTheDocument();
    expect(within(listbox).getByText("בוטל")).toBeInTheDocument();
    // אושר ו"הגיע/ה" לא צריכים להיות כאן
    expect(within(listbox).queryByText("אושר")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. סטטוסים סופיים — אין כפתור שינוי סטטוס
// ---------------------------------------------------------------------------

describe("WeeklyCalendar — task 5.8: terminal statuses (5.8-3)", () => {
  const terminalStatuses = ["COMPLETED", "CANCELLED", "NO_SHOW"];

  terminalStatuses.forEach((status) => {
    it(`סטטוס סופי '${status}' — אין כפתור 'שנה סטטוס' עבור תור זה`, () => {
      const apt = makeApt(`terminal-${status}`, status, {
        firstName: "נועה",
        lastName: "דוד",
      });
      render(
        <WeeklyCalendar
          initialAppointments={[apt]}
          initialWeekStart={WEEK_START}
        />
      );

      // אין כפתור שינוי סטטוס — NEXT_STATUSES[terminal] = []
      const statusBtn = screen.queryByRole("button", {
        name: /שנה סטטוס עבור/,
      });
      expect(statusBtn).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// 4. לחיצה על סטטוס — PATCH נקרא עם הסטטוס החדש
// ---------------------------------------------------------------------------

describe("WeeklyCalendar — task 5.8: status change PATCH call (5.8-4)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("לחיצה על 'אושר' בתפריט מפעילה PATCH /api/appointments/[id] עם status=CONFIRMED", async () => {
    const patchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        appointment: {
          ...makeApt("patch-status-apt", "CONFIRMED"),
          statusHistory: [
            {
              id: "h1",
              fromStatus: "SCHEDULED",
              toStatus: "CONFIRMED",
              changedAt: "2026-11-01T09:00:00",
              changedBy: "system",
            },
          ],
        },
      }),
    });
    globalThis.fetch = patchMock as unknown as typeof fetch;

    const apt = makeApt("patch-status-apt", "SCHEDULED", {
      firstName: "דנה",
      lastName: "הבדיקה",
    });
    render(
      <WeeklyCalendar
        initialAppointments={[apt]}
        initialWeekStart={WEEK_START}
      />
    );

    // פותחים תפריט סטטוס
    const statusButtons = screen.getAllByRole("button", {
      name: /שנה סטטוס עבור/,
    });
    fireEvent.click(statusButtons[0]);

    // לוחצים על "אושר" בתפריט
    const listbox = screen.getByRole("listbox", { name: "בחר סטטוס חדש" });
    fireEvent.click(within(listbox).getByText("אושר"));

    // ממתינים לסיום ה-fetch האסינכרוני
    await waitFor(() => {
      expect(patchMock).toHaveBeenCalled();
    });

    // בודקים שנקרא PATCH עם הנתיב והסטטוס הנכון
    const patchCall = patchMock.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === "string" &&
        (call[0] as string).includes("/api/appointments/patch-status-apt") &&
        (call[1] as RequestInit)?.method === "PATCH"
    );
    expect(patchCall).toBeDefined();

    const body = JSON.parse((patchCall![1] as RequestInit).body as string);
    expect(body.status).toBe("CONFIRMED");
  });
});

// ---------------------------------------------------------------------------
// 5. Rollback — כאשר ה-PATCH נכשל, הסטטוס חוזר לערך המקורי
// ---------------------------------------------------------------------------

describe("WeeklyCalendar — task 5.8: status change rollback on error (5.8-5)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("כאשר PATCH נכשל — הודעת שגיאה מוצגת והסטטוס המקורי נשמר", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "שגיאת שרת" }),
    }) as unknown as typeof fetch;

    const apt = makeApt("rollback-apt", "SCHEDULED", {
      firstName: "שרה",
      lastName: "הרולבק",
    });
    render(
      <WeeklyCalendar
        initialAppointments={[apt]}
        initialWeekStart={WEEK_START}
      />
    );

    // פותחים תפריט סטטוס
    const statusButtons = screen.getAllByRole("button", {
      name: /שנה סטטוס עבור/,
    });
    fireEvent.click(statusButtons[0]);

    // לוחצים על "אושר"
    const listbox = screen.getByRole("listbox", { name: "בחר סטטוס חדש" });
    fireEvent.click(within(listbox).getByText("אושר"));

    // ממתינים להופעת הודעת שגיאה (role="alert")
    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });

    // הסטטוס המקורי (נקבע) עדיין מוצג — ה-badge של SCHEDULED
    const scheduledBadges = screen.queryAllByLabelText("סטטוס: נקבע");
    expect(scheduledBadges.length).toBeGreaterThanOrEqual(1);
  });
});
