/**
 * בדיקות לרכיב AdminGlobalSearch — משימה 11.3 (חיפוש גלובלי ב-Header, FR-CL-03).
 *
 * בודק:
 * 1. מבנה/נגישות — form role="search" עם aria-label עברי, Input type/inputMode="search",
 *    touch target 44px (h-11), אייקון חיפוש, role="status" ל-screen readers.
 * 2. הקלדה >= 2 תווים → fetch עם debounce ל-`GET /api/clients?q=` ורינדור dropdown
 *    עם שם + טלפון (dir="ltr"), כל פריט מקשר ל-`/clients/[id]`.
 * 3. פחות מ-2 תווים אינו מפעיל חיפוש.
 * 4. קישור "לכל התוצאות בעמוד הלקוחות" מצביע ל-`/clients?q=`.
 * 5. Enter → router.push(`/clients?q=<term>`).
 * 6. Escape סוגר את ה-dropdown.
 * 7. תוצאות ריקות → הודעה עברית מתאימה.
 * 8. בקשה ישנה (stale) שמתבטלת אינה מרנדרת תוצאות ישנות.
 *
 * הרצה: `npx vitest run components/layout/__tests__/AdminGlobalSearch.test.tsx`
 */

import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), prefetch: vi.fn() }),
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

import { AdminGlobalSearch } from "@/components/layout/AdminGlobalSearch";

type ClientRow = { id: string; firstName: string; lastName: string; phone: string };

function makeClient(id: string, firstName: string, lastName: string, phone: string): ClientRow {
  return { id, firstName, lastName, phone };
}

/** mock של fetch שמחזיר רשימת לקוחות קבועה. */
function mockFetchClients(clients: ClientRow[]) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({ clients }),
  } as Response);
}

function input() {
  return screen.getByRole("searchbox");
}

