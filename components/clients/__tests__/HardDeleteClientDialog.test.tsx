/**
 * בדיקות ל-HardDeleteClientDialog — דיאלוג "מחיקה לצמיתות" ללקוח/ה (משימה 12.2, §12).
 *
 * בודק:
 * 1. כפתור "מחיקה לצמיתות" מרונדר (touch target 44px), הדיאלוג סגור בהתחלה.
 * 2. לחיצה פותחת דיאלוג אזהרה אדום (role=alertdialog) עם שם הלקוח/ה ופירוט ה-cascade.
 * 3. כפתור "מחק לצמיתות" מנוטרל עד שמוקלד שם הלקוח/ה המלא (confirmPhrase).
 * 4. אישור → DELETE /api/clients/:id/hard-delete, ואז ניווט ל-/clients + refresh.
 * 5. כשל → הודעת שגיאה עברית, בלי ניווט.
 * 6. RTL ו-touch targets.
 *
 * הרצה: `npx vitest run components/clients/__tests__/HardDeleteClientDialog.test.tsx`
 */

import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

import { HardDeleteClientDialog } from "@/components/clients/HardDeleteClientDialog";

const CLIENT = { id: "client-1", firstName: "דנה", lastName: "כהן" };
const FULL_NAME = "דנה כהן";

function renderDialog() {
  return render(<HardDeleteClientDialog client={CLIENT} />);
}

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "מחיקה לצמיתות" }));
}

/** מקליד/ה את מחרוזת האישור בשדה שבתוך הדיאלוג. */
function typeConfirmPhrase(value: string) {
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value } });
}

beforeEach(() => {
  mockPush.mockReset();
  mockRefresh.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HardDeleteClientDialog — כפתור ופתיחה", () => {
  it('מרנדר כפתור "מחיקה לצמיתות" עם touch target 44px', () => {
    renderDialog();
    const trigger = screen.getByRole("button", { name: "מחיקה לצמיתות" });
    expect(trigger).toBeInTheDocument();
    expect(trigger.className).toContain("min-h-11");
  });

  it("הדיאלוג סגור לפני לחיצה", () => {
    renderDialog();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("לחיצה פותחת דיאלוג אזהרה עם שם הלקוח/ה ופירוט cascade", () => {
    renderDialog();
    openDialog();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(/פעולה בלתי הפיכה/)).toBeInTheDocument();
    // השם המלא מופיע גם באזהרה וגם בתווית ההקלדה — getAllByText כדי לא לזרוק
    expect(screen.getAllByText(new RegExp(FULL_NAME)).length).toBeGreaterThan(0);
    expect(screen.getByText(/כל התורים/)).toBeInTheDocument();
    expect(screen.getByText(/הטפסים החתומים/)).toBeInTheDocument();
  });
});

describe("HardDeleteClientDialog — אישור בהקלדת שם", () => {
  it('כפתור "מחק לצמיתות" מנוטרל עד הקלדת השם המלא', () => {
    renderDialog();
    openDialog();

    const confirmBtn = screen.getByRole("button", { name: "מחק לצמיתות" });
    expect(confirmBtn).toBeDisabled();

    // הקלדה חלקית — עדיין מנוטרל
    typeConfirmPhrase("דנה");
    expect(confirmBtn).toBeDisabled();

    // השם המלא — מופעל
    typeConfirmPhrase(FULL_NAME);
    expect(confirmBtn).toBeEnabled();
  });
});

describe("HardDeleteClientDialog — ביצוע מחיקה", () => {
  it("אישור שולח DELETE לנתיב hard-delete ואז מנווט ל-/clients + refresh", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, orphanedPdfKeys: [] }),
    } as Response);

    renderDialog();
    openDialog();
    typeConfirmPhrase(FULL_NAME);
    fireEvent.click(screen.getByRole("button", { name: "מחק לצמיתות" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/clients/client-1/hard-delete");
    expect(init.method).toBe("DELETE");

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/clients");
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("כשל → מציג הודעת שגיאה עברית ואינו מנווט", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "אירעה שגיאה במחיקה לצמיתות" }),
    } as Response);

    renderDialog();
    openDialog();
    typeConfirmPhrase(FULL_NAME);
    fireEvent.click(screen.getByRole("button", { name: "מחק לצמיתות" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "אירעה שגיאה במחיקה לצמיתות"
      );
    });
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("HardDeleteClientDialog — RTL ו-touch targets", () => {
  it("כפתורי האישור והביטול בעלי touch target 44px", () => {
    renderDialog();
    openDialog();
    expect(
      screen.getByRole("button", { name: "מחק לצמיתות" }).className
    ).toContain("min-h-11");
    expect(
      screen.getByRole("button", { name: "ביטול" }).className
    ).toContain("min-h-11");
  });
});
