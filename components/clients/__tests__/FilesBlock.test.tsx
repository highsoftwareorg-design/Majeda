/**
 * בדיקות ל-FilesBlock ו-ConsentFormsBlock — משימות 4.10 ו-4.11.
 *
 * בודק:
 * 1. FilesBlock — מציג כותרת "קבצים ותמונות".
 * 2. FilesBlock — מציג טקסט "בקרוב".
 * 3. FilesBlock — לא זורק שגיאה כאשר מרונדר ללא props.
 * 4. FilesBlock — ה-section מכיל dir="rtl".
 * 5. ConsentFormsBlock — מציג כותרת "טפסי הסכמה".
 * 6. ConsentFormsBlock — מציג "אין טפסים עדיין".
 * 7. ConsentFormsBlock — לא זורק שגיאה כאשר מרונדר ללא props.
 * 8. ConsentFormsBlock — ה-section מכיל dir="rtl".
 *
 * הרצה: `npx vitest run --reporter=verbose components/clients/__tests__/FilesBlock.test.tsx`
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { FilesBlock } from "@/components/clients/FilesBlock";
import { ConsentFormsBlock } from "@/components/clients/ConsentFormsBlock";

// ---------------------------------------------------------------------------
// FilesBlock (משימה 4.10)
// ---------------------------------------------------------------------------

describe("FilesBlock — משימה 4.10", () => {
  it('מציג את הכותרת "קבצים ותמונות"', () => {
    render(<FilesBlock />);
    expect(screen.getByText("קבצים ותמונות")).toBeInTheDocument();
  });

  it('מציג טקסט "בקרוב" (הודעת placeholder לשלב עתידי)', () => {
    render(<FilesBlock />);
    expect(screen.getByText(/בקרוב/)).toBeInTheDocument();
  });

  it("לא זורק שגיאה כאשר מרונדר ללא props", () => {
    expect(() => render(<FilesBlock />)).not.toThrow();
  });

  it("ה-section הראשי מכיל dir=rtl", () => {
    const { container } = render(<FilesBlock />);
    const section = container.querySelector("section");
    expect(section).not.toBeNull();
    expect(section).toHaveAttribute("dir", "rtl");
  });

  it('ה-section מוגדר עם aria-label="קבצים ותמונות"', () => {
    render(<FilesBlock />);
    const region = screen.getByRole("region", { name: "קבצים ותמונות" });
    expect(region).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ConsentFormsBlock (משימה 4.11)
// ---------------------------------------------------------------------------

describe("ConsentFormsBlock — משימה 4.11", () => {
  it('מציג את הכותרת "טפסי הסכמה"', () => {
    render(<ConsentFormsBlock />);
    expect(screen.getByText("טפסי הסכמה")).toBeInTheDocument();
  });

  it('מציג "אין טפסים עדיין" כאשר אין נתוני טפסים', () => {
    render(<ConsentFormsBlock />);
    expect(screen.getByText("אין טפסים עדיין")).toBeInTheDocument();
  });

  it("לא זורק שגיאה כאשר מרונדר ללא props", () => {
    expect(() => render(<ConsentFormsBlock />)).not.toThrow();
  });

  it("ה-section הראשי מכיל dir=rtl", () => {
    const { container } = render(<ConsentFormsBlock />);
    const section = container.querySelector("section");
    expect(section).not.toBeNull();
    expect(section).toHaveAttribute("dir", "rtl");
  });

  it('ה-section מוגדר עם aria-label="טפסי הסכמה"', () => {
    render(<ConsentFormsBlock />);
    const region = screen.getByRole("region", { name: "טפסי הסכמה" });
    expect(region).toBeInTheDocument();
  });
});
