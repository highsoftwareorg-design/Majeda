/**
 * בדיקות ל-ConsentList — משימה 7.9 (FR-PR-08).
 *
 * בודק:
 * 1. מרנדר שורה אחת לכל פריט הסכמה (בטבלה).
 * 2. סטטוס "פג תוקף" מרונדר עם מחלקת text-red-800 (badge אדום).
 * 3. axe — ללא הפרות נגישות.
 *
 * הרצה: `npx vitest run components/clients/__tests__/ConsentList.test.tsx`
 */

import { vi, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";

// רכיב זה אינו משתמש ב-next/navigation, אך נמוק למקרה שרכיבי Lucide ייטענו בעקיפין
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/clients/client-1",
}));

import { ConsentList } from "@/components/clients/ConsentList";
import type { ConsentItem } from "@/components/clients/ConsentList";

// ---------------------------------------------------------------------------
// נתוני עזר
// ---------------------------------------------------------------------------

const SAMPLE_CONSENTS: ConsentItem[] = [
  {
    id: "c1",
    templateName: "טופס הסכמה לפילינג",
    templateVersion: 1,
    signedAt: "2026-11-05T10:00:00.000Z",
    expiresAt: "2026-11-01T10:00:00.000Z",
    pdfStorageKey: "files/c1.pdf",
    status: "פג תוקף",
  },
  {
    id: "c2",
    templateName: "טופס כללי",
    templateVersion: 2,
    signedAt: "2026-10-01T10:00:00.000Z",
    expiresAt: null,
    pdfStorageKey: null,
    status: "בתוקף",
  },
];

const PENDING_CONSENT: ConsentItem = {
  id: "c3",
  templateName: "טופס ממתין",
  templateVersion: 1,
  signedAt: null,
  expiresAt: null,
  pdfStorageKey: null,
  status: "ממתין לחתימה",
};

// ---------------------------------------------------------------------------
// בדיקות
// ---------------------------------------------------------------------------

describe("ConsentList — רינדור שורות", () => {
  it("מרנדר שורה אחת לכל פריט הסכמה (בטבלה)", () => {
    const { container } = render(<ConsentList consents={SAMPLE_CONSENTS} />);
    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
  });

  it("מרנדר מצב ריק כאשר אין הסכמות", () => {
    render(<ConsentList consents={[]} />);
    expect(screen.getByText(/אין טפסי הסכמה/)).toBeInTheDocument();
  });
});

describe("ConsentList — סטטוס 'פג תוקף' בצבע אדום", () => {
  it("badge של 'פג תוקף' מכיל את המחלקה text-red-800", () => {
    render(<ConsentList consents={SAMPLE_CONSENTS} />);
    const badges = screen.getAllByText("פג תוקף");
    expect(badges.length).toBeGreaterThan(0);
    // הראשון (טבלה) — בדיקת מחלקת צבע אדום
    expect(badges[0].className).toContain("text-red-800");
  });

  it("badge של 'בתוקף' אינו מכיל text-red-800", () => {
    render(<ConsentList consents={SAMPLE_CONSENTS} />);
    const badges = screen.getAllByText("בתוקף");
    expect(badges[0].className).not.toContain("text-red-800");
    expect(badges[0].className).toContain("text-green-800");
  });

  it("badge של 'ממתין לחתימה' אינו מכיל text-red-800", () => {
    render(<ConsentList consents={[PENDING_CONSENT]} />);
    const badges = screen.getAllByText("ממתין לחתימה");
    expect(badges[0].className).not.toContain("text-red-800");
    expect(badges[0].className).toContain("text-orange-800");
  });
});

describe("ConsentList — נגישות axe", () => {
  it("רשימה עם פריטים — axe ללא הפרות נגישות", async () => {
    const { container } = render(<ConsentList consents={SAMPLE_CONSENTS} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("מצב ריק — axe ללא הפרות נגישות", async () => {
    const { container } = render(<ConsentList consents={[]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
