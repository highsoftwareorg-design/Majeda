import { ContactFormSection } from "@/components/landing/ContactFormSection";

/**
 * עטיפת Server Component לטופס השארת פרטים (משימה 2.6).
 *
 * עדכון: אפשרויות "טיפול מבוקש" נטענות כעת מתפריט השירותים הסטטי (TREATMENT_MENU)
 * בתוך ContactFormSection, ולכן אין יותר שליפה מה-DB כאן. העטיפה נשארת כנקודת
 * חיבור יחידה בדף (עטופה ב-Suspense/LandingMotion ב-page.tsx) כדי לא לשנות את מבנה הדף.
 */
export function ContactFormSectionContainer() {
  return <ContactFormSection />;
}

export default ContactFormSectionContainer;
