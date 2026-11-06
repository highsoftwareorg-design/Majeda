import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import AccessibilityStatementPage, { metadata } from "@/app/accessibility/page";

/** משימה 2.18 — דף הצהרת הנגישות. */
describe("/accessibility statement page", () => {
  it("has no axe violations", async () => {
    const { container } = render(<AccessibilityStatementPage />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("is RTL with a single h1 and the Hebrew title in metadata", () => {
    render(<AccessibilityStatementPage />);
    expect(screen.getByRole("main")).toHaveAttribute("dir", "rtl");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("הצהרת נגישות");
    expect(metadata.title).toBe("הצהרת נגישות");
  });

  it("states the standard as a target and requires consultant review (not a compliance claim)", () => {
    render(<AccessibilityStatementPage />);
    const main = screen.getByRole("main");
    expect(main).toHaveTextContent("ת״י 5568");
    expect(main).toHaveTextContent("WCAG 2.1");
    expect(main).toHaveTextContent("זהו יעד ולא אישור עמידה");
    expect(screen.getByRole("note", { name: "סטטוס ההצהרה" })).toHaveTextContent(
      "יועץ/ת נגישות מורשה/ית",
    );
  });

  it("covers adjustments, limitations and contact sections", () => {
    render(<AccessibilityStatementPage />);
    for (const title of [
      "תקן ורמת הנגישות",
      "התאמות הנגישות שבוצעו באתר",
      "מגבלות ידועות",
      "פנייה בנושא נגישות",
      "עדכון ההצהרה",
    ]) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    }
  });

  it("marks coordinator contact details and review date as clinic placeholders", () => {
    const { container } = render(<AccessibilityStatementPage />);
    const placeholders = container.querySelectorAll("[data-placeholder]");
    expect(placeholders.length).toBeGreaterThanOrEqual(6);
    placeholders.forEach((el) => expect(el).toHaveTextContent(/^\[למילוי ע״י הקליניקה: .+\]$/));
    const contact = screen.getByRole("region", { name: "פנייה בנושא נגישות" });
    for (const label of ["רכז/ת הנגישות", "טלפון", "דוא״ל"]) {
      expect(within(contact).getByText(label)).toBeInTheDocument();
    }
  });

  it("keeps the footer link to /accessibility", () => {
    render(<AccessibilityStatementPage />);
    expect(screen.getByRole("link", { name: "הצהרת נגישות" })).toHaveAttribute("href", "/accessibility");
  });
});
