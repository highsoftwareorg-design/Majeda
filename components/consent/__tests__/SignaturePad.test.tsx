/**
 * בדיקות ל-SignaturePad — משימה 7.6 (FR-CF-04, FR-CF-05).
 *
 * בודק:
 * 1. מרנדר אלמנט canvas.
 * 2. כפתור "נקה" קיים.
 * 3. isEmpty() מחזיר true בהתחלה (לפני ציור).
 * 4. exportDataURL() מחזיר מחרוזת שמתחילה ב-"data:".
 * 5. axe — ללא הפרות נגישות.
 *
 * הרצה: `npx vitest run components/consent/__tests__/SignaturePad.test.tsx`
 */

import React from "react";
import { vi, describe, it, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";

// מוק לנווט — shadcn Button עשוי לטעון next/navigation בעקיפין
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/sign",
}));

// מוק ל-Canvas API (jsdom אינו ממממש canvas)
beforeAll(() => {
  const mockCtx = {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "",
    lineJoin: "",
  };

  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => mockCtx
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  HTMLCanvasElement.prototype.toDataURL = vi.fn(
    () => "data:image/png;base64,test"
  );
});

import { SignaturePad, type SignaturePadRef } from "@/components/consent/SignaturePad";

// ---------------------------------------------------------------------------
// בדיקות — מרנדר בסיסי
// ---------------------------------------------------------------------------

describe("SignaturePad — מרנדר בסיסי", () => {
  it("מרנדר אלמנט canvas", () => {
    render(<SignaturePad />);
    const canvas = document.querySelector("canvas");
    expect(canvas).not.toBeNull();
  });

  it('כפתור "נקה" קיים', () => {
    render(<SignaturePad />);
    const clearButton = screen.getByRole("button", { name: "נקה" });
    expect(clearButton).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// בדיקות — ref API
// ---------------------------------------------------------------------------

describe("SignaturePad — ref API", () => {
  it("isEmpty() מחזיר true בהתחלה (לפני ציור)", () => {
    const ref = React.createRef<SignaturePadRef>();
    render(<SignaturePad ref={ref} />);
    expect(ref.current).not.toBeNull();
    expect(ref.current!.isEmpty()).toBe(true);
  });

  it('exportDataURL() מחזיר מחרוזת שמתחילה ב-"data:"', () => {
    const ref = React.createRef<SignaturePadRef>();
    render(<SignaturePad ref={ref} />);
    expect(ref.current).not.toBeNull();
    const url = ref.current!.exportDataURL();
    expect(typeof url).toBe("string");
    expect(url.startsWith("data:")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// בדיקות — נגישות axe
// ---------------------------------------------------------------------------

describe("SignaturePad — נגישות axe", () => {
  it("axe — ללא הפרות נגישות", async () => {
    const { container } = render(<SignaturePad />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
