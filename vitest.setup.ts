import "@testing-library/jest-dom/vitest";
import { expect } from "vitest";
import { toHaveNoViolations } from "jest-axe";

// מוסיף את ה-matcher `toHaveNoViolations` (axe-core) לבדיקות נגישות אוטומטיות
// (משימה 2.10 — בדיקת נגישות בסיסית של דף הנחיתה).
expect.extend(toHaveNoViolations);

// jsdom אינו מממש ResizeObserver, אך רכיבי Radix UI (כגון Checkbox) תלויים בו.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
