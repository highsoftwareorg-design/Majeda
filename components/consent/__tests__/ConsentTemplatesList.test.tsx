/**
 * בדיקות ל-ConsentTemplatesList — כולל פעולת "מחיקה לצמיתות" לתבנית הסכמה (משימה 12.5, §12).
 *
 * ה-list מטמיע את `HardDeleteDialog` המשותף (12.1) ומבצע
 * `DELETE /api/consent-templates/:id/hard-delete`; לאחר הצלחה טוען מחדש את הרשימה
 * (`GET /api/consent-templates`), ללא ניווט (אין toast בפרויקט — עקבי עם 12.2–12.4).
 *
 * בודק:
 * 1. כפתור "מחיקה לצמיתות" מרונדר לכל שורה (touch target 44px, aria-label עם שם התבנית), הדיאלוג סגור.
 * 2. לחיצה פותחת דיאלוג אזהרה (role=alertdialog) עם שם התבנית ואזהרת המחיקה המודגשת.
 * 3. כפתור "מחק לצמיתות" מנוטרל עד שמוקלד שם התבנית המלא (confirmPhrase).
 * 4. אישור → DELETE לנתיב hard-delete, ואז טעינה מחודשת (GET /api/consent-templates).
 * 5. כשל → הודעת שגיאה עברית בתוך הדיאלוג, בלי טעינה מחודשת.
 *
 * הרצה: `npx vitest run components/consent/__tests__/ConsentTemplatesList.test.tsx`
 */

import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { ConsentTemplatesList } from "@/components/consent/ConsentTemplatesList";
import type { ConsentTemplateData } from "@/components/consent/ConsentTemplateEditor";

const TEMPLATE: ConsentTemplateData = {
  id: "tpl-1",
  name: "הסכמה לבוטוקס",
  isGeneral: false,
  treatmentIds: [],
  validityDays: 365,
  language: "he",
  version: 2,
  isActive: true,
  fields: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderList(templates: ConsentTemplateData[] = [TEMPLATE]) {
  return render(<ConsentTemplatesList initialTemplates={templates} />);
}

function openHardDeleteDialog(name = TEMPLATE.name) {
  fireEvent.click(
    screen.getByRole("button", { name: `מחיקה לצמיתות של תבנית ${name}` })
  );
}

/** מקליד/ה את מחרוזת האישור בשדה שבתוך הדיאלוג. */
function typeConfirmPhrase(value: string) {
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value } });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ConsentTemplatesList — כפתור מחיקה לצמיתות ופתיחה", () => {
  it('מרנדר כפתור "מחיקה לצמיתות" לכל שורה עם touch target 44px', () => {
    renderList();
    const trigger = screen.getByRole("button", {
      name: `מחיקה לצמיתות של תבנית ${TEMPLATE.name}`,
    });
    expect(trigger).toBeInTheDocument();
    expect(trigger.className).toContain("min-h-11");
  });

  it("הדיאלוג סגור לפני לחיצה", () => {
    renderList();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("לחיצה פותחת דיאלוג אזהרה עם שם התבנית ואזהרת המחיקה המודגשת", () => {
    renderList();
    openHardDeleteDialog();

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(/פעולה בלתי הפיכה/)).toBeInTheDocument();
    // האזהרה המודגשת הנדרשת ב-PLAN 12.5
    expect(
      screen.getByText(/כל הטפסים החתומים המבוססים על תבנית זו יימחקו לצמיתות/)
    ).toBeInTheDocument();
    // שם התבנית מופיע באזהרה וגם בתווית ההקלדה — getAllByText כדי לא לזרוק
    expect(
      screen.getAllByText(new RegExp(TEMPLATE.name)).length
    ).toBeGreaterThan(0);
  });
});

describe("ConsentTemplatesList — אישור בהקלדת שם", () => {
  it('כפתור "מחק לצמיתות" מנוטרל עד הקלדת שם התבנית המלא', () => {
    renderList();
    openHardDeleteDialog();

    const confirmBtn = screen.getByRole("button", { name: "מחק לצמיתות" });
    expect(confirmBtn).toBeDisabled();

    // הקלדה חלקית — עדיין מנוטרל
    typeConfirmPhrase("הסכמה");
    expect(confirmBtn).toBeDisabled();

    // השם המלא — מופעל
    typeConfirmPhrase(TEMPLATE.name);
    expect(confirmBtn).toBeEnabled();
  });
});

describe("ConsentTemplatesList — ביצוע מחיקה לצמיתות", () => {
  it("אישור שולח DELETE לנתיב hard-delete ואז טוען מחדש את הרשימה", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/hard-delete")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, orphanedPdfKeys: [] }),
          } as Response;
        }
        // טעינה מחודשת של הרשימה
        return {
          ok: true,
          status: 200,
          json: async () => ({ templates: [] }),
        } as Response;
      });

    renderList();
    openHardDeleteDialog();
    typeConfirmPhrase(TEMPLATE.name);
    fireEvent.click(screen.getByRole("button", { name: "מחק לצמיתות" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    // הקריאה הראשונה — DELETE לנתיב hard-delete של התבנית
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe("/api/consent-templates/tpl-1/hard-delete");
    expect(init.method).toBe("DELETE");

    // לאחר הצלחה — טעינה מחודשת של הרשימה, כולל לא-פעילות (GET ?includeInactive=1)
    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some(
          ([u]) => String(u) === "/api/consent-templates?includeInactive=1"
        )
      ).toBe(true);
    });
  });

  it("תבנית לא-פעילה (מחיקה רכה) — מוצגת עם 'לא פעיל' ורק 'מחיקה לצמיתות' זמינה", () => {
    const inactive: ConsentTemplateData = {
      ...TEMPLATE,
      id: "tpl-2",
      name: "תבנית ישנה",
      isActive: false,
    };
    renderList([TEMPLATE, inactive]);

    expect(screen.getByText("לא פעיל")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "מחיקה לצמיתות של תבנית תבנית ישנה" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "ערוך תבנית תבנית ישנה" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "מחק תבנית תבנית ישנה" })
    ).not.toBeInTheDocument();

    // התבנית הפעילה עדיין עם כל הפעולות
    expect(
      screen.getByRole("button", { name: `ערוך תבנית ${TEMPLATE.name}` })
    ).toBeInTheDocument();
  });

  it("כשל → מציג הודעת שגיאה עברית בדיאלוג ואינו טוען מחדש", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "אירעה שגיאה במחיקה לצמיתות" }),
    } as Response);

    renderList();
    openHardDeleteDialog();
    typeConfirmPhrase(TEMPLATE.name);
    fireEvent.click(screen.getByRole("button", { name: "מחק לצמיתות" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "אירעה שגיאה במחיקה לצמיתות"
      );
    });

    // רק קריאת ה-DELETE בוצעה — אין טעינה מחודשת (GET) לאחר כשל
    expect(
      fetchSpy.mock.calls.every(([u]) =>
        String(u).endsWith("/hard-delete")
      )
    ).toBe(true);
  });
});
