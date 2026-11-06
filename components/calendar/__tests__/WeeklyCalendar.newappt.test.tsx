/**
 * בדיקות ל-WeeklyCalendar — דיאלוג תור חדש (משימה 5.9, FR-AP-02).
 *
 * בודק:
 * 1. כפתור "הוסף תור" קיים בטולבר של היומן.
 * 2. לחיצה על הכפתור פותחת דיאלוג עם role="dialog".
 * 3. הדיאלוג כולל תוויות עבריות: לקוח/ה, טיפול, מטפל/ת, תאריך, שעת התחלה.
 * 4. הקלדה בשדה חיפוש לקוח קוראת ל-GET /api/clients?q= לאחר השהייה 300ms (debounce).
 * 5. שליחת הטופס קוראת ל-POST /api/appointments עם הנתונים הנכונים.
 * 6. תגובת 409 מ-POST מציגה הודעת שגיאה בעברית.
 * 7. POST מוצלח — הדיאלוג נסגר.
 *
 * הרצה:
 *   npx vitest run --reporter=verbose components/calendar/__tests__/WeeklyCalendar.newappt.test.tsx
 */

import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import {
  WeeklyCalendar,
  type TreatmentOption,
} from "../WeeklyCalendar";

// ---------------------------------------------------------------------------
// נתוני עזר
// ---------------------------------------------------------------------------

const WEEK_START = "2026-11-01";

const TREATMENTS: TreatmentOption[] = [
  { id: "t1", name: "הסרת שיער בלייזר", durationMinutes: 60, color: "#FF5733" },
  { id: "t2", name: "טיפול פנים", durationMinutes: 45, color: "#33FF57" },
];

/** לקוח/ה דמה לתוצאות חיפוש */
const MOCK_CLIENT = {
  id: "client-1",
  firstName: "שרה",
  lastName: "כהן",
  phone: "0501234567",
};

// ---------------------------------------------------------------------------
// Mock גלובלי בסיסי — appointments endpoint (נדרש לכל הרכיב)
// ---------------------------------------------------------------------------
beforeAll(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ appointments: [] }),
  }) as unknown as typeof fetch;
});

// ---------------------------------------------------------------------------
// 1 + 2 + 3. בדיקות בסיסיות — כפתור הוספת תור ודיאלוג
// ---------------------------------------------------------------------------

