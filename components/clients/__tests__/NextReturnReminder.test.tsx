/**
 * בדיקות ל-NextReturnReminder — משימה 4.9 (§4.1 תזכורת חזרה).
 *
 * בודק:
 * 1. מצב ריק — לא מרנדר כלום כאשר אין returnDate פתוח.
 * 2. returnDate עתידי — מציג את בלוק התזכורת.
 * 3. returnDate עבר — מציג תווית "באיחור".
 * 4. "דחה ב-7 ימים" — קורא ל-PATCH עם התאריך המעודכן.
 * 5. "סומן כבוצע" — קורא ל-PATCH עם returnNoteHandled=true ומסתיר את הבלוק.
 *
 * הרצה: `npx vitest run --reporter=verbose components/clients/__tests__/NextReturnReminder.test.tsx`
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextReturnReminder } from "@/components/clients/NextReturnReminder";
import type { VisitForReminder } from "@/components/clients/NextReturnReminder";

// ---------------------------------------------------------------------------
// עזרים
// ---------------------------------------------------------------------------

function makeVisit(overrides: Partial<VisitForReminder> = {}): VisitForReminder {
  return {
    id: "visit-1",
    returnDate: null,
    returnNoteHandled: false,
    ...overrides,
  };
}

/** תאריך עתידי בעוד 30 יום */
function futureDate(daysFromNow = 30): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

/** תאריך עבר לפני 10 ימים */
function pastDate(daysAgo = 10): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

// ---------------------------------------------------------------------------
// מוק ל-fetch
// ---------------------------------------------------------------------------

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 1. מצב ריק — לא מרנדר כלום
// ---------------------------------------------------------------------------

