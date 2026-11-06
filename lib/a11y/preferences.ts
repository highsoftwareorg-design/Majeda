/**
 * משימה 2.18 — העדפות תוסף הנגישות (מודול ללא React, ללא תלות ב-GSAP).
 *
 * מקור האמת בזמן ריצה הוא מאפייני `data-*` על `<html>` (ה-CSS ב-styles/tokens.css מגיב
 * אליהם). localStorage משמש רק לשמירה בין ביקורים, תמיד עטוף ב-try/catch (מצב פרטי,
 * חסימת אחסון, מכסה מלאה — האתר ממשיך לעבוד, ההעדפות פשוט לא נשמרות).
 *
 * "עצירת אנימציות" משתמשת ב-API הקיים של 2.16 (`data-reduce-motion` /
 * `haltLandingMotion()`), כך שגם ה-GSAP של דף הנחיתה נעצר בפועל.
 *
 * אין כאן מידע אישי — רק העדפות תצוגה.
 */

import {
  LANDING_MOTION_HALT_ATTR,
  haltLandingMotion,
  isLandingMotionHalted,
  resumeLandingMotion,
} from "@/lib/motion/landing-motion";

export const A11Y_STORAGE_KEY = "majida:a11y-prefs:v1";

/** רמות גודל טקסט: -1 = 90%, 0 = 100% (ברירת מחדל), 1..3 = 110%..130%. */
export const TEXT_SCALE_MIN = -1;
export const TEXT_SCALE_MAX = 3;

export type A11yPrefs = {
  textScale: number;
  highContrast: boolean;
  grayscale: boolean;
  highlightLinks: boolean;
  readableFont: boolean;
  stopMotion: boolean;
  largeCursor: boolean;
};

export type A11yToggleKey = Exclude<keyof A11yPrefs, "textScale">;

export const DEFAULT_A11Y_PREFS: Readonly<A11yPrefs> = Object.freeze({
  textScale: 0,
  highContrast: false,
  grayscale: false,
  highlightLinks: false,
  readableFont: false,
  stopMotion: false,
  largeCursor: false,
});

/** המאפיינים על `<html>` והערך שמסמן "פעיל". */
export const A11Y_ATTR = {
  textScale: "data-a11y-text",
  highContrast: "data-a11y-contrast",
  grayscale: "data-a11y-grayscale",
  highlightLinks: "data-a11y-links",
  readableFont: "data-a11y-font",
  largeCursor: "data-a11y-cursor",
  stopMotion: LANDING_MOTION_HALT_ATTR,
} as const;

const TOGGLE_ON_VALUE: Record<A11yToggleKey, string> = {
  highContrast: "high",
  grayscale: "true",
  highlightLinks: "true",
  readableFont: "readable",
  largeCursor: "large",
  stopMotion: "true",
};

const TOGGLE_KEYS = Object.keys(TOGGLE_ON_VALUE) as A11yToggleKey[];

/** גודל הטקסט באחוזים לכל רמה (לתצוגה בפאנל; ה-CSS המקביל ב-tokens.css). */
export function textScalePercent(level: number): number {
  return 100 + clampTextScale(level) * 10;
}

export function clampTextScale(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, Math.round(level)));
}

/** ניקוי קלט לא מהימן (localStorage יכול להכיל כל דבר). */
export function sanitizeA11yPrefs(raw: unknown): A11yPrefs {
  const prefs: A11yPrefs = { ...DEFAULT_A11Y_PREFS };
  if (!raw || typeof raw !== "object") return prefs;
  const record = raw as Record<string, unknown>;
  if (typeof record.textScale === "number") prefs.textScale = clampTextScale(record.textScale);
  for (const key of TOGGLE_KEYS) prefs[key] = record[key] === true;
  return prefs;
}

export function isDefaultA11yPrefs(prefs: A11yPrefs): boolean {
  return (Object.keys(DEFAULT_A11Y_PREFS) as (keyof A11yPrefs)[]).every(
    (key) => prefs[key] === DEFAULT_A11Y_PREFS[key],
  );
}

