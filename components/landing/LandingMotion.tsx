"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CustomEase } from "gsap/CustomEase";
import { useGSAP } from "@gsap/react";
import {
  LANDING_MOTION_HALT_ATTR,
  LANDING_MOTION_SECTION_READY_EVENT,
  getReadyLandingSections,
  isLandingMotionHalted,
  type StreamedLandingSection,
} from "@/lib/motion/landing-motion";

/** האם יש סביבת דפדפן מלאה (window + matchMedia). ב-SSR/jsdom ללא matchMedia — לא. */
function canAnimate(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

let pluginsRegistered = false;
/**
 * רישום חד-פעמי של הפלאגינים, בצד הלקוח בלבד (gsap-react: לא להריץ GSAP ב-SSR).
 * ScrollTrigger ניגש ל-window.matchMedia כבר ברישום, ולכן הרישום מותנה בקיומו —
 * כך שייבוא המודול לא קורס בסביבה ללא matchMedia (למשל jsdom). נקרא גם בטעינת
 * המודול (כשאפשר) וגם בתוך useGSAP לפני כל שימוש, כגיבוי.
 */
function ensurePluginsRegistered(): boolean {
  if (pluginsRegistered) return true;
  if (!canAnimate()) return false;
  gsap.registerPlugin(useGSAP, ScrollTrigger, CustomEase);
  pluginsRegistered = true;
  return true;
}
ensurePluginsRegistered();

/*
 * מאפייני ה-inline שהאנימציה כותבת (opacity, transform, transformOrigin, transition)
 * מוסרים בסיום כל חשיפה (settleRevealed) כדי שה-CSS של הרכיב (למשל disabled:opacity-50
 * בכפתור, frame-zoom) יחזור לשלוט.
 */

/**
 * סיום בטוח של חשיפה — לעולם לא "מוסר" ל-CSS transition (למשל transition-all של Button).
 *
 * אם מסירים באותו שינוי סגנון גם `opacity:0` וגם `transition:none`, הדפדפן רואה
 * opacity 0→1 יחד עם transition-all פעיל ומנפיש fade של ~180ms (באג פוקוס על כפתור
 * השליחה שטרם נחשף). לכן שלושה שלבים:
 * 1. כתיבת opacity:1 עם `transition: none`, ובאותה כתיבה הסרת transform/transformOrigin
 *    (clearProps). לא כותבים y:0/scale:1 — GSAP היה כותב `translate(0px,0px)`, והסרתו
 *    בשלב 3 הייתה מתחילה transition (בלתי נראה, transform זהותי) על כפתורי transition-all.
 * 2. אילוץ חישוב סגנון (getBoundingClientRect) — הדפדפן "מתחייב" ל-opacity:1 ול-transform
 *    none ללא transition.
 * 3. clearProps של opacity/transition בלבד — ההסרה משנה 1→1 (ללא שינוי נראה), אין מה להנפיש.
 */
// 2.22: גם clipPath — חשיפת התמונות (inset) לא משאירה clip-path inline אחרי הסיום.
const SETTLE_CLEAR_TRANSFORM = "transform,transformOrigin,clipPath";
const SETTLE_CLEAR_REST = "opacity,transition";

function settleRevealed(targets: Element[]): void {
  if (targets.length === 0) return;
  gsap.set(targets, { opacity: 1, transition: "none", clearProps: SETTLE_CLEAR_TRANSFORM });
  void targets[0].getBoundingClientRect(); // flush סגנון יחיד לכל המסמך
  gsap.set(targets, { clearProps: SETTLE_CLEAR_REST });
}

/**
 * משימה 2.16 — רכיב התזמור של אנימציות הכניסה/גלילה בדף הנחיתה.
 *
 * עקרונות (מתוך ה-skills ומהערת 2.11 ב-PLAN):
 * - "רגע מתוזמר אחד" (frontend-design): רק ב-Hero יש timeline מלא (קשת → כותרת →
 *   קו מוזהב → הבטחה → CTA, כ-1.1 שניות). בשאר הסקשנים חשיפה מינימלית ושונה לכל
 *   סקשן (לא fade-up זהה), פעם אחת בלבד (`once`), ללא scrub.
 * - transform/opacity בלבד (gsap-performance): y / scale / scaleX / opacity.
 *   במכוון opacity ולא autoAlpha: autoAlpha מגדיר visibility:hidden, שמוציא את
 *   שדות הטופס/הקישורים מסדר ה-Tab ואת הטקסט מעץ הנגישות עד החשיפה. עם opacity
 *   האלמנט נשאר נגיש; פוקוס (focusin) על אלמנט שטרם נחשף משלים את חשיפתו מיד,
 *   כך שאלמנט ממוקד לעולם אינו שקוף.
 * - ערכי סיום מפורשים בלבד (fromTo / to) + `transition: none` זמני על היעדים, כדי
 *   ש-CSS transitions (כמו transition-all של Button) לא ישחיתו את מצב הסיום.
 *   אין תנועה אופקית כלל → אין "דליפה משמאל" ב-RTL. מוקד ה-scaleX של הקו המוזהב
 *   נגזר מכיוון המסמך (inline-start = ימין ב-RTL) בדסקטופ, ומהמרכז בנייד.
 * - ללא FOUC/CLS: התוכן מרונדר גלוי ב-SSR ונשאר גלוי ללא JS. מצבי ההתחלה מוחלים
 *   רק בתוך ענף `prefers-reduced-motion: no-preference` של gsap.matchMedia, ורק על
 *   אלמנטים שעדיין מתחת לקו הגלילה (אלמנט שכבר נראה לא מוסתר ולא "מהבהב").
 * - `reduce` → אין אנימציה בכלל. `data-reduce-motion` על `<html>` → עצירה מיידית
 *   (ראו lib/motion/landing-motion.ts). כפתור ה-WhatsApp הצף לא מונפש בכלל.
 * - טוקני תנועה מ-styles/tokens.css: `--ease-luxe` (דרך CustomEase), `--duration-base`,
 *   `--duration-slow` — מקור אמת יחיד, ללא ערכים כפולים בקוד.
 *
 * הרכיב מרנדר `span` מוסתר יחיד כדי לאתר את ה-`<main>` (ה-scope) בלי לעטוף את
 * ה-Server Components של הסקשנים או לשנות את מבנה ה-DOM שלהם.
 */

type MotionTokens = { ease: string; base: number; slow: number };

/** קריאת טוקני התנועה מ-CSS (fallback לערכי 2.11 אם המשתנה חסר, למשל ב-jsdom). */
function readMotionTokens(): MotionTokens {
  const styles = getComputedStyle(document.documentElement);
  const toSeconds = (name: string, fallback: number) => {
    const raw = styles.getPropertyValue(name).trim();
    const ms = Number.parseFloat(raw);
    if (!Number.isFinite(ms)) return fallback;
    return raw.endsWith("ms") ? ms / 1000 : ms;
  };

  // --ease-luxe: cubic-bezier(0.22, 1, 0.36, 1) ≈ power4.out (ease-out-quint)
  let ease = "power4.out";
  const bezier = styles
    .getPropertyValue("--ease-luxe")
    .match(/cubic-bezier\(([^)]+)\)/);
  if (bezier) {
    if (!CustomEase.get("luxe")) CustomEase.create("luxe", bezier[1].replace(/\s+/g, ""));
    ease = "luxe";
  }

  return {
    ease,
    base: toSeconds("--duration-base", 0.32),
    slow: toSeconds("--duration-slow", 0.7),
  };
}

