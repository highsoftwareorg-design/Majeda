/**
 * בדיקות ל-WeeklyCalendar — משימה 11.11:
 * תצוגת חודש + תצוגת "סדר יום" (אג'נדה) ליום נבחר.
 *
 * בודק:
 *  A. תצוגת חודש — רשת 7 עמודות RTL (ראשון ראשון/ימני ביותר), תוויות ימים/חודש בעברית.
 *  B. ספירת תורים לכל יום — מחושבת מהתורים שנשלפו, ומכבדת פילטר מטפל/ת.
 *  C. ניווט חודש קודם/הבא/היום — משנה את החודש המוצג.
 *  D. לחיצה על יום בחודש — מעבר לתצוגת היום של אותו תאריך.
 *  E. תצוגת אג'נדה — רשימה מסודרת לפי שעה (24h), עם לקוח/טיפול/מטפל/חדר/סטטוס.
 *  F. אג'נדה — פעולות שינוי סטטוס ושינוי מועד זמינות וקוראות לאותם handlers.
 *  G. מתג גריד/רשימה מוצג רק בתצוגת יום; גריד ברירת מחדל ב-jsdom (אין matchMedia).
 *  H. שליפת טווח — שבוע→יום באותו שבוע אינו שולף מחדש; מעבר חודש שולף מחדש.
 *  I. RTL / עברית / יעדי מגע 44px.
 *
 * הרצה:
 *   npx vitest run components/calendar/__tests__/WeeklyCalendar.monthagenda.test.tsx
 */

import {
  render,
  screen,
  fireEvent,
  within,
  act,
} from "@testing-library/react";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { WeeklyCalendar, type SerializedAppointment } from "../WeeklyCalendar";

// ---------------------------------------------------------------------------
// נתוני עזר
// ---------------------------------------------------------------------------

/** השבוע ההתחלתי (ראשון 2026-11-08) — מכיל את "היום" המקובע 2026-11-10. */
const WEEK_START = "2026-11-08";

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
    room?: string | null;
    status?: string;
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
    room: options.room ?? null,
    startTime,
    endTime,
    status: options.status ?? "SCHEDULED",
    notes: null,
    statusHistory: [],
    createdAt: "2026-11-01T08:00:00",
    updatedAt: "2026-11-01T08:00:00",
  };
}

/**
 * תורים לחודש נובמבר 2026:
 *  - 10/11: שני תורים (09:00, 11:00) — מטפלת א  (אחד עם חדר "חדר 1")
 *  - 20/11: תור אחד (09:00) — מטפלת ב (עם חדר "חדר 2")
 * מסודרים בכוונה כך שתור ה-11:00 מופיע לפני ה-09:00 — לבדיקת מיון לפי שעה.
 */
const APT_10_LATE = makeAppointment(
  "a2",
  "מטפלת א",
  "2026-11-10T11:00:00",
  "2026-11-10T12:00:00",
  { firstName: "לאה", lastName: "דוד", treatmentName: "טיפול פנים" }
);
const APT_10_EARLY = makeAppointment(
  "a1",
  "מטפלת א",
  "2026-11-10T09:00:00",
  "2026-11-10T10:00:00",
  { firstName: "שרה", lastName: "כהן", treatmentName: "הסרת שיער", room: "חדר 1" }
);
const APT_20 = makeAppointment(
  "b1",
  "מטפלת ב",
  "2026-11-20T09:00:00",
  "2026-11-20T10:00:00",
  { firstName: "רחל", lastName: "לוי", treatmentName: "עיסוי", room: "חדר 2" }
);

const ALL_APTS: SerializedAppointment[] = [APT_10_LATE, APT_10_EARLY, APT_20];

/** מפלל מיקרו-tasks כדי להשלים resolve של fetch אסינכרוני ללא אזהרות act. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

// ---------------------------------------------------------------------------
// הגדרות — שעון מקובע ל-2026-11-10 (שלישי), ומוק fetch שמחזיר את התורים
// ---------------------------------------------------------------------------

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-10T10:00:00"));

  // ברירת מחדל: GET מחזיר את כל התורים; PATCH מחזיר appointment מעודכן.
  fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          appointment: { status: "CONFIRMED", statusHistory: [] },
        }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ appointments: ALL_APTS }),
    });
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

function renderCal() {
  return render(
    <WeeklyCalendar initialAppointments={ALL_APTS} initialWeekStart={WEEK_START} />
  );
}

/** מעבר לתצוגת חודש. */
function goToMonth() {
  fireEvent.click(screen.getByRole("button", { name: "תצוגת חודש" }));
}

