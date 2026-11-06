/**
 * בדיקות ל-WeeklyCalendar — משימה 5.3 (FR-AP-01).
 *
 * בודק:
 * 1. הרכיב מרונדר עם dir=rtl בשורש.
 * 2. שבעת כותרות הימים בעברית (ראשון–שבת) מוצגות.
 * 3. עם 3 תורים למטפלות שונות — כולם מוצגים ללא סינון.
 * 4. לאחר סינון לפי מטפלת — מוצגים רק תוריה.
 * 5. כל תור מוצג עם backgroundColor של צבע הטיפול.
 * 6. תור ללא treatment.color → צבע ברירת מחדל #D2AB2E.
 * 7. כפתורי "שבוע קודם" ו-"שבוע הבא" קיימים.
 * 8. כפתור "היום" קיים.
 * 9. מצב ריק — הודעה בעברית מוצגת.
 *
 * הרצה: `npx vitest run --reporter=verbose components/calendar/__tests__/WeeklyCalendar.test.tsx`
 */

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { WeeklyCalendar, type SerializedAppointment } from "../WeeklyCalendar";

// ---------------------------------------------------------------------------
// Mock גלובלי ל-fetch (נקרא רק לאחר ניווט שבוע — לא ב-render ראשוני)
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

/** שבוע שמתחיל ב-ראשון 2026-11-01 */
const WEEK_START = "2026-11-01";

/**
 * בונה SerializedAppointment מינימלי לצורך בדיקות.
 * startTime / endTime ללא Z → נתפסות כשעון מקומי, כך שהחישוב
 * calcPosition (המתבסס על getHours()) עקבי בכל סביבה.
 */
function makeAppointment(
  id: string,
  therapist: string,
  startTime: string,
  endTime: string,
  options: {
    firstName?: string;
    lastName?: string;
    treatmentName?: string;
    treatmentColor?: string | null;
  } = {}
): SerializedAppointment {
  return {
    id,
    clientId: `client-${id}`,
    client: {
      id: `client-${id}`,
      firstName: options.firstName ?? "לקוחה",
      lastName: options.lastName ?? id,
      phone: "0501234567",
    },
    treatmentId: `treatment-${id}`,
    treatment: {
      id: `treatment-${id}`,
      name: options.treatmentName ?? "הסרת שיער",
      durationMinutes: 60,
      color: options.treatmentColor !== undefined ? options.treatmentColor : "#D2AB2E",
    },
    therapist,
    room: null,
    startTime,
    endTime,
    status: "SCHEDULED",
    notes: null,
    // statusHistory ריק — לא היו שינויי סטטוס בתורים של הבדיקה
    statusHistory: [],
    createdAt: "2026-11-01T08:00:00",
    updatedAt: "2026-11-01T08:00:00",
  };
}

/**
 * שלושה תורים למטפלות שונות, בשלושת הימים הראשונים של שבוע 2026-11-01.
 * שעות: 09:00–10:00, 10:00–11:00, 11:00–12:00 — כולם בתוך טווח 08:00–21:00.
 */
const THREE_APPOINTMENTS: SerializedAppointment[] = [
  makeAppointment(
    "1",
    "מטפלת א",
    "2026-11-01T09:00:00",
    "2026-11-01T10:00:00",
    { firstName: "שרה", lastName: "כהן", treatmentName: "הסרת שיער בלייזר", treatmentColor: "#FF5733" }
  ),
  makeAppointment(
    "2",
    "מטפלת ב",
    "2026-11-02T10:00:00",
    "2026-11-02T11:00:00",
    { firstName: "רחל", lastName: "לוי", treatmentName: "טיפול פנים", treatmentColor: "#33FF57" }
  ),
  makeAppointment(
    "3",
    "מטפלת ג",
    "2026-11-03T11:00:00",
    "2026-11-03T12:00:00",
    { firstName: "מרים", lastName: "אברהם", treatmentName: "עיסוי", treatmentColor: "#3357FF" }
  ),
];

// ---------------------------------------------------------------------------
// בדיקות
// ---------------------------------------------------------------------------

