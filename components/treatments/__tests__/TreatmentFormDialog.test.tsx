/**
 * בדיקות ל-TreatmentFormDialog — טופס יצירה/עריכה של טיפול (משימה 11.7, FR-AP-02).
 *
 * בודק:
 * 1. יצירה — POST /api/treatments עם גוף נכון; onDone + router.refresh בהצלחה.
 * 2. עריכה — PATCH /api/treatments/:id עם השדות ששונו; refresh בהצלחה.
 * 3. ולידציה בצד לקוח חוסמת שליחה (אין fetch) ומציגה הודעת תיקון.
 * 4. 409 שם כפול — מציג את הודעת השרת inline; אין refresh.
 * 5. RTL/מובייל — כפתור סגירה "סגירה" (size-11), כפתור שמירה min-h-11.
 *
 * הרצה: `npx vitest run components/treatments/__tests__/TreatmentFormDialog.test.tsx`
 */

import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mockRefresh }),
}));

import {
  TreatmentFormDialog,
  type TreatmentListItem,
} from "@/components/treatments/TreatmentFormDialog";

const EXISTING: TreatmentListItem = {
  id: "t1",
  name: "בוטוקס",
  description: "החלקת קמטים",
  durationMinutes: 30,
  price: 500,
  recommendedReturn: "4 חודשים",
  recommendedReturnDays: 120,
  color: "#AABBCC",
  requiresConsentForm: true,
  authorizedTherapists: "שרה",
};

function setValue(id: string, value: string) {
  fireEvent.change(document.getElementById(id) as HTMLInputElement, {
    target: { value },
  });
}

function renderCreate() {
  render(
    <TreatmentFormDialog open onOpenChange={() => {}} treatment={null} />
  );
}

function renderEdit() {
  render(
    <TreatmentFormDialog open onOpenChange={() => {}} treatment={EXISTING} />
  );
}

beforeEach(() => {
  mockRefresh.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TreatmentFormDialog — יצירה (POST)", () => {
  it("שולח POST /api/treatments עם הגוף הנכון ומרענן בהצלחה", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ treatment: { id: "t-new" } }),
    } as Response);

    renderCreate();
    setValue("nt-name", "פילינג");
    setValue("nt-duration", "45");
    setValue("nt-price", "300");
    fireEvent.click(screen.getByRole("button", { name: "שמירת טיפול" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/treatments");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.name).toBe("פילינג");
    expect(body.durationMinutes).toBe("45");
    expect(body.price).toBe("300");

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});

describe("TreatmentFormDialog — עריכה (PATCH)", () => {
  it("שולח PATCH /api/treatments/:id ומרענן בהצלחה", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ treatment: { id: "t1" } }),
    } as Response);

    renderEdit();
    setValue("et-price", "750");
    fireEvent.click(screen.getByRole("button", { name: "שמירת טיפול" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/treatments/t1");
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(init.body as string);
    expect(body.price).toBe("750");

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});

describe("TreatmentFormDialog — ולידציה בצד לקוח", () => {
  it("שם ריק חוסם את ה-POST ומציג הודעת תיקון", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderCreate();
    // ללא שם, עם משך ומחיר בלבד
    setValue("nt-duration", "30");
    setValue("nt-price", "100");
    fireEvent.click(screen.getByRole("button", { name: "שמירת טיפול" }));

    await waitFor(() => {
      expect(screen.getByText("נא לתקן את השדות המסומנים")).toBeInTheDocument();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("TreatmentFormDialog — 409 שם כפול", () => {
  it("מציג את הודעת השרת inline ואינו מרענן", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ errors: { name: "כבר קיים טיפול בשם הזה בקטלוג" } }),
    } as Response);

    renderCreate();
    setValue("nt-name", "בוטוקס");
    setValue("nt-duration", "30");
    setValue("nt-price", "500");
    fireEvent.click(screen.getByRole("button", { name: "שמירת טיפול" }));

    // ההודעה מופיעה גם כשגיאת שדה inline וגם כשגיאת טופס כללית
    await waitFor(() => {
      expect(
        screen.getAllByText("כבר קיים טיפול בשם הזה בקטלוג").length
      ).toBeGreaterThan(0);
    });
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("TreatmentFormDialog — RTL ומובייל", () => {
  it("תוכן הדיאלוג ממורכז סימטרית (inset-x / mx-auto)", () => {
    renderCreate();
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("inset-x-4");
    expect(dialog.className).toContain("mx-auto");
  });

  it("כפתור סגירה עברי בעל touch target 44px", () => {
    renderCreate();
    expect(screen.getByRole("button", { name: "סגירה" }).className).toContain(
      "size-11"
    );
  });

  it("כפתור השמירה בעל touch target 44px", () => {
    renderCreate();
    expect(
      screen.getByRole("button", { name: "שמירת טיפול" }).className
    ).toContain("min-h-11");
  });
});
