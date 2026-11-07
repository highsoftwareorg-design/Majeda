/**
 * בדיקות ל-FollowUpRuleEditor — משימה 8.2 (FR-FU-01).
 *
 * בודק:
 * 1. מרנדר ללא קריסה.
 * 2. יש שדה name, שדה offsetDays ו-select של recipientType.
 * 3. axe → 0 violations.
 *
 * הרצה: `npx vitest run components/followups/__tests__/FollowUpRuleEditor.test.tsx`
 */

import { vi, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";

// מוק next/navigation למקרה שייטען בעקיפין
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/treatments/treat-1",
}));

import { FollowUpRuleEditor } from "@/components/followups/FollowUpRuleEditor";

// --- עזרים ---

const DEFAULT_PROPS = {
  treatmentId: "treat-1",
  onSave: vi.fn(),
  onCancel: vi.fn(),
};

// --- בדיקות ---

describe("FollowUpRuleEditor — רינדור", () => {
  it("מרנדר ללא קריסה", () => {
    expect(() => render(<FollowUpRuleEditor {...DEFAULT_PROPS} />)).not.toThrow();
  });

  it("מרנדר טופס עם aria-label בעברית", () => {
    render(<FollowUpRuleEditor {...DEFAULT_PROPS} />);
    const form = document.querySelector("form");
    expect(form).not.toBeNull();
    expect(form?.getAttribute("aria-label")).toBe("טופס כלל מעקב");
  });
});

describe("FollowUpRuleEditor — שדות הטופס", () => {
  it("יש שדה name (input[type=text]) עם label מתאים", () => {
    render(<FollowUpRuleEditor {...DEFAULT_PROPS} />);
    // מחפש את ה-input לפי id
    const nameInput = document.getElementById("fu-name") as HTMLInputElement | null;
    expect(nameInput).not.toBeNull();
    expect(nameInput?.tagName.toLowerCase()).toBe("input");
    expect(nameInput?.type).toBe("text");
  });

  it("יש שדה offsetDays (input[type=number]) עם min=0", () => {
    render(<FollowUpRuleEditor {...DEFAULT_PROPS} />);
    const offsetInput = document.getElementById("fu-offset") as HTMLInputElement | null;
    expect(offsetInput).not.toBeNull();
    expect(offsetInput?.type).toBe("number");
    expect(Number(offsetInput?.min)).toBe(0);
  });

  it("יש select של recipientType עם 3 אפשרויות (client, admin, both)", () => {
    render(<FollowUpRuleEditor {...DEFAULT_PROPS} />);
    const select = document.getElementById("fu-recipient") as HTMLSelectElement | null;
    expect(select).not.toBeNull();
    const options = Array.from(select?.options ?? []).map((o) => o.value);
    expect(options).toContain("client");
    expect(options).toContain("admin");
    expect(options).toContain("both");
  });

  it("ברירת המחדל של recipientType היא 'client'", () => {
    render(<FollowUpRuleEditor {...DEFAULT_PROPS} />);
    const select = document.getElementById("fu-recipient") as HTMLSelectElement | null;
    expect(select?.value).toBe("client");
  });

  it("יש כפתור שמירה וכפתור ביטול", () => {
    render(<FollowUpRuleEditor {...DEFAULT_PROPS} />);
    expect(screen.getByRole("button", { name: /שמירת כלל/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ביטול/i })).toBeInTheDocument();
  });

  it("הטופס מכיל dir=rtl", () => {
    render(<FollowUpRuleEditor {...DEFAULT_PROPS} />);
    const form = document.querySelector("form");
    expect(form?.getAttribute("dir")).toBe("rtl");
  });
});

describe("FollowUpRuleEditor — נגישות axe", () => {
  it("הטופס ריק — axe ללא הפרות נגישות", async () => {
    const { container } = render(<FollowUpRuleEditor {...DEFAULT_PROPS} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
