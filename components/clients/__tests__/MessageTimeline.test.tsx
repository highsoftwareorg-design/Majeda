/**
 * בדיקות ל-MessageTimeline — משימה 6.7 (FR-WA-06).
 *
 * בודק:
 * 1. mock עם 3 הודעות — 3 שורות מרונדרות בסדר כרונולוגי הפוך (החדש ביותר ראשון).
 * 2. סטטוס MOCK מוצג כ"מדומה (פיתוח)" ולא כ"נשלח" או כל תווית אחרת.
 * 3. מערך הודעות ריק — מרנדר טקסט "אין הודעות".
 * 4. סטטוס SENT מוצג כ"נשלח".
 * 5. סוג מקור "appointment" מוצג כ"תזכורת תור".
 * 6. סוג מקור "follow_up" מוצג כ"מעקב".
 * 7. axe — ללא הפרות נגישות.
 *
 * הרצה: `npx vitest run components/clients/__tests__/MessageTimeline.test.tsx`
 */

import { vi, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";

// 'use client' רכיב — אין צורך למוק next/server אבל next/navigation עלול להיטען בעקיפין.
// נמוק אותו למקרה שרכיבים פנימיים ישתמשו בו.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/clients/client-1",
}));

import { MessageTimeline } from "@/components/clients/MessageTimeline";

// ---------------------------------------------------------------------------
// נתוני עזר
// ---------------------------------------------------------------------------

/** יצירת הודעה מדומה עם ערכי ברירת מחדל סבירים */
function makeMessage(overrides: Partial<{
  id: string;
  channel: string;
  templateId: string | null;
  status: string;
  sourceType: string | null;
  sentAt: string | null;
  createdAt: string;
}> = {}) {
  return {
    id: "msg-default",
    channel: "whatsapp",
    templateId: null,
    status: "SENT",
    sourceType: "appointment",
    sentAt: null,
    createdAt: "2026-11-07T10:00:00.000Z",
    ...overrides,
  };
}

/** 3 הודעות ממוינות מהחדש לישן (כפי שמגיעות מה-API) */
const THREE_MESSAGES = [
  makeMessage({
    id: "msg-1",
    sourceType: "appointment",
    status: "SENT",
    createdAt: "2026-11-07T10:00:00.000Z",
  }),
  makeMessage({
    id: "msg-2",
    sourceType: "follow_up",
    status: "DELIVERED",
    createdAt: "2026-11-06T10:00:00.000Z",
  }),
  makeMessage({
    id: "msg-3",
    sourceType: "campaign",
    status: "MOCK",
    createdAt: "2026-11-05T10:00:00.000Z",
  }),
];

// ---------------------------------------------------------------------------
// בדיקות
// ---------------------------------------------------------------------------

describe("MessageTimeline — מצב ריק", () => {
  it('מרנדר טקסט "אין הודעות" כאשר מערך ריק', () => {
    render(<MessageTimeline messages={[]} />);
    expect(screen.getByText(/אין הודעות/)).toBeInTheDocument();
  });
});

describe("MessageTimeline — 3 הודעות", () => {
  it("מרנדר 3 שורות בסדר כרונולוגי הפוך (החדש ביותר ראשון)", () => {
    const { container } = render(<MessageTimeline messages={THREE_MESSAGES} />);

    // בדיקה שיש בדיוק 3 שורות (div עם border)
    const rows = container.querySelectorAll(
      "div.border.border-gray-200.rounded-lg"
    );
    expect(rows).toHaveLength(3);

    // בדיקת סדר: שורה ראשונה = appointment (תזכורת תור), שנייה = follow_up (מעקב), שלישית = campaign (קמפיין)
    expect(rows[0]).toHaveTextContent("תזכורת תור");
    expect(rows[1]).toHaveTextContent("מעקב");
    expect(rows[2]).toHaveTextContent("קמפיין");
  });
});

describe("MessageTimeline — סטטוסים", () => {
  it('סטטוס MOCK מוצג כ"מדומה (פיתוח)" ולא כ"נשלח"', () => {
    render(
      <MessageTimeline
        messages={[makeMessage({ status: "MOCK" })]}
      />
    );
    expect(screen.getByText("מדומה (פיתוח)")).toBeInTheDocument();
    expect(screen.queryByText("נשלח")).not.toBeInTheDocument();
  });

  it('סטטוס SENT מוצג כ"נשלח"', () => {
    render(
      <MessageTimeline
        messages={[makeMessage({ status: "SENT" })]}
      />
    );
    expect(screen.getByText("נשלח")).toBeInTheDocument();
  });
});

describe("MessageTimeline — סוגי מקור", () => {
  it('sourceType "appointment" מוצג כ"תזכורת תור"', () => {
    render(
      <MessageTimeline
        messages={[makeMessage({ sourceType: "appointment" })]}
      />
    );
    expect(screen.getByText("תזכורת תור")).toBeInTheDocument();
  });

  it('sourceType "follow_up" מוצג כ"מעקב"', () => {
    render(
      <MessageTimeline
        messages={[makeMessage({ sourceType: "follow_up" })]}
      />
    );
    expect(screen.getByText("מעקב")).toBeInTheDocument();
  });
});

describe("MessageTimeline — נגישות axe", () => {
  it("3 הודעות — axe ללא הפרות נגישות", async () => {
    const { container } = render(<MessageTimeline messages={THREE_MESSAGES} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("מצב ריק — axe ללא הפרות נגישות", async () => {
    const { container } = render(<MessageTimeline messages={[]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
