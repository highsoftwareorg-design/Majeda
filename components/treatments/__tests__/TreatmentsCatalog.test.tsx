/**
 * בדיקות ל-TreatmentsCatalog — רשימת קטלוג הטיפולים (משימה 11.7, FR-AP-02).
 *
 * בודק:
 * 1. מציג לכל טיפול שם/משך/מחיר/צבע/"טופס נדרש"/זמן חזרה.
 * 2. שם הטיפול הוא קישור ל-/treatments/[id].
 * 3. כפתור "+ טיפול חדש" פותח את הדיאלוג במצב יצירה (כותרת "טיפול חדש").
 * 4. כפתור "עריכה" פותח את הדיאלוג במצב עריכה (כותרת "עריכת טיפול") טעון בערכים.
 * 5. מצב ריק מציג הודעת עידוד.
 * 6. RTL/מובייל — touch targets 44px לכפתורים.
 *
 * הרצה: `npx vitest run components/treatments/__tests__/TreatmentsCatalog.test.tsx`
 */

import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...props }, children),
}));

import { TreatmentsCatalog } from "@/components/treatments/TreatmentsCatalog";
import type { TreatmentListItem } from "@/components/treatments/TreatmentFormDialog";

const TREATMENTS: TreatmentListItem[] = [
  {
    id: "t1",
    name: "בוטוקס",
    description: "החלקת קמטים",
    durationMinutes: 30,
    price: 500,
    recommendedReturn: "4 חודשים",
    recommendedReturnDays: 120,
    color: "#AABBCC",
    requiresConsentForm: true,
    authorizedTherapists: "שרה",
  },
  {
    id: "t2",
    name: "פילינג כימי",
    description: null,
    durationMinutes: 60,
    price: 0,
    recommendedReturn: null,
    recommendedReturnDays: null,
    color: "#D2AB2E",
    requiresConsentForm: false,
    authorizedTherapists: null,
  },
];

describe("TreatmentsCatalog — רשימה", () => {
  beforeEach(() => {
    render(<TreatmentsCatalog initialTreatments={TREATMENTS} />);
  });

  it("מציג את כל שמות הטיפולים כקישורים ל-/treatments/[id]", () => {
    const link1 = screen.getByRole("link", { name: /בוטוקס/ });
    const link2 = screen.getByRole("link", { name: /פילינג כימי/ });
    expect(link1).toHaveAttribute("href", "/treatments/t1");
    expect(link2).toHaveAttribute("href", "/treatments/t2");
  });

  it("מציג משך, מחיר, צבע, טופס נדרש וזמן חזרה לכל טיפול", () => {
    const items = screen.getAllByRole("listitem");
    const first = within(items[0]);
    expect(first.getByText("30 דק׳")).toBeInTheDocument();
    // מחיר מפורמט ב-ILS
    expect(first.getByText(/500/)).toBeInTheDocument();
    // צבע HEX
    expect(first.getByText("#AABBCC")).toBeInTheDocument();
    // טופס נדרש = כן
    expect(first.getByText("כן")).toBeInTheDocument();
    // זמן חזרה מומלץ
    expect(first.getByText("4 חודשים")).toBeInTheDocument();
  });

  it("טיפול ללא טופס נדרש מציג 'לא'", () => {
    const items = screen.getAllByRole("listitem");
    expect(within(items[1]).getByText("לא")).toBeInTheDocument();
  });
});

describe("TreatmentsCatalog — פתיחת דיאלוג", () => {
  beforeEach(() => {
    render(<TreatmentsCatalog initialTreatments={TREATMENTS} />);
  });

  it('"+ טיפול חדש" פותח דיאלוג יצירה', () => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /טיפול חדש/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("טיפול חדש")).toBeInTheDocument();
    // שדה השם ריק ביצירה
    expect((document.getElementById("nt-name") as HTMLInputElement).value).toBe("");
  });

  it('כפתור "עריכה" פותח דיאלוג עריכה טעון בערכי הטיפול', () => {
    fireEvent.click(screen.getByRole("button", { name: "עריכת בוטוקס" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("עריכת טיפול")).toBeInTheDocument();
    expect((document.getElementById("et-name") as HTMLInputElement).value).toBe("בוטוקס");
    expect((document.getElementById("et-duration") as HTMLInputElement).value).toBe("30");
    expect((document.getElementById("et-price") as HTMLInputElement).value).toBe("500");
  });

  it('כפתור "+ טיפול חדש" בעל touch target 44px', () => {
    expect(
      screen.getByRole("button", { name: /טיפול חדש/ }).className
    ).toContain("min-h-11");
  });
});

describe("TreatmentsCatalog — מצב ריק", () => {
  it("מציג הודעת עידוד כשאין טיפולים", () => {
    render(<TreatmentsCatalog initialTreatments={[]} />);
    expect(screen.getByText(/עדיין אין טיפולים בקטלוג/)).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