// ===========================================================================
// A. תצוגת חודש — רשת RTL ותוויות עבריות
// ===========================================================================
describe("11.11 — תצוגת חודש: רשת 7 עמודות RTL ותוויות עבריות", () => {
  it("מרנדרת אזור חודש עם כותרת החודש בעברית (נובמבר 2026)", () => {
    renderCal();
    goToMonth();
    expect(
      screen.getByRole("region", { name: "תצוגת חודש: נובמבר 2026" })
    ).toBeInTheDocument();
  });

  it("הרשת היא grid-cols-7 בתוך שורש dir=rtl", () => {
    const { container } = renderCal();
    goToMonth();
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveAttribute("dir", "rtl");
    const grid = container.querySelector(".grid-cols-7");
    expect(grid).not.toBeNull();
  });

  it("שבע כותרות הימים מופיעות בסדר ראשון→שבת (ראשון = הראשון/הימני ביותר ב-RTL)", () => {
    const { container } = renderCal();
    goToMonth();
    const grid = container.querySelector(".grid-cols-7") as HTMLElement;
    // שבעת ילדי-הרשת הראשונים הם כותרות הימים
    const headerTexts = Array.from(grid.children)
      .slice(0, 7)
      .map((el) => el.textContent?.trim());
    expect(headerTexts).toEqual([
      "ראשון",
      "שני",
      "שלישי",
      "רביעי",
      "חמישי",
      "שישי",
      "שבת",
    ]);
    // הערה: jsdom אינו מבצע פריסה חזותית — מיקום ראשון בימין נובע מ-grid ב-dir=rtl
    // ומאומת כאן דרך סדר ה-DOM + dir=rtl בשורש.
  });
});

// ===========================================================================
// B. ספירת תורים לכל יום — מכבדת פילטר
// ===========================================================================
describe("11.11 — ספירת תורים לכל יום בתצוגת חודש", () => {
  it("10/11 מציג 2 תורים, 20/11 מציג 1 תור", () => {
    renderCal();
    goToMonth();
    expect(
      screen.getByRole("button", { name: /10\/11, 2 תורים/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /20\/11, 1 תורים/ })
    ).toBeInTheDocument();
  });

  it("יום ללא תורים מסומן 'אין תורים' ואינו מציג badge", () => {
    renderCal();
    goToMonth();
    expect(
      screen.getByRole("button", { name: /15\/11, אין תורים/ })
    ).toBeInTheDocument();
  });

  it("סינון לפי 'מטפלת א' מפחית את ספירת 20/11 ל-0 (אין תורים)", async () => {
    renderCal();
    goToMonth();
    // סינון מטפל/ת — הפקד זמין בכל התצוגות
    fireEvent.change(screen.getByLabelText("סינון לפי מטפל/ת"), {
      target: { value: "מטפלת א" },
    });
    await flush();
    // 10/11 נשאר 2 (מטפלת א), 20/11 הופך ל"אין תורים" (מטפלת ב סוננה)
    expect(
      screen.getByRole("button", { name: /10\/11, 2 תורים/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /20\/11, אין תורים/ })
    ).toBeInTheDocument();
  });
});

// ===========================================================================
// C. ניווט חודש
// ===========================================================================
describe("11.11 — ניווט חודש קודם/הבא/היום", () => {
  it("'חודש הבא' עובר מנובמבר לדצמבר 2026", async () => {
    renderCal();
    goToMonth();
    expect(
      screen.getByRole("region", { name: "תצוגת חודש: נובמבר 2026" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "חודש הבא" }));
    await flush();
    expect(
      screen.getByRole("region", { name: "תצוגת חודש: דצמבר 2026" })
    ).toBeInTheDocument();
  });

  it("'חודש קודם' עובר מנובמבר לאוקטובר 2026", async () => {
    renderCal();
    goToMonth();
    fireEvent.click(screen.getByRole("button", { name: "חודש קודם" }));
    await flush();
    expect(
      screen.getByRole("region", { name: "תצוגת חודש: אוקטובר 2026" })
    ).toBeInTheDocument();
  });

  it("'היום' מחזיר לחודש הנוכחי (נובמבר 2026) לאחר ניווט קדימה", async () => {
    renderCal();
    goToMonth();
    fireEvent.click(screen.getByRole("button", { name: "חודש הבא" }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "היום" }));
    await flush();
    expect(
      screen.getByRole("region", { name: "תצוגת חודש: נובמבר 2026" })
    ).toBeInTheDocument();
  });
});

// ===========================================================================
// D. לחיצה על יום → תצוגת יום
// ===========================================================================
describe("11.11 — לחיצה על יום בחודש פותחת את תצוגת היום", () => {
  it("לחיצה על 10/11 עוברת לתצוגת יום של 10/11", async () => {
    renderCal();
    goToMonth();
    fireEvent.click(screen.getByRole("button", { name: /10\/11, 2 תורים/ }));
    await flush();

    const dayRegion =
      screen.queryByRole("region", { name: /תצוגת יום:/ }) ??
      screen.getByRole("region", { name: /רשימת סדר יום:/ });
    const label = dayRegion.getAttribute("aria-label") ?? "";
    expect(label).toContain("10/11");
  });
});

