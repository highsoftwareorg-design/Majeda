/**
 * משימה 2.16 — API ציבורי (ללא תלות ב-GSAP) לשליטה באנימציות דף הנחיתה.
 *
 * מקור האמת לעצירת אנימציות הוא המאפיין `data-reduce-motion` על `<html>`.
 * רכיב התזמור `components/landing/LandingMotion.tsx` מאזין לו (MutationObserver):
 * - אם המאפיין קיים בזמן הטעינה — לא נוצרת אף אנימציה.
 * - אם הוא נוסף בזמן ריצה — כל האנימציות וה-ScrollTriggers של הדף מבוטלים
 *   (`mm.revert()`), הסגנונות ה-inline מוסרים והתוכן מוצג מיד במצבו הסופי.
 * - הסרת המאפיין אינה מפעילה מחדש את האנימציות (עד רענון הדף) — עדיף "שקט" על פני
 *   הפעלה חוזרת של אנימציות כניסה על תוכן שכבר נקרא.
 *
 * תוסף הנגישות (2.18) יכול פשוט לקרוא ל-`haltLandingMotion()` / `resumeLandingMotion()`,
 * או להגדיר את המאפיין בעצמו (למשל מתוך העדפה שנשמרה ב-localStorage) לפני/אחרי הטעינה.
 */

/** שם המאפיין על `<html>` שעוצר את כל אנימציות דף הנחיתה. */
export const LANDING_MOTION_HALT_ATTR = "data-reduce-motion";

/** אירוע פנימי: סקשן שנטען ב-Suspense סיים hydration ומוכן לאנימציה. */
export const LANDING_MOTION_SECTION_READY_EVENT = "landing-motion:section-ready";

/** סקשנים שמגיעים ב-streaming (עטופים ב-Suspense ב-app/page.tsx). */
export type StreamedLandingSection = "treatments" | "contact-form";

const readySections = new Set<StreamedLandingSection>();

/** האם האנימציות נעצרו (המאפיין קיים וערכו אינו "false"). */
export function isLandingMotionHalted(): boolean {
  if (typeof document === "undefined") return false;
  const value = document.documentElement.getAttribute(LANDING_MOTION_HALT_ATTR);
  return value !== null && value !== "false";
}

/**
 * עוצר מיד את כל אנימציות דף הנחיתה ומציג את התוכן במצבו הסופי.
 *
 * 2.18 — סדר פעולות (מונע "דהייה" של ~150ms ותזוזה של 8px בכפתורי `transition-all`):
 * 1. הגדרת המאפיין → כלל ה-CSS ב-tokens.css (`transition: none !important` תחת
 *    `html[data-reduce-motion]`) נכנס לתוקף;
 * 2. אילוץ חישוב סגנון/פריסה סינכרוני (getBoundingClientRect) — הדפדפן "מתחייב"
 *    ל-transition:none על כל האלמנטים *לפני* שמשהו משתנה;
 * 3. רק אחר כך, ב-microtask, ה-MutationObserver של LandingMotion קורא ל-`mm.revert()`
 *    שמסיר את ה-opacity/transform ה-inline — השינוי מוחל מיד, בלי CSS transition.
 */
export function haltLandingMotion(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute(LANDING_MOTION_HALT_ATTR, "true");
  void root.getBoundingClientRect(); // flush לפני ה-revert (שרץ ב-microtask)
}

/** מסיר את העצירה. אנימציות כניסה יחזרו רק בטעינת הדף הבאה. */
export function resumeLandingMotion(): void {
  if (typeof document === "undefined") return;
  document.documentElement.removeAttribute(LANDING_MOTION_HALT_ATTR);
}

/** נקרא ע"י `LandingMotionSectionReady` כשסקשן streamed סיים hydration. */
export function markLandingSectionReady(section: StreamedLandingSection): void {
  readySections.add(section);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<StreamedLandingSection>(LANDING_MOTION_SECTION_READY_EVENT, {
        detail: section,
      }),
    );
  }
}

/** סקשנים streamed שכבר סיימו hydration (למקרה שהאירוע קדם להאזנה). */
export function getReadyLandingSections(): StreamedLandingSection[] {
  return Array.from(readySections);
}
