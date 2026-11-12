/**
 * בדיקות ל-WeeklyCalendar — מילוי אוטומטי של שעת הסיום בדיאלוג "תור חדש"
 * (תיקון באג: שעת הסיום נגזרת ממשך הטיפול הנבחר).
 *
 * ההתנהגות הנבדקת:
 *  - בחירת טיפול ממלאת שעת סיום = שעת התחלה + משך הטיפול.
 *  - שינוי שעת ההתחלה כשטיפול נבחר מחשב מחדש את שעת הסיום.
 *  - בחירת "ללא טיפול ספציפי" אינה משנה את שעת הסיום.
 *  - עריכה ידנית של שעת הסיום נשמרת על פני render לא-קשור, ומוחלפת
 *    כשמשנים טיפול/שעת התחלה.
 *  - משכי טיפול שאינם 60 (למשל 150 ו-45) מחושבים נכון.
 *  - חציית חצות עוטפת ליממה (23:30 + 60 → 00:30).
 *
 * הערה על הכיסוי של addMinutesToTime:
 *   הפונקציה addMinutesToTime היא ברמת-מודול אך אינה מיוצאת (export) מ-
 *   WeeklyCalendar.tsx — לכן לא ניתן לבדוק אותה כיחידה נפרדת, והיא נבדקת
 *   דרך התנהגות הדיאלוג (כולל מקרה הקצה של חציית חצות).
 *
 * הבדיקות משתמשות ב-fireEvent (ולא userEvent) כדי להישאר עקביות עם
 * WeeklyCalendar.newappt.test.tsx הקיים ולהפעיל את מטפלי ה-onChange של
 * שדות ה-<select> ו-type="time" בצורה אמינה.
 *
 * הרצה:
 *   npx vitest run components/calendar/__tests__/WeeklyCalendar.autoend.test.tsx
 */

import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WeeklyCalendar, type TreatmentOption } from "../WeeklyCalendar";

const WEEK_START = "2026-11-01";

/** טיפולים עם משכים מגוונים: 60, 45, 150 דקות */
const TREATMENTS: TreatmentOption[] = [
  { id: "t60", name: "הסרת שיער בלייזר", durationMinutes: 60, color: "#FF5733" },
  { id: "t45", name: "טיפול פנים", durationMinutes: 45, color: "#33FF57" },
  { id: "t150", name: "טיפול ממושך", durationMinutes: 150, color: "#3357FF" },
];

// ---------------------------------------------------------------------------
// עזרים
// ---------------------------------------------------------------------------

/** פותח את דיאלוג התור החדש ומחזיר את אלמנט הדיאלוג */
function openDialog(): HTMLElement {
  fireEvent.click(
    screen.getByRole("button", { name: "פתח דיאלוג הוספת תור חדש" })
  );
  return screen.getByRole("dialog");
}

function getStartInput(dialog: HTMLElement): HTMLInputElement {
  return within(dialog).getByLabelText(/שעת התחלה/) as HTMLInputElement;
}

function getEndInput(dialog: HTMLElement): HTMLInputElement {
  return within(dialog).getByLabelText(/שעת סיום/) as HTMLInputElement;
}

function getTreatmentSelect(dialog: HTMLElement): HTMLSelectElement {
  return within(dialog).getByLabelText(/טיפול/) as HTMLSelectElement;
}

function selectTreatment(dialog: HTMLElement, value: string): void {
  fireEvent.change(getTreatmentSelect(dialog), { target: { value } });
}

function setStart(dialog: HTMLElement, value: string): void {
  fireEvent.change(getStartInput(dialog), { target: { value } });
}

// ---------------------------------------------------------------------------
// setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ appointments: [] }),
  }) as unknown as typeof fetch;
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// בחירת טיפול ממלאת שעת סיום = התחלה + משך
// ---------------------------------------------------------------------------

describe("NewAppointmentDialog — auto-fill end time from treatment duration", () => {
  it("ברירת המחדל: שעת התחלה 09:00, שעת סיום 10:00", () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
        treatments={TREATMENTS}
      />
    );
    const dialog = openDialog();
    expect(getStartInput(dialog).value).toBe("09:00");
    expect(getEndInput(dialog).value).toBe("10:00");
  });

  it("בחירת טיפול של 45 דק' קובעת שעת סיום = 09:45", () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
        treatments={TREATMENTS}
      />
    );
    const dialog = openDialog();
    selectTreatment(dialog, "t45");
    expect(getEndInput(dialog).value).toBe("09:45");
  });

  it("בחירת טיפול של 150 דק' קובעת שעת סיום = 11:30 (משך שאינו 60)", () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
        treatments={TREATMENTS}
      />
    );
    const dialog = openDialog();
    selectTreatment(dialog, "t150");
    expect(getEndInput(dialog).value).toBe("11:30");
  });

  it("בחירת טיפול של 60 דק' קובעת שעת סיום = 10:00", () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
        treatments={TREATMENTS}
      />
    );
    const dialog = openDialog();
    // משנים תחילה את שעת ההתחלה כדי שהתוצאה תהיה שונה מברירת המחדל
    setStart(dialog, "14:00");
    selectTreatment(dialog, "t60");
    expect(getEndInput(dialog).value).toBe("15:00");
  });

  it("שינוי שעת ההתחלה כשטיפול נבחר מחשב מחדש את שעת הסיום", () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
        treatments={TREATMENTS}
      />
    );
    const dialog = openDialog();

    // בחירת טיפול 45 דק' → 09:45
    selectTreatment(dialog, "t45");
    expect(getEndInput(dialog).value).toBe("09:45");

    // שינוי שעת התחלה ל-13:00 → 13:45 (מחושב מחדש)
    setStart(dialog, "13:00");
    expect(getEndInput(dialog).value).toBe("13:45");
  });
});

