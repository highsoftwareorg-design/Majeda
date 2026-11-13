/**
 * בדיקות ל-ToastProvider / useToast — מערכת הודעות ללא תלות (סעיף 12, מעקב).
 *
 * בודק:
 * 1. useToast ללא Provider — לא זורק (no-op).
 * 2. קריאה ל-toast מציגה הודעה באזור role="status" / aria-live="polite".
 * 3. כפתור הסגירה (≥44px, aria-label עברי) מסיר את ההודעה.
 * 4. סגירה אוטומטית אחרי durationMs (fake timers); durationMs=0 — נשאר.
 * 5. variant=error מסומן ב-data-variant ובתווית sr-only "שגיאה".
 * 6. לכל היותר 3 הודעות בו-זמנית.
 *
 * הרצה: `npx vitest run components/common/__tests__/Toast.test.tsx`
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ToastProvider, useToast, type ToastOptions } from "@/components/common/Toast";

function Trigger({
  message = "הפעולה הצליחה",
  options,
}: {
  message?: string;
  options?: ToastOptions;
}) {
  const { toast } = useToast();
  return (
    <button type="button" onClick={() => toast(message, options)}>
      הצג
    </button>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useToast ללא Provider", () => {
  it("לא זורק — toast היא no-op", () => {
    render(<Trigger />);
    expect(() => fireEvent.click(screen.getByRole("button", { name: "הצג" }))).not.toThrow();
    expect(screen.queryByText("הפעולה הצליחה")).not.toBeInTheDocument();
  });
});

describe("ToastProvider — הצגה וסגירה", () => {
  it("מציג את ההודעה באזור aria-live polite", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );
    const viewport = screen.getByRole("status");
    expect(viewport).toHaveAttribute("aria-live", "polite");

    fireEvent.click(screen.getByRole("button", { name: "הצג" }));
    expect(screen.getByText("הפעולה הצליחה")).toBeInTheDocument();
    expect(screen.getByText("הצלחה:")).toBeInTheDocument(); // sr-only label
  });

  it("כפתור הסגירה מסיר את ההודעה ועומד ב-44px", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "הצג" }));
    const close = screen.getByRole("button", { name: "סגירת ההודעה" });
    expect(close.className).toContain("min-h-11");
    expect(close.className).toContain("min-w-11");

    fireEvent.click(close);
    expect(screen.queryByText("הפעולה הצליחה")).not.toBeInTheDocument();
  });

  it("נסגר אוטומטית אחרי durationMs", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger options={{ durationMs: 1000 }} />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "הצג" }));
    expect(screen.getByText("הפעולה הצליחה")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(screen.getByText("הפעולה הצליחה")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText("הפעולה הצליחה")).not.toBeInTheDocument();
  });

  it("durationMs=0 — אינו נסגר אוטומטית", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger options={{ durationMs: 0 }} />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "הצג" }));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText("הפעולה הצליחה")).toBeInTheDocument();
  });

  it("variant=error — data-variant ותווית sr-only 'שגיאה'", () => {
    render(
      <ToastProvider>
        <Trigger message="משהו השתבש" options={{ variant: "error" }} />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "הצג" }));
    const text = screen.getByText("משהו השתבש");
    expect(text.closest("[data-variant]")).toHaveAttribute("data-variant", "error");
    expect(screen.getByText("שגיאה:")).toBeInTheDocument();
  });

  it("מציג לכל היותר 3 הודעות בו-זמנית", () => {
    render(
      <ToastProvider>
        <Trigger options={{ durationMs: 0 }} />
      </ToastProvider>
    );
    const btn = screen.getByRole("button", { name: "הצג" });
    for (let i = 0; i < 5; i++) fireEvent.click(btn);
    expect(screen.getAllByText("הפעולה הצליחה")).toHaveLength(3);
  });
});
