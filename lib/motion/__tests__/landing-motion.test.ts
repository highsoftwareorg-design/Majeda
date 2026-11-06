import { describe, it, expect, afterEach, vi } from "vitest";
import {
  LANDING_MOTION_HALT_ATTR,
  LANDING_MOTION_SECTION_READY_EVENT,
  getReadyLandingSections,
  haltLandingMotion,
  isLandingMotionHalted,
  markLandingSectionReady,
  resumeLandingMotion,
} from "@/lib/motion/landing-motion";

/**
 * משימה 2.16 — API העצירה של אנימציות דף הנחיתה (ישמש את ווידג׳ט הנגישות ב-2.18).
 */
describe("lib/motion/landing-motion (task 2.16)", () => {
  afterEach(() => {
    document.documentElement.removeAttribute(LANDING_MOTION_HALT_ATTR);
  });

  it("uses data-reduce-motion as the halt attribute", () => {
    expect(LANDING_MOTION_HALT_ATTR).toBe("data-reduce-motion");
  });

  it("is not halted by default", () => {
    expect(isLandingMotionHalted()).toBe(false);
  });

  it("haltLandingMotion sets the attribute on <html> and reports halted", () => {
    haltLandingMotion();
    expect(document.documentElement.getAttribute(LANDING_MOTION_HALT_ATTR)).toBe("true");
    expect(isLandingMotionHalted()).toBe(true);
  });

  it("resumeLandingMotion removes the attribute", () => {
    haltLandingMotion();
    resumeLandingMotion();
    expect(document.documentElement.hasAttribute(LANDING_MOTION_HALT_ATTR)).toBe(false);
    expect(isLandingMotionHalted()).toBe(false);
  });

  it.each([
    ["", true],
    ["true", true],
    ["1", true],
    ["reduce", true],
    ["false", false],
  ])("attribute value %j -> halted=%s", (value, expected) => {
    document.documentElement.setAttribute(LANDING_MOTION_HALT_ATTR, value);
    expect(isLandingMotionHalted()).toBe(expected);
  });

  it("halt/resume are idempotent", () => {
    haltLandingMotion();
    haltLandingMotion();
    expect(isLandingMotionHalted()).toBe(true);
    resumeLandingMotion();
    resumeLandingMotion();
    expect(isLandingMotionHalted()).toBe(false);
  });

  it("markLandingSectionReady records the section and dispatches the ready event", () => {
    const listener = vi.fn();
    window.addEventListener(LANDING_MOTION_SECTION_READY_EVENT, listener);
    markLandingSectionReady("treatments");
    markLandingSectionReady("treatments");
    window.removeEventListener(LANDING_MOTION_SECTION_READY_EVENT, listener);

    expect(listener).toHaveBeenCalledTimes(2);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toBe("treatments");
    // Set semantics — no duplicates
    expect(getReadyLandingSections().filter((s) => s === "treatments")).toHaveLength(1);
  });
});
