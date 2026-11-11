/**
 * בדיקות ל-NewClientDialog — משימה 11.4 (FR-CL-01 יצירה, FR-CL-02 כפילות טלפון).
 *
 * בודק:
 * 1. כפתור ה-trigger "+ לקוח/ה חדש/ה" מרונדר עם touch target של 44px.
 * 2. פתיחת הדיאלוג מציגה את כל שדות FR-CL-01 עם תוויות עבריות; שדות חובה מסומנים.
 * 3. ולידציית טלפון ישראלי בצד לקוח — דוחה מספר לא תקין וחוסמת שליחה; מקבלת תקין.
 * 4. שליחה מוצלחת — POST /api/clients עם המבנה הנכון + ניווט לפרופיל החדש.
 * 5. 409 כפילות — הודעה עברית + קישור לכרטיס הקיים (התאמה פעילה דרך GET);
 *    נפילה ל-/clients/duplicates כשאין התאמה פעילה.
 * 6. 400 — שגיאות שדה מהשרת מוצגות inline.
 * 7. RTL / מובייל — מיקום סימטרי (inset-x), touch targets 44px, כפתור סגירה.
 *
 * הרצה: `npx vitest run --reporter=verbose components/clients/__tests__/NewClientDialog.test.tsx`
 */

import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ─── mocks ────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
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

import { NewClientDialog } from "@/components/clients/NewClientDialog";
import {
  validateCreateClient,
  isClientValid,
} from "@/lib/validations/clients";

const TAGS = [
  { id: "tag-1", name: "VIP" },
  { id: "tag-2", name: "מועדפת" },
];

function renderDialog() {
  return render(<NewClientDialog tags={TAGS} />);
}

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /לקוח\/ה חדש\/ה/ }));
}

/** ממלא את שלושת שדות החובה בערכים תקינים. */
function fillRequired(phone = "0541234567") {
  fireEvent.change(document.getElementById("nc-first-name") as HTMLInputElement, {
    target: { value: "דנה" },
  });
  fireEvent.change(document.getElementById("nc-last-name") as HTMLInputElement, {
    target: { value: "כהן" },
  });
  fireEvent.change(document.getElementById("nc-phone") as HTMLInputElement, {
    target: { value: phone },
  });
}

