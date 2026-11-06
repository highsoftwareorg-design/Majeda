import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";

/**
 * משימה 2.13 — TreatmentsSection (Server Component אסינכרוני).
 * getTreatments מוחלף ב-mock כדי לבדוק שהתוכן נשלף רק ממנו (ללא נתונים כפולים בקוד).
 */
const getTreatmentsMock = vi.fn();
vi.mock("@/lib/db/treatments", () => ({
  getTreatments: () => getTreatmentsMock(),
}));

import { TreatmentsSection } from "@/components/landing/TreatmentsSection";

const FAKE = [
  { id: "t1", name: "טיפול בדיקה א", description: "תיאור א", price: 250, durationMinutes: 45, createdAt: new Date(), updatedAt: new Date() },
  { id: "t2", name: "טיפול בדיקה ב", description: null, price: 300, durationMinutes: 60, createdAt: new Date(), updatedAt: new Date() },
  { id: "t3", name: "טיפול בדיקה ג", description: "תיאור ג", price: 480, durationMinutes: 90, createdAt: new Date(), updatedAt: new Date() },
];

async function renderSection() {
  const ui = await TreatmentsSection();
  return render(<>{ui}</>);
}

describe("TreatmentsSection (2.13)", () => {
  beforeEach(() => {
    getTreatmentsMock.mockReset();
  });

  it("renders every treatment returned by getTreatments (>=3) as list items", async () => {
    getTreatmentsMock.mockResolvedValue(FAKE);
    const { container } = await renderSection();
    expect(getTreatmentsMock).toHaveBeenCalledTimes(1);
    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(container.querySelectorAll("[data-treatment-item]")).toHaveLength(3);
    for (const t of FAKE) {
      expect(screen.getByRole("heading", { level: 3, name: t.name })).toBeInTheDocument();
    }
  });

  it("renders only data from getTreatments (no hardcoded treatment names)", async () => {
    getTreatmentsMock.mockResolvedValue([FAKE[0]]);
    await renderSection();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
    expect(screen.getByText("החל מ-₪250")).toBeInTheDocument();
    expect(screen.getByText("משך הטיפול: 45 דקות")).toBeInTheDocument();
  });

  it("formats price/duration and omits missing description", async () => {
    getTreatmentsMock.mockResolvedValue(FAKE);
    await renderSection();
    expect(screen.getByText("החל מ-₪480")).toBeInTheDocument();
    expect(screen.getByText("משך הטיפול: שעה")).toBeInTheDocument();
    expect(screen.getByText("משך הטיפול: שעה ו-30 דקות")).toBeInTheDocument();
    expect(screen.getAllByText(/החל מ-₪/)).toHaveLength(3);
    expect(screen.queryByText("null")).toBeNull();
  });

  it("returns nothing when there are no treatments", async () => {
    getTreatmentsMock.mockResolvedValue([]);
    const ui = await TreatmentsSection();
    expect(ui).toBeNull();
  });

  it("has a single h2 heading labelling the section and h3 per item", async () => {
    getTreatmentsMock.mockResolvedValue(FAKE);
    const { container } = await renderSection();
    const h2s = container.querySelectorAll("h2");
    expect(h2s).toHaveLength(1);
    expect(h2s[0]).toHaveTextContent("הטיפולים שלנו");
    const section = container.querySelector("section#treatments");
    expect(section).toHaveAttribute("aria-labelledby", h2s[0].id);
    expect(container.querySelectorAll("h1, h4, h5, h6")).toHaveLength(0);
  });

  it("uses an overflow-safe responsive grid", async () => {
    getTreatmentsMock.mockResolvedValue(FAKE);
    const { container } = await renderSection();
    expect(container.querySelector("section")).toHaveClass("w-full");
    const list = container.querySelector("[data-treatments-list]");
    expect(list?.className).toMatch(/grid-cols-1/);
    expect(list?.className).toMatch(/lg:grid-cols-2/);
  });

  it("has no axe violations", async () => {
    getTreatmentsMock.mockResolvedValue(FAKE);
    const { container } = await renderSection();
    expect(await axe(container)).toHaveNoViolations();
  });
});
