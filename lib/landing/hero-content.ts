import { STOCK_IMAGES } from "@/lib/landing/stock-images";

/**
 * משימה 2.20 — טקסטי ה-Hero של דף הנחיתה.
 * ניתן לעריכה ע״י הקליניקה.
 *
 * הכותרת היא טיוטה לאישור המשתמשת (ראו PLAN.md Notes/Risks, 2.20). כללי ניסוח:
 * פנייה ללקוחה, חמה ויוקרתית, ללא טענות שאינן ניתנות לאימות ("הטובים בארץ", "#1")
 * וללא הבטחות רפואיות/תוצאה. שם המותג אינו בכותרת — הוא נגיש דרך ה-alt של הלוגו.
 */
export const HERO_CONTENT = {
  /** ה-h1 היחיד בדף. */
  title: "הרגע השקט שלך מתחיל כאן",
  /** משפט ההבטחה של המותג (נספח א׳). */
  promise: "יופי נצחי, בנגיעה אישית",
  ctaLabel: "לקביעת תור",
  /** עוגן לטופס יצירת הקשר (id="booking" ב-ContactFormSection). */
  ctaHref: "#booking",
} as const;

/** תמונת הרקע של ה-Hero — ממקור הנתונים היחיד של 2.19 (ללא נתיב/alt קשיחים ברכיב). */
export const HERO_IMAGE = STOCK_IMAGES.heroSteamRoom;
