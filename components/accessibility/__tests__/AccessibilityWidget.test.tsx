import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { AccessibilityWidget } from "@/components/accessibility/AccessibilityWidget";
import {
  A11Y_ATTR,
  A11Y_STORAGE_KEY,
  DEFAULT_A11Y_PREFS,
  buildA11yInlineScript,
  loadA11yPrefs,
} from "@/lib/a11y/preferences";
import { LANDING_MOTION_HALT_ATTR, haltLandingMotion } from "@/lib/motion/landing-motion";

/** משימה 2.18 — תוסף הנגישות (jsdom). */

const html = document.documentElement;

function clearHtmlAttrs() {
  Object.values(A11Y_ATTR).forEach((attr) => html.removeAttribute(attr));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  clearHtmlAttrs();
  window.localStorage.clear();
});

function renderWidget() {
  const user = userEvent.setup();
  render(
    <main dir="rtl" lang="he">
      <a href="#x">קישור בדף</a>
      <AccessibilityWidget />
    </main>,
  );
  const trigger = screen.getByRole("button", { name: "פתיחת תפריט נגישות" });
  return { user, trigger };
}

async function openPanel() {
  const ctx = renderWidget();
  await ctx.user.click(ctx.trigger);
  const dialog = await screen.findByRole("dialog", { name: "התאמות נגישות" });
  return { ...ctx, dialog };
}

function option(dialog: HTMLElement, name: string) {
  return within(dialog).getByRole("button", { name });
}

