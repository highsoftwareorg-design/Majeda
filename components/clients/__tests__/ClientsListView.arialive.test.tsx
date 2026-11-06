/**
 * בדיקת רכיב ClientsListView — אלמנט aria-live "נמצאו N לקוחות" (משימה 3.10).
 *
 * בודק שאלמנט `aria-live="polite"` עם טקסט "נמצאו N לקוחות"
 * מרונדר כשיש תוצאות ב-initialClients.
 *
 * הרצה: `npx vitest run --reporter=verbose components/clients/__tests__/ClientsListView.arialive.test.tsx`
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClientsListView } from "@/components/clients/ClientsListView";
import type { ClientListItem } from "@/components/clients/ClientsListView";

// ─── mock next/link (אינו נדרש ב-jsdom) ───────────────────────────────────
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    React.createElement("a", { href, ...props }, children),
}));

// ─── mock fetch (ClientsListView שולח fetch לשרת — לא נדרש כאן) ───────────
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => [],
});
Object.defineProperty(globalThis, "fetch", { value: mockFetch, writable: true });

// ─── נתוני בדיקה ─────────────────────────────────────────────────────────

function makeClient(id: string, firstName: string, lastName: string): ClientListItem {
  return {
    id,
    firstName,
    lastName,
    phone: `0501234${id}`,
    city: "תל אביב",
    createdAt: new Date().toISOString(),
  };
}

const THREE_CLIENTS: ClientListItem[] = [
  makeClient("001", "דנה", "לוי"),
  makeClient("002", "רחל", "כהן"),
  makeClient("003", "מרים", "ישראלי"),
];

// ─── בדיקות ─────────────────────────────────────────────────────────────────

describe("ClientsListView — aria-live ספירת לקוחות (משימה 3.10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("מציג aria-live='polite' עם טקסט 'נמצאו N לקוחות' כשיש לקוחות", () => {
    render(
      <ClientsListView
        initialClients={THREE_CLIENTS}
        treatments={[]}
        tags={[]}
      />
    );

    // חיפוש לפי aria-live attribute ישירות (ה-<p> לא נושא role="status")
    const politeEl = document.querySelector("[aria-live='polite']");
    expect(politeEl).not.toBeNull();
    expect(politeEl?.textContent).toMatch(/נמצאו 3 לקוחות/);
  });

  it("הטקסט 'נמצאו 3 לקוחות' נגיש ב-DOM", () => {
    render(
      <ClientsListView
        initialClients={THREE_CLIENTS}
        treatments={[]}
        tags={[]}
      />
    );

    expect(screen.getByText(/נמצאו 3 לקוחות/)).toBeTruthy();
  });

  it("מציג 'נמצאו 0 לקוחות' כשהרשימה ריקה", () => {
    render(
      <ClientsListView
        initialClients={[]}
        treatments={[]}
        tags={[]}
      />
    );

    const politeEl = document.querySelector("[aria-live='polite']");
    expect(politeEl).not.toBeNull();
    expect(politeEl?.textContent).toMatch(/נמצאו 0 לקוחות/);
  });

  it("מספר הלקוחות ב-aria-live תואם לאורך initialClients", () => {
    const FIVE_CLIENTS = [
      ...THREE_CLIENTS,
      makeClient("004", "שרה", "ברק"),
      makeClient("005", "נעמי", "שלום"),
    ];

    render(
      <ClientsListView
        initialClients={FIVE_CLIENTS}
        treatments={[]}
        tags={[]}
      />
    );

    const politeEl = document.querySelector("[aria-live='polite']");
    expect(politeEl?.textContent).toMatch(/נמצאו 5 לקוחות/);
  });
});
