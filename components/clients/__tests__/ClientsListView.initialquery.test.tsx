/**
 * בדיקות ל-ClientsListView — prop initialQuery (משימה 11.3, FR-CL-03).
 *
 * מוודא שניווט מהחיפוש הגלובלי ב-Header (`/clients?q=<term>`) אכן מסנן את הרשימה:
 * העמוד קורא את `searchParams.q` → מעביר כ-initialQuery → הרשימה מריצה fetch ומציגה
 * תוצאות מסוננות.
 *
 * בודק:
 * 1. initialQuery לא ריק → שדה החיפוש מאותחל בערך, fetch ל-/api/clients?q= מופעל,
 *    והרשימה מציגה את תוצאות ה-API (ולא את initialClients).
 * 2. שינוי initialQuery (ניווט חוזר עם q שונה) → fetch חדש עם ה-q החדש.
 * 3. initialQuery ריק → אין fetch, מוצגים initialClients.
 *
 * הרצה: `npx vitest run components/clients/__tests__/ClientsListView.initialquery.test.tsx`
 */

import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { ClientsListView } from "@/components/clients/ClientsListView";
import type { ClientListItem } from "@/components/clients/ClientsListView";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    React.createElement("a", { href, ...props }, children),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

function makeClient(id: string, firstName: string, lastName: string): ClientListItem {
  return {
    id,
    firstName,
    lastName,
    phone: `050000${id}`,
    city: "תל אביב",
    createdAt: new Date().toISOString(),
  };
}

const INITIAL: ClientListItem[] = [
  makeClient("1", "דנה", "לוי"),
  makeClient("2", "רחל", "כהן"),
];

/** mock fetch שמחזיר רשימה ספציפית לפי ה-q בכתובת. */
function mockFetchByQuery(map: Record<string, ClientListItem[]>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
    const params = new URLSearchParams(String(url).split("?")[1] ?? "");
    const q = params.get("q") ?? "";
    return Promise.resolve({
      ok: true,
      json: async () => ({ clients: map[q] ?? [] }),
    } as Response);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("ClientsListView — initialQuery (ניווט מהחיפוש הגלובלי)", () => {
  it("initialQuery מאתחל את שדה החיפוש ומפעיל fetch עם q", async () => {
    const fetchSpy = mockFetchByQuery({ שרה: [makeClient("9", "שרה", "ישראלי")] });

    render(
      <ClientsListView
        initialClients={INITIAL}
        treatments={[]}
        tags={[]}
        initialQuery="שרה"
      />
    );

    // שדה החיפוש מאותחל ב-"שרה"
    const searchBox = screen.getByLabelText(/חיפוש לקוחות לפי שם/) as HTMLInputElement;
    expect(searchBox.value).toBe("שרה");

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("/api/clients?");
    expect(url).toContain(`q=${encodeURIComponent("שרה")}`);
  });

  it("מציג את תוצאות ה-API המסוננות ולא את initialClients", async () => {
    mockFetchByQuery({ שרה: [makeClient("9", "שרה", "ישראלי")] });

    render(
      <ClientsListView
        initialClients={INITIAL}
        treatments={[]}
        tags={[]}
        initialQuery="שרה"
      />
    );

    expect(await screen.findByText("שרה ישראלי")).toBeInTheDocument();
    // הלקוחות המקוריים לא אמורים להופיע כשיש פילטר פעיל
    await waitFor(() => {
      expect(screen.queryByText("דנה לוי")).not.toBeInTheDocument();
    });
  });

  it("שינוי initialQuery (ניווט חוזר) מריץ fetch חדש עם ה-q החדש", async () => {
    const fetchSpy = mockFetchByQuery({
      שרה: [makeClient("9", "שרה", "ישראלי")],
      רחל: [makeClient("2", "רחל", "כהן")],
    });

    const { rerender } = render(
      <ClientsListView
        initialClients={INITIAL}
        treatments={[]}
        tags={[]}
        initialQuery="שרה"
      />
    );
    expect(await screen.findByText("שרה ישראלי")).toBeInTheDocument();

    rerender(
      <ClientsListView
        initialClients={INITIAL}
        treatments={[]}
        tags={[]}
        initialQuery="רחל"
      />
    );

    await waitFor(() => {
      const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.includes(`q=${encodeURIComponent("רחל")}`))).toBe(true);
    });
    expect(await screen.findByText("רחל כהן")).toBeInTheDocument();
  });

  it("initialQuery ריק → אין fetch ומוצגים initialClients", async () => {
    const fetchSpy = mockFetchByQuery({});

    render(
      <ClientsListView
        initialClients={INITIAL}
        treatments={[]}
        tags={[]}
        initialQuery=""
      />
    );

    expect(screen.getByText("דנה לוי")).toBeInTheDocument();
    // ממתינים לוודא שלא נורתה בקשה
    await new Promise((r) => setTimeout(r, 100));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
