/**
 * בדיקות ל-ConsentSigningPanel — החלק שהושלם במשימה 11.12 (FR-CF-02, FR-CF-06).
 *
 * מכסה אך ורק את פאנל יצירת קישור החתימה. הורדת ה-PDF החתום (FR-CF-08) חסומה/לא
 * מומשה ואינה נבדקת כאן.
 *
 * בודק:
 * 1. טעינת תבניות מ-GET /api/consent-templates — מצב טעינה, רשימה, ריק, שגיאה.
 * 2. בחירת תבנית + "צור קישור חתימה" → POST /api/consent-tokens עם {clientId, templateId}.
 * 3. הצלחה — הקישור /sign/<token> מוצג בשדה קריאה-בלבד; העתקה ללוח; קישור wa.me עם טלפון 972.
 * 4. שגיאה מה-POST — role="alert" עברית, אין קישור.
 * 5. RTL/מובייל/44px, תוויות עבריות, אין הדפסת PII/חתימה ללוג.
 *
 * הרצה: `npx vitest run components/clients/__tests__/ConsentSigningPanel.test.tsx`
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

import { ConsentSigningPanel } from "@/components/clients/ConsentSigningPanel";

const TEMPLATES = [
  { id: "tpl-1", name: "טופס הסכמה לטיפול פנים", version: 2 },
  { id: "tpl-2", name: "טופס הסכמה להסרת שיער", version: 1 },
];

const CREATE_BTN = /צור קישור חתימה|יוצר קישור/;

// mock fetch שמנתב לפי URL: GET תבניות מול POST טוקן.
function mockFetch(opts: {
  templates?: unknown;
  templatesOk?: boolean;
  token?: unknown;
  tokenOk?: boolean;
  tokenReject?: boolean;
}) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/api/consent-templates")) {
      return {
        ok: opts.templatesOk ?? true,
        json: async () => opts.templates ?? { templates: TEMPLATES },
      } as Response;
    }
    if (url.includes("/api/consent-tokens")) {
      if (opts.tokenReject) throw new Error("network");
      return {
        ok: opts.tokenOk ?? true,
        json: async () => opts.token ?? { signingToken: "TOK123" },
      } as Response;
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

// clipboard אינו ממומש ב-jsdom — stub ברירת מחדל שמצליח.
let clipboardWrite: ReturnType<typeof vi.fn>;
beforeEach(() => {
  clipboardWrite = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: clipboardWrite },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

// ─── 1. טעינת תבניות ────────────────────────────────────────────────────────

describe("ConsentSigningPanel — טעינת תבניות", () => {
  it("טוען מ-GET /api/consent-templates ומאכלס את ה-select בתבניות פעילות", async () => {
    const fetchSpy = mockFetch({ templates: { templates: TEMPLATES } });
    render(<ConsentSigningPanel clientId="cl-1" clientPhone="0541234567" />);

    await waitFor(() =>
      expect(screen.getByRole("combobox")).toBeInTheDocument()
    );

    // ה-fetch הראשון היה ל-GET תבניות
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/consent-templates");

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    // אופציית placeholder + 2 תבניות
    expect(select.options).toHaveLength(3);
    expect(screen.getByRole("option", { name: /טופס הסכמה לטיפול פנים \(v2\)/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /טופס הסכמה להסרת שיער \(v1\)/ })).toBeInTheDocument();
  });

  it("מצב ריק — אין תבניות פעילות מציג הודעה עברית ואין select", async () => {
    mockFetch({ templates: { templates: [] } });
    render(<ConsentSigningPanel clientId="cl-1" clientPhone="0541234567" />);

    await waitFor(() =>
      expect(screen.getByText(/אין תבניות הסכמה פעילות/)).toBeInTheDocument()
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("שגיאת טעינה — מציג role=alert עברי ואין select", async () => {
    mockFetch({ templatesOk: false, templates: {} });
    render(<ConsentSigningPanel clientId="cl-1" clientPhone="0541234567" />);

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/שגיאה בטעינת תבניות/)
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});

// ─── 2+3. יצירת קישור חתימה ─────────────────────────────────────────────────

describe("ConsentSigningPanel — יצירת קישור חתימה", () => {
  async function renderAndSelect(phone: string | null = "0541234567") {
    mockFetch({ templates: { templates: TEMPLATES } });
    render(<ConsentSigningPanel clientId="cl-42" clientPhone={phone} />);
    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "tpl-1" } });
  }

  it("בחירת תבנית + לחיצה → POST /api/consent-tokens עם {clientId, templateId}", async () => {
    const fetchSpy = mockFetch({ templates: { templates: TEMPLATES } });
    render(<ConsentSigningPanel clientId="cl-42" clientPhone="0541234567" />);
    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "tpl-1" } });
    fireEvent.click(screen.getByRole("button", { name: CREATE_BTN }));

    await waitFor(() => {
      const postCall = fetchSpy.mock.calls.find((c) =>
        String(c[0]).includes("/api/consent-tokens")
      );
      expect(postCall).toBeDefined();
    });

    const postCall = fetchSpy.mock.calls.find((c) =>
      String(c[0]).includes("/api/consent-tokens")
    )!;
    const init = postCall[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ clientId: "cl-42", templateId: "tpl-1" });
  });

  it("הצלחה — מציג קישור /sign/<token> בשדה קריאה-בלבד", async () => {
    await renderAndSelect();
    fireEvent.click(screen.getByRole("button", { name: CREATE_BTN }));

    const input = (await screen.findByLabelText("קישור חתימה")) as HTMLInputElement;
    expect(input).toHaveAttribute("readonly");
    // window.location.origin ב-jsdom הוא http://localhost:3000
    expect(input.value).toBe("http://localhost:3000/sign/TOK123");
  });

  it("כפתור ההעתקה מעתיק את הקישור ללוח ומשנה את התווית", async () => {
    await renderAndSelect();
    fireEvent.click(screen.getByRole("button", { name: CREATE_BTN }));
    await screen.findByLabelText("קישור חתימה");

    fireEvent.click(screen.getByRole("button", { name: /העתק קישור/ }));

    await waitFor(() =>
      expect(clipboardWrite).toHaveBeenCalledWith("http://localhost:3000/sign/TOK123")
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /הקישור הועתק/ })).toBeInTheDocument()
    );
  });

  it("קישור wa.me משתמש בטלפון מנורמל ל-972 ומכיל את קישור החתימה", async () => {
    await renderAndSelect("0541234567");
    fireEvent.click(screen.getByRole("button", { name: CREATE_BTN }));
    await screen.findByLabelText("קישור חתימה");

    const wa = screen.getByRole("link", { name: /שלח שוב ב-WhatsApp/ }) as HTMLAnchorElement;
    expect(wa.href).toContain("wa.me/972541234567");
    expect(decodeURIComponent(wa.href)).toContain("http://localhost:3000/sign/TOK123");
  });

  it("ללא טלפון ללקוח/ה — אין קישור WhatsApp אך הקישור עדיין מוצג", async () => {
    await renderAndSelect(null);
    fireEvent.click(screen.getByRole("button", { name: CREATE_BTN }));
    await screen.findByLabelText("קישור חתימה");

    expect(screen.queryByRole("link", { name: /שלח שוב ב-WhatsApp/ })).not.toBeInTheDocument();
  });

  it("ללא בחירת תבנית — כפתור היצירה מושבת ולחיצה לא קוראת ל-POST", async () => {
    const fetchSpy = mockFetch({ templates: { templates: TEMPLATES } });
    render(<ConsentSigningPanel clientId="cl-42" clientPhone="0541234567" />);
    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());

    const btn = screen.getByRole("button", { name: CREATE_BTN });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);

    const postCall = fetchSpy.mock.calls.find((c) =>
      String(c[0]).includes("/api/consent-tokens")
    );
    expect(postCall).toBeUndefined();
  });
});

// ─── 4. שגיאות POST ─────────────────────────────────────────────────────────

describe("ConsentSigningPanel — שגיאות יצירה", () => {
  it("תשובת שגיאה מהשרת — role=alert עם הודעת השרת, אין קישור", async () => {
    mockFetch({
      templates: { templates: TEMPLATES },
      tokenOk: false,
      token: { error: "התבנית אינה פעילה" },
    });
    render(<ConsentSigningPanel clientId="cl-42" clientPhone="0541234567" />);
    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "tpl-1" } });
    fireEvent.click(screen.getByRole("button", { name: CREATE_BTN }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("התבנית אינה פעילה")
    );
    expect(screen.queryByLabelText("קישור חתימה")).not.toBeInTheDocument();
  });

  it("כשל רשת — הודעת שגיאה עברית כללית, אין קישור", async () => {
    mockFetch({ templates: { templates: TEMPLATES }, tokenReject: true });
    render(<ConsentSigningPanel clientId="cl-42" clientPhone="0541234567" />);
    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "tpl-1" } });
    fireEvent.click(screen.getByRole("button", { name: CREATE_BTN }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/שגיאת רשת/)
    );
    expect(screen.queryByLabelText("קישור חתימה")).not.toBeInTheDocument();
  });

  it("תשובת 200 ללא signingToken — נחשבת שגיאה, אין קישור", async () => {
    mockFetch({ templates: { templates: TEMPLATES }, tokenOk: true, token: {} });
    render(<ConsentSigningPanel clientId="cl-42" clientPhone="0541234567" />);
    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "tpl-1" } });
    fireEvent.click(screen.getByRole("button", { name: CREATE_BTN }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/שגיאה ביצירת קישור/)
    );
    expect(screen.queryByLabelText("קישור חתימה")).not.toBeInTheDocument();
  });
});

// ─── 5. RTL / מובייל / 44px / פרטיות ────────────────────────────────────────

describe("ConsentSigningPanel — RTL/מובייל/נגישות/פרטיות", () => {
  it("מיכל ה-RTL, ה-select והכפתור בעלי touch target 44px (min-h-11)", async () => {
    const { container } = render(
      (() => {
        mockFetch({ templates: { templates: TEMPLATES } });
        return <ConsentSigningPanel clientId="cl-1" clientPhone="0541234567" />;
      })()
    );
    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());

    expect(container.querySelector("[dir='rtl']")).toBeInTheDocument();
    expect(screen.getByRole("combobox").className).toContain("min-h-11");
    expect(screen.getByRole("button", { name: CREATE_BTN }).className).toContain("min-h-11");
  });

  it("לא מדפיס ללוג טלפון/טוקן/קישור חתימה (פרטיות §11)", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockFetch({ templates: { templates: TEMPLATES } });
    render(<ConsentSigningPanel clientId="cl-42" clientPhone="0541234567" />);
    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "tpl-1" } });
    fireEvent.click(screen.getByRole("button", { name: CREATE_BTN }));
    await screen.findByLabelText("קישור חתימה");

    const logged = [...logSpy.mock.calls, ...errSpy.mock.calls, ...warnSpy.mock.calls]
      .flat()
      .map(String)
      .join(" ");
    expect(logged).not.toContain("0541234567");
    expect(logged).not.toContain("972541234567");
    expect(logged).not.toContain("TOK123");
  });
});
