/**
 * בדיקות ל-ArchiveClientDialog — דיאלוג "העברה לארכיון" (משימה 11.6, FR-CL-01, §11.2).
 *
 * בודק:
 * 1. כפתור "העברה לארכיון" מרונדר (touch target 44px), הדיאלוג סגור בהתחלה.
 * 2. לחיצה פותחת דיאלוג אישור עם שם הלקוח/ה והבהרה שאין מחיקה לצמיתות.
 * 3. אישור → DELETE /api/clients/:id (מחיקה רכה), ואז ניווט ל-/clients + refresh.
 * 4. כשל DELETE → הודעת שגיאה עברית, בלי ניווט.
 * 5. RTL ו-touch targets.
 *
 * הרצה: `npx vitest run components/clients/__tests__/ArchiveClientDialog.test.tsx`
 */

import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

import { ArchiveClientDialog } from "@/components/clients/ArchiveClientDialog";

const CLIENT = { id: "client-1", firstName: "דנה", lastName: "כהן" };

function renderDialog() {
  return render(<ArchiveClientDialog client={CLIENT} />);
}

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "העברה לארכיון" }));
}

beforeEach(() => {
  mockPush.mockReset();
  mockRefresh.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ArchiveClientDialog — כפתור ופתיחה", () => {
  it('מרנדר כפתור "העברה לארכיון" עם touch target 44px', () => {
    renderDialog();
    const trigger = screen.getByRole("button", { name: "העברה לארכיון" });
    expect(trigger).toBeInTheDocument();
    expect(trigger.className).toContain("min-h-11");
  });

  it("הדיאלוג סגור לפני לחיצה", () => {
    renderDialog();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("לחיצה פותחת דיאלוג אישור עם שם הלקוח/ה והבהרה שאין מחיקה לצמיתות", () => {
    renderDialog();
    openDialog();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/דנה כהן/)).toBeInTheDocument();
    expect(screen.getByText(/זו אינה מחיקה לצמיתות/)).toBeInTheDocument();
    // כפתור אישור וכפתור ביטול קיימים
    expect(screen.getByRole("button", { name: "העבר לארכיון" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ביטול" })).toBeInTheDocument();
  });
});

describe("ArchiveClientDialog — אישור ארכוב", () => {
  it("אישור שולח DELETE /api/clients/:id ואז מנווט ל-/clients + refresh", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ client: { id: "client-1", status: "archived" } }),
    } as Response);

    renderDialog();
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: "העבר לארכיון" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/clients/client-1");
    expect(init.method).toBe("DELETE");

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/clients");
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("כשל DELETE → מציג הודעת שגיאה עברית ואינו מנווט", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "אירעה שגיאה בשרת" }),
    } as Response);

    renderDialog();
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: "העבר לארכיון" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("אירעה שגיאה בשרת");
    });
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("ArchiveClientDialog — RTL ו-touch targets", () => {
  it("כפתורי האישור והביטול בעלי touch target 44px", () => {
    renderDialog();
    openDialog();
    expect(screen.getByRole("button", { name: "העבר לארכיון" }).className).toContain("min-h-11");
    expect(screen.getByRole("button", { name: "ביטול" }).className).toContain("min-h-11");
  });
});
