"use client";

import { useId, useState, type ComponentType, type SVGProps } from "react";
import Link from "next/link";
import { Dialog, Toggle } from "radix-ui";
import {
  Check,
  Contrast,
  Link as LinkIcon,
  Minus,
  MousePointer2,
  Palette,
  Pause,
  Plus,
  RotateCcw,
  Type,
  X,
} from "lucide-react";
import {
  DEFAULT_A11Y_PREFS,
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  applyA11yPrefs,
  readA11yPrefsFromDom,
  saveA11yPrefs,
  textScalePercent,
  type A11yPrefs,
  type A11yToggleKey,
} from "@/lib/a11y/preferences";

/**
 * משימה 2.18 — תוסף נגישות פנימי (ללא סקריפט overlay של צד שלישי, §11).
 *
 * - Dialog של Radix (אותו primitive שעליו בנוי ה-Dialog של shadcn) במצב modal: focus trap,
 *   Esc לסגירה, החזרת הפוקוס לכפתור ההפעלה, role="dialog" + aria-labelledby/-describedby.
 *   לא נעשה שימוש ב-Dialog המעוצב של shadcn כי משטחי ברירת המחדל שלו (bg-background
 *   לבן) סותרים את הפאנל הכהה של המותג, וכללי shadcn אוסרים לדרוס צבעים דרך className.
 * - כל אפשרות היא Toggle של Radix (`<button aria-pressed>`); המצב מוצג גם בסימן ✓ ולא רק בצבע.
 * - ההעדפות מוחלות כ-data-* על <html> (CSS ב-styles/tokens.css) ונשמרות ב-localStorage
 *   (try/catch, lib/a11y/preferences.ts). סקריפט inline ב-app/layout.tsx מחיל אותן לפני הציור.
 * - "עצירת אנימציות" = `haltLandingMotion()` של 2.16 (GSAP נעצר בפועל + CSS transitions/animations).
 * - מיקום: פינה תחתונה ב-inline-start (ימין ב-RTL), מול כפתור ה-WhatsApp שב-inline-end —
 *   אין התנגשות. 48px (≥44px), אייקון gold על ink 9.00:1, גבול gold מול רקע כהה/בהיר ≥3:1.
 */