// ===========================================================================
// E. תצוגת אג'נדה — רשימה מסודרת לפי שעה
// ===========================================================================
describe("11.11 — תצוגת אג'נדה (רשימת יום)", () => {
  function goToAgenda() {
    fireEvent.click(screen.getByRole("button", { name: "תצוגת יום" }));
    fireEvent.click(screen.getByRole("button", { name: "רשימת יום" }));
  }

  it("מציגה אזור 'רשימת סדר יום' ליום הנבחר (10/11)", () => {
    renderCal();
    goToAgenda();
    expect(
      screen.getByRole("region", { name: /רשימת סדר יום:/ })
    ).toBeInTheDocument();
  });

  it("התורים מסודרים לפי שעה עולה (09:00 לפני 11:00) למרות סדר קלט הפוך", () => {
    renderCal();
    goToAgenda();
    const region = screen.getByRole("region", { name: /רשימת סדר יום:/ });
    const items = Array.from(region.querySelectorAll("li"));
    expect(items.length).toBe(2);
    // ראשון ברשימה = שרה כהן (09:00), שני = לאה דוד (11:00)
    expect(items[0].textContent).toContain("שרה כהן");
    expect(items[0].textContent).toContain("09:00");
    expect(items[1].textContent).toContain("לאה דוד");
    expect(items[1].textContent).toContain("11:00");
  });

  it("כל שורה מציגה שעה (24h), לקוח, טיפול, מטפל/ת, חדר וסטטוס", () => {
    renderCal();
    goToAgenda();
    const region = screen.getByRole("region", { name: /רשימת סדר יום:/ });
    const first = within(region).getAllByRole("listitem")[0];
    expect(first.textContent).toContain("09:00–10:00"); // שעה 24h
    expect(first.textContent).toContain("שרה כהן"); // לקוח
    expect(first.textContent).toContain("הסרת שיער"); // טיפול
    expect(first.textContent).toContain("מטפלת א"); // מטפל/ת
    expect(first.textContent).toContain("חדר 1"); // חדר
    expect(first.textContent).toContain("נקבע"); // סטטוס SCHEDULED
  });

  it("מצב ריק מציג הודעה בעברית כשאין תורים ליום", async () => {
    renderCal();
    fireEvent.click(screen.getByRole("button", { name: "תצוגת יום" }));
    fireEvent.click(screen.getByRole("button", { name: "רשימת יום" }));
    // מעבר ליום ללא תורים (11/11) — "יום הבא"
    fireEvent.click(screen.getByRole("button", { name: "יום הבא" }));
    await flush();
    expect(screen.getByText("אין תורים ליום זה")).toBeInTheDocument();
  });
});

