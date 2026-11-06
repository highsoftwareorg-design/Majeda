import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Footer } from "@/components/landing/Footer";

describe("Footer", () => {
  it("renders a privacy policy link pointing to /privacy", () => {
    render(<Footer />);
    const link = screen.getByRole("link", { name: "מדיניות פרטיות" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/privacy");
  });

  it("renders an accessibility statement link pointing to /accessibility", () => {
    render(<Footer />);
    const link = screen.getByRole("link", { name: "הצהרת נגישות" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/accessibility");
  });

  it("renders a terms link pointing to /terms", () => {
    render(<Footer />);
    const link = screen.getByRole("link", { name: "תקנון" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/terms");
  });

  it("renders the copyright text", () => {
    render(<Footer />);
    expect(screen.getByText(/MAJIDA Beauté Center/)).toBeInTheDocument();
  });
});

// משימה 2.14 — שמירה על קישורים ותוכן לאחר העיצוב המחודש
describe("Footer — 2.14 redesign regression", () => {
  it("keeps exactly the three legal links, in order, inside the labelled nav", () => {
    render(<Footer />);
    const nav = screen.getByRole("navigation", { name: "קישורים משפטיים" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["מדיניות פרטיות", "/privacy"],
      ["הצהרת נגישות", "/accessibility"],
      ["תקנון", "/terms"],
    ]);
  });

  it("has no links outside the legal nav", () => {
    const { container } = render(<Footer />);
    expect(container.querySelectorAll("a")).toHaveLength(3);
  });

  it("renders the full copyright line unchanged (CURRENT_YEAR, bdi-isolated brand)", () => {
    const { container } = render(<Footer />);
    const p = container.querySelector("footer p");
    expect(p?.textContent).toBe("© 2026 MAJIDA Beauté Center. כל הזכויות שמורות.");
    expect(p?.querySelector("bdi")?.textContent).toBe("© 2026 MAJIDA Beauté Center");
  });

  it("keeps the logo image with its accessible name", () => {
    render(<Footer />);
    expect(screen.getByRole("img", { name: "MAJIDA Beauté Center" })).toBeInTheDocument();
  });

  it("gives legal links a 44px minimum touch target class", () => {
    render(<Footer />);
    for (const name of ["מדיניות פרטיות", "הצהרת נגישות", "תקנון"]) {
      expect(screen.getByRole("link", { name })).toHaveClass("min-h-11");
    }
  });
});
