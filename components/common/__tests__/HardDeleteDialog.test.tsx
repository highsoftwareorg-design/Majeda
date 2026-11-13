/**
 * בדיקות ל-HardDeleteDialog — דיאלוג "מחיקה לצמיתות" המשותף (משימה 12.1, §12).
 *
 * בודק:
 * 1. מרנדר כותרת "מחיקה לצמיתות" והבהרה "פעולה בלתי הפיכה — לא ניתן לשחזר".
 * 2. מרנדר warningBody דינמי (פירוט cascade) שהקורא מעביר.
 * 3. כפתור המחיקה מנוטרל עד הקלדה מדויקת של confirmPhrase, ונפתח כשתואם.
 * 4. onConfirm נקרא רק לאחר הקלדה תואמת (לעולם לא כשהכפתור מנוטרל).
 * 5. בזמן submitting — השדה מנוטרל וסגירת הדיאלוג נמנעת.
 * 6. נגישות: תוכן עם role="alertdialog"; שגיאה עם role="alert"; axe נקי.
 * 7. עברית/RTL.
 *
 * הרצה: `npx vitest run components/common/__tests__/HardDeleteDialog.test.tsx`
 */

import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { axe } from "jest-axe";

import { HardDeleteDialog } from "@/components/common/HardDeleteDialog";

type Props = React.ComponentProps<typeof HardDeleteDialog>;

function baseProps(overrides: Partial<Props> = {}): Props {
  return {
    open: true,
    onOpenChange: vi.fn(),
    warningBody: <span>יימחקו גם 3 תורים ו-2 ביקורים</span>,
    confirmPhrase: "דנה כהן",
    onConfirm: vi.fn(),
    submitting: false,
    error: null,
    ...overrides,
  };
}

function getConfirmInput(): HTMLInputElement {
  return screen.getByRole("textbox") as HTMLInputElement;
}

function getDeleteButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: "מחק לצמיתות" }) as HTMLButtonElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("HardDeleteDialog — כותרת והבהרה", () => {
  it('מרנדר כותרת ברירת מחדל "מחיקה לצמיתות"', () => {
    render(<HardDeleteDialog {...baseProps()} />);
    expect(screen.getByText("מחיקה לצמיתות")).toBeInTheDocument();
  });

  it("מרנדר כותרת מותאמת כשמועברת", () => {
    render(<HardDeleteDialog {...baseProps({ title: "מחיקת טיפול לצמיתות" })} />);
    expect(screen.getByText("מחיקת טיפול לצמיתות")).toBeInTheDocument();
  });

  it('מרנדר את ההבהרה "פעולה בלתי הפיכה — לא ניתן לשחזר"', () => {
    render(<HardDeleteDialog {...baseProps()} />);
    expect(
      screen.getByText("פעולה בלתי הפיכה — לא ניתן לשחזר")
    ).toBeInTheDocument();
  });
});

describe("HardDeleteDialog — warningBody דינמי", () => {
  it("מרנדר את תוכן ה-cascade שהקורא מעביר", () => {
    render(
      <HardDeleteDialog
        {...baseProps({
          warningBody: <span>יימחקו גם 5 תורים, 4 ביקורים ו-1 טופס חתום</span>,
        })}
      />
    );
    expect(
      screen.getByText("יימחקו גם 5 תורים, 4 ביקורים ו-1 טופס חתום")
    ).toBeInTheDocument();
  });
});

describe("HardDeleteDialog — כפתור מחיקה ותנאי הקלדה", () => {
  it("כפתור המחיקה מנוטרל לפני הקלדה", () => {
    render(<HardDeleteDialog {...baseProps()} />);
    expect(getDeleteButton()).toBeDisabled();
  });

  it("כפתור המחיקה נשאר מנוטרל כשההקלדה אינה תואמת במדויק", () => {
    render(<HardDeleteDialog {...baseProps()} />);
    fireEvent.change(getConfirmInput(), { target: { value: "דנה" } });
    expect(getDeleteButton()).toBeDisabled();
  });

  it("כפתור המחיקה נפתח כשההקלדה תואמת במדויק את confirmPhrase", () => {
    render(<HardDeleteDialog {...baseProps()} />);
    fireEvent.change(getConfirmInput(), { target: { value: "דנה כהן" } });
    expect(getDeleteButton()).not.toBeDisabled();
  });

  it("confirmPhrase ריק משאיר את הכפתור נעול גם לאחר הקלדה", () => {
    render(<HardDeleteDialog {...baseProps({ confirmPhrase: "" })} />);
    fireEvent.change(getConfirmInput(), { target: { value: "" } });
    expect(getDeleteButton()).toBeDisabled();
  });
});

