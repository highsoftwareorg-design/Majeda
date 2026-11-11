/**
 * בדיקות לבאדג' "משימות פתוחות" ב-AdminNav — משימה 11.9 (FR-FU-07).
 *
 * בודק:
 * 1. count>0 → באדג' מוצג על פריט "משימות" בלבד (לא על פריטים אחרים), עם המספר.
 * 2. count=0 (או ללא prop) → אין באדג' כלל (גם לא "0").
 * 3. count>99 → מוצג "99+".
 * 4. טקסט sr-only עברי "(N משימות פתוחות)" קיים לקוראי מסך.
 * 5. ברירת המחדל (openTasksCount לא מועבר) — ללא באדג', עדיין 7 פריטים.
 *
 * הרצה: `npx vitest run components/layout/__tests__/AdminNav.badge.test.tsx`
 */

import { vi, describe, it, expect, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";

let mockPathname = "/clients";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

import { AdminNav } from "@/components/layout/AdminNav";

afterEach(() => {
  cleanup();
  mockPathname = "/clients";
});

/** פריט ניווט לפי label — הראשון מבין דסקטופ/נייד (ה-href ייחודי). */
function navLink(label: string) {
  return screen.getAllByRole("link", { name: new RegExp(label) })[0];
}

describe("AdminNav — באדג' משימות פתוחות (11.9)", () => {
  it("count>0 → באדג' מוצג על פריט 'משימות' עם המספר", () => {
    render(<AdminNav openTasksCount={3} />);
    const tasks = navLink("משימות");
    expect(tasks).toHaveAttribute("href", "/tasks");
    // המספר מופיע בתוך הקישור (הבאדג' המספרי aria-hidden).
    expect(tasks.textContent).toContain("3");
    // טקסט נגיש לקוראי מסך.
    expect(within(tasks).getByText("(3 משימות פתוחות)")).toBeInTheDocument();
  });

  it("הבאדג' מופיע רק על 'משימות' ולא על פריטים אחרים", () => {
    render(<AdminNav openTasksCount={4} />);
    const clients = navLink("לקוחות");
    const calendar = navLink("יומן");
    expect(clients.textContent).not.toContain("4");
    expect(calendar.textContent).not.toContain("4");
    // טקסט "משימות פתוחות" קיים בדיוק פעם אחת (רק פריט המשימות; פאנל הנייד סגור).
    expect(screen.getAllByText(/משימות פתוחות/)).toHaveLength(1);
  });

  it("count=0 → אין באדג' כלל (גם לא '0')", () => {
    render(<AdminNav openTasksCount={0} />);
    const tasks = navLink("משימות");
    expect(tasks.textContent).not.toContain("0");
    expect(screen.queryByText(/משימות פתוחות/)).not.toBeInTheDocument();
  });

  it("ללא prop (ברירת מחדל) → אין באדג', ועדיין 7 פריטים בדסקטופ", () => {
    render(<AdminNav />);
    expect(screen.queryByText(/משימות פתוחות/)).not.toBeInTheDocument();
    // רשימת הדסקטופ מרונדרת תמיד — 7 פריטים.
    const lists = screen.getAllByRole("list");
    const desktop = lists[0];
    expect(within(desktop).getAllByRole("link")).toHaveLength(7);
  });

  it("count>99 → מוצג '99+' והטקסט הנגיש נושא את המספר המלא", () => {
    render(<AdminNav openTasksCount={150} />);
    const tasks = navLink("משימות");
    expect(tasks.textContent).toContain("99+");
    expect(within(tasks).getByText("(150 משימות פתוחות)")).toBeInTheDocument();
  });

  it("count=99 (בדיוק בתקרה) → מוצג '99' ולא '99+'", () => {
    render(<AdminNav openTasksCount={99} />);
    const tasks = navLink("משימות");
    expect(tasks.textContent).toContain("99");
    expect(tasks.textContent).not.toContain("99+");
  });
});
