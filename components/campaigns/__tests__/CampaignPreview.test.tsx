/**
 * בדיקות ל-CampaignPreview — משימה 9.3 (FR-MK-02).
 *
 * בודק:
 * 1. גוף תבנית עם {name} → מוחלף ב"שרה לוי" (ערך דוגמה).
 * 2. כפתור "שלח בדיקה" גלוי.
 * 3. axe → ללא הפרות נגישות.
 *
 * הרצה: `npx vitest run components/campaigns/__tests__/CampaignPreview.test.tsx`
 */

import { vi, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";

// ---------------------------------------------------------------------------
// מוקים
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/campaigns/campaign-1",
}));

// ---------------------------------------------------------------------------
// Import לאחר ה-mocks
// ---------------------------------------------------------------------------

import { CampaignPreview } from "@/components/campaigns/CampaignPreview";

// ---------------------------------------------------------------------------
// בדיקות — תצוגה מקדימה
// ---------------------------------------------------------------------------

describe("CampaignPreview — תצוגה מקדימה עם {name}", () => {
  it('מחליף {name} ב"שרה לוי" בתוך אזור התצוגה המקדימה', () => {
    render(
      <CampaignPreview
        campaignId="campaign-1"
        body="שלום {name}, מחכים לך לביקור!"
      />
    );
    // שרה לוי מופיעה גם בטקסט ההסבר וגם בתצוגה — בודקים שהתצוגה מכילה את הטקסט המלא
    expect(screen.getByText("שלום שרה לוי, מחכים לך לביקור!")).toBeInTheDocument();
  });

  it("הטקסט המלא עם ערך הדוגמה מוצג", () => {
    render(
      <CampaignPreview
        campaignId="campaign-1"
        body="שלום {name}!"
      />
    );
    expect(screen.getByText(/שלום שרה לוי!/)).toBeInTheDocument();
  });

  it("placeholder לא ידוע מוחלף בערך ריק (buildSampleVariables מחזיר '' לכל key לא מוכר)", () => {
    render(
      <CampaignPreview
        campaignId="campaign-1"
        body="{name} תגיעי בתאריך {unknown_field}"
      />
    );
    // buildSampleVariables מחזיר "" ל-unknown_field → renderTemplateBody מחליף ב""
    // הטקסט הסופי: "שרה לוי תגיעי בתאריך "
    expect(screen.getByText(/שרה לוי תגיעי בתאריך/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// בדיקות — כפתור "שלח בדיקה"
// ---------------------------------------------------------------------------

describe("CampaignPreview — כפתור שלח בדיקה", () => {
  it('כפתור "שלח בדיקה" גלוי', () => {
    render(
      <CampaignPreview
        campaignId="campaign-1"
        body="הודעת בדיקה ל{name}"
      />
    );
    expect(
      screen.getByRole("button", { name: "שלח בדיקה" })
    ).toBeInTheDocument();
  });

  it('כפתור "שלח בדיקה" לא מושבת בהתחלה', () => {
    render(
      <CampaignPreview
        campaignId="campaign-1"
        body="הודעת בדיקה"
      />
    );
    const button = screen.getByRole("button", { name: "שלח בדיקה" });
    expect(button).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// בדיקות — נגישות axe
// ---------------------------------------------------------------------------

describe("CampaignPreview — נגישות axe", () => {
  it("axe — ללא הפרות נגישות", async () => {
    const { container } = render(
      <CampaignPreview
        campaignId="campaign-1"
        body="שלום {name}, מחכים לך!"
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
