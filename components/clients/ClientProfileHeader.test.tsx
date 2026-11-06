/**
 * בדיקות ל-ClientProfileHeader — משימה 4.2.
 *
 * בודק: קישור wa.me, גיל מחושב, תגיות, הסכמה לדיוור.
 * מריץ: `npx vitest run --reporter=verbose components/clients/ClientProfileHeader.test.tsx`
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  ClientProfileHeader,
  toWhatsAppLink,
  computeAge,
  type ClientProfileHeaderData,
} from "./ClientProfileHeader";

// --- נתוני mock ---

function makeBirthDate(yearsAgo: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yearsAgo);
  return d;
}

const MOCK_CLIENT: ClientProfileHeaderData = {
  id: "test-id-1",
  firstName: "דנה",
  lastName: "כהן",
  phone: "0541234567",
  gender: "female",
  birthDate: makeBirthDate(30),
  source: "referral",
  marketingConsentChannel: "whatsapp",
  tags: [{ tag: { id: "tag-1", name: "VIP" } }],
};

// --- בדיקות פונקציות עזר ---

describe("toWhatsAppLink", () => {
  it("ממיר מספר מקומי 05X ל-wa.me/972X", () => {
    expect(toWhatsAppLink("0541234567")).toBe("https://wa.me/972541234567");
  });

  it("מספר שכבר מתחיל ב-972 נשמר כמו שהוא", () => {
    expect(toWhatsAppLink("972541234567")).toBe("https://wa.me/972541234567");
  });

  it("מסיר תווים לא-ספרתיים לפני ההמרה", () => {
    expect(toWhatsAppLink("054-123-4567")).toBe("https://wa.me/972541234567");
  });
});

describe("computeAge", () => {
  it("מחזיר null כשאין תאריך לידה", () => {
    expect(computeAge(null)).toBeNull();
  });

  it("מחשב גיל נכון", () => {
    const birthDate = makeBirthDate(30);
    // גיל 30 (ייתכן ± 1 אם עברנו/לא עברנו את יום הולדת השנה)
    const age = computeAge(birthDate);
    expect(age).toBeGreaterThanOrEqual(29);
    expect(age).toBeLessThanOrEqual(31);
  });
});

// --- בדיקות רינדור ---

describe("ClientProfileHeader", () => {
  it("מציג שם מלא של הלקוחה", () => {
    render(<ClientProfileHeader client={MOCK_CLIENT} />);
    expect(screen.getByText("דנה כהן")).toBeInTheDocument();
  });

  it("קישור הטלפון מוביל ל-wa.me/972541234567", () => {
    render(<ClientProfileHeader client={MOCK_CLIENT} />);
    const link = screen.getByRole("link", { name: /פתח שיחת WhatsApp/i });
    expect(link).toHaveAttribute("href", "https://wa.me/972541234567");
  });

  it("מציג גיל 30 (± 1 לגבול שנה)", () => {
    render(<ClientProfileHeader client={MOCK_CLIENT} />);
    // גיל מוצג בתוך אלמנט <strong>
    const ageEl = screen.getByText(/^3[0-1]$/);
    expect(ageEl).toBeInTheDocument();
  });

  it('מציג את שם התגית "VIP"', () => {
    render(<ClientProfileHeader client={MOCK_CLIENT} />);
    expect(screen.getByText("VIP")).toBeInTheDocument();
  });

  it('מציג "הסכמה לדיוור: כן" כשיש ערוץ הסכמה', () => {
    render(<ClientProfileHeader client={MOCK_CLIENT} />);
    expect(screen.getByText("הסכמה לדיוור:")).toBeInTheDocument();
    expect(screen.getByText("כן")).toBeInTheDocument();
  });

  it('מציג "לא צוין" כשאין הסכמה (none)', () => {
    const clientNoConsent: ClientProfileHeaderData = {
      ...MOCK_CLIENT,
      marketingConsentChannel: "none",
    };
    render(<ClientProfileHeader client={clientNoConsent} />);
    expect(screen.getByText("לא צוין")).toBeInTheDocument();
  });

  it('מציג "גיל: —" כשאין תאריך לידה', () => {
    const clientNoBirth: ClientProfileHeaderData = {
      ...MOCK_CLIENT,
      birthDate: null,
    };
    render(<ClientProfileHeader client={clientNoBirth} />);
    expect(screen.getByText(/גיל: —/)).toBeInTheDocument();
  });

  it("מציג מקור הגעה מתורגם", () => {
    render(<ClientProfileHeader client={MOCK_CLIENT} />);
    expect(screen.getByText("מקור הגעה:")).toBeInTheDocument();
    expect(screen.getByText("המלצה")).toBeInTheDocument();
  });

  it("הקישור נפתח בלשונית חדשה (target=_blank)", () => {
    render(<ClientProfileHeader client={MOCK_CLIENT} />);
    const link = screen.getByRole("link", { name: /פתח שיחת WhatsApp/i });
    expect(link).toHaveAttribute("target", "_blank");
  });
});
