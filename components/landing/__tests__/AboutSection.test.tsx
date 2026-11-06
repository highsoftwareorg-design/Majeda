import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AboutSection } from "@/components/landing/AboutSection";

describe("AboutSection", () => {
  it("renders the Hebrew heading", () => {
    render(<AboutSection />);
    const heading = screen.getByRole("heading", { name: "אודות המרפאה והצוות" });
    expect(heading).toBeInTheDocument();
  });

  it("renders the body text describing the clinic", () => {
    render(<AboutSection />);
    expect(
      screen.getByText(/מרפאת יופי וטיפוח בוטיקית/)
    ).toBeInTheDocument();
  });

  it("renders team member names and roles", () => {
    render(<AboutSection />);
    expect(screen.getByText("מג'ידה כהן")).toBeInTheDocument();
    expect(screen.getByText("מייסדת ומטפלת ראשית")).toBeInTheDocument();
  });
});

// משימה 2.14 — התוכן הטקסטואלי זהה לפני/אחרי (הושווה מול build ישן); p→h3 לשמות בלבד
describe("AboutSection — 2.14 redesign regression", () => {
  const BODY =
    "מג'ידה Beauté Center היא מרפאת יופי וטיפוח בוטיקית, המשלבת מקצועיות, טכנולוגיה מתקדמת ויחס אישי חם. הצוות שלנו מלווה כל לקוחה לאורך המסע שלה — מהייעוץ הראשוני ועד לתוצאות הרצויות — תוך שמירה על סטנדרטים גבוהים של בטיחות, היגיינה ושירות.";
  const TEAM = [
    ["מג'ידה כהן", "מייסדת ומטפלת ראשית"],
    ["נור חדאד", "קוסמטיקאית רפואית"],
    ["יעל אברהם", "מטפלת הסרת שיער ופנים"],
  ];

  it("keeps the exact body paragraph", () => {
    const { container } = render(<AboutSection />);
    const p = container.querySelector("[data-about-copy] p");
    expect(p?.textContent?.replace(/\s+/g, " ").trim()).toBe(BODY);
  });

  it("renders the three team members (name as h3, role) in order", () => {
    render(<AboutSection />);
    const names = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(TEAM.map(([n]) => n));
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(TEAM.map(([n, r]) => n + r));
  });

  it("has a valid heading outline: one h2 labelling the section, only h3 below it", () => {
    const { container } = render(<AboutSection />);
    const section = container.querySelector("section#about")!;
    const h2s = section.querySelectorAll("h2");
    expect(h2s).toHaveLength(1);
    expect(section.getAttribute("aria-labelledby")).toBe(h2s[0].id);
    expect(section.querySelectorAll("h1, h4, h5, h6")).toHaveLength(0);
  });

  it("hides decorative portrait placeholders from assistive tech", () => {
    const { container } = render(<AboutSection />);
    const portraits = container.querySelectorAll("[data-about-portrait]");
    expect(portraits).toHaveLength(3);
    portraits.forEach((p) => expect(p).toHaveAttribute("aria-hidden", "true"));
  });
});
