"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { SECTION_IMAGES } from "@/lib/landing/section-images";
import { TREATMENT_MENU } from "@/lib/landing/treatment-menu";

/**
 * סקשן "הטיפולים" של דף הנחיתה — דפדפן טיפולים אינטראקטיבי (מחליף את רשימת הטקסט הארוכה).
 *
 * UX: מבקרת בדף רואה קודם את ה*קטגוריות* (כפתורי סינון עם מספר טיפולים), בוחרת קטגוריה,
 * ורואה את הטיפולים כ*כרטיסים* נקיים — שם הטיפול + שם המכשיר/המותג בלבד (בלי קיר טקסט).
 * לחיצה על כרטיס חושפת תיאור קצר ("גלי לפרטים"). כך קל לסרוק מה יש, ולהעמיק רק במה שמעניין.
 *
 * תוכן סטטי (lib/landing/treatment-menu.ts), ללא מחירים (לפי בקשת הקליניקה), נפרד מרשימת
 * הטיפולים שב-DB (getTreatments) המשמשת את קביעת התור.
 *
 * עיצוב (כיוון "אטלייה נואר ושמפניה"): רצועה בהירה (champagne-wash). קטגוריה פעילה = bg-gold /
 * text-ink; לא-פעילה = קו שיער + charcoal. כרטיסים בקו שיער עם מבטא זהב (gold-deep) ו-charcoal/taupe.
 * ללא טוקני שטח כהה (טוקני זהב בהירים וכו') — תואם למגבלת הרצועות הבהירות.
 *
 * נגישות: כפתורי הקטגוריות הם קבוצת סינון (aria-pressed) עם aria-label; כל כרטיס הוא כפתור
 * חשיפה (aria-expanded + aria-controls). RTL ו-mobile-first: logical properties, כפתורים
 * נגללים/נשברים בנייד, כרטיסים בעמודה אחת→שתיים→שלוש.
 */
export function TreatmentMenuSection() {
  const [activeCategoryId, setActiveCategoryId] = useState(TREATMENT_MENU[0].id);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const panelId = useId();

  const activeCategory =
    TREATMENT_MENU.find((category) => category.id === activeCategoryId) ?? TREATMENT_MENU[0];

  return (
    <section
      id="treatments"
      data-treatments
      data-treatment-menu
      data-band="light"
      data-band-tone="champagne"
      className="w-full bg-champagne-wash px-gutter py-section"
      aria-labelledby="treatments-heading"
    >
      <div className="mx-auto flex w-full max-w-landing flex-col gap-stack">
        <div className="grid w-full grid-cols-1 items-end gap-stack lg:grid-cols-[5fr_7fr] lg:gap-grid">
          <header data-section-heading className="flex flex-col items-start gap-6">
            <p className="font-body text-xs font-semibold uppercase tracking-widest text-gold-deep">
              01 / הטיפולים
            </p>
            <h2
              id="treatments-heading"
              className="measure-heading font-heading text-h2 font-medium text-charcoal"
            >
              הטיפולים <em className="italic">שלנו</em>
            </h2>
            <span aria-hidden="true" className="rule-gilded" />
            <p className="measure-prose text-body text-taupe">
              בחרו תחום כדי לגלות את הטיפולים והמכשירים המתקדמים שלנו. לחצו על טיפול לפרטים
              נוספים — ולקביעת תור או התאמה אישית, נשמח שתפנו אלינו.
            </p>
          </header>

          <div
            data-landing-image="treatments"
            className="frame-zoom frame-hairline-light relative aspect-landscape w-full overflow-hidden rounded-frame bg-sand"
          >
            <div data-landing-parallax className="absolute inset-0">
              <Image
                src={SECTION_IMAGES.treatments.src}
                alt={SECTION_IMAGES.treatments.alt}
                fill
                sizes="(min-width: 1280px) 640px, (min-width: 1024px) 55vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>

        {/* כפתורי קטגוריות (סינון) */}
        <div
          data-treatment-categories
          role="group"
          aria-label="קטגוריות טיפולים"
          className="flex flex-wrap gap-3"
        >
          {TREATMENT_MENU.map((category) => {
            const isActive = category.id === activeCategoryId;
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  setActiveCategoryId(category.id);
                  setOpenItem(null);
                }}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-body font-semibold transition-colors duration-(--duration-quick) ease-luxe focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-dark ${
                  isActive
                    ? "border-gold-dark bg-gold text-ink"
                    : "border-hairline-light bg-transparent text-charcoal hover:border-gold-dark hover:text-gold-deep"
                }`}
              >
                <span>{category.title}</span>
                <span
                  aria-hidden="true"
                  className={`text-caption font-bold tabular-nums ${
                    isActive ? "text-ink/70" : "text-gold-deep"
                  }`}
                >
                  {category.items.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* כרטיסי הטיפולים של הקטגוריה הפעילה */}
        <ul
          data-treatment-cards
          className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {activeCategory.items.map((item) => {
            const isOpen = openItem === item.name;
            const itemPanelId = `${panelId}-${activeCategory.id}-${item.name}`;
            return (
              <li key={item.name} data-treatment-card className="min-w-0">
                <div className="flex h-full flex-col rounded-frame border border-hairline-light bg-porcelain/60 transition-colors duration-(--duration-quick) ease-luxe hover:border-gold-dark">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={itemPanelId}
                    onClick={() => setOpenItem(isOpen ? null : item.name)}
                    className="flex min-h-11 w-full items-start justify-between gap-4 p-5 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-dark"
                  >
                    <span className="flex min-w-0 flex-col gap-1.5">
                      {item.device && (
                        <span className="font-body text-caption font-semibold uppercase tracking-wide text-gold-deep">
                          <bdi>{item.device}</bdi>
                        </span>
                      )}
                      <span className="min-w-0 font-heading text-lead font-bold text-charcoal">
                        {item.name}
                      </span>
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className={`mt-1 size-5 shrink-0 text-gold-deep transition-transform duration-(--duration-quick) ease-luxe ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p
                      id={itemPanelId}
                      className="measure-prose border-t border-hairline-light px-5 pb-5 pt-4 text-body text-taupe"
                    >
                      {item.description}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export default TreatmentMenuSection;
