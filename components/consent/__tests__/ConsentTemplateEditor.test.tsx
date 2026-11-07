/**
 * בדיקות ל-ConsentTemplateEditor — משימה 7.2 (FR-CF-01, FR-CF-02).
 *
 * בודק:
 * 1. מרנדר ללא קריסה עם props מינימליים.
 * 2. שדה שם (input[type=text]#ct-name) קיים.
 * 3. בחירת שפה (select#ct-language) קיימת עם אפשרויות he / ar.
 * 4. תיבת סימון isGeneral (input[type=checkbox]#ct-is-general) קיימת.
 * 5. fieldset שדות הטופס קיים.
 * 6. לחיצה על "הוסף שדה" מוסיפה שורת שדה חדשה.
 * 7. axe — ללא הפרות נגישות (מצב יצירה).
 *
 * הרצה: `npx vitest run components/consent/__tests__/ConsentTemplateEditor.test.tsx`
 */

import { vi, describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "jest-axe";

// מוק לנווט — shadcn Button עשוי לטעון next/navigation בעקיפין
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/consent-templates",
}));

import { ConsentTemplateEditor } from "@/components/consent/ConsentTemplateEditor";

// ---------------------------------------------------------------------------
// עזרים
// ---------------------------------------------------------------------------

function minimalProps() {
  return {
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };
}

/** תבנית מדומה לבדיקות מצב עריכה */
const EXISTING_TEMPLATE = {
  id: "template-1",
  name: "טופס הסכמה כללי",
  isGeneral: true,
  treatmentIds: ["treat-1", "treat-2"],
  validityDays: 365,
  language: "he",
  version: 1,
  isActive: true,
  fields: [
    { id: "f1", type: "checkbox" as const, label: "קראתי והסכמתי", required: true },
  ],
  createdAt: "2026-11-07T10:00:00.000Z",
  updatedAt: "2026-11-07T10:00:00.000Z",
};

// ---------------------------------------------------------------------------
// בדיקות — מרנדר בסיסי (מצב יצירה)
// ---------------------------------------------------------------------------