describe("HardDeleteDialog — onConfirm", () => {
  it("onConfirm אינו נקרא כשהכפתור מנוטרל (ללא הקלדה תואמת)", () => {
    const onConfirm = vi.fn();
    render(<HardDeleteDialog {...baseProps({ onConfirm })} />);
    fireEvent.click(getDeleteButton());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("onConfirm נקרא לאחר הקלדה תואמת ולחיצה על הכפתור", () => {
    const onConfirm = vi.fn();
    render(<HardDeleteDialog {...baseProps({ onConfirm })} />);
    fireEvent.change(getConfirmInput(), { target: { value: "דנה כהן" } });
    fireEvent.click(getDeleteButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("onConfirm אינו נקרא בזמן submitting גם אם קודם לכן הוקלד הטקסט התואם", () => {
    const onConfirm = vi.fn();
    // submitting=true מההתחלה — הכפתור מנוטרל ו-handleConfirm יוצא מוקדם.
    render(
      <HardDeleteDialog
        {...baseProps({ onConfirm, submitting: true })}
      />
    );
    // בזמן submitting טקסט הכפתור הוא "מוחק לצמיתות…" (ראו בדיקת "מצב submitting")
    fireEvent.click(screen.getByRole("button", { name: "מוחק לצמיתות…" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("HardDeleteDialog — מצב submitting", () => {
  it("שדה האישור מנוטרל בזמן submitting", () => {
    render(<HardDeleteDialog {...baseProps({ submitting: true })} />);
    expect(getConfirmInput()).toBeDisabled();
  });

  it('טקסט הכפתור מתחלף ל-"מוחק לצמיתות…" בזמן submitting', () => {
    render(<HardDeleteDialog {...baseProps({ submitting: true })} />);
    expect(
      screen.getByRole("button", { name: "מוחק לצמיתות…" })
    ).toBeInTheDocument();
  });

  it("סגירת הדיאלוג נמנעת בזמן submitting (Escape לא קורא ל-onOpenChange)", () => {
    const onOpenChange = vi.fn();
    render(
      <HardDeleteDialog {...baseProps({ submitting: true, onOpenChange })} />
    );
    fireEvent.keyDown(screen.getByRole("alertdialog"), {
      key: "Escape",
      code: "Escape",
    });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("כשאינו submitting — Escape קורא ל-onOpenChange(false)", () => {
    const onOpenChange = vi.fn();
    render(<HardDeleteDialog {...baseProps({ onOpenChange })} />);
    fireEvent.keyDown(screen.getByRole("alertdialog"), {
      key: "Escape",
      code: "Escape",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("HardDeleteDialog — נגישות", () => {
  it('לתוכן יש role="alertdialog"', () => {
    render(<HardDeleteDialog {...baseProps()} />);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it('הודעת שגיאה מרונדרת עם role="alert"', () => {
    render(
      <HardDeleteDialog {...baseProps({ error: "אירעה שגיאה בשרת" })} />
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("אירעה שגיאה בשרת");
  });

  it("אין הודעת alert כשאין שגיאה", () => {
    render(<HardDeleteDialog {...baseProps({ error: null })} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("axe — ללא הפרות נגישות", async () => {
    const { baseElement } = render(<HardDeleteDialog {...baseProps()} />);
    const results = await axe(baseElement);
    expect(results).toHaveNoViolations();
  });
});

describe("HardDeleteDialog — עברית/RTL ו-touch targets", () => {
  it("כפתורי ביטול ומחיקה בעלי touch target 44px", () => {
    render(<HardDeleteDialog {...baseProps()} />);
    expect(getDeleteButton().className).toContain("min-h-11");
    expect(
      screen.getByRole("button", { name: "ביטול" }).className
    ).toContain("min-h-11");
  });

  it("confirmPhrase מוצג בתוך אלמנט bdi (בידוד דו-כיווני לשם בעברית)", () => {
    const { baseElement } = render(<HardDeleteDialog {...baseProps()} />);
    const bdi = baseElement.querySelector("bdi");
    expect(bdi).not.toBeNull();
    expect(within(bdi as HTMLElement).getByText("דנה כהן")).toBeInTheDocument();
  });
});
