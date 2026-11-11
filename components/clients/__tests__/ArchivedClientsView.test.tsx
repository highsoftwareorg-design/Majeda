/**
 * בדיקות ל-ArchivedClientsView — תצוגת ארכיון ושחזור (משימה 11.6, FR-CL-01).
 *
 * בודק:
 * 1. בטעינה — fetch ל-/api/clients?status=archived, ואז רינדור שורות (שם/טלפון/עיר).
 * 2. כל שורה כוללת כפתור "שחזור" עם aria-label עברי מתאים.
 * 3. שחזור מוצלח → POST /api/clients/:id/restore, השורה יוצאת מהתצוגה, onRestored + refresh.
 * 4. כשל טעינה → הודעת שגיאה + כפתור "נסה שוב" שמריץ טעינה מחדש.
 * 5. כשל שחזור → הודעת שגיאה עברית, השורה נשארת.
 * 6. ארכיון ריק → "אין לקוחות בארכיון".
 * 7. RTL (dir="rtl") ו-touch targets 44px.
 *
 * הרצה: `npx vitest run components/clients/__tests__/ArchivedClientsView.test.tsx`
 */

import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

import { ArchivedClientsView } from "@/components/clients/ArchivedClientsView";

const ARCHIVED = [
  { id: "a1", firstName: "דנה", lastName: "לוי", phone: "0501110001", city: "חיפה", createdAt: new Date().toISOString() },
  { id: "a2", firstName: "רחל", lastName: "כהן", phone: "0501110002", city: "תל אביב", createdAt: new Date().toISOString() },
];

/** תגובת fetch מוצלחת עם רשימת מאורכבים. */
function okList(clients: unknown[] = ARCHIVED) {
  return { ok: true, status: 200, json: async () => ({ clients }) } as Response;
}

beforeEach(() => {
  mockRefresh.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ArchivedClientsView — טעינה ורינדור", () => {
  it("בטעינה קורא ל-/api/clients?status=archived ומרנדר שורות", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okList());

    render(<ArchivedClientsView />);

    await waitFor(() => {
      expect(screen.getByText("דנה לוי")).toBeInTheDocument();
    });
    expect(fetchSpy).toHaveBeenCalledWith("/api/clients?status=archived");
    expect(screen.getByText("רחל כהן")).toBeInTheDocument();
    expect(screen.getByText("0501110001")).toBeInTheDocument();
    // מונה חי
    expect(screen.getByText(/2 לקוחות בארכיון/)).toBeInTheDocument();
  });

  it("כל שורה כוללת כפתור שחזור עם aria-label עברי", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okList());
    render(<ArchivedClientsView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "שחזור דנה לוי מהארכיון" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "שחזור רחל כהן מהארכיון" })).toBeInTheDocument();
  });

  it("ארכיון ריק → מציג 'אין לקוחות בארכיון'", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okList([]));
    render(<ArchivedClientsView />);

    await waitFor(() => {
      expect(screen.getByText("אין לקוחות בארכיון.")).toBeInTheDocument();
    });
    expect(screen.getByText(/0 לקוחות בארכיון/)).toBeInTheDocument();
  });
});

describe("ArchivedClientsView — שחזור", () => {
  it("שחזור מוצלח → POST /restore, השורה יוצאת, onRestored + refresh", async () => {
    const onRestored = vi.fn();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(okList()) // טעינה ראשונית
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ client: { id: "a1" } }) } as Response);

    render(<ArchivedClientsView onRestored={onRestored} />);

    await waitFor(() => {
      expect(screen.getByText("דנה לוי")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "שחזור דנה לוי מהארכיון" }));

    await waitFor(() => {
      expect(screen.queryByText("דנה לוי")).not.toBeInTheDocument();
    });

    // הקריאה השנייה היא ל-endpoint השחזור בשיטת POST
    const [url, init] = fetchSpy.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/api/clients/a1/restore");
    expect(init.method).toBe("POST");

    expect(onRestored).toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalled();
    // שורה שנייה נשארת
    expect(screen.getByText("רחל כהן")).toBeInTheDocument();
  });

  it("כשל שחזור → הודעת שגיאה עברית, השורה נשארת", async () => {
    vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(okList())
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: "לקוח לא נמצא" }) } as Response);

    render(<ArchivedClientsView />);

    await waitFor(() => {
      expect(screen.getByText("דנה לוי")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "שחזור דנה לוי מהארכיון" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("לקוח לא נמצא");
    });
    // השורה נשארת כי השחזור נכשל
    expect(screen.getByText("דנה לוי")).toBeInTheDocument();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("ArchivedClientsView — כשל טעינה", () => {
  it("כשל טעינה → הודעת שגיאה + כפתור 'נסה שוב' שטוען מחדש", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) } as Response)
      .mockResolvedValueOnce(okList());

    render(<ArchivedClientsView />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/שגיאה בטעינת הארכיון/);
    });

    fireEvent.click(screen.getByRole("button", { name: "נסה שוב" }));

    await waitFor(() => {
      expect(screen.getByText("דנה לוי")).toBeInTheDocument();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("ArchivedClientsView — RTL ו-touch targets", () => {
  it("המכל בכיוון RTL וכפתור השחזור בעל touch target 44px", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okList());
    const { container, findByRole } = render(<ArchivedClientsView />);

    // כיוון RTL על המכל הראשי
    expect(container.querySelector("[dir='rtl']")).not.toBeNull();

    // המתנה לרינדור שורות ואז בדיקת touch target
    const btn = await findByRole("button", { name: "שחזור דנה לוי מהארכיון" });
    expect(btn.className).toContain("min-h-11");
  });
});
