import { STOCK_IMAGES } from "@/lib/landing/stock-images";

/**
 * משימה 2.21 — שיבוץ תמונות האווירה בסקשנים של דף הנחיתה.
 * כל התמונות מגיעות ממקור הנתונים היחיד של 2.19 (`STOCK_IMAGES`); הרכיבים לא מחזיקים
 * נתיב או alt קשיחים.
 *
 * אילוץ יושרה: אין כאן — ואסור שיהיו — תמונות ל"לפני/אחרי" או לצוות. שני החלקים האלה
 * נשארים placeholders עד שיסופקו תמונות אמיתיות מהקליניקה (ראו PLAN.md, 2.19–2.21).
 */
export const SECTION_IMAGES = {
  /** טיפולים — תמונת אווירה אחת לסקשן כולו (לא תמונה לכל טיפול; לטבלת Treatment אין שדה תמונה). */
  treatments: STOCK_IMAGES.treatmentOilDrop,
  /** אודות — חלל הטיפול, ללא פנים. מוצג בנפרד מקשתות הצוות, במסגרת מלבנית ולא בקשת. */
  about: STOCK_IMAGES.aboutTreatmentRoom,
  /** מפריד הסקשנים היחיד (בין ההמלצות לאודות) — טקסטורה דקורטיבית. */
  divider: STOCK_IMAGES.textureCreamSmear,
} as const;
