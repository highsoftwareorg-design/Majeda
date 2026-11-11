/**
 * בדיקות לרכיב AdminShell — משימות 11.1/11.2 (מעטפת ממשק הניהול).
 *
 * בודק:
 * 1. ה-Shell מרנדר landmark <main> יחיד (אין main מקונן), והתוכן נמצא בתוכו.
 * 2. כפתור "התנתקות" יחיד ב-Shell (אין כפתור כפול מתוך העמודים).
 * 3. ה-Shell עוטף ב-dir="rtl" ורקע שמפניה (BR-02/BR-03, NFR-06).
 * 4. הלוגו וה-Header מרונדרים.
 * 5. axe — ללא הפרות נגישות.
 *
 * הערה: signOut (NextAuth) ו-Logo (next/image) ממוקים כדי לבודד את ה-Shell
 * מתשתית השרת ומטעינת תמונה.
 *
 * הרצה: `npx vitest run components/layout/__tests__/AdminShell.test.tsx`
 */

import { vi, describe, it, expect, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import { axe } from "jest-axe";

vi.mock("next/navigation", () => ({
  usePathname: () => "/clients",
  // נדרש לשורת החיפוש הגלובלית (משימה 11.3).
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

// בידוד מתשתית NextAuth (קריאת NextAuth() ברמת המודול דורשת env + prisma).
vi.mock("@/lib/auth/auth", () => ({
  signOut: vi.fn(),
}));

// בידוד מ-next/image — הלוגו מרונדר כ-img פשוט בבדיקה.
vi.mock("@/components/brand/Logo", () => ({
  Logo: () => <img alt="מאג'ידה סנטר" src="/brand/majida_logo.svg" />,
}));

import { AdminShell } from "@/components/layout/AdminShell";

afterEach(() => cleanup());

describe("AdminShell — מבנה ו-landmarks", () => {
  it("מרנדר landmark <main> יחיד עם התוכן בתוכו", () => {
    render(
      <AdminShell>
        <div data-testid="page-content">תוכן העמוד</div>
      </AdminShell>
    );
    const mains = screen.getAllByRole("main");
    expect(mains).toHaveLength(1);
    expect(within(mains[0]).getByTestId("page-content")).toBeInTheDocument();
  });

  it("מכיל כפתור 'התנתקות' יחיד", () => {
    render(
      <AdminShell>
        <div>תוכן</div>
      </AdminShell>
    );
    const logoutButtons = screen.getAllByRole("button", { name: "התנתקות" });
    expect(logoutButtons).toHaveLength(1);
    expect(logoutButtons[0]).toHaveAttribute("type", "submit");
  });

  it("עוטף ב-dir=rtl ורקע שמפניה", () => {
    const { container } = render(
      <AdminShell>
        <div>תוכן</div>
      </AdminShell>
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("dir", "rtl");
    expect(root.className).toContain("bg-champagne");
  });

  it("מרנדר Header עם הלוגו", () => {
    render(
      <AdminShell>
        <div>תוכן</div>
      </AdminShell>
    );
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByAltText("מאג'ידה סנטר")).toBeInTheDocument();
  });
});

describe("AdminShell — נגישות", () => {
  it("אין הפרות axe", async () => {
    const { container } = render(
      <AdminShell>
        <h1>כותרת עמוד</h1>
        <p>תוכן נגיש</p>
      </AdminShell>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
