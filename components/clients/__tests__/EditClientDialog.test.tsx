/**
 * בדיקות ל-EditClientDialog + כפתור "עריכה" בכותרת הפרופיל — משימה 11.5 (FR-CL-01 עריכה).
 *
 * הרינדור נעשה דרך `ClientProfileHeader` (האינטגרציה האמיתית — הכפתור יושב בכותרת),
 * כדי לכסות גם את "הכפתור מרונדר בכותרת" וגם את זרימת הדיאלוג.
 *
 * בודק:
 * 1. כפתור "עריכה" מרונדר בכותרת (עם touch target 44px) ופותח טופס טעון בערכים הקיימים.
 * 2. שינוי שדה ושמירה — PATCH /api/clients/:id עם השדות ששונו *בלבד* (לא כל הרשומה).
 * 3. ללא שינוי — אין קריאת רשת; הדיאלוג נסגר.
 * 4. תגית קיימת מרונדרת נעולה (disabled); הוספת תגית חדשה → POST /api/clients/bulk-tag.
 * 5. הצלחה מפעילה router.refresh().
 * 6. 409 (טלפון שונה למספר קיים) — הודעה עברית + קישור לכרטיס הקיים; לא refresh.
 * 7. 400 — שגיאות שדה מהשרת מוצגות inline.
 * 8. RTL / מובייל — inset-x / mx-auto, touch targets 44px.
 * 9. אין שדות רפואיים בטופס העריכה (מנוהלים ב-MedicalAlertsForm).
 *
 * הרצה: `npx vitest run components/clients/__tests__/EditClientDialog.test.tsx`
 */

import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ─── mocks ────────────────────────────────────────────────────────────────

const mockRefresh = vi.fn();
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...props }, children),
}));

import { ClientProfileHeader } from "@/components/clients/ClientProfileHeader";
import type { ClientProfileHeaderData } from "@/components/clients/ClientProfileHeader";

const TAG_OPTIONS = [
  { id: "tag-1", name: "VIP" },
  { id: "tag-2", name: "מועדפת" },
  { id: "tag-3", name: "חדשה" },
];

const BASE_CLIENT: ClientProfileHeaderData = {
  id: "client-9",
  firstName: "דנה",
  lastName: "כהן",
  phone: "0541234567",
  gender: "female",
  birthDate: new Date("1990-05-15T00:00:00.000Z"),
  email: "dana@example.com",
  city: "חיפה",
  note: "לקוחה מועדפת",
  source: "instagram",
  marketingConsentChannel: "whatsapp",
  tags: [{ tag: { id: "tag-1", name: "VIP" } }],
};

function renderHeader(client: Partial<ClientProfileHeaderData> = {}) {
  return render(
    <ClientProfileHeader
      client={{ ...BASE_CLIENT, ...client }}
      tagOptions={TAG_OPTIONS}
    />
  );
}

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "עריכה" }));
}

function field(id: string) {
  return document.getElementById(id) as HTMLInputElement;
}

