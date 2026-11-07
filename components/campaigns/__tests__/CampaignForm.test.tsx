/**
 * בדיקות ל-CampaignForm — משימה 9.2 (FR-MK-01, FR-MK-07).
 *
 * בודק:
 * 1. מרנדר שלב 1 בהתחלה (שם + סגמנט).
 * 2. שלב 1 מכיל שדה שם קמפיין.
 * 3. axe → ללא הפרות נגישות.
 *
 * הרצה: `npx vitest run components/campaigns/__tests__/CampaignForm.test.tsx`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";

// ---------------------------------------------------------------------------
// מוקים
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/campaigns/new",
}));

// מוק fetch גלובלי — מחזיר רשימות ריקות כדי שהקומפוננטה תסיים לטעון
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/segments")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ segments: [] }),
        });
      }
      if (url.includes("/api/whatsapp/templates")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ templates: [] }),
        });
      }
      return Promise.resolve({
        ok: false,
        json: async () => ({}),
      });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Import component after mocks
// ---------------------------------------------------------------------------

import { CampaignForm } from "@/components/campaigns/CampaignForm";

// ---------------------------------------------------------------------------
// בדיקות
// ---------------------------------------------------------------------------

describe("CampaignForm — שלב 1 ראשוני", () => {
  it("מרנדר את שלב 1 בהתחלה — כותרת 'שלב 1: שם וסגמנט' גלויה", () => {
    render(<CampaignForm costPerMessageIls={0.3} />);
    expect(screen.getByRole("heading", { name: /שלב 1.*שם וסגמנט/i })).toBeInTheDocument();
  });

  it("שלב 2 ו-3 אינם גלויים בהתחלה", () => {
    render(<CampaignForm costPerMessageIls={0.3} />);
    expect(screen.queryByRole("heading", { name: /שלב 2/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /שלב 3/i })).not.toBeInTheDocument();
  });

  it("שדה שם הקמפיין קיים עם id='campaign-name'", () => {
    render(<CampaignForm costPerMessageIls={0.3} />);
    const nameInput = document.getElementById("campaign-name");
    expect(nameInput).toBeInTheDocument();
    expect(nameInput).toHaveAttribute("type", "text");
  });

  it("כפתור 'הבא' גלוי בשלב 1", () => {
    render(<CampaignForm costPerMessageIls={0.3} />);
    expect(screen.getByRole("button", { name: "הבא" })).toBeInTheDocument();
  });

  it("מחוון שלבים מציג 3 שלבים עם aria-current='step' על שלב 1", () => {
    render(<CampaignForm costPerMessageIls={0.3} />);
    const nav = screen.getByRole("navigation", { name: /שלבי יצירת הקמפיין/i });
    expect(nav).toBeInTheDocument();
    const currentStep = nav.querySelector("[aria-current='step']");
    expect(currentStep).toBeInTheDocument();
    expect(currentStep).toHaveTextContent("1");
  });
});

describe("CampaignForm — נגישות axe", () => {
  it("שלב 1 ראשוני — axe ללא הפרות נגישות", async () => {
    const { container } = render(<CampaignForm costPerMessageIls={0.3} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
