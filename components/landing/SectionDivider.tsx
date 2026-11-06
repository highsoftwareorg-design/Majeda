import Image from "next/image";
import { SECTION_IMAGES } from "@/lib/landing/section-images";

/**
 * משימה 2.21 — מפריד הסקשנים היחיד בדף: רצועת טקסטורה צרה (מריחת קרם על שמפניה)
 * בין ההמלצות (sand) לאודות (porcelain). שתי הרצועות בהירות, והמפריד נותן להן "נשימה"
 * מוחשית בתחום הטיפוח במקום קו שיער נוסף.
 *
 * - דקורטיבי בלבד: alt ריק ו-aria-hidden (WCAG H67) — הטקסטורה לא מוסרת מידע.
 *   התמונה עצמה מגיעה ממקור הנתונים היחיד של 2.19 (SECTION_IMAGES.divider).
 * - יחס קבוע (aspect-[3/1] → lg:aspect-[6/1]) — שומר מקום מראש (ללא CLS), lazy כברירת מחדל.
 * - object-position (50% 55%) מכוון את החיתוך אל המריחה עצמה.
 * - [data-landing-image] הוא מכל overflow:hidden — עוגן ל-parallax/clip של 2.22.
 * - ללא frame-zoom: אין כאן אינטראקציה (hover על רצועה ברוחב מלא היה מסיח).
 */
export function SectionDivider() {
  return (
    <div
      data-landing-divider
      data-band="image"
      data-band-tone="image"
      aria-hidden="true"
      className="w-full bg-sand"
    >
      <div
        data-landing-image="divider"
        className="relative aspect-[3/1] w-full overflow-hidden lg:aspect-[6/1]"
      >
        {/* 2.22: שכבת parallax פנימית; ה-clip של החשיפה מוחל על המכל */}
        <div data-landing-parallax className="absolute inset-0">
          <Image
            src={SECTION_IMAGES.divider.src}
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-[50%_55%]"
          />
        </div>
      </div>
    </div>
  );
}

export default SectionDivider;
