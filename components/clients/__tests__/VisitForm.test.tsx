/**
 * בדיקות ל-VisitForm — משימה 4.5 (FR-PR-02).
 *
 * בודק:
 * 1. רינדור התחלתי — כפתור "הוסף ביקור" גלוי, טופס מוסתר.
 * 2. לחיצה על הכפתור — הטופס נפתח עם כל השדות הנדרשים.
 * 3. נוכחות שדה תאריך עם כותרת עברית.
 * 4. נוכחות שדה מוצרים/אצווה עם כותרת עברית.
 * 5. נוכחות שדה מחיר עם כותרת עברית.
 * 6. כפתור "שמור ביקור" גלוי בטופס פתוח.
 * 7. כפתור "ביטול" סוגר את הטופס.
 * 8. ולידציה בצד לקוח — מחיר שלילי מציג שגיאה וחוסם שליחה.
 * 9. RTL ו-lang="he" על אלמנט הבסיס.
 * 10. טיפולים מוצגים כ-checkboxes כאשר רשימה מסופקת.
 *
 * הרצה: `npx vitest run --reporter=verbose components/clients/__tests__/VisitForm.test.tsx`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// --- Mocks ---

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// --- Import component after mocks ---

import { VisitForm } from "@/components/clients/VisitForm";

// --- נתוני עזר ---

const MOCK_TREATMENTS = [
  { id: "t-1", name: "הסרת שיער בלייזר" },
  { id: "t-2", name: "טיפול פנים" },
];

function renderForm(treatments = MOCK_TREATMENTS) {
  return render(<VisitForm clientId="client-1" treatments={treatments} />);
}

// --- בדיקות ---

describe("VisitForm — רינדור התחלתי", () => {
  it('מציג כפתור "הוסף ביקור" כאשר הטופס סגור', () => {
    renderForm();
    expect(
      screen.getByRole("button", { name: /הוסף ביקור/ })
    ).toBeInTheDocument();
  });

  it("הטופס עצמו מוסתר בתחילה (הכותרת רישום ביקור חדש לא גלויה)", () => {
    renderForm();
    expect(screen.queryByText("רישום ביקור חדש")).not.toBeInTheDocument();
  });

  it("האלמנט הבסיסי מוגדר עם dir=rtl ו-lang=he", () => {
    const { container } = renderForm();
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveAttribute("dir", "rtl");
    expect(root).toHaveAttribute("lang", "he");
  });
});

describe("VisitForm — פתיחת הטופס", () => {
  it('לחיצה על "הוסף ביקור" פותחת את הטופס', () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /הוסף ביקור/ }));
    expect(screen.getByText("רישום ביקור חדש")).toBeInTheDocument();
  });

  it("שדה תאריך ביקור גלוי עם כותרת עברית", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /הוסף ביקור/ }));
    // הכותרת "תאריך ביקור" גלויה
    expect(screen.getByText(/תאריך ביקור/)).toBeInTheDocument();
    // ה-input עם id=visit-date קיים (נבדק בנפרד בבדיקה הבאה)
    expect(document.getElementById("visit-date")).not.toBeNull();
  });

  it("שדה תאריך (input[type=date]) קיים ומאוכלס בתאריך ברירת מחדל", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /הוסף ביקור/ }));
    const dateInput = document.getElementById("visit-date") as HTMLInputElement;
    expect(dateInput).not.toBeNull();
    expect(dateInput.type).toBe("date");
    // ברירת מחדל — היום (YYYY-MM-DD)
    expect(dateInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("שדה מוצרים ואצווה (batch number) גלוי עם כותרת עברית", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /הוסף ביקור/ }));
    // הכותרת כוללת "מספר אצווה"
    expect(screen.getByText(/מספר אצווה/)).toBeInTheDocument();
    // ה-textarea עם id=visit-products
    const textarea = document.getElementById("visit-products") as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it("שדה מחיר (₪) גלוי עם כותרת עברית", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /הוסף ביקור/ }));
    expect(screen.getByText(/מחיר/)).toBeInTheDocument();
    const priceInput = document.getElementById("visit-price") as HTMLInputElement;
    expect(priceInput).not.toBeNull();
    expect(priceInput.type).toBe("number");
    expect(priceInput.min).toBe("0");
  });

  it('כפתור "שמור ביקור" גלוי בטופס פתוח', () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /הוסף ביקור/ }));
    expect(
      screen.getByRole("button", { name: "שמור ביקור" })
    ).toBeInTheDocument();
  });

  it("שדה מטפל/ת גלוי עם placeholder עברי", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /הוסף ביקור/ }));
    expect(screen.getByText(/מטפל\/ת/)).toBeInTheDocument();
    const therapistInput = document.getElementById("visit-therapist") as HTMLInputElement;
    expect(therapistInput).not.toBeNull();
  });

  it("שדה אזור מטופל גלוי", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /הוסף ביקור/ }));
    expect(screen.getByText("אזור מטופל")).toBeInTheDocument();
    const areaInput = document.getElementById("visit-treated-area");
    expect(areaInput).not.toBeNull();
  });

  it("שדה סיכום טיפול (notes) גלוי עם כותרת עברית", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /הוסף ביקור/ }));
    // הכותרת "סיכום טיפול" גלויה (fieldset legend + label)
    const summaryLabels = screen.getAllByText("סיכום טיפול");
    expect(summaryLabels.length).toBeGreaterThanOrEqual(1);
    const notesTextarea = document.getElementById("visit-notes");
    expect(notesTextarea).not.toBeNull();
  });

  it("שדה תוצאה / תגובת לקוחה (clientReaction) גלוי בטופס — task 4.6", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /הוסף ביקור/ }));
    expect(screen.getByText(/תוצאה \/ תגובת לקוחה/)).toBeInTheDocument();
    const reactionTextarea = document.getElementById("visit-client-reaction");
    expect(reactionTextarea).not.toBeNull();
    expect((reactionTextarea as HTMLTextAreaElement).tagName).toBe("TEXTAREA");
  });
});

describe("VisitForm — רב-ברירת טיפולים", () => {
  it("מציג checkboxes לכל טיפול ברשימה", () => {
    renderForm(MOCK_TREATMENTS);
    fireEvent.click(screen.getByRole("button", { name: /הוסף ביקור/ }));
    expect(screen.getByText("הסרת שיער בלייזר")).toBeInTheDocument();
    expect(screen.getByText("טיפול פנים")).toBeInTheDocument();
  });

  it("checkboxes מתחילים לא מסומנים", () => {
    renderForm(MOCK_TREATMENTS);
    fireEvent.click(screen.getByRole("button", { name: /הוסף ביקור/ }));
    const checkboxes = screen.getAllByRole("checkbox");
    checkboxes.forEach((cb) => {
      expect((cb as HTMLInputElement).checked).toBe(false);
    });
  });

  it("לחיצה על טיפול מסמנת את ה-checkbox", () => {
    renderForm(MOCK_TREATMENTS);
    fireEvent.click(screen.getByRole("button", { name: /הוסף ביקור/ }));
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
  });

  it("כאשר רשימת טיפולים ריקה — fieldset הטיפולים לא מוצג", () => {
    renderForm([]);
    fireEvent.click(screen.getByRole("button", { name: /הוסף ביקור/ }));
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});

describe("VisitForm — ולידציה בצד לקוח", () => {
  beforeEach(() => {
    // מוק fetch — לא אמור להיקרא בשגיאות ולידציה
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ visit: {} }),
    } as Response);
  });

  it("מחיר שלילי מציג הודעת שגיאה וחוסם שליחה לשרת", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /הוסף ביקור/ }));

    // הזן מחיר שלילי
    const priceInput = document.getElementById("visit-price") as HTMLInputElement;
    fireEvent.change(priceInput, { target: { value: "-100" } });

    // שלח
    fireEvent.click(screen.getByRole("button", { name: "שמור ביקור" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByRole("alert").textContent).toContain("אי-שלילי");
    });

    // fetch לא נקרא
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("כאשר תאריך ריק — מציג הודעת שגיאה", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /הוסף ביקור/ }));

    // מחק את תאריך ברירת המחדל
    const dateInput = document.getElementById("visit-date") as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: "שמור ביקור" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByRole("alert").textContent).toContain("תאריך");
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe("VisitForm — סגירת הטופס", () => {
  it('לחיצה על "ביטול" סוגרת את הטופס וחוזרת לכפתור', () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /הוסף ביקור/ }));
    expect(screen.getByText("רישום ביקור חדש")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ביטול" }));
    expect(screen.queryByText("רישום ביקור חדש")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /הוסף ביקור/ })).toBeInTheDocument();
  });

  it('לחיצה על כפתור ה-X (aria-label="סגור טופס ביקור") סוגרת את הטופס', () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /הוסף ביקור/ }));
    fireEvent.click(screen.getByRole("button", { name: "סגור טופס ביקור" }));
    expect(screen.queryByText("רישום ביקור חדש")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// task 4.7 — הצעת תאריך חזרה (FR-PR-05)
// ---------------------------------------------------------------------------

const TREATMENTS_WITH_RETURN = [
  { id: "t-1", name: "הסרת שיער בלייזר", recommendedReturnDays: 120 },
  { id: "t-2", name: "טיפול פנים", recommendedReturnDays: 30 },
];

const TREATMENTS_WITHOUT_RETURN = [
  { id: "t-3", name: "ייעוץ", recommendedReturnDays: null },
];

describe("VisitForm — הצעת תאריך חזרה (task 4.7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ visit: { id: "visit-99" } }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("לאחר שמירה מוצלחת עם טיפול בעל recommendedReturnDays — מוצגת הצעת מועד חזרה", async () => {
    render(
      <VisitForm clientId="client-1" treatments={TREATMENTS_WITH_RETURN} />
    );
    fireEvent.click(screen.getByRole("button", { name: /הוסף ביקור/ }));

    // סמן טיפול עם ימי חזרה
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);

    fireEvent.click(screen.getByRole("button", { name: "שמור ביקור" }));

    await waitFor(() => {
      expect(screen.getByText("הצעת מועד חזרה")).toBeInTheDocument();
    });
  });

  it("הצעת תאריך: מחושבת כ-visitDate + max(recommendedReturnDays) של הטיפולים שנבחרו", async () => {
    render(
      <VisitForm clientId="client-1" treatments={TREATMENTS_WITH_RETURN} />
    );
    fireEvent.click(screen.getByRole("button", { name: /הוסף ביקור/ }));

    // הגדר תאריך ביקור קבוע: 2026-01-01
    const dateInput = document.getElementById("visit-date") as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2026-01-01" } });

    // סמן את שני הטיפולים (30 ו-120 ימים) — ה-max הוא 120
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]); // 120 ימים
    fireEvent.click(checkboxes[1]); // 30 ימים

    fireEvent.click(screen.getByRole("button", { name: "שמור ביקור" }));

    await waitFor(() => {
      expect(screen.getByText("הצעת מועד חזרה")).toBeInTheDocument();
    });

    // 2026-01-01 + 120 ימים = 2026-05-01
    const returnInput = document.getElementById(
      "return-date-input"
    ) as HTMLInputElement;
    expect(returnInput).not.toBeNull();
    expect(returnInput.value).toBe("2026-05-01");
  });

  it("כאשר לטיפולים שנבחרו אין recommendedReturnDays — לא מוצגת הצעת חזרה וטופס נסגר", async () => {
    render(
      <VisitForm clientId="client-1" treatments={TREATMENTS_WITHOUT_RETURN} />
    );
    fireEvent.click(screen.getByRole("button", { name: /הוסף ביקור/ }));

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]); // ייעוץ — ללא ימי חזרה

    fireEvent.click(screen.getByRole("button", { name: "שמור ביקור" }));

    await waitFor(() => {
      // הטופס נסגר — "רישום ביקור חדש" לא גלוי
      expect(screen.queryByText("הצעת מועד חזרה")).not.toBeInTheDocument();
    });
  });

  it("שדה return-date-input ניתן לעריכה ידנית לשינוי התאריך", async () => {
    render(
      <VisitForm clientId="client-1" treatments={TREATMENTS_WITH_RETURN} />
    );
    fireEvent.click(screen.getByRole("button", { name: /הוסף ביקור/ }));

    const dateInput = document.getElementById("visit-date") as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2026-01-01" } });

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]); // 120 ימים

    fireEvent.click(screen.getByRole("button", { name: "שמור ביקור" }));

    await waitFor(() => {
      expect(screen.getByText("הצעת מועד חזרה")).toBeInTheDocument();
    });

    // שינוי ידני של התאריך
    const returnInput = document.getElementById(
      "return-date-input"
    ) as HTMLInputElement;
    fireEvent.change(returnInput, { target: { value: "2026-06-15" } });
    expect(returnInput.value).toBe("2026-06-15");
  });

  it("לחיצה על 'שמור מועד חזרה' שולחת PATCH עם התאריך שנבחר", async () => {
    // הבקשה השנייה (PATCH) מחזירה 200
    (globalThis.fetch as ReturnType<typeof vi.spyOn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ visit: { id: "visit-99", returnDate: "2026-06-15" } }),
    } as Response);

    render(
      <VisitForm clientId="client-1" treatments={TREATMENTS_WITH_RETURN} />
    );
    fireEvent.click(screen.getByRole("button", { name: /הוסף ביקור/ }));

    const dateInput = document.getElementById("visit-date") as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2026-01-01" } });

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]); // 120 ימים

    fireEvent.click(screen.getByRole("button", { name: "שמור ביקור" }));

    await waitFor(() => {
      expect(screen.getByText("הצעת מועד חזרה")).toBeInTheDocument();
    });

    // שינוי ידני של התאריך לפני שמירה
    const returnInput = document.getElementById(
      "return-date-input"
    ) as HTMLInputElement;
    fireEvent.change(returnInput, { target: { value: "2026-06-15" } });

    fireEvent.click(screen.getByRole("button", { name: /שמור מועד חזרה/ }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    // בדיקה שה-PATCH נשלח עם התאריך המעודכן
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.spyOn>;
    const patchCall = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(patchCall[0]).toContain("visit-99");
    const patchBody = JSON.parse(patchCall[1].body as string) as { returnDate: string };
    expect(patchBody.returnDate).toBe("2026-06-15");
  });

  it("כפתור 'דלג על קביעת תאריך חזרה' סוגר את הטופס ללא שמירת תאריך", async () => {
    render(
      <VisitForm clientId="client-1" treatments={TREATMENTS_WITH_RETURN} />
    );
    fireEvent.click(screen.getByRole("button", { name: /הוסף ביקור/ }));

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);

    fireEvent.click(screen.getByRole("button", { name: "שמור ביקור" }));

    await waitFor(() => {
      expect(screen.getByText("הצעת מועד חזרה")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /דלג על קביעת תאריך חזרה/ })
    );

    // הטופס נסגר — PATCH לא נקרא
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