describe("WeeklyCalendar — task 5.9: toolbar 'הוסף תור' button", () => {
  it("כפתור 'הוסף תור' קיים בטולבר עם aria-label מתאים", () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
        treatments={TREATMENTS}
      />
    );

    const btn = screen.getByRole("button", {
      name: "פתח דיאלוג הוספת תור חדש",
    });
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toContain("הוסף תור");
  });

  it("לחיצה על 'הוסף תור' פותחת דיאלוג עם role='dialog'", () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
        treatments={TREATMENTS}
      />
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "פתח דיאלוג הוספת תור חדש" })
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("הדיאלוג מכיל תוויות עבריות: לקוח/ה, טיפול, מטפל/ת, תאריך, שעת התחלה, שעת סיום", () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
        treatments={TREATMENTS}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "פתח דיאלוג הוספת תור חדש" })
    );

    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByLabelText(/לקוח\/ה/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/טיפול/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/מטפל\/ת/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/תאריך/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/שעת התחלה/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/שעת סיום/)).toBeInTheDocument();
  });

  it("הדיאלוג כולל קישור 'צור לקוח/ה חדש/ה' שמוביל ל-/clients/new", () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
        treatments={TREATMENTS}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "פתח דיאלוג הוספת תור חדש" })
    );

    const dialog = screen.getByRole("dialog");
    const link = within(dialog).getByRole("link", {
      name: /צור לקוח\/ה חדש\/ה/,
    });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/clients/new");
  });

  it("רשימת הטיפולים ב-select מכילה את הטיפולים שהועברו כ-prop", () => {
    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
        treatments={TREATMENTS}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "פתח דיאלוג הוספת תור חדש" })
    );

    const dialog = screen.getByRole("dialog");

    // שמות הטיפולים מופיעים בתוך הדיאלוג
    expect(within(dialog).getByText(/הסרת שיער בלייזר/)).toBeInTheDocument();
    expect(within(dialog).getByText(/טיפול פנים/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. חיפוש לקוח/ה עם debounce — fake timers
// ---------------------------------------------------------------------------

describe("WeeklyCalendar — task 5.9: client search debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("הקלדת שתי תווים ומעלה קוראת ל-GET /api/clients?q= לאחר 300ms", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/api/clients")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ clients: [MOCK_CLIENT] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ appointments: [] }),
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
        treatments={TREATMENTS}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "פתח דיאלוג הוספת תור חדש" })
    );

    const dialog = screen.getByRole("dialog");
    const searchInput = within(dialog).getByLabelText(
      "חיפוש לקוח/ה לפי שם או טלפון"
    );

    // הקלדת שתי תווים ומעלה
    fireEvent.change(searchInput, { target: { value: "שרה" } });

    // לפני 300ms — fetch לא נקרא עבור clients
    const clientCallsBefore = fetchMock.mock.calls.filter(
      (call: unknown[]) =>
        typeof call[0] === "string" &&
        (call[0] as string).includes("/api/clients")
    );
    expect(clientCallsBefore.length).toBe(0);

    // מעבירים 300ms ומחכים לפתרון ה-promise שנוצר ב-setTimeout
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    // fetch נקרא עם ה-URL הנכון
    const clientCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) =>
        typeof call[0] === "string" &&
        (call[0] as string).includes("/api/clients")
    );
    expect(clientCalls.length).toBeGreaterThanOrEqual(1);

    const calledUrl = clientCalls[0][0] as string;
    expect(calledUrl).toContain("q=");
    expect(calledUrl).toContain(encodeURIComponent("שרה"));
  });

  it("הקלדת פחות מ-2 תווים לא מפעילה fetch לחיפוש", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ appointments: [] }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
        treatments={TREATMENTS}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "פתח דיאלוג הוספת תור חדש" })
    );

    const dialog = screen.getByRole("dialog");
    const searchInput = within(dialog).getByLabelText(
      "חיפוש לקוח/ה לפי שם או טלפון"
    );

    // הקלדת תו אחד בלבד
    fireEvent.change(searchInput, { target: { value: "ש" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // fetch לא נקרא עבור /api/clients
    const clientCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) =>
        typeof call[0] === "string" &&
        (call[0] as string).includes("/api/clients")
    );
    expect(clientCalls.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// עזר: פתיחת הדיאלוג ובחירת לקוח/ה (עם fake timers פעילים)
// ---------------------------------------------------------------------------

async function openDialogAndSelectClient(
  fetchMock: ReturnType<typeof vi.fn>
): Promise<void> {
  fireEvent.click(
    screen.getByRole("button", { name: "פתח דיאלוג הוספת תור חדש" })
  );

  const dialog = screen.getByRole("dialog");
  const searchInput = within(dialog).getByLabelText(
    "חיפוש לקוח/ה לפי שם או טלפון"
  );

  fireEvent.change(searchInput, { target: { value: "שרה" } });

  // מתקדמים בזמן + ממתינים לפתרון ה-fetch
  await act(async () => {
    await vi.advanceTimersByTimeAsync(350);
  });

  // הדרופדאון אמור להיות גלוי עכשיו
  const listbox = screen.getByRole("listbox", { name: "תוצאות חיפוש לקוחות" });
  const clientOption = within(listbox).getByRole("option");
  fireEvent.click(clientOption);
}

// ---------------------------------------------------------------------------
// 5 + 6 + 7. שליחת הטופס — POST /api/appointments
// ---------------------------------------------------------------------------

describe("WeeklyCalendar — task 5.9: form submission POST", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("שליחת הטופס עם נתונים תקינים קוראת ל-POST /api/appointments עם הנתונים הנכונים", async () => {
    const fetchMock = vi.fn().mockImplementation(
      (url: string, options?: RequestInit) => {
        if (typeof url === "string" && url.includes("/api/clients")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ clients: [MOCK_CLIENT] }),
          });
        }
        if (options?.method === "POST") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ appointment: { id: "new-apt-1" } }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ appointments: [] }),
        });
      }
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
        treatments={TREATMENTS}
      />
    );

    await openDialogAndSelectClient(fetchMock);

    const dialog = screen.getByRole("dialog");

    // מילוי שם מטפל/ת (חובה)
    fireEvent.change(within(dialog).getByLabelText(/מטפל\/ת/), {
      target: { value: "מג'ידה" },
    });

    // מילוי תאריך
    fireEvent.change(within(dialog).getByLabelText(/תאריך/), {
      target: { value: "2026-11-01" },
    });

    // מילוי שעת התחלה
    fireEvent.change(within(dialog).getByLabelText(/שעת התחלה/), {
      target: { value: "09:00" },
    });

    // מילוי שעת סיום
    fireEvent.change(within(dialog).getByLabelText(/שעת סיום/), {
      target: { value: "10:00" },
    });

    // שליחת הטופס
    fireEvent.click(within(dialog).getByRole("button", { name: /שמור תור/ }));

    // ממתינים לסיום ה-POST האסינכרוני
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // בדיקת ה-POST call
    const postCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) =>
        (call[1] as RequestInit | undefined)?.method === "POST"
    );
    expect(postCalls.length).toBeGreaterThanOrEqual(1);

    const postCall = postCalls[0];
    expect((postCall[0] as string)).toContain("/api/appointments");

    const body = JSON.parse((postCall[1] as RequestInit).body as string);
    expect(body.clientId).toBe(MOCK_CLIENT.id);
    expect(body.therapist).toBe("מג'ידה");
    expect(body.startTime).toContain("2026-11-01");
    expect(body.endTime).toContain("2026-11-01");
  });

  it("תגובת 409 מ-POST מציגה הודעת שגיאה בעברית", async () => {
    const conflictError = "חפיפת תורים — קיים תור אחר באותה השעה";

    const fetchMock = vi.fn().mockImplementation(
      (url: string, options?: RequestInit) => {
        if (typeof url === "string" && url.includes("/api/clients")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ clients: [MOCK_CLIENT] }),
          });
        }
        if (options?.method === "POST") {
          return Promise.resolve({
            ok: false,
            status: 409,
            json: async () => ({ error: conflictError }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ appointments: [] }),
        });
      }
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
        treatments={TREATMENTS}
      />
    );

    await openDialogAndSelectClient(fetchMock);

    const dialog = screen.getByRole("dialog");

    // מילוי שדות חובה
    fireEvent.change(within(dialog).getByLabelText(/מטפל\/ת/), {
      target: { value: "מג'ידה" },
    });
    fireEvent.change(within(dialog).getByLabelText(/תאריך/), {
      target: { value: "2026-11-01" },
    });
    fireEvent.change(within(dialog).getByLabelText(/שעת התחלה/), {
      target: { value: "09:00" },
    });
    fireEvent.change(within(dialog).getByLabelText(/שעת סיום/), {
      target: { value: "10:00" },
    });

    // שליחת הטופס
    fireEvent.click(within(dialog).getByRole("button", { name: /שמור תור/ }));

    // ממתינים לעדכון ה-DOM עם הודעת השגיאה
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // הדיאלוג עדיין פתוח
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // הודעת שגיאה מופיעה
    const alertEl = within(dialog).getByRole("alert");
    expect(alertEl).toBeInTheDocument();
    expect(alertEl.textContent).toContain(conflictError);
  });

  it("POST מוצלח — הדיאלוג נסגר לאחר יצירת התור", async () => {
    const fetchMock = vi.fn().mockImplementation(
      (url: string, options?: RequestInit) => {
        if (typeof url === "string" && url.includes("/api/clients")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ clients: [MOCK_CLIENT] }),
          });
        }
        if (options?.method === "POST") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ appointment: { id: "new-apt-success" } }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ appointments: [] }),
        });
      }
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <WeeklyCalendar
        initialAppointments={[]}
        initialWeekStart={WEEK_START}
        treatments={TREATMENTS}
      />
    );

    await openDialogAndSelectClient(fetchMock);

    const dialog = screen.getByRole("dialog");

    // מילוי שדות חובה
    fireEvent.change(within(dialog).getByLabelText(/מטפל\/ת/), {
      target: { value: "מג'ידה" },
    });
    fireEvent.change(within(dialog).getByLabelText(/תאריך/), {
      target: { value: "2026-11-01" },
    });
    fireEvent.change(within(dialog).getByLabelText(/שעת התחלה/), {
      target: { value: "09:00" },
    });
    fireEvent.change(within(dialog).getByLabelText(/שעת סיום/), {
      target: { value: "10:00" },
    });

    // שליחת הטופס
    fireEvent.click(within(dialog).getByRole("button", { name: /שמור תור/ }));

    // מחכים לסגירת הדיאלוג
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // הדיאלוג נסגר
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
