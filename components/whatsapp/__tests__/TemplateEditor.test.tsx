/**
 * בדיקות ל-TemplateEditor — משימה 6.8 (FR-WA-05).
 *
 * בודק:
 * 1. מרנדר בסיסי (מצב יצירה) — שדות שם, גוף, קטגוריה, שפה קיימים.
 * 2. תצוגה מקדימה — מופיעה עם body {name} ומחליפה {name} בערך לדוגמה "מג׳ידה".
 * 3. תצוגה מקדימה — {name} שאינו ב-SAMPLE_VALUES מוחלף ב-[custom].
 * 4. axe — ללא הפרות נגישות (מצב יצירה).
 *
 * הרצה: `npx vitest run components/whatsapp/__tests__/`
 */

import { vi, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";

// מוק לנווט — ל-Button ורכיבי שאד-cn ייתכן שייטענו next/navigation בעקיפין
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/settings/templates",
}));

import { TemplateEditor } from "@/components/whatsapp/TemplateEditor";

// ---------------------------------------------------------------------------
// נתוני עזר
// ---------------------------------------------------------------------------

/** props מינימליים לרינדור TemplateEditor במצב יצירה */
function minimalProps() {
  return {
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };
}

/** תבנית מדומה עם גוף הודעה לבדיקת תצוגה מקדימה */
const TEMPLATE_WITH_BODY = {
  id: "template-1",
  name: "appointment_confirmation",
  category: "UTILITY",
  body: "שלום {name}",
  variables: ["name"],
  approvedByMeta: false,
  language: "he",
  isActive: true,
  createdAt: "2026-11-07T10:00:00.000Z",
  updatedAt: "2026-11-07T10:00:00.000Z",
};

// ---------------------------------------------------------------------------
// בדיקות — מרנדר בסיסי (מצב יצירה)
// ---------------------------------------------------------------------------

describe("TemplateEditor — מרנדר בסיסי (מצב יצירה)", () => {
  it("מרנדר ללא קריסה עם props מינימליים", () => {
    expect(() => render(<TemplateEditor {...minimalProps()} />)).not.toThrow();
  });

  it("שדה שם (template-name) קיים עם label", () => {
    render(<TemplateEditor {...minimalProps()} />);
    // שדה השם מקבל id="template-name" במצב יצירה
    const nameInput = document.getElementById("template-name");
    expect(nameInput).not.toBeNull();
    expect(nameInput?.tagName.toLowerCase()).toBe("input");
  });

  it("שדה גוף ההודעה (textarea) קיים", () => {
    render(<TemplateEditor {...minimalProps()} />);
    const bodyField = document.getElementById("template-body");
    expect(bodyField).not.toBeNull();
    expect(bodyField?.tagName.toLowerCase()).toBe("textarea");
  });

  it("שדה קטגוריה (select) קיים עם אפשרויות UTILITY ו-MARKETING", () => {
    render(<TemplateEditor {...minimalProps()} />);
    const categorySelect = document.getElementById(
      "template-category"
    ) as HTMLSelectElement | null;
    expect(categorySelect).not.toBeNull();
    expect(categorySelect?.tagName.toLowerCase()).toBe("select");

    const options = Array.from(categorySelect!.options).map((o) => o.value);
    expect(options).toContain("UTILITY");
    expect(options).toContain("MARKETING");
  });

  it("שדה שפה (select) קיים עם אפשרויות he ו-ar", () => {
    render(<TemplateEditor {...minimalProps()} />);
    const langSelect = document.getElementById(
      "template-language"
    ) as HTMLSelectElement | null;
    expect(langSelect).not.toBeNull();
    expect(langSelect?.tagName.toLowerCase()).toBe("select");

    const options = Array.from(langSelect!.options).map((o) => o.value);
    expect(options).toContain("he");
    expect(options).toContain("ar");
  });

  it("כפתורי שמור וביטול קיימים", () => {
    render(<TemplateEditor {...minimalProps()} />);
    expect(screen.getByRole("button", { name: "שמור" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ביטול" })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// בדיקות — תצוגה מקדימה
// ---------------------------------------------------------------------------

describe("TemplateEditor — תצוגה מקדימה", () => {
  it("כאשר body ריק (מצב יצירה) — תצוגה מקדימה לא מוצגת", () => {
    render(<TemplateEditor {...minimalProps()} />);
    // תצוגה מקדימה מותנית ב-body.trim() !== ""
    expect(
      screen.queryByRole("region", { name: "תצוגה מקדימה של ההודעה" })
    ).toBeNull();
  });

  it("כאשר template עם body {name} ו-variables=['name'] — תצוגה מקדימה מחליפה {name} בערך דוגמה", () => {
    render(
      <TemplateEditor template={TEMPLATE_WITH_BODY} {...minimalProps()} />
    );

    const preview = screen.getByRole("region", {
      name: "תצוגה מקדימה של ההודעה",
    });
    expect(preview).toBeInTheDocument();

    // SAMPLE_VALUES.name = "מג׳ידה" — {name} מוחלף בערך זה
    expect(preview).toHaveTextContent("שלום מג׳ידה");
    // {name} הגולמי לא אמור להיות גלוי
    expect(preview).not.toHaveTextContent("{name}");
  });

  it("משתנה לא ב-SAMPLE_VALUES מוחלף ב-[custom]", () => {
    const customTemplate = {
      ...TEMPLATE_WITH_BODY,
      body: "הודעה {custom_var}",
      variables: ["custom_var"],
    };
    render(
      <TemplateEditor template={customTemplate} {...minimalProps()} />
    );

    const preview = screen.getByRole("region", {
      name: "תצוגה מקדימה של ההודעה",
    });
    expect(preview).toHaveTextContent("הודעה [custom_var]");
  });
});

// ---------------------------------------------------------------------------
// בדיקות — נגישות axe
// ---------------------------------------------------------------------------

describe("TemplateEditor — נגישות axe", () => {
  it("מצב יצירה (ללא template) — axe ללא הפרות נגישות", async () => {
    const { container } = render(<TemplateEditor {...minimalProps()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("מצב עריכה (עם template ו-body) — axe ללא הפרות נגישות", async () => {
    const { container } = render(
      <TemplateEditor template={TEMPLATE_WITH_BODY} {...minimalProps()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