/**
 * מסנן אלמנטים שכבר נראים/מעל ה-viewport — רק מה שמתחת לקו הגלילה יוסתר ויחשף.
 * כל הקריאות (getBoundingClientRect) קודם, ורק אח"כ הכתיבות (gsap.set) — gsap-performance.
 */
function belowFold(elements: Element[]): Element[] {
  const limit = window.innerHeight * 0.92;
  return elements.filter((el) => el.getBoundingClientRect().top > limit);
}

/*
 * משימה 2.22 — תנועה עשירה ומאופקת לתמונות:
 *
 * (1) parallax / scale-on-scroll (scrub) — רק על השכבה הפנימית [data-landing-parallax] שבתוך
 *     מכל [data-landing-image] עם overflow:hidden. לא על ה-img (שם פועל frame-zoom ב-hover) ולא על
 *     המכל (שם פועל ה-clip). transform בלבד (yPercent/scale), ease "none", ציר y בלבד.
 *     - Hero: scale 1 → 1.08 ו-yPercent 0 → 3 בין "top top" ל-"bottom top". בהתחלה scale 1 — אין
 *       "קפיצה" ב-hydration של ה-LCP. בכל נקודה ההזזה (3p%) קטנה מהשוליים שה-scale יוצר (4p%
 *       לכל צד), ולכן שולי התמונה לעולם לא נחשפים.
 *     - תמונות האווירה: scale קבוע 1.08 (4% שוליים לכל צד) ו-yPercent ‎-3 → 3 לאורך מעבר התמונה
 *       ב-viewport ("top bottom" → "bottom top"). |3%| < 4% → אין חשיפת שוליים.
 *     ScrollTrigger אחד לכל תמונה (4 בסך הכול), scrub מוחלק קל.
 * (2) חשיפת clip (inset) פעם אחת בכניסה ל-viewport — על המכל, סימטרית (אותו ערך ב-inline-start
 *     וב-inline-end) ולכן בטוחה ל-RTL. דרך reveal() הקיים: רק מתחת לקו הגלילה, רק בענף
 *     no-preference, ו-settleRevealed מסיר את ה-clip-path ה-inline בסיום.
 *     ה-Hero לא מקבל clip — הוא רקע מלא וכבר נראה בטעינה; הרגע המתוזמר שלו נשאר ה-timeline של 2.16.
 */
