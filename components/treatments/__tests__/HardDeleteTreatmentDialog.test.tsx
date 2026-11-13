/**
 * בדיקות ל-HardDeleteTreatmentDialog — דיאלוג "מחיקה לצמיתות" לטיפול (משימה 12.3, §12).
 *
 * בודק:
 * 1. כפתור "מחיקה לצמיתות" מרונדר (touch target 44px, aria-label עם שם הטיפול), הדיאלוג סגור.
 * 2. לחיצה פותחת דיאלוג אזהרה (role=alertdialog) עם שם הטיפול ופירוט ה-detach/cascade.
 * 3. כפתור "מחק לצמיתות" מנוטרל עד שמוקלד שם הטיפול המלא (confirmPhrase).
 * 4. אישור → DELETE /api/treatments/:id, ואז ניווט ל-/treatments + refresh.
 * 5. כשל → הודעת שגיאה עברית, בלי ניווט.
 * 6. touch targets של כפתורי האישור/ביטול.
 *
 * הערה: אין ספריית toast בפרויקט — אין אימות הודעת הצלחה (עקבי עם 12.2).
 *
 * הרצה: `npx vitest run components/treatments/__tests__/HardDeleteTreatmentDialog.test.tsx`
 */

import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

import { HardDeleteTreatmentDialog } from "@/components/treatments/HardDeleteTreatmentDialog";

const TREATMENT = { id: "treat-1", name: "בוטוקס" };

function renderDialog() {
  return render(<HardDeleteTreatmentDialog treatment={TREATMENT} />);
}

function openDialog() {
  fireEvent.click(
    screen.getByRole("button", { name: `מחיקה לצמיתות של ${TREATMENT.name}` })
  );
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

describe("HardDeleteTreatmentDialog — כפתור ופתיחה", () => {
  it('מרנדר כפתור "מחיקה לצמיתות" עם touch target 44px', () => {
    renderDialog();
    const trigger = screen.getByRole("button", {
      name: `מחיקה לצמיתות של ${TREATMENT.name}`,
    });
    expect(trigger).toBeInTheDocument();
    expect(trigger.className).toContain("min-h-11");
  });

  it("הדיאלוג סגור לפני לחיצה", () => {
    renderDialog();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("לחיצה פותחת דיאלוג אזהרה עם שם הטיפול ופירוט detach/cascade", () => {
    renderDialog();
    openDialog();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(/פעולה בלתי הפיכה/)).toBeInTheDocument();
    // שם הטיפול מופיע באזהרה וגם בתווית ההקלדה — getAllByText כדי לא לזרוק
    expect(
      screen.getAllByText(new RegExp(TREATMENT.name)).length
    ).toBeGreaterThan(0);
    // התורים/בקשות מנותקים (לא נמחקים)
    expect(screen.getByText(/ינותקו \(לא יימחקו\)/)).toBeInTheDocument();
    expect(screen.getByText(/כללי המעקב של הטיפול יימחקו/)).toBeInTheDocument();
    expect(
      screen.getByText(/פריטי הטיפול בביקורים היסטוריים יימחקו/)
    ).toBeInTheDocument();
  });
});

describe("HardDeleteTreatmentDialog — אישור בהקלדת שם", () => {
  it('כפתור "מחק לצמיתות" מנוטרל עד הקלדת שם הטיפול המלא', () => {
    renderDialog();
    openDialog();

    const confirmBtn = screen.getByRole("button", { name: "מחק לצמיתות" });
    expect(confirmBtn).toBeDisabled();

    // הקלדה חלקית — עדיין מנוטרל
    typeConfirmPhrase("בוט");
    expect(confirmBtn).toBeDisabled();

    // השם המלא — מופעל
    typeConfirmPhrase(TREATMENT.name);
    expect(confirmBtn).toBeEnabled();
  });
});

describe("HardDeleteTreatmentDialog — ביצוע מחיקה", () => {
  it("אישור שולח DELETE לנתיב הטיפול ואז מנווט ל-/treatments + refresh", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as Response);

    renderDialog();
    openDialog();
    typeConfirmPhrase(TREATMENT.name);
    fireEvent.click(screen.getByRole("button", { name: "מחק לצמיתות" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/treatments/treat-1");
    expect(init.method).toBe("DELETE");

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/treatments");
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
    typeConfirmPhrase(TREATMENT.name);
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

describe("HardDeleteTreatmentDialog — touch targets", () => {
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