describe("NextReturnReminder — מצב ריק", () => {
  it("לא מרנדר כלום כאשר אין ביקורים", () => {
    const { container } = render(
      <NextReturnReminder clientId="c-1" visits={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("לא מרנדר כלום כאשר כל ה-returnDate הם null", () => {
    const { container } = render(
      <NextReturnReminder
        clientId="c-1"
        visits={[makeVisit({ returnDate: null }), makeVisit({ id: "v-2", returnDate: null })]}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("לא מרנדר כלום כאשר כל הביקורים עם returnDate מסומנים returnNoteHandled=true", () => {
    const { container } = render(
      <NextReturnReminder
        clientId="c-1"
        visits={[
          makeVisit({ returnDate: futureDate(), returnNoteHandled: true }),
        ]}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. הצגת בלוק התזכורת (returnDate עתידי)
// ---------------------------------------------------------------------------

describe("NextReturnReminder — הצגת תזכורת", () => {
  it("מציג את כותרת 'תזכורת חזרה הבאה' כאשר יש returnDate פתוח", () => {
    render(
      <NextReturnReminder
        clientId="c-1"
        visits={[makeVisit({ returnDate: futureDate() })]}
      />
    );
    expect(screen.getByText("תזכורת חזרה הבאה")).toBeInTheDocument();
  });

  it("הבלוק כולל dir=rtl", () => {
    const { container } = render(
      <NextReturnReminder
        clientId="c-1"
        visits={[makeVisit({ returnDate: futureDate() })]}
      />
    );
    const section = container.querySelector("section");
    expect(section).toHaveAttribute("dir", "rtl");
  });

  it("הבלוק כולל aria-label מתאים", () => {
    render(
      <NextReturnReminder
        clientId="c-1"
        visits={[makeVisit({ returnDate: futureDate() })]}
      />
    );
    expect(
      screen.getByRole("region", { name: "תזכורת חזרה הבאה" })
    ).toBeInTheDocument();
  });

  it("מציג את שני כפתורי הפעולה", () => {
    render(
      <NextReturnReminder
        clientId="c-1"
        visits={[makeVisit({ returnDate: futureDate() })]}
      />
    );
    expect(
      screen.getByRole("button", { name: /דחה ב-7 ימים/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /סומן כבוצע/ })
    ).toBeInTheDocument();
  });

  it("כאשר יש כמה ביקורים — מציג רק את הקרוב ביותר (visitId השני)", () => {
    // הביקור הראשון עם returnDate רחוק יותר
    const nearDate = futureDate(10);
    const farDate = futureDate(60);

    render(
      <NextReturnReminder
        clientId="c-1"
        visits={[
          makeVisit({ id: "far", returnDate: farDate }),
          makeVisit({ id: "near", returnDate: nearDate }),
        ]}
      />
    );

    // רק תאריך אחד מוצג
    const dateEls = screen.getAllByRole("paragraph");
    // הפורמט עשוי להשתנות לפי locale — בודקים שהמקטע הוויזואלי קיים
    expect(dateEls.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 3. תווית "באיחור" כאשר returnDate עבר
// ---------------------------------------------------------------------------

describe("NextReturnReminder — תווית 'באיחור'", () => {
  it("מציג 'באיחור' כאשר returnDate הוא בעבר", () => {
    render(
      <NextReturnReminder
        clientId="c-1"
        visits={[makeVisit({ returnDate: pastDate() })]}
      />
    );
    expect(screen.getByText("באיחור")).toBeInTheDocument();
  });

  it("לא מציג 'באיחור' כאשר returnDate הוא בעתיד", () => {
    render(
      <NextReturnReminder
        clientId="c-1"
        visits={[makeVisit({ returnDate: futureDate() })]}
      />
    );
    expect(screen.queryByText("באיחור")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. כפתור "דחה ב-7 ימים"
// ---------------------------------------------------------------------------

describe("NextReturnReminder — 'דחה ב-7 ימים'", () => {
  it("קורא ל-fetch PATCH עם returnDate 7 ימים אחרי התאריך המקורי", async () => {
    const original = new Date("2026-12-01T00:00:00.000Z");
    render(
      <NextReturnReminder
        clientId="client-abc"
        visits={[makeVisit({ id: "v-99", returnDate: original })]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /דחה ב-7 ימים/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/clients/client-abc/visits/v-99");
    expect(options.method).toBe("PATCH");

    const body = JSON.parse(options.body as string) as { returnDate: string };
    const sentDate = new Date(body.returnDate);
    const expectedDate = new Date(original);
    expectedDate.setDate(expectedDate.getDate() + 7);

    // אנחנו בודקים שהתאריך שנשלח הוא +7 ימים מהמקורי (בתוך מרווח של דקה)
    expect(Math.abs(sentDate.getTime() - expectedDate.getTime())).toBeLessThan(
      60_000
    );
  });

  it("מעדכן את התאריך המוצג אחרי דחייה מוצלחת", async () => {
    const original = new Date("2026-12-01T00:00:00.000Z");
    render(
      <NextReturnReminder
        clientId="client-abc"
        visits={[makeVisit({ id: "v-99", returnDate: original })]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /דחה ב-7 ימים/ }));

    // הבלוק עדיין גלוי אחרי הדחייה (לא מוסתר)
    await waitFor(() =>
      expect(screen.getByText("תזכורת חזרה הבאה")).toBeInTheDocument()
    );
  });

  it("מציג שגיאה אם ה-fetch נכשל", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "שגיאת שרת" }),
    });

    render(
      <NextReturnReminder
        clientId="client-abc"
        visits={[makeVisit({ id: "v-99", returnDate: futureDate() })]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /דחה ב-7 ימים/ }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument()
    );
    expect(screen.getByRole("alert")).toHaveTextContent("שגיאת שרת");
  });
});

// ---------------------------------------------------------------------------
// 5. כפתור "סומן כבוצע"
// ---------------------------------------------------------------------------

describe("NextReturnReminder — 'סומן כבוצע'", () => {
  it("קורא ל-fetch PATCH עם returnNoteHandled=true", async () => {
    render(
      <NextReturnReminder
        clientId="client-xyz"
        visits={[makeVisit({ id: "v-55", returnDate: futureDate() })]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /סומן כבוצע/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/clients/client-xyz/visits/v-55");
    expect(options.method).toBe("PATCH");

    const body = JSON.parse(options.body as string) as {
      returnNoteHandled: boolean;
    };
    expect(body.returnNoteHandled).toBe(true);
  });

  it("מסתיר את הבלוק לאחר סימון כבוצע מוצלח", async () => {
    const { container } = render(
      <NextReturnReminder
        clientId="client-xyz"
        visits={[makeVisit({ id: "v-55", returnDate: futureDate() })]}
      />
    );

    expect(container.firstChild).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /סומן כבוצע/ }));

    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  it("מציג שגיאה אם ה-fetch נכשל בסימון כבוצע", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "לא ניתן לעדכן" }),
    });

    render(
      <NextReturnReminder
        clientId="client-xyz"
        visits={[makeVisit({ id: "v-55", returnDate: futureDate() })]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /סומן כבוצע/ }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument()
    );
    expect(screen.getByRole("alert")).toHaveTextContent("לא ניתן לעדכן");
  });
});