describe("ConsentTemplateEditor — מרנדר בסיסי (מצב יצירה)", () => {
  it("מרנדר ללא קריסה עם props מינימליים", () => {
    expect(() =>
      render(<ConsentTemplateEditor {...minimalProps()} />)
    ).not.toThrow();
  });

  it("שדה שם התבנית (input#ct-name) קיים מסוג text", () => {
    render(<ConsentTemplateEditor {...minimalProps()} />);
    const nameInput = document.getElementById("ct-name") as HTMLInputElement | null;
    expect(nameInput).not.toBeNull();
    expect(nameInput?.tagName.toLowerCase()).toBe("input");
    expect(nameInput?.type).toBe("text");
  });

  it("בחירת שפה (select#ct-language) קיימת עם אפשרויות he ו-ar", () => {
    render(<ConsentTemplateEditor {...minimalProps()} />);
    const langSelect = document.getElementById(
      "ct-language"
    ) as HTMLSelectElement | null;
    expect(langSelect).not.toBeNull();
    expect(langSelect?.tagName.toLowerCase()).toBe("select");

    const options = Array.from(langSelect!.options).map((o) => o.value);
    expect(options).toContain("he");
    expect(options).toContain("ar");
  });

  it("תיבת סימון טופס כללי (input[type=checkbox]#ct-is-general) קיימת", () => {
    render(<ConsentTemplateEditor {...minimalProps()} />);
    const checkbox = document.getElementById(
      "ct-is-general"
    ) as HTMLInputElement | null;
    expect(checkbox).not.toBeNull();
    expect(checkbox?.type).toBe("checkbox");
  });

  it("fieldset שדות הטופס קיים עם legend עברי", () => {
    render(<ConsentTemplateEditor {...minimalProps()} />);
    const fieldset = document.querySelector("fieldset");
    expect(fieldset).not.toBeNull();
    const legend = fieldset?.querySelector("legend");
    expect(legend).not.toBeNull();
    expect(legend?.textContent).toContain("שדות הטופס");
  });

  it("כפתורי שמור וביטול קיימים", () => {
    render(<ConsentTemplateEditor {...minimalProps()} />);
    expect(screen.getByRole("button", { name: "שמור" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ביטול" })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// בדיקות — לחיצה על "הוסף שדה"
// ---------------------------------------------------------------------------

describe("ConsentTemplateEditor — הוספת שדה", () => {
  it('לחיצה על "הוסף שדה" מוסיפה שורת שדה חדשה', () => {
    render(<ConsentTemplateEditor {...minimalProps()} />);

    // לפני לחיצה: אין שדות (ב-fieldset)
    const selectsBefore = document.querySelectorAll('select[id^="field-type-"]');
    expect(selectsBefore).toHaveLength(0);

    // לחיצה על "+ הוסף שדה"
    const addButton = screen.getByRole("button", { name: /הוסף שדה/ });
    fireEvent.click(addButton);

    // לאחר לחיצה: שורת שדה אחת נוספה
    const selectsAfter = document.querySelectorAll('select[id^="field-type-"]');
    expect(selectsAfter).toHaveLength(1);
  });

  it('לחיצה פעמיים על "הוסף שדה" מוסיפה שתי שורות', () => {
    render(<ConsentTemplateEditor {...minimalProps()} />);

    const addButton = screen.getByRole("button", { name: /הוסף שדה/ });
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    const selects = document.querySelectorAll('select[id^="field-type-"]');
    expect(selects).toHaveLength(2);
  });

  it("לחיצה על הסר שדה מסירה את השורה", () => {
    render(<ConsentTemplateEditor {...minimalProps()} />);

    // הוסף שדה
    const addButton = screen.getByRole("button", { name: /הוסף שדה/ });
    fireEvent.click(addButton);

    // ודא שנוספה שורה
    expect(document.querySelectorAll('select[id^="field-type-"]')).toHaveLength(1);

    // לחץ על הסר
    const removeButton = screen.getByRole("button", { name: /הסר שדה/ });
    fireEvent.click(removeButton);

    // ודא שהוסרה
    expect(document.querySelectorAll('select[id^="field-type-"]')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// בדיקות — מצב עריכה (template קיים)
// ---------------------------------------------------------------------------

describe("ConsentTemplateEditor — מצב עריכה", () => {
  it("שדה השם מאוכלס עם ערך קיים", () => {
    render(<ConsentTemplateEditor template={EXISTING_TEMPLATE} {...minimalProps()} />);
    const nameInput = document.getElementById("ct-name") as HTMLInputElement;
    expect(nameInput.value).toBe("טופס הסכמה כללי");
  });

  it("שדות קיימים מוצגים ברינדור ראשוני", () => {
    render(<ConsentTemplateEditor template={EXISTING_TEMPLATE} {...minimalProps()} />);
    // תבנית קיימת עם שדה אחד
    const selects = document.querySelectorAll('select[id^="field-type-"]');
    expect(selects).toHaveLength(1);
  });

  it("isGeneral מאוכלס מה-template", () => {
    render(<ConsentTemplateEditor template={EXISTING_TEMPLATE} {...minimalProps()} />);
    const checkbox = document.getElementById("ct-is-general") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// בדיקות — נגישות axe
// ---------------------------------------------------------------------------

describe("ConsentTemplateEditor — נגישות axe", () => {
  it("מצב יצירה (ללא template) — axe ללא הפרות נגישות", async () => {
    const { container } = render(<ConsentTemplateEditor {...minimalProps()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("מצב עריכה (עם template ושדות) — axe ללא הפרות נגישות", async () => {
    const { container } = render(
      <ConsentTemplateEditor template={EXISTING_TEMPLATE} {...minimalProps()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
