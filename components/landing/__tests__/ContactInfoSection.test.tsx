import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContactInfoSection } from "@/components/landing/ContactInfoSection";

describe("ContactInfoSection", () => {
  it("renders a clear Hebrew heading", () => {
    render(<ContactInfoSection />);
    const heading = screen.getByRole("heading", { name: "פרטי קשר" });
    expect(heading).toBeInTheDocument();
  });

  it("renders address text", () => {
    render(<ContactInfoSection />);
    expect(screen.getByText("כתובת")).toBeInTheDocument();
    expect(screen.getByText(/רחוב הדוגמה 12/)).toBeInTheDocument();
  });

  it("renders opening hours text", () => {
    render(<ContactInfoSection />);
    expect(screen.getByText("שעות פעילות")).toBeInTheDocument();
    expect(screen.getByText(/09:00 - 20:00/)).toBeInTheDocument();
  });

  it("renders Instagram and Facebook links", () => {
    render(<ContactInfoSection />);
    const instagramLink = screen.getByRole("link", { name: "אינסטגרם" });
    const facebookLink = screen.getByRole("link", { name: "פייסבוק" });

    expect(instagramLink).toHaveAttribute("href", "https://instagram.com/majida.beaute");
    expect(facebookLink).toHaveAttribute("href", "https://facebook.com/majida.beaute");
  });
});

// משימה 2.14 — התוכן הטקסטואלי והקישורים זהים לפני/אחרי (p→h3 לכותרות המשנה בלבד)
describe("ContactInfoSection — 2.14 redesign regression", () => {
  it("keeps the exact address line", () => {
    render(<ContactInfoSection />);
    expect(screen.getByText("רחוב הדוגמה 12, תל אביב (כתובת לדוגמה)").tagName).toBe("P");
  });

  it("keeps each opening-hours row's text identical (label + ':' + space + hours)", () => {
    render(<ContactInfoSection />);
    const rows = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(rows).toEqual([
      "ראשון - חמישי: 09:00 - 20:00",
      "שישי: 09:00 - 14:00",
      "שבת: סגור",
    ]);
  });

  it("has a valid heading outline: one h2, then the three h3 sub-headings", () => {
    const { container } = render(<ContactInfoSection />);
    const section = container.querySelector("section#contact-info")!;
    const h2s = section.querySelectorAll("h2");
    expect(h2s).toHaveLength(1);
    expect(section.getAttribute("aria-labelledby")).toBe(h2s[0].id);
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent?.trim())
    ).toEqual(["כתובת", "שעות פעילות", "עקבו אחרינו"]);
    expect(section.querySelectorAll("h1, h4, h5, h6")).toHaveLength(0);
  });

  it("keeps exactly two social links with identical href/aria-label/target/rel", () => {
    const { container } = render(<ContactInfoSection />);
    const links = [...container.querySelectorAll("a")];
    expect(
      links.map((a) => [
        a.getAttribute("href"),
        a.getAttribute("aria-label"),
        a.getAttribute("target"),
        a.getAttribute("rel"),
      ])
    ).toEqual([
      ["https://instagram.com/majida.beaute", "אינסטגרם", "_blank", "noopener noreferrer"],
      ["https://facebook.com/majida.beaute", "פייסבוק", "_blank", "noopener noreferrer"],
    ]);
    links.forEach((a) => expect(a).toHaveClass("size-11"));
  });

  it("hides heading icons from assistive tech", () => {
    const { container } = render(<ContactInfoSection />);
    container.querySelectorAll("svg").forEach((svg) =>
      expect(svg).toHaveAttribute("aria-hidden", "true")
    );
  });
});