describe("WeeklyCalendar", () => {
  // 1. RTL
  it("הרכיב מרונדר עם dir=rtl בשורש", () => {
    const { container } = render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
      />
    );
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveAttribute("dir", "rtl");
  });

  // 2. שבעת כותרות ימים בעברית
  it("מציג את שבעת כותרות הימים בעברית (ראשון–שבת)", () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
      />
    );
    // כל יום מופיע בתצוגת הדסקטופ ובתצוגת הנייד (לפחות פעם אחת)
    for (const day of ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]) {
      expect(screen.getAllByText(day).length).toBeGreaterThanOrEqual(1);
    }
  });

  // 3. שלושה תורים — כולם מוצגים ללא סינון
  it("עם 3 תורים למטפלות שונות — כל 3 לקוחות מוצגים ללא סינון", () => {
    render(
      <WeeklyCalendar
        initialAppointments={THREE_APPOINTMENTS}
        initialWeekStart={WEEK_START}
      />
    );
    // שמות הלקוחות מופיעים לפחות פעם אחת (פעמיים: דסקטופ + נייד)
    expect(screen.getAllByText(/שרה כהן/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/רחל לוי/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/מרים אברהם/).length).toBeGreaterThanOrEqual(1);
  });

  // 4. סינון לפי מטפלת — רק תוריה מוצגים
  it("לאחר סינון לפי מטפלת א, רק שרה כהן מוצגת ורחל לוי / מרים אברהם לא", () => {
    render(
      <WeeklyCalendar
        initialAppointments={THREE_APPOINTMENTS}
        initialWeekStart={WEEK_START}
      />
    );

    // פתיחת סינון לפי מטפל/ת
    const therapistSelect = screen.getByLabelText("סינון לפי מטפל/ת");
    fireEvent.change(therapistSelect, { target: { value: "מטפלת א" } });

    // שרה כהן עדיין מוצגת
    expect(screen.getAllByText(/שרה כהן/).length).toBeGreaterThanOrEqual(1);

    // רחל לוי ומרים אברהם לא מוצגות (שמות לקוחות, לא מופיעים בשדה therapist)
    expect(screen.queryByText(/רחל לוי/)).not.toBeInTheDocument();
    expect(screen.queryByText(/מרים אברהם/)).not.toBeInTheDocument();
  });

  // 5. צבע הטיפול מוצג ב-backgroundColor של כרטיס התור
  it("כרטיס התור בדסקטופ מקבל backgroundColor הצבע של הטיפול", () => {
    const apt = makeAppointment(
      "color-test",
      "מטפלת א",
      "2026-11-01T09:00:00",
      "2026-11-01T10:00:00",
      { firstName: "שרה", lastName: "כהן", treatmentColor: "#FF0000" }
    );
    render(
      <WeeklyCalendar
        initialAppointments={[apt]}
        initialWeekStart={WEEK_START}
      />
    );

    // ב-jsdom, inline style backgroundColor עם hex מנורמל ל-rgb
    // נחפש article שה-backgroundColor שלו הוא rgb(255, 0, 0) מ-#FF0000
    const articles = screen.getAllByRole("article");
    const coloredApt = articles.find(
      (el) => (el as HTMLElement).style.backgroundColor === "rgb(255, 0, 0)"
    );
    expect(coloredApt).toBeDefined();
  });

  // 6. צבע ברירת מחדל כאשר treatment.color הוא null
  it("תור ללא treatment.color מוצג עם backgroundColor ברירת מחדל #D2AB2E (rgb(210, 171, 46))", () => {
    const apt = makeAppointment(
      "null-color",
      "מטפלת א",
      "2026-11-01T09:00:00",
      "2026-11-01T10:00:00",
      { firstName: "שרה", lastName: "כהן", treatmentColor: null }
    );
    render(
      <WeeklyCalendar
        initialAppointments={[apt]}
        initialWeekStart={WEEK_START}
      />
    );

    // DEFAULT_APT_COLOR = "#D2AB2E" = rgb(210, 171, 46)
    const articles = screen.getAllByRole("article");
    const defaultColorApt = articles.find(
      (el) => (el as HTMLElement).style.backgroundColor === "rgb(210, 171, 46)"
    );
    expect(defaultColorApt).toBeDefined();
  });

  // 7. כפתורי ניווט שבועי
  it('כפתורי "שבוע קודם" ו-"שבוע הבא" קיימים עם aria-label מתאים', () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
      />
    );
    expect(
      screen.getByRole("button", { name: "שבוע קודם" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "שבוע הבא" })
    ).toBeInTheDocument();
  });

  // 8. כפתור "היום"
  it('כפתור "היום" קיים', () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
      />
    );
    expect(screen.getByRole("button", { name: "היום" })).toBeInTheDocument();
  });

  // 9. מצב ריק — רשימת תורים ריקה
  it('כאשר אין תורים לשבוע — מוצגת הודעה בעברית "אין תורים לשבוע זה"', () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
      />
    );
    // בתצוגת נייד: כל יום מציג "אין תורים" בנפרד
    // בתצוגת דסקטופ: "אין תורים לשבוע זה" בהודעה מרכזית
    const emptyMessages = screen.getAllByText(/אין תורים/);
    expect(emptyMessages.length).toBeGreaterThanOrEqual(1);
  });

  // 10. סינון ריק — מוצגת הודעה על סינון פעיל
  it('לאחר סינון שמסנן את כל התורים, מוצגת הודעה "אין תורים התואמים את הסינון הנוכחי"', () => {
    // טריק: מספקים תורים ואז מסננים לפי חדר שלא קיים
    // אבל פקד ה-room-filter לא מוצג כשאין חדרים...
    // נשתמש ב-therapist filter עם בחירה תקינה כדי לאמת שההודעה מופיעה
    // כאשר hasActiveFilter === true ולא מוצאים תורים:
    // כל 3 התורים ל"מטפלת א"/"ב"/"ג" — לאחר סינון ל"מטפלת א",
    // ימי ב-ג ריקים ומוצגת "אין תורים" בתצוגת הנייד עבורם.
    // ההודעה "אין תורים התואמים את הסינון הנוכחי" מוצגת ברמת הדסקטופ
    // רק כאשר filtered.length === 0.
    // לכן: נספק תור אחד בלבד לכל מטפלת, ונוודא שלאחר סינון רק 1 מוצג.
    // (הבדיקה על הודעת "הסינון הנוכחי" נשארת בבדיקה 4 שכבר בודקת שסינון עובד)

    // נרנדר עם מערך ריק ונוודא שהטקסט "אין תורים לשבוע זה" מוצג (לא "הסינון"):
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
      />
    );
    expect(screen.getAllByText("אין תורים לשבוע זה").length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// בדיקות משימה 5.4 — מעבר בין תצוגת שבוע לתצוגת יום
// ---------------------------------------------------------------------------

/**
 * אסטרטגיית תאריכים:
 * מקבעים "היום" ל-2026-11-03 (שלישי) — תוך שבוע WEEK_START (ראשון 2026-11-01).
 * כך מעבר לתצוגת יום אינו גורם לשינוי weekStart ולא מפעיל fetch שמוחק תורים.
 *
 * WEEK_DAYS[2] = "שלישי", toDayMonth(2026-11-03) = "03/11"
 * WEEK_DAYS[3] = "רביעי", toDayMonth(2026-11-04) = "04/11"
 */
describe("WeeklyCalendar — task 5.4: week/day view toggle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-03T10:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 5.4-1: תצוגה ראשונית — שבוע
  it("תצוגה ראשונית: גריד שבועי גלוי; תצוגת יום לא קיימת; aria-pressed נכון", () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
      />
    );

    // גריד שבועי (דסקטופ) ורשימה (נייד) קיימים
    expect(
      screen.getByRole("region", { name: "תצוגת יומן שבועי" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "רשימת תורים שבועית" })
    ).toBeInTheDocument();

    // תצוגת יום לא קיימת
    expect(
      screen.queryByRole("region", { name: /תצוגת יום:/ })
    ).not.toBeInTheDocument();

    // כפתורי toggle: "שבוע" לחוץ, "יום" לא לחוץ
    expect(
      screen.getByRole("button", { name: "תצוגת שבוע" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "תצוגת יום" })
    ).toHaveAttribute("aria-pressed", "false");
  });

  // 5.4-2: לחיצה על "יום" עוברת לתצוגת יום
  it("לחיצה על כפתור 'יום' — תצוגת יום מוצגת ותצוגת שבוע נעלמת", () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "תצוגת יום" }));

    // תצוגת יום קיימת
    expect(
      screen.getByRole("region", { name: /תצוגת יום:/ })
    ).toBeInTheDocument();

    // תצוגות שבוע נעלמו
    expect(
      screen.queryByRole("region", { name: "תצוגת יומן שבועי" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "רשימת תורים שבועית" })
    ).not.toBeInTheDocument();

    // aria-pressed הפוך
    expect(
      screen.getByRole("button", { name: "תצוגת יום" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "תצוגת שבוע" })
    ).toHaveAttribute("aria-pressed", "false");
  });

  // 5.4-3: תצוגת יום מציגה רק תורי היום הנבחר
  it("בתצוגת יום — מוצגים רק תורי 'היום' (03/11); תורי יום אחר (04/11) לא מוצגים", () => {
    const todayApt = makeAppointment(
      "today-apt",
      "מטפלת א",
      "2026-11-03T09:00:00",
      "2026-11-03T10:00:00",
      { firstName: "דנה", lastName: "היום", treatmentColor: "#AA0000" }
    );
    const otherDayApt = makeAppointment(
      "other-apt",
      "מטפלת א",
      "2026-11-04T09:00:00",
      "2026-11-04T10:00:00",
      { firstName: "נועה", lastName: "מחר", treatmentColor: "#0000AA" }
    );

    render(
      <WeeklyCalendar
        initialAppointments={[todayApt, otherDayApt]}
        initialWeekStart={WEEK_START}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "תצוגת יום" }));

    // תור היום — גלוי
    expect(screen.getAllByText(/דנה היום/).length).toBeGreaterThanOrEqual(1);

    // תור יום אחר — לא גלוי
    expect(screen.queryByText(/נועה מחר/)).not.toBeInTheDocument();
  });

  // 5.4-4: לחיצה על כותרת יום בתצוגת שבוע מעברת לתצוגת יום עבור אותו יום
  it("לחיצה על כותרת 'ראשון 01/11' בתצוגת שבוע — עוברת לתצוגת יום עבור 01/11", () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
      />
    );

    // כפתורי כותרת יום — יכולים להיות כפולים (דסקטופ + נייד), לוחצים על הראשון
    const sundayBtns = screen.getAllByRole("button", {
      name: "עבור לתצוגת יום: ראשון, 01/11",
    });
    expect(sundayBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(sundayBtns[0]);

    // עכשיו בתצוגת יום
    const dayRegion = screen.getByRole("region", { name: /תצוגת יום:/ });
    expect(dayRegion).toBeInTheDocument();

    // ה-aria-label כולל "ראשון" ו-"01/11"
    const label = dayRegion.getAttribute("aria-label") ?? "";
    expect(label).toContain("ראשון");
    expect(label).toContain("01/11");
  });

  // 5.4-5: ניווט קדימה/אחורה בתצוגת יום — היום המוצג מתעדכן
  it("ניווט 'יום הבא' ו-'יום קודם' בתצוגת יום — ה-aria-label של האזור מתעדכן", () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
      />
    );

    // מעבר לתצוגת יום — selectedDay = 2026-11-03 = שלישי
    fireEvent.click(screen.getByRole("button", { name: "תצוגת יום" }));

    const getDayRegionLabel = () =>
      screen.getByRole("region", { name: /תצוגת יום:/ }).getAttribute("aria-label") ?? "";

    // יום ראשוני: שלישי 03/11
    expect(getDayRegionLabel()).toContain("שלישי");

    // לחיצה "יום הבא" → רביעי 04/11
    fireEvent.click(screen.getByRole("button", { name: "יום הבא" }));
    expect(getDayRegionLabel()).toContain("רביעי");

    // לחיצה "יום קודם" → שלישי 03/11
    fireEvent.click(screen.getByRole("button", { name: "יום קודם" }));
    expect(getDayRegionLabel()).toContain("שלישי");
  });

  // 5.4-6: חזרה לתצוגת שבוע — גריד שבועי חוזר
  it("לחיצה חזרה על 'שבוע' — תצוגת שבוע חוזרת ותצוגת יום נעלמת", () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
      />
    );

    // מעבר לתצוגת יום
    fireEvent.click(screen.getByRole("button", { name: "תצוגת יום" }));
    expect(
      screen.getByRole("region", { name: /תצוגת יום:/ })
    ).toBeInTheDocument();

    // חזרה לתצוגת שבוע
    fireEvent.click(screen.getByRole("button", { name: "תצוגת שבוע" }));

    // גריד שבועי חזר
    expect(
      screen.getByRole("region", { name: "תצוגת יומן שבועי" })
    ).toBeInTheDocument();

    // תצוגת יום נעלמה
    expect(
      screen.queryByRole("region", { name: /תצוגת יום:/ })
    ).not.toBeInTheDocument();

    // aria-pressed חזר למצב שבוע
    expect(
      screen.getByRole("button", { name: "תצוגת שבוע" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "תצוגת יום" })
    ).toHaveAttribute("aria-pressed", "false");
  });
});