beforeEach(() => {
  mockRefresh.mockReset();
  mockPush.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── 1. כפתור עריכה + טופס טעון מראש ────────────────────────────────────────

describe("EditClientDialog — כפתור עריכה בכותרת", () => {
  it('מרנדר כפתור "עריכה" בכותרת הפרופיל', () => {
    renderHeader();
    const trigger = screen.getByRole("button", { name: "עריכה" });
    expect(trigger).toBeInTheDocument();
  });

  it("הכפתור בעל touch target של 44px (min-h-11)", () => {
    renderHeader();
    expect(screen.getByRole("button", { name: "עריכה" }).className).toContain("min-h-11");
  });

  it("הדיאלוג סגור לפני לחיצה", () => {
    renderHeader();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("לחיצה פותחת טופס עריכה טעון בערכי הלקוח/ה הקיימים", () => {
    renderHeader();
    openDialog();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: /טופס עריכת לקוח\/ה/ })).toBeInTheDocument();

    expect(field("ec-first-name").value).toBe("דנה");
    expect(field("ec-last-name").value).toBe("כהן");
    expect(field("ec-phone").value).toBe("0541234567");
    expect(field("ec-email").value).toBe("dana@example.com");
    expect(field("ec-city").value).toBe("חיפה");
    expect(field("ec-note").value).toBe("לקוחה מועדפת");
    expect(field("ec-source").value).toBe("instagram");
    expect(field("ec-birth-date").value).toBe("1990-05-15");
    expect((document.getElementById("ec-gender") as HTMLSelectElement).value).toBe("female");
    expect((document.getElementById("ec-consent") as HTMLSelectElement).value).toBe("whatsapp");
  });
});

// ─── 2. PATCH רק שדות ששונו ──────────────────────────────────────────────────

describe("EditClientDialog — PATCH עם שדות ששונו בלבד", () => {
  it("שינוי שם פרטי + עיר שולח PATCH עם שני השדות בלבד ומרענן", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);

    renderHeader();
    openDialog();
    fireEvent.change(field("ec-first-name"), { target: { value: "דנית" } });
    fireEvent.change(field("ec-city"), { target: { value: "תל אביב" } });
    fireEvent.click(screen.getByRole("button", { name: "שמירת שינויים" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/clients/client-9");
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(init.body as string);
    // רק השדות ששונו — לא כל הרשומה
    expect(Object.keys(body).sort()).toEqual(["city", "firstName"]);
    expect(body.firstName).toBe("דנית");
    expect(body.city).toBe("תל אביב");
    expect(body.phone).toBeUndefined();
    expect(body.lastName).toBeUndefined();

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("שינוי ערוץ ההסכמה בלבד שולח רק marketingConsentChannel", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);

    renderHeader();
    openDialog();
    fireEvent.change(document.getElementById("ec-consent") as HTMLSelectElement, {
      target: { value: "sms" },
    });
    fireEvent.click(screen.getByRole("button", { name: "שמירת שינויים" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(Object.keys(body)).toEqual(["marketingConsentChannel"]);
    expect(body.marketingConsentChannel).toBe("sms");
  });
});

// ─── 3. ללא שינוי — אין רשת ──────────────────────────────────────────────────

describe("EditClientDialog — שמירה ללא שינוי", () => {
  it("שמירה ללא שינוי כלל אינה שולחת בקשת רשת", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderHeader();
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: "שמירת שינויים" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

// ─── 4. תגיות — קיימות נעולות, חדשות דרך bulk-tag ────────────────────────────

describe("EditClientDialog — תגיות", () => {
  it("תגית קיימת מרונדרת נעולה (disabled) ולחוצה (aria-pressed)", () => {
    renderHeader();
    openDialog();
    const vip = screen.getByRole("button", { name: "VIP" });
    expect(vip).toBeDisabled();
    expect(vip.getAttribute("aria-pressed")).toBe("true");
    // רמז עברי שתגיות קיימות אינן ניתנות להסרה
    expect(screen.getByText(/תגיות קיימות אינן ניתנות להסרה/)).toBeInTheDocument();
  });

  it("הוספת תגית חדשה שולחת POST /api/clients/bulk-tag ללא PATCH", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);

    renderHeader();
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: "חדשה" })); // tag-3
    fireEvent.click(screen.getByRole("button", { name: "שמירת שינויים" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/clients/bulk-tag");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ clientIds: ["client-9"], tagId: "tag-3" });

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});

// ─── 5. 409 טלפון כפול ───────────────────────────────────────────────────────

describe("EditClientDialog — 409 טלפון שונה למספר קיים", () => {
  it("מציג הודעה עברית + קישור לכרטיס הקיים; אינו מרענן", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/clients/client-9" && init?.method === "PATCH") {
          return { status: 409, json: async () => ({ errors: { phone: "כבר קיים" } }) } as Response;
        }
        // GET lookup — טלפון מנורמל של לקוח/ה קיים/ת אחר/ת
        return {
          ok: true,
          status: 200,
          json: async () => ({
            clients: [
              { id: "existing-77", firstName: "רונית", lastName: "לוי", phone: "0529999999" },
            ],
          }),
        } as Response;
      });

    renderHeader();
    openDialog();
    fireEvent.change(field("ec-phone"), { target: { value: "0529999999" } });
    fireEvent.click(screen.getByRole("button", { name: "שמירת שינויים" }));

    await waitFor(() => {
      expect(screen.getByText(/מספר הטלפון שייך ללקוח\/ה רונית לוי/)).toBeInTheDocument();
    });
    const link = screen.getByRole("link", { name: /מעבר לכרטיס הלקוח/ });
    expect(link).toHaveAttribute("href", "/clients/existing-77");
    // ה-GET נקרא עם הטלפון המנורמל
    expect(fetchSpy.mock.calls.some(([u]) => String(u).includes("/api/clients?q="))).toBe(true);
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

// ─── 6. 400 שגיאות שרת ───────────────────────────────────────────────────────

describe("EditClientDialog — 400 שגיאות שרת", () => {
  it("מציג שגיאות שדה מהשרת inline ואינו מרענן", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 400,
      json: async () => ({
        error: "נא לתקן את השדות המסומנים",
        errors: { email: "כתובת אימייל לא תקינה" },
      }),
    } as Response);

    renderHeader();
    openDialog();
    // שינוי אימייל כדי שיהיה PATCH לשלוח
    fireEvent.change(field("ec-email"), { target: { value: "changed@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "שמירת שינויים" }));

    await waitFor(() => {
      expect(screen.getByText("כתובת אימייל לא תקינה")).toBeInTheDocument();
    });
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

// ─── 7. RTL / מובייל ─────────────────────────────────────────────────────────

describe("EditClientDialog — RTL ומובייל", () => {
  it("תוכן הדיאלוג ממורכז סימטרית (inset-x / mx-auto)", () => {
    renderHeader();
    openDialog();
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("inset-x-4");
    expect(dialog.className).toContain("mx-auto");
    expect(dialog.className).toContain("max-w-lg");
  });

  it("כפתור השמירה בעל touch target של 44px (min-h-11)", () => {
    renderHeader();
    openDialog();
    expect(screen.getByRole("button", { name: "שמירת שינויים" }).className).toContain("min-h-11");
  });

  it("כפתור סגירה עם aria-label עברי ו-touch target 44px", () => {
    renderHeader();
    openDialog();
    const close = screen.getByRole("button", { name: "סגירה" });
    expect(close.className).toContain("size-11");
  });
});

// ─── 8. אין שדות רפואיים בטופס העריכה ────────────────────────────────────────

describe("EditClientDialog — שדות רפואיים אינם בטופס", () => {
  it("הטופס אינו כולל שדות אלרגיות/תרופות/הריון/מצבים רפואיים", () => {
    renderHeader();
    openDialog();
    for (const name of ["allergies", "medications", "pregnancyNursing", "medicalConditions"]) {
      expect(document.getElementById(`ec-${name}`)).toBeNull();
    }
  });
});
