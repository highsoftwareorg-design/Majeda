/**
 * בדיקות יחידה ל-lib/nav/adminNav.ts — משימה 11.1 (קונפיגורציית הניווט).
 *
 * בודק:
 * 1. adminNavItems מכיל בדיוק 7 פריטים עם כל ה-hrefs הצפויים.
 * 2. לכל פריט label בעברית ואייקון.
 * 3. isAdminNavItemActive — התאמה מדויקת לנתיב.
 * 4. isAdminNavItemActive — התאמת תת-נתיב (/clients/123 מפעיל /clients).
 * 5. isAdminNavItemActive — לא over-match (/clients-archive לא מפעיל /clients;
 *    /treatments לא מפעיל פריט אחר).
 *
 * הרצה: `npx vitest run lib/nav/__tests__/adminNav.test.ts`
 */

import { describe, it, expect } from "vitest";
import { adminNavItems, isAdminNavItemActive } from "@/lib/nav/adminNav";

const EXPECTED_HREFS = [
  "/clients",
  "/calendar",
  "/tasks",
  "/campaigns",
  "/consent-templates",
  "/treatments",
  "/settings",
];

const EXPECTED_LABELS = [
  "לקוחות",
  "יומן",
  "משימות",
  "קמפיינים",
  "טפסי הסכמה",
  "קטלוג טיפולים",
  "הגדרות",
];

describe("adminNavItems", () => {
  it("מכיל בדיוק 7 פריטים", () => {
    expect(adminNavItems).toHaveLength(7);
  });

  it("מכיל את כל 7 ה-hrefs הצפויים בסדר הנכון", () => {
    expect(adminNavItems.map((i) => i.href)).toEqual(EXPECTED_HREFS);
  });

  it("לכל פריט label בעברית תואם", () => {
    expect(adminNavItems.map((i) => i.label)).toEqual(EXPECTED_LABELS);
  });

  it("לכל פריט אייקון (רכיב/פונקציה)", () => {
    for (const item of adminNavItems) {
      expect(item.icon).toBeDefined();
      // אייקוני lucide הם רכיבי React (פונקציה או forwardRef/object).
      expect(["function", "object"]).toContain(typeof item.icon);
    }
  });

  it("אין hrefs כפולים", () => {
    const hrefs = adminNavItems.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("isAdminNavItemActive", () => {
  it("מתאים בהתאמה מדויקת לנתיב", () => {
    expect(isAdminNavItemActive("/clients", "/clients")).toBe(true);
    expect(isAdminNavItemActive("/settings", "/settings")).toBe(true);
  });

  it("מתאים לתת-נתיב (/clients/123 מפעיל /clients)", () => {
    expect(isAdminNavItemActive("/clients", "/clients/123")).toBe(true);
    expect(isAdminNavItemActive("/clients", "/clients/duplicates")).toBe(true);
    expect(isAdminNavItemActive("/campaigns", "/campaigns/new")).toBe(true);
    expect(isAdminNavItemActive("/treatments", "/treatments/abc-123")).toBe(true);
    expect(isAdminNavItemActive("/settings", "/settings/templates")).toBe(true);
  });

  it("אינו over-match על קידומת מחרוזת שאינה גבול נתיב", () => {
    // '/clients-archive' מתחיל ב-'/clients' כמחרוזת אך אינו תת-נתיב שלו.
    expect(isAdminNavItemActive("/clients", "/clients-archive")).toBe(false);
    expect(isAdminNavItemActive("/campaigns", "/campaigns-old")).toBe(false);
  });

  it("אינו מפעיל פריט עבור נתיב שונה לחלוטין", () => {
    expect(isAdminNavItemActive("/clients", "/calendar")).toBe(false);
    expect(isAdminNavItemActive("/settings", "/tasks")).toBe(false);
    expect(isAdminNavItemActive("/treatments", "/")).toBe(false);
  });

  it("בכל נתיב פעיל מסומן לכל היותר פריט אחד", () => {
    const paths = [
      "/clients",
      "/clients/123",
      "/calendar",
      "/tasks",
      "/campaigns/new",
      "/consent-templates",
      "/treatments/abc",
      "/settings/templates",
    ];
    for (const p of paths) {
      const activeCount = adminNavItems.filter((i) =>
        isAdminNavItemActive(i.href, p)
      ).length;
      expect(activeCount).toBeLessThanOrEqual(1);
    }
  });
});