type OptionDef = {
  key: A11yToggleKey;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const OPTIONS: OptionDef[] = [
  { key: "highContrast", label: "ניגודיות גבוהה", icon: Contrast },
  { key: "grayscale", label: "גווני אפור", icon: Palette },
  { key: "highlightLinks", label: "הדגשת קישורים", icon: LinkIcon },
  { key: "readableFont", label: "גופן קריא", icon: Type },
  { key: "stopMotion", label: "עצירת אנימציות", icon: Pause },
  { key: "largeCursor", label: "סמן עכבר מוגדל", icon: MousePointer2 },
];

/**
 * טבעת פוקוס (WCAG 2.4.7 / 1.4.11). חשוב: ב-Tailwind v4 `outline-none` קובע
 * `--tw-outline-style: none`, ו-`focus-visible:outline-2` משתמש ב-`outline-style: var(--tw-outline-style)`
 * — כך שהשילוב משאיר את ה-outline בלתי נראה. התיקון: `focus-visible:outline-solid` מפורש (מאפס את
 * המשתנה ל-solid במצב פוקוס), ו-`outline-hidden` במקום `outline-none` (מוסיף outline שקוף במצב
 * forced-colors / Windows High Contrast). נשמר ע"י בדיקת רגרסיה (__tests__/focusClasses.test.tsx).
 *
 * ניגודיות gold-light (#E9D58A) מול הרקע הסמוך לטבעת (offset 2px — מחוץ לרכיב):
 * ink-raised (רקע הפאנל) 12.69:1, ink 13.45:1, ink-elevated 10.83:1, charcoal 11.86:1 — כולם ≥3:1.
 */
const FOCUS_RING =
  "outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light";

/**
 * כפתור ההפעלה צף מעל כל הדף, כולל רצועות בהירות (champagne/sand/blush/porcelain/white) שבהן
 * gold-light נותן רק 1.10–1.46:1. לכן נוספת "הילה" אטומה של ink (#0B0B0B) ברוחב 6px מתחת לטבעת.
 *
 * (fix 2) ההילה ממומשת כ-ring ולא כ-`shadow-[…var(--color-ink)]`: ב-Tailwind v4 צל שרירותי מתקמפל
 * ל-`var(--tw-shadow-color, var(--color-ink))`, וה-`shadow-black/30` של הכפתור קובע את
 * `--tw-shadow-color` — כך שההילה יצאה שחור 30% (2.06–2.10:1 בלבד). ring משתמש ב-`--tw-ring-color`
 * הבלתי תלוי, ו-ring-offset נשאר 0. גאומטריה (מקצה הגבול החוצה): ink 0–6px (ring), ועליו outline
 * gold-light ב-2–4px (offset 2px) — כלומר gold על ink, וקצה ה-ink החיצוני (4–6px) מול הדף.
 *
 * ניגודיות: gold-light מול ink 13.45:1. ink מול רצועות בהירות: champagne 18.24:1, sand 16.15:1,
 * blush 14.79:1, porcelain 19.21:1, white 19.68:1. על רצועות כהות (ink 1.00, ink-raised 1.06,
 * charcoal 1.13 מול ההילה) הטבעת gold-light עצמה נותנת מול הדף 13.45 / 12.69 / 11.86:1.
 * כך המחוון ≥3:1 בכל רקע. נשמר ע"י בדיקת קומפילציה (__tests__/focusClasses.test.tsx).
 */
const TRIGGER_FOCUS_RING = `${FOCUS_RING} focus-visible:ring-6 focus-visible:ring-ink`;

/** aria-disabled ולא disabled: כפתור שהופך ל-disabled מאבד פוקוס (הפוקוס "נופל" מהדיאלוג). */
const STEPPER = `flex size-12 shrink-0 items-center justify-center rounded-lg border border-gold-antique bg-ink text-gold hover:border-gold aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:border-gold-antique ${FOCUS_RING}`;

/** סמל הנגישות הבינלאומי (דמות בתוך עיגול) — ציור פנימי, currentColor. */
function AccessibilitySymbol(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" {...props}>
      <circle cx="12" cy="12" r="10.25" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="6.6" r="1.6" fill="currentColor" />
      <path
        d="M6.6 9.4c1.9.6 3.6.9 5.4.9s3.5-.3 5.4-.9M12 10.3v3.6m0 0-2.4 5m2.4-5 2.4 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<A11yPrefs>(DEFAULT_A11Y_PREFS);
  const [motionReloadNote, setMotionReloadNote] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const textGroupId = useId();

  const handleOpenChange = (next: boolean) => {
    // מקור האמת הוא <html> (כולל מה שהסקריפט ה-inline החיל) — סנכרון בכל פתיחה.
    if (next) setPrefs(readA11yPrefsFromDom());
    setOpen(next);
  };

  const commit = (next: A11yPrefs) => {
    setPrefs(next);
    applyA11yPrefs(next);
    setStorageFailed(!saveA11yPrefs(next));
  };

  const toggle = (key: A11yToggleKey, pressed: boolean) => {
    if (key === "stopMotion") setMotionReloadNote(!pressed && prefs.stopMotion);
    commit({ ...prefs, [key]: pressed });
  };

  const setTextScale = (level: number) => commit({ ...prefs, textScale: level });

  const reset = () => {
    setMotionReloadNote(prefs.stopMotion);
    commit({ ...DEFAULT_A11Y_PREFS });
  };

  const percent = textScalePercent(prefs.textScale);
  const atMin = prefs.textScale <= TEXT_SCALE_MIN;
  const atMax = prefs.textScale >= TEXT_SCALE_MAX;

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="פתיחת תפריט נגישות"
          title="תפריט נגישות"
          data-a11y-trigger=""
          className={`fixed bottom-5 start-5 z-50 flex size-12 items-center justify-center rounded-full border-2 border-gold bg-ink text-gold shadow-lg shadow-black/30 hover:bg-ink-elevated ${TRIGGER_FOCUS_RING}`}
        >
          <AccessibilitySymbol className="size-7" />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Content
          dir="rtl"
          data-a11y-panel=""
          className="fixed start-3 end-3 bottom-3 z-60 flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-y-auto rounded-lg border border-gold-antique bg-ink-raised text-champagne shadow-lift motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:slide-in-from-bottom-2 sm:end-auto sm:start-5 sm:bottom-20 sm:w-96 sm:max-h-[calc(100dvh-6.5rem)]"
        >
          <div className="flex items-start justify-between gap-4 p-5 pbe-3">
            <div className="flex flex-col gap-2">
              <Dialog.Title className="font-heading text-h3 text-gold-pale">התאמות נגישות</Dialog.Title>
              <span aria-hidden="true" className="rule-gilded" />
              <Dialog.Description className="text-caption text-champagne-muted">
                ההגדרות נשמרות בדפדפן הזה בלבד ואפשר לאפס אותן בכל רגע.
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="סגירת תפריט הנגישות"
              className={`-me-2 flex size-11 shrink-0 items-center justify-center rounded-full text-champagne hover:bg-ink-elevated ${FOCUS_RING}`}
            >
              <X aria-hidden="true" className="size-5" />
            </Dialog.Close>
          </div>

          <div className="flex flex-col gap-5 px-5 pbe-5">
            <div role="group" aria-labelledby={textGroupId} className="flex flex-col gap-2">
              <span id={textGroupId} className="text-body font-semibold text-champagne">
                גודל טקסט
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="הקטנת הטקסט"
                  aria-disabled={atMin}
                  onClick={() => !atMin && setTextScale(prefs.textScale - 1)}
                  className={STEPPER}
                >
                  <Minus aria-hidden="true" className="size-5" />
                </button>
                <p role="status" className="flex-1 text-center text-body tabular-nums text-champagne">
                  {percent === 100 ? "רגיל (100%)" : `${percent}%`}
                </p>
                <button
                  type="button"
                  aria-label="הגדלת הטקסט"
                  aria-disabled={atMax}
                  onClick={() => !atMax && setTextScale(prefs.textScale + 1)}
                  className={STEPPER}
                >
                  <Plus aria-hidden="true" className="size-5" />
                </button>
              </div>
            </div>

            <ul aria-label="אפשרויות תצוגה" className="flex flex-col gap-2">
              {OPTIONS.map(({ key, label, icon: Icon }) => (
                <li key={key}>
                  <Toggle.Root
                    pressed={prefs[key]}
                    onPressedChange={(pressed) => toggle(key, pressed)}
                    data-a11y-option={key}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-lg border border-gold-antique bg-ink px-4 py-2 text-start text-body text-champagne hover:border-gold data-[state=on]:border-gold data-[state=on]:bg-ink-elevated ${FOCUS_RING}`}
                  >
                    <Icon aria-hidden="true" className="size-5 shrink-0 text-gold" />
                    <span className="flex-1">{label}</span>
                    <span
                      aria-hidden="true"
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${
                        prefs[key] ? "border-gold bg-gold text-ink" : "border-gold-antique"
                      }`}
                    >
                      {prefs[key] ? <Check className="size-4" strokeWidth={3} /> : null}
                    </span>
                  </Toggle.Root>
                </li>
              ))}
            </ul>

            {motionReloadNote ? (
              <p role="status" className="text-caption text-champagne-muted">
                האנימציות יחזרו לפעול רק לאחר רענון הדף.
              </p>
            ) : null}
            {storageFailed ? (
              <p role="status" className="text-caption text-champagne-muted">
                הדפדפן חוסם שמירה מקומית — ההגדרות יחולו רק עד סגירת הדף.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-hairline-dark pbs-4">
              <button
                type="button"
                onClick={reset}
                data-a11y-reset=""
                className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-body text-gold-pale hover:text-gold-light ${FOCUS_RING}`}
              >
                <RotateCcw aria-hidden="true" className="size-4" />
                איפוס הגדרות
              </button>
              <Link
                href="/accessibility"
                onClick={() => setOpen(false)}
                className={`inline-flex min-h-11 items-center px-2 text-body text-gold-pale underline underline-offset-4 hover:text-gold-light ${FOCUS_RING}`}
              >
                הצהרת הנגישות
              </Link>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default AccessibilityWidget;
