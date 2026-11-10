import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TreatmentMenuSection } from "@/components/landing/TreatmentMenuSection";
import { TREATMENT_MENU } from "@/lib/landing/treatment-menu";

const [firstCategory] = TREATMENT_MENU;

describe("TreatmentMenuSection — interactive explorer", () => {
  it("renders the single Hebrew treatments heading", () => {
    render(<TreatmentMenuSection />);
    expect(screen.getByRole("heading", { level: 2, name: /הטיפולים שלנו/ })).toBeInTheDocument();
  });

  it("renders a category filter button per category; the first is pressed by default", () => {
    render(<TreatmentMenuSection />);
    // ספירת הקטגוריה מסומנת aria-hidden, לכן השם הנגיש של הכפתור = כותרת הקטגוריה בלבד.
    for (const category of TREATMENT_MENU) {
      expect(screen.getByRole("button", { name: category.title })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: firstCategory.title })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows only the active category's treatments, and switches on category click", async () => {
    const user = userEvent.setup();
    render(<TreatmentMenuSection />);

    // ברירת מחדל: הטיפולים של הקטגוריה הראשונה מוצגים
    for (const item of firstCategory.items) {
      expect(screen.getByText(item.name)).toBeInTheDocument();
    }

    const other = TREATMENT_MENU[1];
    // טיפול מקטגוריה אחרת אינו ב-DOM עד שבוחרים אותה
    expect(screen.queryByText(other.items[0].name)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: other.title }));
    expect(screen.getByRole("button", { name: other.title })).toHaveAttribute("aria-pressed", "true");
    for (const item of other.items) {
      expect(screen.getByText(item.name)).toBeInTheDocument();
    }
    // הטיפולים של הקטגוריה הראשונה כבר אינם מוצגים
    expect(screen.queryByText(firstCategory.items[0].name)).not.toBeInTheDocument();
  });

  it("reaches every treatment name by selecting its category", async () => {
    const user = userEvent.setup();
    render(<TreatmentMenuSection />);
    for (const category of TREATMENT_MENU) {
      await user.click(screen.getByRole("button", { name: category.title }));
      for (const item of category.items) {
        expect(screen.getByText(item.name)).toBeInTheDocument();
      }
    }
  });

  it("keeps descriptions hidden until a card is expanded (disclosure)", async () => {
    const user = userEvent.setup();
    render(<TreatmentMenuSection />);
    const item = firstCategory.items[0];

    // התיאור מוסתר כברירת מחדל (פחות טקסט)
    expect(screen.queryByText(item.description)).not.toBeInTheDocument();

    const card = screen.getByText(item.name).closest("button")!;
    expect(card).toHaveAttribute("aria-expanded", "false");

    await user.click(card);
    expect(card).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(item.description)).toBeInTheDocument();

    // סגירה חוזרת מסתירה שוב
    await user.click(card);
    expect(screen.queryByText(item.description)).not.toBeInTheDocument();
  });

  it("shows the Latin device name inside a <bdi> for the active category", () => {
    const { container } = render(<TreatmentMenuSection />);
    const bdiText = [...container.querySelectorAll("bdi")].map((b) => b.textContent);
    for (const item of firstCategory.items) {
      if (item.device) expect(bdiText).toContain(item.device);
    }
  });

  it("contains no prices (no ₪ sign) anywhere in the section", () => {
    const { container } = render(<TreatmentMenuSection />);
    expect(container.textContent ?? "").not.toContain("₪");
  });

  it("is a labelled RTL-friendly light-band section using logical/light tokens only", () => {
    const { container } = render(<TreatmentMenuSection />);
    const section = container.querySelector("section#treatments")!;
    expect(section.getAttribute("aria-labelledby")).toBe(section.querySelector("h2")!.id);
    expect(section).toHaveAttribute("data-band", "light");
    const html = section.outerHTML;
    expect(html).not.toMatch(/text-(gold-pale|champagne-muted|champagne|gold-light|gold)(?=[\s"])/);
    expect(html).not.toMatch(/\b(ml|mr|pl|pr|left|right)-/);
  });
});

describe("TREATMENT_MENU data", () => {
  it("has four non-empty categories", () => {
    expect(TREATMENT_MENU).toHaveLength(4);
    for (const category of TREATMENT_MENU) {
      expect(category.items.length).toBeGreaterThan(0);
    }
  });

  it("has unique category ids and unique item names", () => {
    const ids = TREATMENT_MENU.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const names = TREATMENT_MENU.flatMap((c) => c.items.map((i) => i.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it("every item has a Hebrew name and a non-empty description", () => {
    const hebrew = /[֐-׿]/;
    for (const category of TREATMENT_MENU) {
      for (const item of category.items) {
        expect(hebrew.test(item.name), item.name).toBe(true);
        expect(item.description.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
