/**
 * בדיקות ל-SignConsentForm — משימה 7.6 (FR-CF-04, FR-CF-05).
 *
 * בודק:
 * 1. מרנדר ללא קריסה.
 * 2. Canvas מרנדר כאשר יש שדה מסוג signature בשדות הטופס.
 * 3. כפתור שליחה מנוטרל בהתחלה כאשר יש checkbox נדרש (לא מסומן).
 * 4. לאחר סימון checkbox נדרש (ללא שדה חתימה) — כפתור שליחה פעיל.
 * 5. isMinor=true — שדות שם אפוטרופוס ומספר תעודת זהות גלויים.
 * 6. axe — ללא הפרות נגישות.
 *
 * הרצה: `npx vitest run components/consent/__tests__/SignConsentForm.test.tsx`
 */

import React from "react";
import { vi, describe, it, expect, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "jest-axe";

// מוק לנווט
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/sign",
}));

// מוק ל-Canvas API (jsdom אינו ממממש canvas)
beforeAll(() => {
  const mockCtx = {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "",
    lineJoin: "",
  };

  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => mockCtx
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  HTMLCanvasElement.prototype.toDataURL = vi.fn(
    () => "data:image/png;base64,test"
  );
});

import { SignConsentForm } from "@/components/consent/SignConsentForm";

// ---------------------------------------------------------------------------
// Props עזר
// ---------------------------------------------------------------------------

function baseProps(overrides: Partial<React.ComponentProps<typeof SignConsentForm>> = {}) {
  return {
    token: "test-token-123",
    signedConsentId: "consent-id-1",
    clientName: "מרים כהן",
    isMinor: false,
    fields: [],
    treatmentName: "הסרת שיער",
    signedAt: null,
    ...overrides,
  };
}

const REQUIRED_CHECKBOX_FIELD = {
  id: "cb-1",
  type: "checkbox" as const,
  label: "קראתי והסכמתי לתנאי הטיפול",
  required: true,
};

const SIGNATURE_FIELD = {
  id: "sig-1",
  type: "signature" as const,
  label: "חתימת הלקוח/ה",
  required: true,
};

// ---------------------------------------------------------------------------
// בדיקות — מרנדר בסיסי
// ---------------------------------------------------------------------------

describe("SignConsentForm — מרנדר בסיסי", () => {
  it("מרנדר ללא קריסה עם props מינימליים", () => {
    expect(() => render(<SignConsentForm {...baseProps()} />)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// בדיקות — שדה חתימה (canvas)
// ---------------------------------------------------------------------------

describe("SignConsentForm — שדה signature", () => {
  it("canvas מרנדר כאשר יש שדה מסוג signature בשדות", () => {
    render(<SignConsentForm {...baseProps({ fields: [SIGNATURE_FIELD] })} />);
    const canvas = document.querySelector("canvas");
    expect(canvas).not.toBeNull();
  });

  it("canvas אינו מרנדר כאשר אין שדה signature", () => {
    render(<SignConsentForm {...baseProps({ fields: [] })} />);
    const canvas = document.querySelector("canvas");
    expect(canvas).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// בדיקות — כפתור שליחה
// ---------------------------------------------------------------------------

describe("SignConsentForm — כפתור שליחה", () => {
  it("כפתור שליחה מנוטרל בהתחלה כאשר יש checkbox נדרש (לא מסומן)", () => {
    render(<SignConsentForm {...baseProps({ fields: [REQUIRED_CHECKBOX_FIELD] })} />);
    const submitButton = screen.getByRole("button", { name: "חתום על הטופס" });
    expect(submitButton).toBeDisabled();
  });

  it("כפתור שליחה פעיל לאחר סימון checkbox נדרש (ללא שדה חתימה)", () => {
    render(<SignConsentForm {...baseProps({ fields: [REQUIRED_CHECKBOX_FIELD] })} />);

    // סמן את ה-checkbox
    const checkbox = document.getElementById("field-cb-1") as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    fireEvent.click(checkbox);

    const submitButton = screen.getByRole("button", { name: "חתום על הטופס" });
    expect(submitButton).not.toBeDisabled();
  });

  it("כפתור שליחה מנוטרל כאשר יש שדה חתימה (ריק) גם אם כל ה-checkboxes מסומנים", () => {
    render(
      <SignConsentForm
        {...baseProps({ fields: [REQUIRED_CHECKBOX_FIELD, SIGNATURE_FIELD] })}
      />
    );

    // סמן את ה-checkbox
    const checkbox = document.getElementById("field-cb-1") as HTMLInputElement;
    fireEvent.click(checkbox);

    // כפתור עדיין מנוטרל כי לוח החתימה ריק
    const submitButton = screen.getByRole("button", { name: "חתום על הטופס" });
    expect(submitButton).toBeDisabled();
  });

  it("כפתור שליחה פעיל כאשר אין שדות נדרשים ואין שדה חתימה", () => {
    render(<SignConsentForm {...baseProps({ fields: [] })} />);
    const submitButton = screen.getByRole("button", { name: "חתום על הטופס" });
    expect(submitButton).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// בדיקות — שדות אפוטרופוס (isMinor)
// ---------------------------------------------------------------------------

describe("SignConsentForm — שדות אפוטרופוס", () => {
  it("isMinor=true — שדות שם אפוטרופוס ומספר תעודת זהות גלויים", () => {
    render(<SignConsentForm {...baseProps({ isMinor: true })} />);

    const guardianNameInput = document.getElementById("guardianName");
    expect(guardianNameInput).not.toBeNull();

    const guardianIdInput = document.getElementById("guardianIdNumber");
    expect(guardianIdInput).not.toBeNull();
  });

  it("isMinor=false — שדות אפוטרופוס אינם גלויים", () => {
    render(<SignConsentForm {...baseProps({ isMinor: false })} />);

    const guardianNameInput = document.getElementById("guardianName");
    expect(guardianNameInput).toBeNull();

    const guardianIdInput = document.getElementById("guardianIdNumber");
    expect(guardianIdInput).toBeNull();
  });

  it("isMinor=true — כפתור שליחה מנוטרל עד שמולאו שדות האפוטרופוס", () => {
    render(<SignConsentForm {...baseProps({ isMinor: true, fields: [] })} />);

    // ללא מילוי שדות האפוטרופוס — מנוטרל
    const submitButton = screen.getByRole("button", { name: "חתום על הטופס" });
    expect(submitButton).toBeDisabled();

    // מלא שדות אפוטרופוס
    const guardianNameInput = document.getElementById("guardianName") as HTMLInputElement;
    const guardianIdInput = document.getElementById("guardianIdNumber") as HTMLInputElement;

    fireEvent.change(guardianNameInput, { target: { value: "דוד כהן" } });
    fireEvent.change(guardianIdInput, { target: { value: "123456789" } });

    // כעת הכפתור פעיל
    expect(submitButton).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// בדיקות — נגישות axe
// ---------------------------------------------------------------------------

describe("SignConsentForm — נגישות axe", () => {
  it("axe — ללא הפרות נגישות (ללא שדות)", async () => {
    const { container } = render(<SignConsentForm {...baseProps()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("axe — ללא הפרות נגישות (עם שדות ו-isMinor)", async () => {
    const { container } = render(
      <SignConsentForm
        {...baseProps({
          isMinor: true,
          fields: [REQUIRED_CHECKBOX_FIELD, SIGNATURE_FIELD],
        })}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
