/**
 * בדיקות ל-VisitTimeline — משימה 4.6 (FR-PR-03).
 *
 * בודק:
 * 1. מצב ריק — "אין ביקורים עדיין" מוצג.
 * 2. ביקור עם notes בלבד — מוצג סיכום.
 * 3. ביקור עם clientReaction בלבד — מוצגת תגובת לקוחה.
 * 4. ביקור עם שני השדות — שניהם מוצגים.
 * 5. ביקור ללא notes וללא clientReaction — בלוק סיכום לא מוצג.
 * 6. תאריך ביקור מוצג בפורמט עברי.
 * 7. RTL ו-lang="he" על הרכיב הראשי.
 *
 * הרצה: `npx vitest run --reporter=verbose components/clients/__tests__/VisitTimeline.test.tsx`
 */

import { vi, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/navigation — VisitAmendmentForm (נטען ע"י VisitTimeline) משתמש ב-useRouter
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// Mock Intl.DateTimeFormat to avoid locale issues in test environment
// (Node may not have full ICU data for 'he-IL')
// We just check for presence of text, not exact format.

import { VisitTimeline } from "@/components/clients/VisitTimeline";
import type { VisitTimelineProps } from "@/components/clients/VisitTimeline";

type Visit = VisitTimelineProps["visits"][number];

/** יצירת ביקור מדומה — type assertion כדי להתמודד עם Prisma Decimal ושדות ברירת מחדל */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeVisit(overrides: Record<string, any> = {}): Visit {
  return {
    id: "visit-1",
    clientId: "client-1",
    visitDate: new Date("2026-11-05"),
    therapist: null,
    treatedArea: null,
    products: null,
    parameters: null,
    notes: null,
    clientReaction: null,
    price: null,
    visitTreatments: [],
    amendments: [],
    returnDate: null,
    returnNoteHandled: false,
    // createdAt מוגדר כזמן נוכחי ברירת מחדל (ביקור לא נעול).
    // כדי לבדוק ביקור נעול, העבר createdAt: new Date(0) בעקיפות.
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Visit;
}

// --- בדיקות ---

describe("VisitTimeline — מצב ריק", () => {
  it('מציג "אין ביקורים עדיין" כאשר רשימת הביקורים ריקה', () => {
    render(<VisitTimeline visits={[]} clientId="client-1" />);
    expect(screen.getByText("אין ביקורים עדיין")).toBeInTheDocument();
  });

  it("מצב ריק מכיל dir=rtl ו-lang=he", () => {
    const { container } = render(<VisitTimeline visits={[]} clientId="client-1" />);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveAttribute("dir", "rtl");
    expect(root).toHaveAttribute("lang", "he");
  });
});

describe("VisitTimeline — הצגת ביקורים", () => {
  it("הציר הראשי מכיל dir=rtl ו-lang=he", () => {
    const { container } = render(
      <VisitTimeline visits={[makeVisit()]} clientId="client-1" />
    );
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveAttribute("dir", "rtl");
    expect(root).toHaveAttribute("lang", "he");
  });

  it("תאריך ביקור מוצג כ-<time> עם datetime attribute תקין", () => {
    render(<VisitTimeline visits={[makeVisit()]} clientId="client-1" />);
    const timeEl = document.querySelector("time");
    expect(timeEl).not.toBeNull();
    expect(timeEl?.getAttribute("datetime")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("VisitTimeline — הצגת סיכום טיפול (task 4.6)", () => {
  it("ביקור עם notes — מציג את תוכן הסיכום", () => {
    render(
      <VisitTimeline
        visits={[makeVisit({ notes: "הטיפול עבר מצוין, ללא תגובות שליליות" })]}
        clientId="client-1"
      />
    );
    expect(
      screen.getByText("הטיפול עבר מצוין, ללא תגובות שליליות")
    ).toBeInTheDocument();
  });

  it("ביקור עם clientReaction — מציג את תגובת הלקוחה", () => {
    render(
      <VisitTimeline
        visits={[makeVisit({ clientReaction: "שביעות רצון גבוהה, תוצאה מצוינת" })]}
        clientId="client-1"
      />
    );
    expect(
      screen.getByText("שביעות רצון גבוהה, תוצאה מצוינת")
    ).toBeInTheDocument();
  });

  it("ביקור עם clientReaction — מציג כותרת 'תוצאה / תגובת לקוחה'", () => {
    render(
      <VisitTimeline
        visits={[makeVisit({ clientReaction: "שביעות רצון" })]}
        clientId="client-1"
      />
    );
    expect(screen.getByText("תוצאה / תגובת לקוחה")).toBeInTheDocument();
  });

  it("ביקור עם שני השדות — מציג גם סיכום וגם תגובת לקוחה", () => {
    render(
      <VisitTimeline
        visits={[
          makeVisit({
            notes: "סיכום הטיפול",
            clientReaction: "תגובה חיובית",
          }),
        ]}
        clientId="client-1"
      />
    );
    expect(screen.getByText("סיכום הטיפול")).toBeInTheDocument();
    expect(screen.getByText("תגובה חיובית")).toBeInTheDocument();
    expect(screen.getByText("תוצאה / תגובת לקוחה")).toBeInTheDocument();
  });

  it("ביקור ללא notes ולא clientReaction — בלוק 'סיכום טיפול' לא מוצג", () => {
    render(<VisitTimeline visits={[makeVisit()]} clientId="client-1" />);
    // "סיכום טיפול" בתוך הכרטיס לא אמור להופיע (רק אם יש לפחות שדה אחד)
    // שימוש ב-queryAllByText כי "סיכום טיפול" עלול להופיע במקומות אחרים בדף
    const summaryBlocks = screen
      .queryAllByText("סיכום טיפול")
      .filter((el) => el.tagName === "P");
    expect(summaryBlocks.length).toBe(0);
  });

  it("ביקור עם notes בלבד — כותרת 'תוצאה / תגובת לקוחה' לא מוצגת", () => {
    render(
      <VisitTimeline
        visits={[makeVisit({ notes: "רק סיכום, ללא תגובה" })]}
        clientId="client-1"
      />
    );
    expect(
      screen.queryByText("תוצאה / תגובת לקוחה")
    ).not.toBeInTheDocument();
  });

  it("מציג מחיר כאשר הוא מסופק", () => {
    render(<VisitTimeline visits={[makeVisit({ price: 350 })]} clientId="client-1" />);
    // מחיר מוצג בפורמט עברי — מכיל לפחות "350" ו"מחיר"
    expect(screen.getByText(/מחיר/)).toBeInTheDocument();
  });

  it("לא מציג מחיר כאשר הוא null", () => {
    render(<VisitTimeline visits={[makeVisit({ price: null })]} clientId="client-1" />);
    expect(screen.queryByText(/מחיר/)).not.toBeInTheDocument();
  });
});

describe("VisitTimeline — ריבוי ביקורים", () => {
  it("מציג שני ביקורים — שניהם מרונדרים", () => {
    render(
      <VisitTimeline
        visits={[
          makeVisit({ id: "v-1", notes: "ביקור ראשון" }),
          makeVisit({ id: "v-2", notes: "ביקור שני" }),
        ]}
        clientId="client-1"
      />
    );
    expect(screen.getByText("ביקור ראשון")).toBeInTheDocument();
    expect(screen.getByText("ביקור שני")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// task 4.7 — מועד חזרה מוצע (FR-PR-05)
// ---------------------------------------------------------------------------

describe("VisitTimeline — מועד חזרה מוצע (task 4.7)", () => {
  it("כאשר visit.returnDate מוגדר — מוצג 'מועד חזרה מוצע:'", () => {
    render(
      <VisitTimeline
        visits={[makeVisit({ returnDate: new Date("2026-05-01") })]}
        clientId="client-1"
      />
    );
    expect(screen.getByText(/מועד חזרה מוצע/)).toBeInTheDocument();
  });

  it("כאשר visit.returnDate הוא null — 'מועד חזרה מוצע' לא מוצג", () => {
    render(<VisitTimeline visits={[makeVisit({ returnDate: null })]} clientId="client-1" />);
    expect(screen.queryByText(/מועד חזרה מוצע/)).not.toBeInTheDocument();
  });

  it("תאריך החזרה מוצג בתוך אלמנט <p> עם ה-label 'מועד חזרה מוצע:'", () => {
    render(
      <VisitTimeline
        visits={[makeVisit({ returnDate: new Date("2026-05-01") })]}
        clientId="client-1"
      />
    );
    const label = screen.getByText(/מועד חזרה מוצע/);
    // הטקסט נמצא בתוך פסקה
    expect(label.closest("p")).not.toBeNull();
  });

  it("כאשר visit.returnDate מוגדר — הבלוק הוויזואלי (div עם SVG icon) מרונדר", () => {
    const { container } = render(
      <VisitTimeline
        visits={[makeVisit({ returnDate: new Date("2026-06-15") })]}
        clientId="client-1"
      />
    );
    // בלוק ה-returnDate מכיל SVG (אייקון לוח שנה)
    const svgEl = container.querySelector("svg[aria-hidden='true']");
    expect(svgEl).not.toBeNull();
  });

  it("ביקור עם returnDate ו-notes — שניהם מוצגים יחד", () => {
    render(
      <VisitTimeline
        visits={[
          makeVisit({
            notes: "סיכום הטיפול",
            returnDate: new Date("2026-05-01"),
          }),
        ]}
        clientId="client-1"
      />
    );
    expect(screen.getByText("סיכום הטיפול")).toBeInTheDocument();
    expect(screen.getByText(/מועד חזרה מוצע/)).toBeInTheDocument();
  });
});