// ===========================================================================
// F. אג'נדה — פעולות סטטוס ושינוי מועד
// ===========================================================================
describe("11.11 — אג'נדה: שינוי סטטוס ושינוי מועד", () => {
  function goToAgenda() {
    fireEvent.click(screen.getByRole("button", { name: "תצוגת יום" }));
    fireEvent.click(screen.getByRole("button", { name: "רשימת יום" }));
  }

  it("כפתורי שינוי סטטוס חוקיים מוצגים (אושר/בוטל עבור תור 'נקבע')", () => {
    renderCal();
    goToAgenda();
    const region = screen.getByRole("region", { name: /רשימת סדר יום:/ });
    const first = within(region).getAllByRole("listitem")[0];
    expect(
      within(first).getByRole("button", { name: "עדכן סטטוס ל: אושר" })
    ).toBeInTheDocument();
    expect(
      within(first).getByRole("button", { name: "עדכן סטטוס ל: בוטל" })
    ).toBeInTheDocument();
  });

  it("לחיצה על 'אושר' קוראת ל-PATCH /api/appointments/[id] עם status", async () => {
    renderCal();
    goToAgenda();
    const region = screen.getByRole("region", { name: /רשימת סדר יום:/ });
    const first = within(region).getAllByRole("listitem")[0];
    fireEvent.click(
      within(first).getByRole("button", { name: "עדכן סטטוס ל: אושר" })
    );
    await flush();

    const patchCall = fetchMock.mock.calls.find(
      (c: unknown[]) =>
        typeof c[0] === "string" &&
        (c[0] as string).includes("/api/appointments/a1") &&
        (c[1] as RequestInit | undefined)?.method === "PATCH"
    );
    expect(patchCall).toBeDefined();
    const body = JSON.parse((patchCall![1] as RequestInit).body as string);
    expect(body).toHaveProperty("status", "CONFIRMED");
  });

  it("לחיצה על 'שנה מועד' פותחת את דיאלוג שינוי המועד (אותו handler כמו בגריד)", () => {
    renderCal();
    goToAgenda();
    const region = screen.getByRole("region", { name: /רשימת סדר יום:/ });
    const first = within(region).getAllByRole("listitem")[0];
    fireEvent.click(within(first).getByRole("button", { name: /שנה מועד/ }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("תאריך חדש")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("שעת התחלה חדשה")).toBeInTheDocument();
  });

  it("כפתורי פעולה באג'נדה עומדים ביעד מגע 44px", () => {
    renderCal();
    goToAgenda();
    const region = screen.getByRole("region", { name: /רשימת סדר יום:/ });
    const first = within(region).getAllByRole("listitem")[0];
    const reschedule = within(first).getByRole("button", { name: /שנה מועד/ });
    const statusBtn = within(first).getByRole("button", {
      name: "עדכן סטטוס ל: אושר",
    });
    expect(reschedule.className).toContain("min-h-[44px]");
    expect(statusBtn.className).toContain("min-h-[44px]");
  });
});

// ===========================================================================
// G. מתג גריד/רשימה — רק בתצוגת יום; גריד ברירת מחדל ב-jsdom
// ===========================================================================
describe("11.11 — מתג גריד/רשימת יום", () => {
  it("בתצוגת שבוע אין מתג 'גריד יום'/'רשימת יום'", () => {
    renderCal();
    expect(
      screen.queryByRole("button", { name: "גריד יום" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "רשימת יום" })
    ).not.toBeInTheDocument();
  });

  it("בתצוגת חודש אין מתג 'גריד יום'/'רשימת יום'", () => {
    renderCal();
    goToMonth();
    expect(
      screen.queryByRole("button", { name: "גריד יום" })
    ).not.toBeInTheDocument();
  });

  it("בתצוגת יום המתג מוצג, וגריד הוא ברירת המחדל ב-jsdom (אין matchMedia)", () => {
    // jsdom אינו מממש window.matchMedia → ה-effect של המובייל יוצא מוקדם ו-dayLayout נשאר 'grid'
    expect(typeof window.matchMedia).not.toBe("function");
    renderCal();
    fireEvent.click(screen.getByRole("button", { name: "תצוגת יום" }));

    const gridBtn = screen.getByRole("button", { name: "גריד יום" });
    const agendaBtn = screen.getByRole("button", { name: "רשימת יום" });
    expect(gridBtn).toHaveAttribute("aria-pressed", "true");
    expect(agendaBtn).toHaveAttribute("aria-pressed", "false");

    // תצוגת היום (גריד) מוצגת, רשימת סדר-יום לא
    expect(
      screen.getByRole("region", { name: /תצוגת יום:/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: /רשימת סדר יום:/ })
    ).not.toBeInTheDocument();
  });

  it("לחיצה על 'רשימת יום' מחליפה מגריד לאג'נדה", () => {
    renderCal();
    fireEvent.click(screen.getByRole("button", { name: "תצוגת יום" }));
    fireEvent.click(screen.getByRole("button", { name: "רשימת יום" }));
    expect(
      screen.getByRole("region", { name: /רשימת סדר יום:/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: /תצוגת יום:/ })
    ).not.toBeInTheDocument();
  });
});

// ===========================================================================
// H. שליפת טווח — loadedRangeKey
// ===========================================================================
describe("11.11 — שליפת טווח (loadedRangeKey)", () => {
  it("אין שליפה ברינדור ראשוני (הנתונים מגיעים מ-SSR)", () => {
    renderCal();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("מעבר שבוע→יום באותו שבוע אינו שולף מחדש", () => {
    renderCal();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "תצוגת יום" }));
    // selectedDay = היום (10/11) נמצא בשבוע ההתחלתי (08/11) → אין שינוי טווח
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("מעבר לתצוגת חודש שולף מחדש עם טווח החודש", async () => {
    renderCal();
    goToMonth();
    await flush();
    expect(fetchMock).toHaveBeenCalled();
    const monthCall = fetchMock.mock.calls.find(
      (c: unknown[]) =>
        typeof c[0] === "string" &&
        (c[0] as string).includes("start=2026-10-31") &&
        (c[0] as string).includes("end=2026-12-01")
    );
    expect(monthCall).toBeDefined();
  });

  it("ניווט 'שבוע הבא' שולף מחדש (טווח השבוע משתנה)", async () => {
    renderCal();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "שבוע הבא" }));
    await flush();
    expect(fetchMock).toHaveBeenCalled();
  });
});
