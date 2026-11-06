/**
 * משימה 2.19 — מקור נתונים יחיד לתמונות הסטוק של דף הנחיתה.
 *
 * PLACEHOLDER — כל התמונות כאן הן תמונות סטוק (Unsplash License) לאווירה בלבד,
 * ויש להחליף אותן בתמונות אמיתיות מהקליניקה לפני פרודקשן. מקור, צלם ורישיון של כל קובץ
 * מתועדים ב-`public/images/stock/CREDITS.md`.
 *
 * מגבלת יושרה (חובה): אסור להשתמש בתמונות אלה כתוצאת "לפני/אחרי" או כייצוג של צוות
 * הקליניקה. הן משמשות רק לאווירה: Hero, טיפולים, אודות ומפרידים/טקסטורות.
 *
 * רכיבים צורכים את התמונות דרך `STOCK_IMAGES` / `getStockImage()` בלבד, ואינם מחזיקים
 * נתיבים או טקסט alt קשיחים. `width`/`height` הם הממדים האמיתיים של הקובץ (מונע CLS ב-next/image).
 */

/** היעד המתוכנן לכל תמונה בדף (החיווט בפועל — משימות 2.20/2.21). */
export type StockImageRole = "hero" | "treatments" | "about" | "divider";

export interface StockImage {
  /** נתיב מקומי תחת `public/` — לעולם לא דומיין חיצוני. */
  src: `/images/stock/${string}.webp`;
  width: number;
  height: number;
  /** תיאור עברי אמיתי של מה שרואים בתמונה. */
  alt: string;
  /** תמונת סטוק זמנית — להחלפה בתמונות הקליניקה לפני פרודקשן. */
  placeholder: true;
  role: StockImageRole;
}

export const STOCK_IMAGES = {
  heroSteamRoom: {
    src: "/images/stock/hero-steam-room-warm-light.webp",
    width: 2400,
    height: 1601,
    alt: "חדר אדים מעוצב באבן כהה, עם ספסלים מוארים באור חם וקיר בדוגמה גאומטרית בגוני ברונזה בקצהו",
    placeholder: true,
    role: "hero",
  },
  treatmentHandsMassage: {
    src: "/images/stock/treatment-hands-arm-massage.webp",
    width: 1600,
    height: 2400,
    alt: "ידיים של מטפלת מעסות בעדינות את זרועה של מטופלת, באור רך ובגוונים חמים",
    placeholder: true,
    role: "treatments",
  },
  treatmentOilDrop: {
    src: "/images/stock/treatment-oil-dropper-candle.webp",
    width: 1600,
    height: 1067,
    alt: "יד מחזיקה טפטפת שמן טיפוח מעל זרוע, ליד בקבוקוני שמן מזכוכית ענבר, נר דולק ופרחים על שולחן עץ",
    placeholder: true,
    role: "treatments",
  },
  aboutTreatmentRoom: {
    src: "/images/stock/about-treatment-room-wood.webp",
    width: 1600,
    height: 2400,
    alt: "חדר טיפולים שקט עם מיטת טיפול מכוסה במצעים בגוון טאופ-סגלגל, כיור מעוטר וחיפוי עץ חם",
    placeholder: true,
    role: "about",
  },
  productSerumDropper: {
    src: "/images/stock/product-serum-gold-dropper.webp",
    width: 1600,
    height: 1067,
    alt: "בקבוקון סרום מזכוכית חלבית עם פקק טפטפת ותווית בגוון זהב, על משטח בהיר",
    placeholder: true,
    role: "divider",
  },
  textureCreamSmear: {
    src: "/images/stock/texture-cream-smear-champagne.webp",
    width: 1600,
    height: 1702,
    alt: "מריחה של קרם לבן על רקע בגוון שמפניה",
    placeholder: true,
    role: "divider",
  },
  textureFabricFolds: {
    src: "/images/stock/texture-fabric-folds-ivory.webp",
    width: 1600,
    height: 2400,
    alt: "קפלים רכים של בד בגוון שנהב, באור רך",
    placeholder: true,
    role: "divider",
  },
} as const satisfies Record<string, StockImage>;

export type StockImageKey = keyof typeof STOCK_IMAGES;

export function getStockImage(key: StockImageKey): StockImage {
  return STOCK_IMAGES[key];
}

/** כל התמונות שמיועדות לתפקיד מסוים, לפי סדר ההגדרה. */
export function getStockImagesByRole(role: StockImageRole): StockImage[] {
  return Object.values(STOCK_IMAGES).filter((image) => image.role === role);
}
