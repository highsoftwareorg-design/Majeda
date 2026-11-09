import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import TermsOfUsePage, { metadata } from "@/app/terms/page";

/** תקנון ותנאי שימוש — דף סטטי (מודל: app/accessibility/page.tsx). */
describe("/terms page", () => {
  it("renders with no axe violations", async () => {
    const { container } = render(<TermsOfUsePage />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("is RTL with a single h1 carrying the Hebrew title and matching metadata", () => {
    render(<TermsOfUsePage />);
    expect(screen.getByRole("main")).toHaveAttribute("dir", "rtl");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("תקנון ותנאי שימוש");
    expect(metadata.title).toBe("תקנון ותנאי שימוש");
  });

  it("renders the draft-notice aside", () => {
    render(<TermsOfUsePage />);
    expect(screen.getByRole("note", { name: "סטטוס התקנון" })).toHaveTextContent("טיוטה");
  });

  it("renders a back link to the home page", () => {
    render(<TermsOfUsePage />);
    expect(screen.getByRole("link", { name: "חזרה לעמוד הבית" })).toHaveAttribute("href", "/");
  });

  it("cross-links to the privacy policy and the accessibility statement", () => {
    render(<TermsOfUsePage />);
    expect(screen.getByRole("link", { name: "מדיניות הפרטיות" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "הצהרת הנגישות" })).toHaveAttribute("href", "/accessibility");
  });

  it("marks clinic-fill values as placeholders", () => {
    const { container } = render(<TermsOfUsePage />);
    const placeholders = container.querySelectorAll("[data-placeholder]");
    expect(placeholders.length).toBeGreaterThanOrEqual(1);
    placeholders.forEach((el) => expect(el).toHaveTextContent(/^\[למילוי ע״י הקליניקה: .+\]$/));
  });
});
