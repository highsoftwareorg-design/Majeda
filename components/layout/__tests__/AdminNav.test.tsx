/**
 * בדיקות לרכיב AdminNav — משימה 11.1 (ניווט ראשי של ממשק הניהול).
 *
 * בודק:
 * 1. מרנדר קישורים לכל 7 הנתיבים (עם ה-labels בעברית).
 * 2. הפריט התואם לנתיב הנוכחי נושא aria-current="page" ושאר הפריטים לא.
 * 3. התאמת תת-נתיב — /clients/123 מסמן את "לקוחות" כפעיל.
 * 4. כפתור ההמבורגר (נייד) פותח וסוגר את פאנל הניווט.
 * 5. סגירת הפאנל במקש Escape.
 * 6. axe — ללא הפרות נגישות.
 *
 * הרצה: `npx vitest run components/layout/__tests__/AdminNav.test.tsx`
 */

import { vi, describe, it, expect, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";

// usePathname נדרש לרכיב ה-client; נשלט דרך משתנה ניתן לשינוי בין בדיקות.
let mockPathname = "/clients";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

import { AdminNav } from "@/components/layout/AdminNav";

const LABELS = [
  "לקוחות",
  "יומן",
  "משימות",
  "קמפיינים",
  "טפסי הסכמה",
  "קטלוג טיפולים",
  "הגדרות",
];

afterEach(() => {
  cleanup();
  mockPathname = "/clients";
});

describe("AdminNav — קישורי ניווט", () => {
  it("מרנדר קישורים לכל 7 הנתיבים עם ה-labels בעברית", () => {
    render(<AdminNav />);
    // הרכיב מרנדר את רשימת הדסקטופ תמיד (מוסתרת רק ב-CSS). נבדוק שכל label קיים
    // כקישור לפחות פעם אחת, ושה-href נכון.
    const hrefByLabel: Record<string, string> = {
      "לקוחות": "/clients",
      "יומן": "/calendar",
      "משימות": "/tasks",
      "קמפיינים": "/campaigns",
      "טפסי הסכמה": "/consent-templates",
      "קטלוג טיפולים": "/treatments",
      "הגדרות": "/settings",
    };
    for (const label of LABELS) {
      const links = screen.getAllByRole("link", { name: label });
      expect(links.length).toBeGreaterThanOrEqual(1);
      expect(links[0]).toHaveAttribute("href", hrefByLabel[label]);
    }
  });
});

describe("AdminNav — סימון פריט פעיל", () => {
  it('הפריט התואם לנתיב נושא aria-current="page" בלבד', () => {
    mockPathname = "/calendar";
    render(<AdminNav />);
    const active = screen.getAllByRole("link", { name: "יומן" });
    for (const link of active) {
      expect(link).toHaveAttribute("aria-current", "page");
    }
    // פריט לא-פעיל לא נושא aria-current.
    const inactive = screen.getAllByRole("link", { name: "לקוחות" });
    for (const link of inactive) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("תת-נתיב /clients/123 מסמן את 'לקוחות' כפעיל", () => {
    mockPathname = "/clients/123";
    render(<AdminNav />);
    const active = screen.getAllByRole("link", { name: "לקוחות" });
    expect(active[0]).toHaveAttribute("aria-current", "page");
    const inactive = screen.getAllByRole("link", { name: "קמפיינים" });
    expect(inactive[0]).not.toHaveAttribute("aria-current");
  });

  it("בדיוק פריט ייחודי אחד (href) מסומן כפעיל", () => {
    mockPathname = "/settings/templates";
    render(<AdminNav />);
    const current = screen
      .getAllByRole("link")
      .filter((l) => l.getAttribute("aria-current") === "page");
    // הפריט עשוי להופיע גם בדסקטופ וגם בפאנל הנייד — אך ה-href הייחודי אחד.
    const uniqueHrefs = new Set(current.map((l) => l.getAttribute("href")));
    expect(uniqueHrefs.size).toBe(1);
    expect([...uniqueHrefs][0]).toBe("/settings");
  });
});

describe("AdminNav — תפריט נייד (המבורגר)", () => {
  it("הפאנל סגור כברירת מחדל ונפתח בלחיצה על הכפתור", async () => {
    const user = userEvent.setup();
    render(<AdminNav />);

    const toggle = screen.getByRole("button", { name: "פתיחת תפריט הניווט" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // הפאנל הנפתח הוא nav עם aria-label "ניווט ראשי" — לא קיים בהתחלה.
    expect(
      screen.queryByRole("navigation", { name: "ניווט ראשי" })
    ).not.toBeInTheDocument();

    await user.click(toggle);

    expect(
      screen.getByRole("button", { name: "סגירת תפריט הניווט" })
    ).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("navigation", { name: "ניווט ראשי" });
    expect(panel).toBeInTheDocument();
    // הפאנל מכיל את כל 7 הקישורים.
    expect(within(panel).getAllByRole("link")).toHaveLength(7);
  });

  it("לחיצה חוזרת על הכפתור סוגרת את הפאנל", async () => {
    const user = userEvent.setup();
    render(<AdminNav />);

    await user.click(screen.getByRole("button", { name: "פתיחת תפריט הניווט" }));
    expect(
      screen.getByRole("navigation", { name: "ניווט ראשי" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "סגירת תפריט הניווט" }));
    expect(
      screen.queryByRole("navigation", { name: "ניווט ראשי" })
    ).not.toBeInTheDocument();
  });

  it("מקש Escape סוגר את הפאנל", async () => {
    const user = userEvent.setup();
    render(<AdminNav />);

    await user.click(screen.getByRole("button", { name: "פתיחת תפריט הניווט" }));
    expect(
      screen.getByRole("navigation", { name: "ניווט ראשי" })
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("navigation", { name: "ניווט ראשי" })
    ).not.toBeInTheDocument();
  });
});

describe("AdminNav — נגישות", () => {
  it("אין הפרות axe (מצב סגור)", async () => {
    const { container } = render(<AdminNav />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
