/**
 * בדיקות ל-HardDeleteAppointmentDialog — דיאלוג "מחיקה לצמיתות" לתור ביומן (משימה 12.4, §12).
 *
 * הרכיב מבוקר מבחוץ (controlled): `appointment={null}` ⇒ הדיאלוג סגור.
 * אין כפתור טריגר פנימי — היומן (WeeklyCalendar) מחזיק את ה-state ופותח דרך ה-prop.
 *
 * בודק:
 * 1. `appointment={null}` → הדיאלוג סגור (אין alertdialog).
 * 2. עם תור → דיאלוג אזהרה (role=alertdialog) עם שם הלקוח/ה, שם הטיפול ופירוט detach/cascade.
 * 3. כפתור "מחק לצמיתות" מנוטרל עד שמוקלד "מחק" (confirmPhrase לתור).
 * 4. אישור → DELETE /api/appointments/:id, ואז onDeleted(id) + onClose().
 * 5. כשל → הודעת שגיאה עברית, בלי קריאה ל-onDeleted/onClose.
 * 6. touch targets 44px לכפתורי האישור/ביטול.
 *
 * הערה: אין ספריית toast בפרויקט — אין אימות הודעת הצלחה (עקבי עם 12.2/12.3).
 *
 * הרצה: `npx vitest run components/calendar/__tests__/HardDeleteAppointmentDialog.test.tsx`
 */

import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import {
  HardDeleteAppointmentDialog,
  type HardDeleteAppointmentTarget,
} from "@/components/calendar/HardDeleteAppointmentDialog";

const APPOINTMENT: HardDeleteAppointmentTarget = {
  id: "apt-1",
  client: { firstName: "דנה", lastName: "כהן" },
  treatment: { name: "בוטוקס" },
  startTime: "2026-11-20T09:00:00",
};

const CONFIRM_PHRASE = "מחק";

function renderDialog(
  overrides: Partial<{
    appointment: HardDeleteAppointmentTarget | null;
    onClose: () => void;
    onDeleted: (id: string) => void;
  }> = {}
) {
  const onClose = overrides.onClose ?? vi.fn();
  const onDeleted = overrides.onDeleted ?? vi.fn();
  render(
    <HardDeleteAppointmentDialog
      appointment={
        overrides.appointment === undefined ? APPOINTMENT : overrides.appointment
      }
      onClose={onClose}
      onDeleted={onDeleted}
    />
  );
  return { onClose, onDeleted };
}

/** מקליד/ה את מחרוזת האישור בשדה שבתוך הדיאלוג. */
function typeConfirmPhrase(value: string) {
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value } });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HardDeleteAppointmentDialog — פתיחה/סגירה מבוקרת", () => {
  it("appointment=null → הדיאלוג סגור", () => {
    renderDialog({ appointment: null });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("עם תור → דיאלוג אזהרה עם שם הלקוח/ה, שם הטיפול ופירוט detach/cascade", () => {
    renderDialog();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(/פעולה בלתי הפיכה/)).toBeInTheDocument();
    // שם הלקוח/ה ושם הטיפול מופיעים באזהרה
    expect(screen.getByText(/דנה כהן/)).toBeInTheDocument();
    expect(screen.getByText(/בוטוקס/)).toBeInTheDocument();
    // היסטוריית הסטטוס/דריסות ההסכמה יימחקו; טפסים חתומים ינותקו ויישמרו
    expect(
      screen.getByText(/היסטוריית הסטטוס ודריסות ההסכמה/)
    ).toBeInTheDocument();
    expect(screen.getByText(/טפסים חתומים\s*ינותקו ויישמרו/)).toBeInTheDocument();
  });
});

describe("HardDeleteAppointmentDialog — אישור בהקלדת 'מחק'", () => {
  it('כפתור "מחק לצמיתות" מנוטרל עד הקלדת מילת האישור', () => {
    renderDialog();

    const confirmBtn = screen.getByRole("button", { name: "מחק לצמיתות" });
    expect(confirmBtn).toBeDisabled();

    // הקלדה חלקית — עדיין מנוטרל
    typeConfirmPhrase("מח");
    expect(confirmBtn).toBeDisabled();

    // מילת האישור המלאה — מופעל
    typeConfirmPhrase(CONFIRM_PHRASE);
    expect(confirmBtn).toBeEnabled();
  });
});

describe("HardDeleteAppointmentDialog — ביצוע מחיקה", () => {
  it("אישור שולח DELETE לנתיב התור ואז קורא ל-onDeleted + onClose", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as Response);

    const { onDeleted, onClose } = renderDialog();
    typeConfirmPhrase(CONFIRM_PHRASE);
    fireEvent.click(screen.getByRole("button", { name: "מחק לצמיתות" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/appointments/apt-1");
    expect(init.method).toBe("DELETE");

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledWith("apt-1");
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("כשל → מציג הודעת שגיאה עברית ואינו קורא ל-onDeleted/onClose", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "אירעה שגיאה במחיקה לצמיתות" }),
    } as Response);

    const { onDeleted, onClose } = renderDialog();
    typeConfirmPhrase(CONFIRM_PHRASE);
    fireEvent.click(screen.getByRole("button", { name: "מחק לצמיתות" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "אירעה שגיאה במחיקה לצמיתות"
      );
    });
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("HardDeleteAppointmentDialog — touch targets", () => {
  it("כפתורי האישור והביטול בעלי touch target 44px", () => {
    renderDialog();
    expect(
      screen.getByRole("button", { name: "מחק לצמיתות" }).className
    ).toContain("min-h-11");
    expect(
      screen.getByRole("button", { name: "ביטול" }).className
    ).toContain("min-h-11");
  });
});