function storedPrefs() {
  const raw = window.localStorage.getItem(A11Y_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

describe("AccessibilityWidget — trigger and dialog", () => {
  it("renders a labelled floating trigger at inline-start (not colliding with WhatsApp at inline-end)", () => {
    const { trigger } = renderWidget();
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger.className).toMatch(/\bstart-5\b/);
    expect(trigger.className).not.toMatch(/\bend-5\b|\bleft-|\bright-/);
    expect(trigger.className).toMatch(/\bsize-12\b/); // 48px ≥ 44px
  });

  it("opens a dialog with aria-labelledby/describedby and closes with the close button", async () => {
    const { user, trigger, dialog } = await openPanel();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(dialog).toHaveAttribute("aria-labelledby");
    expect(dialog).toHaveAttribute("aria-describedby");
    await user.click(within(dialog).getByRole("button", { name: "סגירת תפריט הנגישות" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("Esc closes the dialog and returns focus to the trigger", async () => {
    const { user, trigger } = await openPanel();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("traps focus inside the dialog (Tab / Shift+Tab wrap)", async () => {
    const { user, dialog } = await openPanel();
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>("button, a[href]"),
    );
    expect(dialog.contains(document.activeElement)).toBe(true);
    for (let i = 0; i < focusables.length + 2; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 3; i += 1) {
      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });
});

describe("AccessibilityWidget — options", () => {
  const cases: [string, string, string, string][] = [
    ["ניגודיות גבוהה", A11Y_ATTR.highContrast, "high", "highContrast"],
    ["גווני אפור", A11Y_ATTR.grayscale, "true", "grayscale"],
    ["הדגשת קישורים", A11Y_ATTR.highlightLinks, "true", "highlightLinks"],
    ["גופן קריא", A11Y_ATTR.readableFont, "readable", "readableFont"],
    ["סמן עכבר מוגדל", A11Y_ATTR.largeCursor, "large", "largeCursor"],
    ["עצירת אנימציות", LANDING_MOTION_HALT_ATTR, "true", "stopMotion"],
  ];

  it.each(cases)("%s toggles %s on <html> and persists", async (label, attr, value, key) => {
    const { user, dialog } = await openPanel();
    const btn = option(dialog, label);
    expect(btn).toHaveAttribute("aria-pressed", "false");

    await user.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(html.getAttribute(attr)).toBe(value);
    expect(storedPrefs()).toMatchObject({ [key]: true });

    if (key === "stopMotion") {
      await user.click(btn);
      expect(html.hasAttribute(attr)).toBe(false);
      expect(within(dialog).getByText("האנימציות יחזרו לפעול רק לאחר רענון הדף.")).toBeInTheDocument();
    } else {
      await user.click(btn);
      expect(btn).toHaveAttribute("aria-pressed", "false");
      expect(html.hasAttribute(attr)).toBe(false);
    }
    expect(storedPrefs()).toBeNull(); // חזרה לברירת מחדל → המפתח נמחק
  });

  it("stop animations uses the 2.16 halt API (flush before the revert observer runs)", async () => {
    const order: string[] = [];
    const rect = vi
      .spyOn(html, "getBoundingClientRect")
      .mockImplementation(() => {
        order.push(`flush:${html.getAttribute(LANDING_MOTION_HALT_ATTR)}`);
        return new DOMRect();
      });
    const observer = new MutationObserver(() => order.push("observer"));
    observer.observe(html, { attributes: true, attributeFilter: [LANDING_MOTION_HALT_ATTR] });

    haltLandingMotion();
    await Promise.resolve();
    observer.disconnect();

    expect(rect).toHaveBeenCalled();
    expect(order).toEqual(["flush:true", "observer"]);
  });

  it("text size increases/decreases within bounds via data-a11y-text", async () => {
    const { user, dialog } = await openPanel();
    const inc = option(dialog, "הגדלת הטקסט");
    const dec = option(dialog, "הקטנת הטקסט");
    const status = within(dialog).getByText("רגיל (100%)");

    await user.click(inc);
    expect(html.getAttribute(A11Y_ATTR.textScale)).toBe("1");
    expect(status).toHaveTextContent("110%");
    await user.click(inc);
    await user.click(inc);
    await user.click(inc); // מעבר לגבול — נשאר 3
    expect(html.getAttribute(A11Y_ATTR.textScale)).toBe("3");
    expect(inc).toHaveAttribute("aria-disabled", "true");
    expect(inc).toHaveFocus(); // aria-disabled — הפוקוס לא "נופל" מהדיאלוג
    expect(storedPrefs()).toMatchObject({ textScale: 3 });

    for (let i = 0; i < 5; i += 1) await user.click(dec);
    expect(html.getAttribute(A11Y_ATTR.textScale)).toBe("-1");
    expect(dec).toHaveAttribute("aria-disabled", "true");
    expect(status).toHaveTextContent("90%");
  });

  it("reset clears every attribute and the stored preferences", async () => {
    const { user, dialog } = await openPanel();
    await user.click(option(dialog, "ניגודיות גבוהה"));
    await user.click(option(dialog, "גופן קריא"));
    await user.click(option(dialog, "הגדלת הטקסט"));
    expect(storedPrefs()).not.toBeNull();

    await user.click(within(dialog).getByRole("button", { name: "איפוס הגדרות" }));
    Object.values(A11Y_ATTR).forEach((attr) => expect(html.hasAttribute(attr)).toBe(false));
    expect(storedPrefs()).toBeNull();
    expect(option(dialog, "ניגודיות גבוהה")).toHaveAttribute("aria-pressed", "false");
  });

  it("syncs its state from <html> on open (attributes applied by the inline script)", async () => {
    html.setAttribute(A11Y_ATTR.highContrast, "high");
    html.setAttribute(LANDING_MOTION_HALT_ATTR, "true");
    const { dialog } = await openPanel();
    expect(option(dialog, "ניגודיות גבוהה")).toHaveAttribute("aria-pressed", "true");
    expect(option(dialog, "עצירת אנימציות")).toHaveAttribute("aria-pressed", "true");
    expect(option(dialog, "גווני אפור")).toHaveAttribute("aria-pressed", "false");
  });

  it("does not crash when localStorage throws, and tells the user", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const { user, dialog } = await openPanel();
    await user.click(option(dialog, "גווני אפור"));
    expect(html.getAttribute(A11Y_ATTR.grayscale)).toBe("true"); // ההתאמה עדיין חלה
    expect(within(dialog).getByText(/הדפדפן חוסם שמירה מקומית/)).toBeInTheDocument();
    expect(loadA11yPrefs()).toEqual(DEFAULT_A11Y_PREFS);
  });
});

describe("AccessibilityWidget — axe", () => {
  it("has no axe violations with the panel closed", async () => {
    const { container } = render(
      <main dir="rtl" lang="he">
        <AccessibilityWidget />
      </main>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no axe violations with the panel open", async () => {
    await openPanel();
    expect(await axe(document.body)).toHaveNoViolations();
  });
});

describe("inline pre-paint script", () => {
  function runScript() {
    new Function(buildA11yInlineScript())();
  }

  it("applies stored preferences (including data-reduce-motion) to <html>", () => {
    window.localStorage.setItem(
      A11Y_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_A11Y_PREFS, textScale: 2, highContrast: true, stopMotion: true }),
    );
    runScript();
    expect(html.getAttribute(A11Y_ATTR.textScale)).toBe("2");
    expect(html.getAttribute(A11Y_ATTR.highContrast)).toBe("high");
    expect(html.getAttribute(LANDING_MOTION_HALT_ATTR)).toBe("true");
    expect(html.hasAttribute(A11Y_ATTR.grayscale)).toBe(false);
  });

  it("ignores invalid/malicious stored values and storage errors", () => {
    window.localStorage.setItem(
      A11Y_STORAGE_KEY,
      JSON.stringify({ textScale: 99, highContrast: "yes", grayscale: 1 }),
    );
    runScript();
    expect(html.hasAttribute(A11Y_ATTR.textScale)).toBe(false);
    expect(html.hasAttribute(A11Y_ATTR.highContrast)).toBe(false);

    window.localStorage.setItem(A11Y_STORAGE_KEY, "{not json");
    expect(runScript).not.toThrow();

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(runScript).not.toThrow();
  });
});
