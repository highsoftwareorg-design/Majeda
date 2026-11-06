/**
 * כפתור WhatsApp צף — עיצוב בלבד (משימה 2.2).
 * TODO: אינטגרציה פונקציונלית אמיתית ל-WhatsApp Business Platform
 * (Cloud API / BSP, SRS §12.2) אינה בתחום המשימה הנוכחית ותתווסף בתכנון נפרד.
 * כרגע הכפתור אינו מוביל לשום צ'אט אמיתי (href="#").
 *
 * 2.17: האייקון ב-text-ink (ink על whatsapp 9.92:1) במקום לבן (1.98:1 — מתחת ל-3:1 של
 * WCAG 1.4.11 לגרפיקה). הכפתור אינו מונפש ע"י GSAP (LandingMotion לא בוחר אותו).
 * מיקום: `end-5` (logical, hebrew-ui) במקום `left-5` — בדף RTL זה אותו מקום בדיוק (שמאל-למטה).
 *
 * 2.21 (ממצא tester): הכפתור צף גם מעל הרצועות הבהירות, ושם outline ב-gold נכשל (1.79–2.13:1).
 * פוקוס = "סנדוויץ'" ink | gold | ink — אותו מראה כמו הילת כפתור הנגישות (2.18 fix 2):
 *   0–2px  ring-offset ב-ink אטום (מפריד את ה-gold מהירוק של הכפתור),
 *   2–4px  ring ב-gold אטום (הסימן עצמו; gold מול ink 9.00:1 משני צידיו),
 *   4–6px  outline ב-ink אטום — השכבה היחידה שנוגעת ברקע הדף (ink מול sand 16.15 / champagne 18.24 / porcelain 19.21).
 * על הרצועות הכהות ה-ink החיצוני נבלע, וה-gold נוגע ברקע: 9.00 (ink) / 8.50 (ink-raised) / 7.94 (charcoal).
 * ring = box-shadow שמורכב עם shadow-lg (רק `--tw-shadow-color` מושפע מ-shadow-black/30); אין `outline-none`,
 * ו-`outline-solid` מפורש.
 */
export function WhatsAppFloatingButton() {
  return (
    <a
      href="#"
      aria-label="צור קשר בוואטסאפ (בקרוב)"
      title="צור קשר בוואטסאפ (בקרוב)"
      className="fixed bottom-5 end-5 z-50 flex size-14 items-center justify-center rounded-full bg-whatsapp text-ink shadow-lg shadow-black/30 transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-ink focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className="size-7"
      >
        <path d="M12.04 2c-5.52 0-10 4.48-10 10 0 1.77.46 3.45 1.26 4.9L2 22l5.25-1.38a9.96 9.96 0 0 0 4.79 1.22h.01c5.52 0 10-4.48 10-10s-4.49-9.84-10.01-9.84Zm0 18.07h-.01a8.3 8.3 0 0 1-4.24-1.16l-.3-.18-3.12.82.83-3.04-.2-.31a8.26 8.26 0 0 1-1.27-4.4c0-4.57 3.72-8.29 8.3-8.29 2.22 0 4.3.87 5.87 2.43a8.23 8.23 0 0 1 2.43 5.87c0 4.58-3.72 8.26-8.29 8.26Zm4.54-6.2c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.71-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.87.85-.87 2.08s.89 2.41 1.01 2.58c.12.17 1.76 2.68 4.25 3.76.6.26 1.06.41 1.42.53.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.1-.23-.16-.48-.28Z" />
      </svg>
    </a>
  );
}

export default WhatsAppFloatingButton;