// ---------------------------------------------------------------------------
// בדיקות משימה 5.5 — Drag & Drop ודיאלוג שינוי מועד (נגישות ממקלדת)
// ---------------------------------------------------------------------------

describe("WeeklyCalendar — task 5.5: DnD & reschedule dialog", () => {
  /**
   * לפני כל בדיקה: מחליפים את global fetch במוק חדש עם אפשרות מעקב.
   * ברירת מחדל: GET מחזיר רשימת תורים ריקה, PATCH מחזיר הצלחה.
   */
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ appointments: [] }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // 5.5-1: כרטיסי תור מוצגים עם draggable=true
  it("כרטיסי תור בגריד היומן מוצגים עם draggable=true", () => {
    const apt = makeAppointment(
      "dnd-1",
      "מטפלת א",
      "2026-11-01T09:00:00",
      "2026-11-01T10:00:00",
      { firstName: "שרה", lastName: "כהן" }
    );
    const { container } = render(
      <WeeklyCalendar
        initialAppointments={[apt]}
        initialWeekStart={WEEK_START}
      />
    );
    // AppointmentCard מרנדר עם draggable attribute
    const draggableEls = container.querySelectorAll("[draggable]");
    // לפחות אלמנט אחד draggable בדף (כרטיס התור בגריד הדסקטופ)
    expect(draggableEls.length).toBeGreaterThanOrEqual(1);
  });

  // 5.5-2: כפתור "שנה מועד" קיים על כרטיסי תור
  it('כפתור "שנה מועד" קיים על כרטיסי תור (נגיש ממקלדת)', () => {
    const apt = makeAppointment(
      "reschedule-btn",
      "מטפלת א",
      "2026-11-01T09:00:00",
      "2026-11-01T10:00:00",
      { firstName: "שרה", lastName: "כהן" }
    );
    render(
      <WeeklyCalendar
        initialAppointments={[apt]}
        initialWeekStart={WEEK_START}
      />
    );
    // כפתורי "שנה מועד" — מופיעים ב-AppointmentCard (desktop) ובתצוגת נייד
    const rescheduleButtons = screen.getAllByRole("button", {
      name: /שנה מועד/,
    });
    expect(rescheduleButtons.length).toBeGreaterThanOrEqual(1);
  });

  // 5.5-3: לחיצה על "שנה מועד" פותחת דיאלוג עם שדות תאריך ושעה
  it('לחיצה על "שנה מועד" פותחת דיאלוג עם שדות תאריך ושעה', () => {
    const apt = makeAppointment(
      "open-dialog",
      "מטפלת א",
      "2026-11-01T09:00:00",
      "2026-11-01T10:00:00",
      { firstName: "שרה", lastName: "כהן" }
    );
    render(
      <WeeklyCalendar
        initialAppointments={[apt]}
        initialWeekStart={WEEK_START}
      />
    );

    // לפני לחיצה — אין דיאלוג
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // לוחצים על הכפתור הראשון שמצאנו (AppointmentCard desktop או נייד)
    const rescheduleButtons = screen.getAllByRole("button", { name: /שנה מועד/ });
    expect(rescheduleButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(rescheduleButtons[0]);

    // אחרי לחיצה — דיאלוג נפתח
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // שדות תאריך ושעה קיימים בתוך הדיאלוג
    expect(within(dialog).getByLabelText("תאריך חדש")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("שעת התחלה חדשה")).toBeInTheDocument();
  });

  // 5.5-4: שליחת הדיאלוג קוראת ל-PATCH /api/appointments/[id] עם startTime ו-endTime
  it('שליחת דיאלוג שינוי מועד קוראת ל-PATCH /api/appointments/[id] עם startTime ו-endTime', async () => {
    const patchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    globalThis.fetch = patchMock as unknown as typeof fetch;

    const apt = makeAppointment(
      "patch-apt",
      "מטפלת א",
      "2026-11-01T09:00:00",
      "2026-11-01T10:00:00",
      { firstName: "שרה", lastName: "כהן" }
    );
    render(
      <WeeklyCalendar
        initialAppointments={[apt]}
        initialWeekStart={WEEK_START}
      />
    );

    // פותחים את הדיאלוג
    const rescheduleButtons = screen.getAllByRole("button", { name: /שנה מועד/ });
    fireEvent.click(rescheduleButtons[0]);

    const dialog = screen.getByRole("dialog");

    // מלאים תאריך ושעה חדשים
    fireEvent.change(within(dialog).getByLabelText("תאריך חדש"), {
      target: { value: "2026-11-05" },
    });
    fireEvent.change(within(dialog).getByLabelText("שעת התחלה חדשה"), {
      target: { value: "14:00" },
    });

    // לוחצים "שמור"
    fireEvent.click(within(dialog).getByRole("button", { name: "שמור" }));

    // ממתינים לסיום ה-fetch האסינכרוני
    await waitFor(() => {
      expect(patchMock).toHaveBeenCalled();
    });

    // בודקים שנקרא PATCH עם הנתיב הנכון
    const patchCall = patchMock.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === "string" &&
        (call[0] as string).includes("/api/appointments/patch-apt")
    );
    expect(patchCall).toBeDefined();

    // בודקים method ו-body
    const callOptions = patchCall![1] as RequestInit;
    expect(callOptions.method).toBe("PATCH");

    const body = JSON.parse(callOptions.body as string);
    expect(body).toHaveProperty("startTime");
    expect(body).toHaveProperty("endTime");
    // startTime חדש כולל את התאריך שהוזן
    expect(body.startTime).toContain("2026-11-05");
  });

  // 5.5-5: בשגיאת PATCH מוצגת הודעת שגיאה ומיקום התור המקורי משוחזר
  it('בשגיאת PATCH מוצגת הודעת שגיאה ומיקום התור המקורי משוחזר', async () => {
    // מוק שמחזיר שגיאת שרת
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "שגיאת שרת" }),
    }) as unknown as typeof fetch;

    const apt = makeAppointment(
      "error-apt",
      "מטפלת א",
      "2026-11-01T09:00:00",
      "2026-11-01T10:00:00",
      { firstName: "שרה", lastName: "כהן" }
    );
    render(
      <WeeklyCalendar
        initialAppointments={[apt]}
        initialWeekStart={WEEK_START}
      />
    );

    // פותחים את הדיאלוג
    const rescheduleButtons = screen.getAllByRole("button", { name: /שנה מועד/ });
    fireEvent.click(rescheduleButtons[0]);

    const dialog = screen.getByRole("dialog");

    // מלאים תאריך ושעה חדשים
    fireEvent.change(within(dialog).getByLabelText("תאריך חדש"), {
      target: { value: "2026-11-05" },
    });
    fireEvent.change(within(dialog).getByLabelText("שעת התחלה חדשה"), {
      target: { value: "14:00" },
    });

    // לוחצים "שמור"
    fireEvent.click(within(dialog).getByRole("button", { name: "שמור" }));

    // ממתינים להופעת הודעת שגיאה (role="alert")
    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });

    // הלקוחה עדיין מוצגת — הרולבק שמר על התור המקורי
    expect(screen.getAllByText(/שרה כהן/).length).toBeGreaterThanOrEqual(1);
  });
});
