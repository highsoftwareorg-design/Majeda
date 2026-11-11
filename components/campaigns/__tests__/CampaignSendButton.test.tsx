/**
 * בדיקות ל-CampaignSendButton — משימה 11.9 (FR-MK-04, השלמת wiring מ-9.5).
 *
 * בודק:
 * 1. הכפתור מוצג לסטטוסי DRAFT/SCHEDULED בלבד; לא ל-SENDING/SENT/CANCELLED.
 * 2. מודאל האישור מציג את ספירת הנמענים (recipientCount).
 * 3. אישור קורא ל-POST /api/campaigns/:id/send פעם אחת (ללא גוף).
 * 4. הצלחה — מציג את הסטטוס החדש וקורא ל-router.refresh().
 * 5. שגיאה — הודעה עברית/מהשרת, המודאל נשאר פתוח.
 * 6. recipientCount=0 — כפתור "אישור ושליחה" מושבת והודעה עברית מתאימה.
 * 7. כפתור מושבת בזמן בקשה פעילה — אין שליחה כפולה.
 * 8. RTL/מובייל — touch target 44px (min-h-11), תוויות עבריות.
 *
 * הרצה: `npx vitest run components/campaigns/__tests__/CampaignSendButton.test.tsx`
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: vi.fn() }),
}));

import { CampaignSendButton } from "@/components/campaigns/CampaignSendButton";

const SEND_BTN = /^שלח קמפיין$/;
const CONFIRM_BTN = /אישור ושליחה|שולח/;

function openModal() {
  fireEvent.click(screen.getByRole("button", { name: SEND_BTN }));
}

beforeEach(() => {
  mockRefresh.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

// ─── 1. גלוי רק לסטטוסים ניתנים-לשליחה ──────────────────────────────────────

describe("CampaignSendButton — תצוגה לפי סטטוס", () => {
  it("מציג כפתור שליחה לסטטוס DRAFT", () => {
    render(<CampaignSendButton campaignId="c1" status="DRAFT" recipientCount={5} />);
    expect(screen.getByRole("button", { name: SEND_BTN })).toBeInTheDocument();
  });

  it("מציג כפתור שליחה לסטטוס SCHEDULED", () => {
    render(<CampaignSendButton campaignId="c1" status="SCHEDULED" recipientCount={5} />);
    expect(screen.getByRole("button", { name: SEND_BTN })).toBeInTheDocument();
  });

  it("לא מציג כפתור שליחה לסטטוס SENDING/SENT/CANCELLED", () => {
    for (const status of ["SENDING", "SENT", "CANCELLED"]) {
      render(<CampaignSendButton campaignId="c1" status={status} recipientCount={5} />);
      expect(screen.queryByRole("button", { name: SEND_BTN })).not.toBeInTheDocument();
      cleanup();
    }
  });

  it("כפתור השליחה בעל touch target 44px (min-h-11)", () => {
    render(<CampaignSendButton campaignId="c1" status="DRAFT" recipientCount={5} />);
    expect(screen.getByRole("button", { name: SEND_BTN }).className).toContain("min-h-11");
  });
});

// ─── 2. מודאל אישור + ספירת נמענים ──────────────────────────────────────────

describe("CampaignSendButton — מודאל אישור", () => {
  it("לחיצה פותחת מודאל המציג את ספירת הנמענים", () => {
    render(<CampaignSendButton campaignId="c1" status="DRAFT" recipientCount={12} />);
    openModal();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog.textContent).toContain("12");
  });

  it("כפתור האישור במודאל בעל touch target 44px", () => {
    render(<CampaignSendButton campaignId="c1" status="DRAFT" recipientCount={12} />);
    openModal();
    expect(screen.getByRole("button", { name: CONFIRM_BTN }).className).toContain("min-h-11");
  });
});

// ─── 3+4. אישור → POST פעם אחת → הצלחה + refresh ────────────────────────────

describe("CampaignSendButton — שליחה מוצלחת", () => {
  it("אישור קורא ל-POST /api/campaigns/:id/send פעם אחת ומציג סטטוס חדש + refresh", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ campaign: { status: "SENDING" } }),
    } as Response);

    render(<CampaignSendButton campaignId="camp-9" status="DRAFT" recipientCount={8} />);
    openModal();
    fireEvent.click(screen.getByRole("button", { name: CONFIRM_BTN }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/campaigns/camp-9/send");
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();

    // סטטוס חדש מוצג (תווית עברית "בשליחה")
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("בשליחה")
    );
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});

// ─── 5. שגיאה — המודאל נשאר פתוח ─────────────────────────────────────────────

describe("CampaignSendButton — שגיאה", () => {
  it("תשובת שגיאה מהשרת — מציגה את ההודעה והמודאל נשאר פתוח", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "הקמפיין כבר נשלח" }),
    } as Response);

    render(<CampaignSendButton campaignId="c1" status="DRAFT" recipientCount={8} />);
    openModal();
    fireEvent.click(screen.getByRole("button", { name: CONFIRM_BTN }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("הקמפיין כבר נשלח")
    );
    // המודאל עדיין פתוח
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("כשל רשת — מציג הודעת שגיאה עברית כללית", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));

    render(<CampaignSendButton campaignId="c1" status="DRAFT" recipientCount={8} />);
    openModal();
    fireEvent.click(screen.getByRole("button", { name: CONFIRM_BTN }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/שגיאת רשת/)
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

// ─── 6. אין נמענים → שליחה מושבתת ───────────────────────────────────────────

describe("CampaignSendButton — אפס נמענים", () => {
  it("recipientCount=0 — כפתור האישור מושבת והודעה עברית מתאימה", () => {
    render(<CampaignSendButton campaignId="c1" status="DRAFT" recipientCount={0} />);
    openModal();
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toMatch(/אין כרגע נמענים תקינים/);
    expect(screen.getByRole("button", { name: CONFIRM_BTN })).toBeDisabled();
  });

  it("recipientCount=0 — לחיצה על אישור לא קוראת ל-fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<CampaignSendButton campaignId="c1" status="DRAFT" recipientCount={0} />);
    openModal();
    fireEvent.click(screen.getByRole("button", { name: CONFIRM_BTN }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ─── 7. ללא שליחה כפולה בזמן בקשה פעילה ──────────────────────────────────────

describe("CampaignSendButton — מניעת שליחה כפולה", () => {
  it("בזמן בקשה פעילה הכפתור מושבת ולחיצה חוזרת לא שולחת שוב", async () => {
    let resolveFetch: (v: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockReturnValue(pending);

    render(<CampaignSendButton campaignId="c1" status="DRAFT" recipientCount={8} />);
    openModal();
    const confirm = screen.getByRole("button", { name: CONFIRM_BTN });
    fireEvent.click(confirm);

    // בזמן ה-in-flight הכפתור מושבת ומציג "שולח…"
    await waitFor(() => expect(confirm).toBeDisabled());
    expect(confirm.textContent).toMatch(/שולח/);

    // לחיצה חוזרת בזמן השליחה לא מפעילה fetch נוסף
    fireEvent.click(confirm);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // שחרור הבקשה כדי לסיים נקי
    resolveFetch({ ok: true, json: async () => ({ campaign: { status: "SENDING" } }) } as Response);
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });
});
