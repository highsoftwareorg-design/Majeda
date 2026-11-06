/**
 * בדיקות ל-VisitTimeline — משימה 4.4.
 *
 * בודק:
 * 1. מערך ריק → מציג "אין ביקורים עדיין" ולא שגיאה.
 * 2. ביקור אחד עם טיפול אחד → שם הטיפול והתאריך מוצגים.
 * 3. ביקור אחד עם שני טיפולים → שני שמות מופרדים בפסיק.
 * 4. ביקור עם therapist מוגדר → תווית המטפל/ת מוצגת.
 * 5. ביקור עם notes מוגדרות → ההערות מוצגות.
 * 6. שלושה ביקורים → כל שלושתם מוצגים (תאריכים וטיפולים).
 *
 * הרצה: `npx vitest run --reporter=verbose components/clients/VisitTimeline.test.tsx`
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock next/navigation — VisitAmendmentForm (נטען ע"י VisitTimeline) משתמש ב-useRouter
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { VisitTimeline } from "./VisitTimeline";
import type { ClientVisitWithTreatments } from "@/lib/db/visits";

// ----- עזר: יצירת ביקור מינימלי לבדיקות -----

function makeVisit(
  overrides: Partial<ClientVisitWithTreatments> & {
    visitDate: Date;
    visitTreatments?: ClientVisitWithTreatments["visitTreatments"];
  }
): ClientVisitWithTreatments {
  const base: ClientVisitWithTreatments = {
    id: "visit-1",
    clientId: "client-1",
    visitDate: overrides.visitDate,
    therapist: null,
    treatedArea: null,
    notes: null,
    clientReaction: null,
    price: null,
    products: null,
    parameters: null,
    returnDate: null,
    returnNoteHandled: false,
    visitTreatments: overrides.visitTreatments ?? [],
    amendments: [],
    // createdAt מוגדר כזמן נוכחי ברירת מחדל (ביקור לא נעול).
    // כדי לבדוק ביקור נעול, העבר createdAt: new Date(0).
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return { ...base, ...overrides };
}

function makeTreatment(id: string, name: string) {
  return {
    visitId: "visit-1",
    treatmentId: id,
    treatment: {
      id,
      name,
      description: null,
      durationMinutes: 60,
      price: 300,
      recommendedReturn: null,
      recommendedReturnDays: null,
      // fields added in task 5.2 (FR-AP-02)
      color: "#D2AB2E",
      requiresConsentForm: false,
      authorizedTherapists: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
  };
}

// ----- בדיקות -----

describe("VisitTimeline", () => {
  // 1. מצב ריק
  it('מציג "אין ביקורים עדיין" כאשר מערך הביקורים ריק', () => {
    render(<VisitTimeline visits={[]} clientId="client-1" />);
    expect(screen.getByText("אין ביקורים עדיין")).toBeInTheDocument();
  });

  it("לא זורק שגיאה כאשר מערך הביקורים ריק", () => {
    expect(() => render(<VisitTimeline visits={[]} clientId="client-1" />)).not.toThrow();
  });

  // 2. ביקור אחד עם טיפול אחד
  it("מציג שם טיפול ותאריך עבור ביקור אחד עם טיפול אחד", () => {
    const visit = makeVisit({
      visitDate: new Date("2026-11-05"),
      visitTreatments: [makeTreatment("t1", "הסרת שיער בלייזר")],
    });

    render(<VisitTimeline visits={[visit]} clientId="client-1" />);

    expect(screen.getByText("הסרת שיער בלייזר")).toBeInTheDocument();
    // בדיקה שהתאריך מוצג בפורמט עברי — בנובמבר 2026
    const timeEl = screen.getByRole("time");
    expect(timeEl).toHaveAttribute("datetime", "2026-11-05");
    // הטקסט מכיל "נובמבר" (חודש עברי)
    expect(timeEl.textContent).toContain("נובמבר");
  });

  // 3. ביקור אחד עם שני טיפולים
  it("מציג שני שמות טיפולים מופרדים בפסיק", () => {
    const visit = makeVisit({
      visitDate: new Date("2026-10-01"),
      visitTreatments: [
        makeTreatment("t1", "הסרת שיער בלייזר"),
        makeTreatment("t2", "טיפול פנים"),
      ],
    });

    render(<VisitTimeline visits={[visit]} clientId="client-1" />);

    expect(
      screen.getByText("הסרת שיער בלייזר, טיפול פנים")
    ).toBeInTheDocument();
  });

  // 4. ביקור עם therapist
  it('מציג "מטפל/ת: שם" כאשר therapist מוגדר', () => {
    const visit = makeVisit({
      visitDate: new Date("2026-09-15"),
      therapist: "מג'ידה",
      visitTreatments: [makeTreatment("t1", "עיסוי")],
    });

    render(<VisitTimeline visits={[visit]} clientId="client-1" />);

    expect(screen.getByText(/מטפל\/ת:/)).toBeInTheDocument();
    expect(screen.getByText(/מג'ידה/)).toBeInTheDocument();
  });

  // 5. ביקור עם notes
  it("מציג הערות כאשר notes מוגדרות", () => {
    const visit = makeVisit({
      visitDate: new Date("2026-08-20"),
      notes: "הלקוחה דיווחה על רגישות באזור הסנטר",
      visitTreatments: [],
    });

    render(<VisitTimeline visits={[visit]} clientId="client-1" />);

    expect(
      screen.getByText("הלקוחה דיווחה על רגישות באזור הסנטר")
    ).toBeInTheDocument();
  });

  // 6. שלושה ביקורים — כולם מוצגים
  it("מציג שלושה ביקורים עם תאריכים וטיפולים שונים", () => {
    const visits: ClientVisitWithTreatments[] = [
      {
        ...makeVisit({
          visitDate: new Date("2026-11-01"),
          visitTreatments: [makeTreatment("t1", "הסרת שיער בלייזר")],
        }),
        id: "visit-1",
      },
      {
        ...makeVisit({
          visitDate: new Date("2026-10-01"),
          visitTreatments: [makeTreatment("t2", "טיפול פנים")],
        }),
        id: "visit-2",
      },
      {
        ...makeVisit({
          visitDate: new Date("2026-09-01"),
          visitTreatments: [makeTreatment("t3", "עיסוי גב")],
        }),
        id: "visit-3",
      },
    ];

    render(<VisitTimeline visits={visits} clientId="client-1" />);

    // שלושה כרטיסים מוצגים
    const timeEls = screen.getAllByRole("time");
    expect(timeEls).toHaveLength(3);

    // כל הטיפולים מוצגים
    expect(screen.getByText("הסרת שיער בלייזר")).toBeInTheDocument();
    expect(screen.getByText("טיפול פנים")).toBeInTheDocument();
    expect(screen.getByText("עיסוי גב")).toBeInTheDocument();

    // שלושת התאריכים מוצגים עם datetime attributes
    expect(timeEls[0]).toHaveAttribute("datetime", "2026-11-01");
    expect(timeEls[1]).toHaveAttribute("datetime", "2026-10-01");
    expect(timeEls[2]).toHaveAttribute("datetime", "2026-09-01");
  });

  // 7. RTL — ה-div הראשי מוגדר עם dir=rtl
  it("ה-div הראשי מוגדר עם dir=rtl", () => {
    const visit = makeVisit({
      visitDate: new Date("2026-11-05"),
      visitTreatments: [],
    });
    const { container } = render(<VisitTimeline visits={[visit]} clientId="client-1" />);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveAttribute("dir", "rtl");
  });
});