export function loadA11yPrefs(): A11yPrefs {
  try {
    const stored = window.localStorage.getItem(A11Y_STORAGE_KEY);
    return sanitizeA11yPrefs(stored ? JSON.parse(stored) : null);
  } catch {
    return { ...DEFAULT_A11Y_PREFS };
  }
}

/** שומר (או מוחק, כשהכול בברירת מחדל). מחזיר false אם האחסון אינו זמין. */
export function saveA11yPrefs(prefs: A11yPrefs): boolean {
  try {
    if (isDefaultA11yPrefs(prefs)) window.localStorage.removeItem(A11Y_STORAGE_KEY);
    else window.localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}

/** קריאת המצב הנוכחי מ-`<html>` (כולל מה שהסקריפט ה-inline החיל לפני ה-hydration). */
export function readA11yPrefsFromDom(root: HTMLElement = document.documentElement): A11yPrefs {
  const prefs: A11yPrefs = { ...DEFAULT_A11Y_PREFS };
  const text = root.getAttribute(A11Y_ATTR.textScale);
  if (text !== null) prefs.textScale = clampTextScale(Number(text));
  for (const key of TOGGLE_KEYS) {
    if (key === "stopMotion") prefs.stopMotion = isLandingMotionHalted();
    else prefs[key] = root.getAttribute(A11Y_ATTR[key]) === TOGGLE_ON_VALUE[key];
  }
  return prefs;
}

/**
 * החלת ההעדפות על `<html>`. עצירת האנימציות מוחלת אחרונה ודרך `haltLandingMotion()`,
 * שמאלץ חישוב סגנון לפני ש-LandingMotion מבטל את ה-GSAP (ראו landing-motion.ts).
 */
export function applyA11yPrefs(prefs: A11yPrefs, root: HTMLElement = document.documentElement): void {
  const level = clampTextScale(prefs.textScale);
  if (level === 0) root.removeAttribute(A11Y_ATTR.textScale);
  else root.setAttribute(A11Y_ATTR.textScale, String(level));

  for (const key of TOGGLE_KEYS) {
    if (key === "stopMotion") continue;
    if (prefs[key]) root.setAttribute(A11Y_ATTR[key], TOGGLE_ON_VALUE[key]);
    else root.removeAttribute(A11Y_ATTR[key]);
  }

  if (prefs.stopMotion) {
    if (!isLandingMotionHalted()) haltLandingMotion();
  } else if (root.hasAttribute(LANDING_MOTION_HALT_ATTR)) {
    resumeLandingMotion();
  }
}

/**
 * סקריפט inline קטן ל-`<head>` שמחיל את ההעדפות השמורות לפני הציור הראשון (ללא הבהוב)
 * ולפני ה-hydration (כך ש-LandingMotion לא יוצר אנימציה כלל כשהעצירה שמורה).
 * נבנה מהקבועים שלמעלה כדי שלא ייווצר פער בין הסקריפט לקוד הרכיב. מחרוזת סטטית
 * (ללא קלט משתמש) — ניתן לחשב לה hash אם יוגדר CSP בעתיד.
 */
export function buildA11yInlineScript(): string {
  const toggles = TOGGLE_KEYS.map((key) => [key, A11Y_ATTR[key], TOGGLE_ON_VALUE[key]]);
  return (
    "(function(){try{" +
    `var p=JSON.parse(window.localStorage.getItem(${JSON.stringify(A11Y_STORAGE_KEY)})||"null");` +
    'if(!p||typeof p!=="object")return;' +
    "var d=document.documentElement;" +
    "var t=p.textScale;" +
    `if(typeof t==="number"&&t%1===0&&t!==0&&t>=${TEXT_SCALE_MIN}&&t<=${TEXT_SCALE_MAX})` +
    `d.setAttribute(${JSON.stringify(A11Y_ATTR.textScale)},String(t));` +
    `var o=${JSON.stringify(toggles)};` +
    "for(var i=0;i<o.length;i++){if(p[o[i][0]]===true)d.setAttribute(o[i][1],o[i][2]);}" +
    "}catch(e){}})();"
  );
}