beforeEach(() => {
  mockPush.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── 1. trigger ─────────────────────────────────────────────────────────────

describe("NewClientDialog — כפתור trigger", () => {
  it('מרנדר כפתור "+ לקוח/ה חדש/ה"', () => {
    renderDialog();
    const trigger = screen.getByRole("button", { name: /לקוח\/ה חדש\/ה/ });
    expect(trigger).toBeInTheDocument();
    expect(trigger.textContent).toContain("+ לקוח/ה חדש/ה");
  });

  it("הכפתור בעל touch target של 44px (min-h-11)", () => {
    renderDialog();
    const trigger = screen.getByRole("button", { name: /לקוח\/ה חדש\/ה/ });
    expect(trigger.className).toContain("min-h-11");
  });

  it("הדיאלוג סגור לפני לחיצה", () => {
    renderDialog();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

// ─── 2. שדות FR-CL-01 ──────────────────────────────────────────────────────

describe("NewClientDialog — פתיחה ושדות FR-CL-01", () => {
  it("לחיצה על ה-trigger פותחת את הדיאלוג", () => {
    renderDialog();
    openDialog();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: /טופס לקוח\/ה חדש\/ה/ })).toBeInTheDocument();
  });

  it("כל שדות FR-CL-01 מוצגים עם תוויות עבריות", () => {
    renderDialog();
    openDialog();
    const ids = [
      "nc-first-name",
      "nc-last-name",
      "nc-phone",
      "nc-gender",
      "nc-birth-date",
      "nc-email",
      "nc-city",
      "nc-source",
      "nc-consent",
      "nc-note",
    ];
    for (const id of ids) {
      expect(document.getElementById(id)).not.toBeNull();
    }
    // תוויות עבריות — שלושת שדות החובה מקושרים ל-label (getByLabelText),
    // כי המחרוזות מופיעות גם בתיאור הדיאלוג.
    expect(screen.getByLabelText(/שם פרטי/)).toBe(document.getElementById("nc-first-name"));
    expect(screen.getByLabelText(/שם משפחה/)).toBe(document.getElementById("nc-last-name"));
    expect(screen.getByLabelText(/טלפון/)).toBe(document.getElementById("nc-phone"));
    // "אימייל" מופיע גם כאפשרות בערוץ ההסכמה — נבדק דרך קישור ה-label.
    expect(screen.getByLabelText("מין")).toBe(document.getElementById("nc-gender"));
    expect(screen.getByLabelText("תאריך לידה")).toBe(document.getElementById("nc-birth-date"));
    expect(screen.getByLabelText("אימייל")).toBe(document.getElementById("nc-email"));
    expect(screen.getByLabelText("עיר")).toBe(document.getElementById("nc-city"));
    expect(screen.getByLabelText("מקור הגעה")).toBe(document.getElementById("nc-source"));
    expect(screen.getByLabelText("ערוץ הסכמה לדיוור")).toBe(document.getElementById("nc-consent"));
    expect(screen.getByLabelText("הערות")).toBe(document.getElementById("nc-note"));
  });

  it("תגיות מרונדרות ככפתורי toggle", () => {
    renderDialog();
    openDialog();
    expect(screen.getByRole("button", { name: "VIP" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "מועדפת" })).toBeInTheDocument();
  });

  it("שדות החובה (שם פרטי/משפחה/טלפון) מסומנים כ-required", () => {
    renderDialog();
    openDialog();
    for (const id of ["nc-first-name", "nc-last-name", "nc-phone"]) {
      const el = document.getElementById(id) as HTMLInputElement;
      expect(el.required).toBe(true);
      expect(el.getAttribute("aria-required")).toBe("true");
    }
  });

  it("שדה טלפון בכיוון ltr ובעל inputMode=tel", () => {
    renderDialog();
    openDialog();
    const phone = document.getElementById("nc-phone") as HTMLInputElement;
    expect(phone.getAttribute("dir")).toBe("ltr");
    expect(phone.getAttribute("inputmode")).toBe("tel");
  });
});

// ─── 3. ולידציית טלפון ישראלי בצד לקוח ──────────────────────────────────────

describe("validateCreateClient — ולידציית טלפון (התאמה למקור האמת)", () => {
  const base = { firstName: "דנה", lastName: "כהן" };

  it("מקבל מספר ישראלי מקומי תקין 05XXXXXXXX", () => {
    expect(isClientValid(validateCreateClient({ ...base, phone: "0541234567" }))).toBe(true);
  });

  it("מקבל מספר בפורמט בינלאומי +9725XXXXXXXX", () => {
    expect(isClientValid(validateCreateClient({ ...base, phone: "+972541234567" }))).toBe(true);
  });

  it("דוחה מספר קצר מדי", () => {
    const errors = validateCreateClient({ ...base, phone: "0541234" });
    expect(errors.phone).toBeTruthy();
  });

  it("דוחה מספר שאינו ישראלי", () => {
    const errors = validateCreateClient({ ...base, phone: "1234567890" });
    expect(errors.phone).toBeTruthy();
  });

  it("דוחה טלפון ריק", () => {
    const errors = validateCreateClient({ ...base, phone: "" });
    expect(errors.phone).toBeTruthy();
  });
});

describe("NewClientDialog — ולידציה בצד לקוח חוסמת שליחה", () => {
  it("טלפון לא תקין מציג שגיאת שדה וחוסם את ה-POST", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderDialog();
    openDialog();
    fillRequired("12345"); // לא תקין
    fireEvent.click(screen.getByRole("button", { name: "שמירת לקוח/ה" }));

    await waitFor(() => {
      expect(document.getElementById("nc-phone-error")).not.toBeNull();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("שם פרטי ריק חוסם את ה-POST ומציג הודעת תיקון", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderDialog();
    openDialog();
    fireEvent.change(document.getElementById("nc-last-name") as HTMLInputElement, {
      target: { value: "כהן" },
    });
    fireEvent.change(document.getElementById("nc-phone") as HTMLInputElement, {
      target: { value: "0541234567" },
    });
    fireEvent.click(screen.getByRole("button", { name: "שמירת לקוח/ה" }));

    await waitFor(() => {
      expect(screen.getByText("נא לתקן את השדות המסומנים")).toBeInTheDocument();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ─── 4. שליחה מוצלחת ────────────────────────────────────────────────────────

describe("NewClientDialog — שליחה מוצלחת (201)", () => {
  it("שולח POST /api/clients עם המבנה הנכון ומנווט לפרופיל החדש", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 201,
      json: async () => ({ client: { id: "new-client-7" } }),
    } as Response);

    renderDialog();
    openDialog();
    fillRequired("0541234567");
    fireEvent.change(document.getElementById("nc-city") as HTMLInputElement, {
      target: { value: "חיפה" },
    });
    fireEvent.click(screen.getByRole("button", { name: "VIP" }));
    fireEvent.click(screen.getByRole("button", { name: "שמירת לקוח/ה" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/clients");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json"
    );
    const body = JSON.parse(init.body as string);
    expect(body.firstName).toBe("דנה");
    expect(body.lastName).toBe("כהן");
    expect(body.phone).toBe("0541234567");
    expect(body.city).toBe("חיפה");
    expect(body.tagIds).toEqual(["tag-1"]);
    expect(body.marketingConsentChannel).toBe("none");

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/clients/new-client-7");
    });
  });
});

// ─── 5. 409 כפילות טלפון ─────────────────────────────────────────────────────

describe("NewClientDialog — 409 כפילות טלפון", () => {
  it("התאמה פעילה: מציג הודעה עברית + קישור לכרטיס הקיים", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/clients" && init?.method === "POST") {
          return {
            status: 409,
            json: async () => ({ errors: { phone: "כבר קיים" } }),
          } as Response;
        }
        // GET lookup של הטלפון המנורמל
        return {
          ok: true,
          status: 200,
          json: async () => ({
            clients: [
              {
                id: "existing-42",
                firstName: "רונית",
                lastName: "לוי",
                phone: "0541234567",
              },
            ],
          }),
        } as Response;
      });

    renderDialog();
    openDialog();
    fillRequired("0541234567");
    fireEvent.click(screen.getByRole("button", { name: "שמירת לקוח/ה" }));

    await waitFor(() => {
      expect(screen.getByText(/מספר הטלפון שייך ללקוח\/ה רונית לוי/)).toBeInTheDocument();
    });

    const link = screen.getByRole("link", { name: /מעבר לכרטיס הלקוח/ });
    expect(link).toHaveAttribute("href", "/clients/existing-42");
    // ה-GET נקרא עם הטלפון המנורמל
    expect(fetchSpy.mock.calls.some(([u]) => String(u).includes("/api/clients?q="))).toBe(
      true
    );
    // לא נווטנו לפרופיל חדש
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("ללא התאמה פעילה: נפילה לקישור /clients/duplicates", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/clients" && init?.method === "POST") {
          return {
            status: 409,
            json: async () => ({ errors: { phone: "כבר קיים" } }),
          } as Response;
        }
        // GET מחזיר רשימה ריקה (אין התאמה פעילה — אולי בארכיון)
        return {
          ok: true,
          status: 200,
          json: async () => ({ clients: [] }),
        } as Response;
      }
    );

    renderDialog();
    openDialog();
    fillRequired("0541234567");
    fireEvent.click(screen.getByRole("button", { name: "שמירת לקוח/ה" }));

    const link = await screen.findByRole("link", { name: /איתור כפילויות/ });
    expect(link).toHaveAttribute("href", "/clients/duplicates");
    expect(mockPush).not.toHaveBeenCalled();
  });
});

// ─── 6. 400 שגיאות שרת inline ────────────────────────────────────────────────

describe("NewClientDialog — 400 שגיאות שרת", () => {
  it("מציג שגיאות שדה מהשרת inline", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 400,
      json: async () => ({
        error: "נא לתקן את השדות המסומנים",
        errors: { email: "כתובת אימייל לא תקינה" },
      }),
    } as Response);

    renderDialog();
    openDialog();
    fillRequired("0541234567");
    fireEvent.click(screen.getByRole("button", { name: "שמירת לקוח/ה" }));

    await waitFor(() => {
      expect(screen.getByText("כתובת אימייל לא תקינה")).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});

// ─── 7. RTL / מובייל ─────────────────────────────────────────────────────────

describe("NewClientDialog — RTL ומובייל", () => {
  it("תוכן הדיאלוג ממורכז סימטרית (inset-x / mx-auto) למניעת גלישה ב-320px", () => {
    renderDialog();
    openDialog();
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("inset-x-4");
    expect(dialog.className).toContain("mx-auto");
    expect(dialog.className).toContain("max-w-lg");
  });

  it("כפתור סגירה עם aria-label עברי ו-touch target של 44px", () => {
    renderDialog();
    openDialog();
    const close = screen.getByRole("button", { name: "סגירה" });
    expect(close.className).toContain("size-11");
  });

  it("כפתור השמירה בעל touch target של 44px (min-h-11)", () => {
    renderDialog();
    openDialog();
    const submit = screen.getByRole("button", { name: "שמירת לקוח/ה" });
    expect(submit.className).toContain("min-h-11");
  });
});