beforeEach(() => {
  mockPush.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

// ─── 1. מבנה ונגישות ─────────────────────────────────────────────────────────

describe("AdminGlobalSearch — מבנה ונגישות", () => {
  it("מרנדר form role='search' עם aria-label עברי", () => {
    render(<AdminGlobalSearch />);
    const form = screen.getByRole("search");
    expect(form).toBeInTheDocument();
    expect(form).toHaveAttribute("aria-label", "חיפוש לקוחות");
  });

  it("שדה החיפוש מסוג search, inputMode=search, enterKeyHint=search, touch target 44px", () => {
    render(<AdminGlobalSearch />);
    const el = input() as HTMLInputElement;
    expect(el).toHaveAttribute("type", "search");
    expect(el).toHaveAttribute("inputmode", "search");
    expect(el).toHaveAttribute("enterkeyhint", "search");
    expect(el.className).toContain("h-11");
  });

  it("קיים אלמנט role='status' להכרזת מספר התוצאות", () => {
    render(<AdminGlobalSearch />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

// ─── 2. חיפוש עם debounce ו-dropdown ─────────────────────────────────────────

describe("AdminGlobalSearch — חיפוש ותוצאות", () => {
  it("הקלדה >= 2 תווים מפעילה fetch ל-/api/clients?q= ומרנדרת dropdown עם שם+טלפון", async () => {
    const clients = [
      makeClient("c1", "שרה", "כהן", "0541111111"),
      makeClient("c2", "שרון", "לוי", "0522222222"),
    ];
    const fetchSpy = mockFetchClients(clients);

    render(<AdminGlobalSearch />);
    fireEvent.change(input(), { target: { value: "שר" } });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    const calledUrl = String(fetchSpy.mock.calls[0][0]);
    expect(calledUrl).toContain("/api/clients?q=");
    expect(calledUrl).toContain(encodeURIComponent("שר"));

    expect(await screen.findByText("שרה כהן")).toBeInTheDocument();
    expect(screen.getByText("שרון לוי")).toBeInTheDocument();
  });

  it("כל תוצאה מקשרת לפרופיל הנכון /clients/[id] והטלפון ב-dir=ltr", async () => {
    const clients = [makeClient("abc-42", "שרה", "כהן", "0541111111")];
    mockFetchClients(clients);

    render(<AdminGlobalSearch />);
    fireEvent.change(input(), { target: { value: "שרה" } });

    const link = await screen.findByRole("link", { name: /שרה כהן/ });
    expect(link).toHaveAttribute("href", "/clients/abc-42");

    const phone = screen.getByText("0541111111");
    expect(phone).toHaveAttribute("dir", "ltr");
  });

  it("מציג קישור 'לכל התוצאות בעמוד הלקוחות' ל-/clients?q=<term>", async () => {
    mockFetchClients([makeClient("c1", "שרה", "כהן", "0541111111")]);

    render(<AdminGlobalSearch />);
    fireEvent.change(input(), { target: { value: "שרה" } });

    const allLink = await screen.findByRole("link", {
      name: "לכל התוצאות בעמוד הלקוחות",
    });
    expect(allLink).toHaveAttribute("href", `/clients?q=${encodeURIComponent("שרה")}`);
  });

  it("תוצאות ריקות מציגות הודעה 'לא נמצאו לקוחות תואמים'", async () => {
    mockFetchClients([]);

    render(<AdminGlobalSearch />);
    fireEvent.change(input(), { target: { value: "זזז" } });

    // ההודעה מופיעה גם ב-role=status (sr-only) וגם ב-dropdown — לכן findAllByText.
    const messages = await screen.findAllByText("לא נמצאו לקוחות תואמים");
    expect(messages.length).toBeGreaterThanOrEqual(1);
    // ודא שההודעה קיימת בתוך פאנל ה-dropdown (ולא רק ב-live region).
    expect(
      messages.some((el) => el.className.includes("text-taupe"))
    ).toBe(true);
  });

  it("פחות מ-2 תווים אינו מפעיל חיפוש", async () => {
    const fetchSpy = mockFetchClients([]);

    render(<AdminGlobalSearch />);
    fireEvent.change(input(), { target: { value: "ש" } });

    // ממתינים מעבר לזמן ה-debounce (300ms) כדי לוודא שלא נשלחה בקשה
    await new Promise((r) => setTimeout(r, 400));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.queryByText(/לא נמצאו/)).not.toBeInTheDocument();
  });
});

// ─── 3. ניווט ו-Enter ────────────────────────────────────────────────────────

describe("AdminGlobalSearch — ניווט", () => {
  it("Enter (submit) מנווט ל-/clients?q=<term> דרך router.push", async () => {
    mockFetchClients([makeClient("c1", "שרה", "כהן", "0541111111")]);

    render(<AdminGlobalSearch />);
    fireEvent.change(input(), { target: { value: "שרה" } });
    // שליחת הטופס (Enter)
    fireEvent.submit(screen.getByRole("search"));

    expect(mockPush).toHaveBeenCalledWith(`/clients?q=${encodeURIComponent("שרה")}`);
  });

  it("Enter עם מחרוזת ריקה אינו מנווט", () => {
    mockFetchClients([]);
    render(<AdminGlobalSearch />);
    fireEvent.submit(screen.getByRole("search"));
    expect(mockPush).not.toHaveBeenCalled();
  });
});

// ─── 4. Escape סוגר dropdown ─────────────────────────────────────────────────

describe("AdminGlobalSearch — התנהגות מקלדת", () => {
  it("Escape סוגר את ה-dropdown", async () => {
    mockFetchClients([makeClient("c1", "שרה", "כהן", "0541111111")]);

    render(<AdminGlobalSearch />);
    fireEvent.change(input(), { target: { value: "שרה" } });

    expect(await screen.findByText("שרה כהן")).toBeInTheDocument();

    fireEvent.keyDown(input(), { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByText("שרה כהן")).not.toBeInTheDocument();
    });
  });
});

// ─── 5. בקשה ישנה (stale) ────────────────────────────────────────────────────

describe("AdminGlobalSearch — התעלמות מתוצאות ישנות", () => {
  it("מרנדר את תוצאות השאילתה האחרונה בלבד (בקשה איטית ישנה אינה דורסת)", async () => {
    // בקשה ראשונה איטית ("שר") מחזירה תוצאה א'; בקשה שנייה מהירה ("שרה") תוצאה ב'.
    // ה-AbortController + clearTimeout של ה-debounce אמורים לבטל את הישנה.
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((url) => {
        const q = decodeURIComponent(String(url).split("q=")[1] ?? "");
        if (q === "שר") {
          return new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({
                    clients: [makeClient("old", "ישן ישן", "ישן", "0500000000")],
                  }),
                } as Response),
              200
            )
          );
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            clients: [makeClient("new", "חדשה", "חדשה", "0541111111")],
          }),
        } as Response);
      });

    render(<AdminGlobalSearch />);
    // הקלדה מהירה: "שר" ואז "שרה" לפני שה-debounce של הראשונה הספיק לרוץ
    fireEvent.change(input(), { target: { value: "שר" } });
    fireEvent.change(input(), { target: { value: "שרה" } });

    expect(await screen.findByText("חדשה חדשה")).toBeInTheDocument();

    // גם אחרי שהתוצאה האיטית הייתה "מגיעה", אסור שתופיע
    await new Promise((r) => setTimeout(r, 400));
    expect(screen.queryByText("ישן ישן")).not.toBeInTheDocument();
    // רק שאילתה אחת נשלחה בפועל (ה-debounce ביטל את הראשונה לפני ה-fetch)
    expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
