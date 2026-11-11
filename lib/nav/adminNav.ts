import {
  CalendarDays,
  FileSignature,
  ListChecks,
  Megaphone,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * פריט בתפריט הניווט הראשי של ממשק הניהול (משימה 11.1).
 * `href` הוא הנתיב המלא; הפריט נחשב פעיל כאשר הנתיב הנוכחי זהה לו או נמצא תחתיו.
 */
export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * מקור יחיד לפריטי הניווט של ממשק הניהול. מסך אדמין יחיד (ללא RBAC) —
 * כל הפריטים מוצגים תמיד, ללא הסתרה לפי תפקיד.
 */
export const adminNavItems: readonly AdminNavItem[] = [
  { label: "לקוחות", href: "/clients", icon: Users },
  { label: "יומן", href: "/calendar", icon: CalendarDays },
  { label: "משימות", href: "/tasks", icon: ListChecks },
  { label: "קמפיינים", href: "/campaigns", icon: Megaphone },
  { label: "טפסי הסכמה", href: "/consent-templates", icon: FileSignature },
  { label: "קטלוג טיפולים", href: "/treatments", icon: Sparkles },
  { label: "הגדרות", href: "/settings", icon: Settings },
];

/** בודק האם פריט הניווט פעיל עבור הנתיב הנוכחי (התאמה מדויקת או תת-נתיב). */
export function isAdminNavItemActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
