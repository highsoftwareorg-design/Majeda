import { getTreatments } from "@/lib/db/treatments";
import { ContactFormSection } from "@/components/landing/ContactFormSection";

/**
 * עטיפת Server Component לטופס השארת פרטים (משימה 2.6).
 * שולפת את רשימת הטיפולים מאותו מקור נתונים המשמש גם ב-TreatmentsSection
 * (`getTreatments`, ללא מערך דמה כפול בקוד) ומעבירה אותה לרכיב הטופס
 * (Client Component). השליפה עטופה ב-Suspense ברמת הדף (page.tsx) כדי
 * לאפשר Prerendering של שאר ה-shell הסטטי.
 *
 * משימה 2.15: העטיפה נשארת ללא markup משלה בכוונה — כל העיצוב (רצועת ink,
 * קומפוזיציה, שדות וכפתור) נמצא ב-ContactFormSection, כך שה-fallback של
 * Suspense ב-page.tsx והרכיב בפועל לא מתנגשים ברקע/ריווח. מקור הטיפולים לא השתנה.
 */
export async function ContactFormSectionContainer() {
  const treatments = await getTreatments();

  return <ContactFormSection treatments={treatments} />;
}

export default ContactFormSectionContainer;