const PARALLAX_SCALE = 1.08;
const PARALLAX_Y_PERCENT = 3; // < (PARALLAX_SCALE - 1) / 2 * 100 = 4 → אין חשיפת שוליים
const PARALLAX_SCRUB = 0.6;

type RevealSpec = {
  from: gsap.TweenVars;
  to: gsap.TweenVars;
  stagger: number;
};

export function LandingMotion() {
  const markerRef = useRef<HTMLSpanElement>(null);

  useGSAP(() => {
    const marker = markerRef.current;
    const root = marker?.parentElement;
    if (!root || !ensurePluginsRegistered()) return; // jsdom/SSR-safe
    if (isLandingMotionHalted()) return;

    const q = gsap.utils.selector(root); // selectors scoped ל-<main> בלבד
    const mm = gsap.matchMedia();
    let heroPlayed = false; // הרגע המתוזמר רץ פעם אחת בלבד לטעינה

    // ענף יחיד: no-preference. תחת reduce הענף לא רץ (ואם המשתמש עובר ל-reduce
    // באמצע — matchMedia מבטל הכול אוטומטית והתוכן מוצג במצבו הסופי).
    mm.add(
      "(prefers-reduced-motion: no-preference)",
      (context) => {
        const { ease, base, slow } = readMotionTokens();
        const rtl = getComputedStyle(root).direction === "rtl";
        // נבדק פעם אחת (לא כתנאי matchMedia) כדי ששינוי רוחב לא יפעיל מחדש את ה-Hero.
        const isDesktop = window.matchMedia("(min-width: 64rem)").matches; // Tailwind lg

        /*
         * מניעת השחתת מצב הסיום ע"י CSS transitions (למשל transition-all של Button):
         * - ערכי סיום מפורשים בכל מקום (fromTo / to עם ערכים קבועים) — GSAP לעולם לא
         *   "קורא" את מצב הסיום מה-computed style באמצע transition.
         * - `transition: none` inline על כל יעד מונפש למשך האנימציה בלבד, כדי שהדפדפן
         *   לא יחליק/יפגר אחרי כל פריים של GSAP; מוסר בסיום יחד עם שאר ה-inline (settleRevealed).
         */
        /** יעדים שמצב ההתחלה (המוסתר) הוחל עליהם ועדיין לא הושלמה חשיפתם. */
        const unrevealed = new Set<Element>();

        /** חשיפה חד-פעמית בגלילה, מקובצת (ScrollTrigger.batch) עם stagger. */
        const reveal = (targets: Element[], spec: RevealSpec) => {
          const pending = belowFold(targets); // קריאות קודם...
          if (pending.length === 0) return;
          gsap.set(pending, { ...spec.from, transition: "none" }); // ...ואז כתיבה אחת
          pending.forEach((el) => unrevealed.add(el));
          ScrollTrigger.batch(pending, {
            start: "top 88%",
            once: true,
            onEnter: (batch) => {
              // יעד שכבר נחשף (למשל בגלל פוקוס) לא מונפש שוב
              const live = batch.filter((el) => unrevealed.has(el));
              if (live.length === 0) return;
              // context.add — כדי שגם tweens שנוצרים מאוחר יבוטלו ב-revert/unmount
              context.add(() =>
                gsap.to(live, {
                  ...spec.to,
                  ease,
                  stagger: spec.stagger,
                  overwrite: true,
                  // לא clearProps של ה-tween (מסיר opacity+transition יחד) — סיום בטוח:
                  onComplete: () => {
                    live.forEach((el) => unrevealed.delete(el));
                    settleRevealed(live);
                  },
                }),
              );
            },
          });
        };

        /**
         * 2.22 — parallax עדין (scrub) על השכבה הפנימית של תמונה. ראו ההערה מעל PARALLAX_SCALE.
         * `hero`: scale-on-scroll מ-1 (ללא קפיצה בטעינה); `atmosphere`: scale קבוע + הזזת y קטנה.
         */
        const parallax = (container: Element | undefined, trigger: Element | undefined, kind: "hero" | "atmosphere") => {
          const layer = container?.querySelector("[data-landing-parallax]");
          if (!layer || !trigger) return;
          // will-change רק על 4 השכבות שבאמת זזות עם הגלילה (gsap-performance); מוסר ב-revert.
          // (transform-origin נשאר ברירת המחדל — מרכז — סימטרי ובטוח ל-RTL.)
          gsap.set(layer, { willChange: "transform" });
          const from: gsap.TweenVars =
            kind === "hero"
              ? { scale: 1, yPercent: 0 }
              : { scale: PARALLAX_SCALE, yPercent: -PARALLAX_Y_PERCENT };
          gsap.fromTo(layer, from, {
            scale: PARALLAX_SCALE,
            yPercent: PARALLAX_Y_PERCENT,
            ease: "none", // scrub — מיפוי ליניארי לגלילה
            scrollTrigger: {
              trigger,
              start: kind === "hero" ? "top top" : "top bottom",
              end: "bottom top",
              scrub: PARALLAX_SCRUB,
            },
          });
        };

        /** 2.22 — חשיפת clip סימטרית (פעם אחת) של מכל תמונה; הסיום החוצה (שלילי) כולל את קו המסגרת. */
        const revealImage = (targets: Element[], fromInset: string, toInset: string) =>
          reveal(targets, {
            from: { clipPath: fromInset },
            to: { clipPath: toInset, duration: slow * 1.4 },
            stagger: 0,
          });

        // ---- Hero: הרגע המתוזמר היחיד (≈1.1s) ----
        const hero = q("[data-hero]")[0];
        let heroTimeline: gsap.core.Timeline | null = null;
        let heroTargets: Element[] = [];
        if (!heroPlayed && hero && hero.getBoundingClientRect().bottom > 0) {
          heroPlayed = true;
          const ruleOrigin = isDesktop ? (rtl ? "100% 50%" : "0% 50%") : "50% 50%";
          const lift = base * 1.5;
          const media = q("[data-hero-media]");
          const title = q("[data-hero-title]");
          const rule = q("[data-hero-rule]");
          const promise = q("[data-hero-promise]");
          const cta = q("[data-hero-cta]"); // Button עם transition-all — ראו הערה למעלה
          heroTargets = [...media, ...title, ...rule, ...promise, ...cta];
          gsap.set(heroTargets, { transition: "none" });
          heroTimeline = gsap
            .timeline({
              defaults: { ease },
              onComplete: () => {
                // גם scaleX של הקו המוזהב חוזר ל-1 דרך scale:1; ואז clearProps בטוח.
                settleRevealed(heroTargets);
                heroTargets = [];
              },
            })
            .fromTo(media, { opacity: 0, y: 16, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: slow }, 0)
            .fromTo(title, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: slow }, 0.1)
            .fromTo(
              rule,
              { scaleX: 0, transformOrigin: ruleOrigin },
              { scaleX: 1, transformOrigin: ruleOrigin, duration: lift },
              0.35,
            )
            .fromTo(promise, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: lift }, 0.5)
            .fromTo(cta, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: lift }, 0.62);
        }
        // 2.22 — scale-on-scroll לתמונת ה-Hero: אלמנט אחר מזה של ה-timeline ([data-hero-media]/טקסט),
        // ולכן אין התנגשות. ה-trigger הוא הסקשן (המכל עצמו מוסתר במצב ניגודיות גבוהה).
        parallax(q('[data-landing-image="hero"]')[0], hero, "hero");

        // ---- פוקוס על אלמנט שעדיין לא נחשף → השלמת החשיפה מיד (WCAG 2.4.7) ----
        const onFocusIn = (event: FocusEvent) => {
          const target = event.target;
          if (!(target instanceof Node)) return;
          if (heroTimeline && heroTimeline.progress() < 1 && heroTargets.some((el) => el.contains(target))) {
            heroTimeline.progress(1); // מפעיל onComplete → settleRevealed
          }
          const focused: Element[] = [];
          unrevealed.forEach((el) => {
            if (!el.contains(target)) return;
            unrevealed.delete(el);
            gsap.killTweensOf(el);
            focused.push(el);
          });
          // opacity:1 + transition:none → flush → clearProps (ללא fade של transition-all)
          settleRevealed(focused);
        };
        root.addEventListener("focusin", onFocusIn);

        // ---- סקשנים סטטיים (חלק מה-shell) — חשיפה מינימלית ושונה לכל אחד ----
        // לפני/אחרי: הקשתות "עולות" — הסקשן היחיד עם scale (מוטיב החתימה).
        // האנימציה על הפריט החיצוני; frame-zoom מזיז רק את [data-frame-media] הפנימי.
        reveal(q("[data-before-after-item]"), {
          from: { opacity: 0, y: 24, scale: 0.97 },
          to: { opacity: 1, y: 0, scale: 1, duration: slow },
          stagger: 0.12,
        });
        // המלצות: opacity בלבד — ציטוט נקרא בשקט, בלי תנועה.
        reveal(q("[data-testimonial-item]"), {
          from: { opacity: 0 },
          to: { opacity: 1, duration: slow },
          stagger: 0.18,
        });
        // אודות: הטקסט עולה מעט, הדיוקנאות מתבהרים בלי תזוזה אנכית.
        reveal(q("[data-about-copy]"), {
          from: { opacity: 0, y: 16 },
          to: { opacity: 1, y: 0, duration: slow },
          stagger: 0,
        });
        reveal(q("[data-about-member]"), {
          from: { opacity: 0, scale: 0.96 },
          to: { opacity: 1, scale: 1, duration: slow },
          stagger: 0.1,
        });
        // 2.22 — תמונות האווירה הסטטיות: חשיפת clip סימטרית + parallax על השכבה הפנימית.
        // מפריד: "רצועה נפתחת" אנכית בלבד; אודות: מסגרת שנפתחת מהמרכז, הסיום כולל את קו המסגרת.
        const divider = q('[data-landing-image="divider"]')[0];
        const about = q('[data-landing-image="about"]')[0];
        revealImage(divider ? [divider] : [], "inset(22% 0% 22% 0%)", "inset(0% 0% 0% 0%)");
        revealImage(about ? [about] : [], "inset(10% 8% 10% 8%)", "inset(-6% -6% -6% -6%)");
        parallax(divider, divider, "atmosphere");
        parallax(about, about, "atmosphere");
        // פרטי קשר: רמז קטן בלבד.
        reveal(q("[data-contact-item]"), {
          from: { opacity: 0, y: 8 },
          to: { opacity: 1, y: 0, duration: base * 1.5 },
          stagger: 0.08,
        });

        // ---- סקשנים streamed (Suspense) — רק אחרי שה-boundary סיים hydration ----
        const done = new Set<StreamedLandingSection>();
        const setupStreamed = (section: StreamedLandingSection) => {
          if (done.has(section)) return;
          done.add(section);
          context.add(() => {
            if (section === "treatments") {
              // "תפריט" — שורות דקות נחשפות במהירות, stagger קצר.
              reveal(q("[data-treatment-item]"), {
                from: { opacity: 0, y: 12 },
                to: { opacity: 1, y: 0, duration: base * 1.5 },
                stagger: 0.05,
              });
              // 2.22 — תמונת האווירה של הטיפולים (בתוך ה-boundary ה-streamed).
              const treatmentsImage = q('[data-landing-image="treatments"]')[0];
              revealImage(
                treatmentsImage ? [treatmentsImage] : [],
                "inset(10% 8% 10% 8%)",
                "inset(-6% -6% -6% -6%)",
              );
              parallax(treatmentsImage, treatmentsImage, "atmosphere");
            } else {
              // טופס: הפאנל עולה, השדות מצטרפים בזה אחר זה בהתאם לגלילה.
              reveal(q("[data-contact-form-panel]"), {
                from: { opacity: 0, y: 20 },
                to: { opacity: 1, y: 0, duration: slow },
                stagger: 0,
              });
              reveal(q("[data-contact-form-field], [data-contact-form-submit]"), {
                from: { opacity: 0, y: 8 },
                to: { opacity: 1, y: 0, duration: base },
                stagger: 0.05,
              });
            }
          });
          ScrollTrigger.refresh(); // ה-layout השתנה כשה-boundary נטען
        };

        getReadyLandingSections().forEach(setupStreamed);
        const onReady = (event: Event) =>
          setupStreamed((event as CustomEvent<StreamedLandingSection>).detail);
        window.addEventListener(LANDING_MOTION_SECTION_READY_EVENT, onReady);

        return () => {
          window.removeEventListener(LANDING_MOTION_SECTION_READY_EVENT, onReady);
          root.removeEventListener("focusin", onFocusIn);
        };
      },
    );

    // עצירה בזמן ריצה (2.18 — "עצירת אנימציות"): ביטול כל האנימציות והצגת התוכן.
    const haltObserver = new MutationObserver(() => {
      if (isLandingMotionHalted()) {
        mm.revert();
        haltObserver.disconnect();
      }
    });
    haltObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [LANDING_MOTION_HALT_ATTR],
    });

    return () => {
      haltObserver.disconnect();
      mm.revert();
    };
  });

  return <span ref={markerRef} hidden aria-hidden="true" data-landing-motion="" />;
}

export default LandingMotion;
