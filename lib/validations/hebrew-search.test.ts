/**
 * בדיקות יחידה (non-DB) ל-normalizeHebrewSearchTerm (משימה 3.8, FR-CL-06).
 *
 * פונקציה טהורה — ניתן לבדוק ללא חיבור לבסיס נתונים.
 */
import { describe, it, expect } from "vitest";
import { normalizeHebrewSearchTerm } from "./hebrew-search";

describe("normalizeHebrewSearchTerm", () => {
  // --- קריטריוני קבלה מפורשים מהמשימה ---

  it('מסיר תחילית "ב": "בטיפול" → "טיפול"', () => {
    expect(normalizeHebrewSearchTerm("בטיפול")).toBe("טיפול");
  });

  it('מסיר תחילית "ה": "הגיעה" → "גיעה"', () => {
    expect(normalizeHebrewSearchTerm("הגיעה")).toBe("גיעה");
  });

  it('מסיר תחילית "ו": "וגם" → "גם"', () => {
    expect(normalizeHebrewSearchTerm("וגם")).toBe("גם");
  });

  it('מחזיר מחרוזת ריקה כשהמונח הוא "ו" בלבד', () => {
    expect(normalizeHebrewSearchTerm("ו")).toBe("");
  });

  it('מחזיר מחרוזת ריקה כשהמונח הוא "ה" בלבד', () => {
    expect(normalizeHebrewSearchTerm("ה")).toBe("");
  });

  it('מחזיר מחרוזת ריקה כשהמונח הוא "ב" בלבד', () => {
    expect(normalizeHebrewSearchTerm("ב")).toBe("");
  });

  it("מחזיר מונח ללא שינוי כשאינו מתחיל בה/ו/ב", () => {
    expect(normalizeHebrewSearchTerm("טיפול")).toBe("טיפול");
  });

  it("מחזיר מונח ללא שינוי לשמות שאינם מתחילים בתחילית", () => {
    expect(normalizeHebrewSearchTerm("שרה")).toBe("שרה");
    expect(normalizeHebrewSearchTerm("מאוחר")).toBe("מאוחר");
    expect(normalizeHebrewSearchTerm("דנה")).toBe("דנה");
  });

  it("מחזיר מחרוזת ריקה עבור קלט ריק", () => {
    expect(normalizeHebrewSearchTerm("")).toBe("");
  });

  it("מסיר ניקוד עברי מהמונח", () => {
    // "שַׁבָּת" עם ניקוד → "שבת" ללא ניקוד
    expect(normalizeHebrewSearchTerm("שַׁבָּת")).toBe("שבת");
  });

  it("מסיר גם ניקוד וגם תחילית בשילוב", () => {
    // "בְּטִיפּוּל" עם ניקוד → תחילית "ב" + "טיפול"
    expect(normalizeHebrewSearchTerm("בְּטִיפּוּל")).toBe("טיפול");
  });

  it("מסיר רק תחילית יחידה (לא מסיר שתיים)", () => {
    // "ובשמחה" → מסיר "ו" → "בשמחה" (לא מסיר גם את "ב")
    expect(normalizeHebrewSearchTerm("ובשמחה")).toBe("בשמחה");
  });

  it("לא משנה מחרוזות שאינן עבריות", () => {
    expect(normalizeHebrewSearchTerm("hello")).toBe("hello");
    expect(normalizeHebrewSearchTerm("050123")).toBe("050123");
  });
});
