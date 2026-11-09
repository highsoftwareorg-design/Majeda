import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import PrivacyPolicyPage, { metadata } from "@/app/privacy/page";

/** מדיניות פרטיות — דף סטטי (מודל: app/accessibility/page.tsx). */
describe("/privacy page", () => {
  it("renders with no axe violations", async () => {
    const { container } = render(<PrivacyPolicyPage />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("is RTL with a single h1 carrying the Hebrew title and matching metadata", () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByRole("main")).toHaveAttribute("dir", "rtl");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("מדיניות פרטיות");
    expect(metadata.title).toBe("מדיניות פרטיות");
  });

  it("renders the draft-notice aside", () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByRole("note", { name: "סטטוס המדיניות" })).toHaveTextContent("טיוטה");
  });

  it("renders a back link to the home page", () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByRole("link", { name: "חזרה לעמוד הבית" })).toHaveAttribute("href", "/");
  });

  it("cross-links to the terms of use", () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByRole("link", { name: "תקנון ותנאי השימוש" })).toHaveAttribute("href", "/terms");
  });

  it("marks clinic-fill values as placeholders", () => {
    const { container } = render(<PrivacyPolicyPage />);
    const placeholders = container.querySelectorAll("[data-placeholder]");
    expect(placeholders.length).toBeGreaterThanOrEqual(1);
    placeholders.forEach((el) => expect(el).toHaveTextContent(/^\[למילוי ע״י הקליניקה: .+\]$/));
  });
});
