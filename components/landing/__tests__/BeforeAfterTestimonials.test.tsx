import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BeforeAfterSection } from "@/components/landing/BeforeAfterSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";

describe("BeforeAfterSection", () => {
  it("renders a clear Hebrew heading", () => {
    render(<BeforeAfterSection />);
    const heading = screen.getByRole("heading", { name: "לפני ואחרי" });
    expect(heading).toBeInTheDocument();
  });

  it("renders before/after placeholder items", () => {
    render(<BeforeAfterSection />);
    expect(screen.getAllByText("לפני").length).toBeGreaterThan(0);
    expect(screen.getAllByText("אחרי").length).toBeGreaterThan(0);
  });

  it("uses responsive, overflow-safe layout classes (no fixed/overflowing widths)", () => {
    const { container } = render(<BeforeAfterSection />);
    const section = container.querySelector("section");
    expect(section).toHaveClass("w-full");
    const grid = container.querySelector(".grid");
    expect(grid).toBeTruthy();
    expect(grid?.className).toMatch(/grid-cols-1/);
    expect(grid?.className).toMatch(/sm:grid-cols-2/);
  });
});

describe("TestimonialsSection", () => {
  it("renders a clear Hebrew heading", () => {
    render(<TestimonialsSection />);
    const heading = screen.getByRole("heading", { name: "מה הלקוחות שלנו אומרות" });
    expect(heading).toBeInTheDocument();
  });

  it("renders static testimonial quotes", () => {
    render(<TestimonialsSection />);
    const quotes = screen.getAllByRole("figure");
    expect(quotes.length).toBeGreaterThanOrEqual(3);
  });

  it("uses responsive, overflow-safe layout classes (no fixed/overflowing widths)", () => {
    const { container } = render(<TestimonialsSection />);
    const section = container.querySelector("section");
    expect(section).toHaveClass("w-full");
    const grid = container.querySelector(".grid");
    expect(grid).toBeTruthy();
    expect(grid?.className).toMatch(/grid-cols-1/);
    expect(grid?.className).toMatch(/sm:grid-cols-2/);
  });
});
