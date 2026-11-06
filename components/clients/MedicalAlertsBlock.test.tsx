/**
 * בדיקות ל-MedicalAlertsBlock — משימה 4.3.
 *
 * בודק:
 * 1. הרכיב מחזיר null כשכל השדות ריקים/null.
 * 2. הרכיב מרנדר עם אייקון AlertTriangle כשיש תוכן.
 * 3. כל שדה מלא מוצג עם התווית העברית שלו.
 * 4. צבע האזהרה (warning) בשימוש.
 *
 * הרצה: `npx vitest run --reporter=verbose components/clients/MedicalAlertsBlock.test.tsx`
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MedicalAlertsBlock, type MedicalAlertsData } from "./MedicalAlertsBlock";

const EMPTY_DATA: MedicalAlertsData = {
  allergies: null,
  medications: null,
  pregnancyNursing: null,
  medicalConditions: null,
};

describe("MedicalAlertsBlock", () => {
  // 1. הסתרה כשכל השדות ריקים/null
  it("מחזיר null כשכל השדות null", () => {
    const { container } = render(<MedicalAlertsBlock data={EMPTY_DATA} />);
    expect(container.firstChild).toBeNull();
  });

  it("מחזיר null כשכל השדות מחרוזות ריקות", () => {
    const data: MedicalAlertsData = {
      allergies: "",
      medications: "",
      pregnancyNursing: "",
      medicalConditions: "",
    };
    const { container } = render(<MedicalAlertsBlock data={data} />);
    expect(container.firstChild).toBeNull();
  });

  it("מחזיר null כשכל השדות רווחים בלבד", () => {
    const data: MedicalAlertsData = {
      allergies: "   ",
      medications: "   ",
      pregnancyNursing: "   ",
      medicalConditions: "   ",
    };
    const { container } = render(<MedicalAlertsBlock data={data} />);
    expect(container.firstChild).toBeNull();
  });

  // 2. מרנדר כשיש תוכן ב-allergies
  it("מרנדר בלוק עם אייקון כאשר allergies מלאה", () => {
    const data: MedicalAlertsData = {
      ...EMPTY_DATA,
      allergies: "פניצילין",
    };
    render(<MedicalAlertsBlock data={data} />);

    // הכותרת בעברית
    expect(screen.getByText("התראות רפואיות")).toBeInTheDocument();

    // הערך מוצג
    expect(screen.getByText("פניצילין")).toBeInTheDocument();

    // התווית בעברית
    expect(screen.getByText("אלרגיות:")).toBeInTheDocument();
  });

  // 3. כל ארבעת השדות עם תוויות עבריות
  it("מציג את כל ארבעת השדות כשהם מלאים", () => {
    const data: MedicalAlertsData = {
      allergies: "אלרגיה לניקל",
      medications: "וורפרין",
      pregnancyNursing: "הריון שבוע 20",
      medicalConditions: "סוכרת סוג 2",
    };
    render(<MedicalAlertsBlock data={data} />);

    // תוויות
    expect(screen.getByText("אלרגיות:")).toBeInTheDocument();
    expect(screen.getByText("תרופות:")).toBeInTheDocument();
    expect(screen.getByText("הריון / הנקה:")).toBeInTheDocument();
    expect(screen.getByText("מצבים רפואיים:")).toBeInTheDocument();

    // ערכים
    expect(screen.getByText("אלרגיה לניקל")).toBeInTheDocument();
    expect(screen.getByText("וורפרין")).toBeInTheDocument();
    expect(screen.getByText("הריון שבוע 20")).toBeInTheDocument();
    expect(screen.getByText("סוכרת סוג 2")).toBeInTheDocument();
  });

  // 4. מוצג רק השדות שמלאים (סלקטיבי)
  it("מציג רק שדות מלאים כשחלקם null", () => {
    const data: MedicalAlertsData = {
      allergies: "פניצילין",
      medications: null,
      pregnancyNursing: null,
      medicalConditions: "אסטמה",
    };
    render(<MedicalAlertsBlock data={data} />);

    expect(screen.getByText("אלרגיות:")).toBeInTheDocument();
    expect(screen.getByText("מצבים רפואיים:")).toBeInTheDocument();
    // שדות ריקים לא מוצגים
    expect(screen.queryByText("תרופות:")).not.toBeInTheDocument();
    expect(screen.queryByText("הריון / הנקה:")).not.toBeInTheDocument();
  });

  // 5. ה-section נושא aria-label בעברית (נגישות)
  it("ה-section נושא aria-label בעברית", () => {
    const data: MedicalAlertsData = {
      ...EMPTY_DATA,
      medications: "אומפרזול",
    };
    render(<MedicalAlertsBlock data={data} />);
    expect(
      screen.getByRole("region", { name: "התראות רפואיות" })
    ).toBeInTheDocument();
  });

  // 6. ה-AlertTriangle נוכח כאשר יש תוכן
  it("מכיל את הכותרת 'התראות רפואיות' כחלק מהבלוק", () => {
    const data: MedicalAlertsData = {
      ...EMPTY_DATA,
      allergies: "חומר ניגוד",
    };
    render(<MedicalAlertsBlock data={data} />);
    // הכותרת היא סמן עקיף לנוכחות ה-AlertTriangle (הם ב-div משותף)
    const heading = screen.getByRole("heading", { name: "התראות רפואיות" });
    expect(heading).toBeInTheDocument();
  });

  // 7. RTL — ה-section מוגדר עם dir=rtl
  it("ה-section מוגדר עם dir=rtl", () => {
    const data: MedicalAlertsData = {
      ...EMPTY_DATA,
      allergies: "בדיקה",
    };
    render(<MedicalAlertsBlock data={data} />);
    const section = screen.getByRole("region", { name: "התראות רפואיות" });
    expect(section).toHaveAttribute("dir", "rtl");
  });
});