// ---------------------------------------------------------------------------
// "ללא טיפול ספציפי" ו-start ריק — אין שינוי
// ---------------------------------------------------------------------------

describe("NewAppointmentDialog — cases that must NOT change end time", () => {
  it("בחירת 'ללא טיפול ספציפי' אינה משנה את שעת הסיום", () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
        treatments={TREATMENTS}
      />
    );
    const dialog = openDialog();

    // תחילה בוחרים טיפול שקובע 09:45
    selectTreatment(dialog, "t45");
    expect(getEndInput(dialog).value).toBe("09:45");

    // מעבר ל"ללא טיפול ספציפי" (value="") — שעת הסיום נשמרת
    selectTreatment(dialog, "");
    expect(getEndInput(dialog).value).toBe("09:45");
  });

  it("שעת התחלה ריקה: בחירת טיפול אינה משנה את שעת הסיום", () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
        treatments={TREATMENTS}
      />
    );
    const dialog = openDialog();

    // מרוקנים את שעת ההתחלה
    setStart(dialog, "");
    expect(getStartInput(dialog).value).toBe("");

    // בחירת טיפול כאשר אין שעת התחלה — שעת הסיום נשארת כברירת המחדל
    selectTreatment(dialog, "t60");
    expect(getEndInput(dialog).value).toBe("10:00");
  });
});

// ---------------------------------------------------------------------------
// עריכה ידנית של שעת הסיום
// ---------------------------------------------------------------------------

describe("NewAppointmentDialog — manual end-time override", () => {
  it("עריכה ידנית נשמרת על פני render לא-קשור (שינוי שדה הערות)", () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
        treatments={TREATMENTS}
      />
    );
    const dialog = openDialog();

    // עריכה ידנית של שעת הסיום
    fireEvent.change(getEndInput(dialog), { target: { value: "12:00" } });
    expect(getEndInput(dialog).value).toBe("12:00");

    // render לא-קשור: שינוי שדה הערות אינו קורא ל-applyAutoEnd
    const notes = within(dialog).getByLabelText(/הערות/) as HTMLTextAreaElement;
    fireEvent.change(notes, { target: { value: "לקוחה מבקשת חדר שקט" } });

    // שעת הסיום הידנית נשמרת
    expect(getEndInput(dialog).value).toBe("12:00");
  });

  it("עריכה ידנית מוחלפת כשבוחרים טיפול", () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
        treatments={TREATMENTS}
      />
    );
    const dialog = openDialog();

    fireEvent.change(getEndInput(dialog), { target: { value: "12:00" } });
    expect(getEndInput(dialog).value).toBe("12:00");

    // בחירת טיפול 45 דק' → 09:45 (הערך הידני מוחלף)
    selectTreatment(dialog, "t45");
    expect(getEndInput(dialog).value).toBe("09:45");
  });

  it("עריכה ידנית מוחלפת כשמשנים את שעת ההתחלה (כשטיפול נבחר)", () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
        treatments={TREATMENTS}
      />
    );
    const dialog = openDialog();

    selectTreatment(dialog, "t60"); // 10:00
    fireEvent.change(getEndInput(dialog), { target: { value: "12:00" } });
    expect(getEndInput(dialog).value).toBe("12:00");

    // שינוי שעת ההתחלה מחשב מחדש ומוחק את העריכה הידנית
    setStart(dialog, "15:00");
    expect(getEndInput(dialog).value).toBe("16:00");
  });
});

// ---------------------------------------------------------------------------
// חציית חצות (modulo 1440)
// ---------------------------------------------------------------------------

describe("NewAppointmentDialog — midnight wrap", () => {
  it("23:30 + 60 דק' עוטף ל-00:30", () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
        treatments={TREATMENTS}
      />
    );
    const dialog = openDialog();

    selectTreatment(dialog, "t60");
    setStart(dialog, "23:30");
    expect(getEndInput(dialog).value).toBe("00:30");
  });

  it("23:30 + 150 דק' עוטף ל-02:00", () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
        treatments={TREATMENTS}
      />
    );
    const dialog = openDialog();

    selectTreatment(dialog, "t150");
    setStart(dialog, "23:30");
    expect(getEndInput(dialog).value).toBe("02:00");
  });
});
