"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  adminNavItems,
  isAdminNavItemActive,
  type AdminNavItem,
} from "@/lib/nav/adminNav";
import { cn } from "@/lib/utils";

/** href של פריט המשימות — הפריט שעליו מוצג באדג' מספר המשימות הפתוחות (משימה 11.9). */
const TASKS_HREF = "/tasks";
/** תקרת תצוגה לבאדג' (מעל הערך מוצג "99+"). */
const BADGE_MAX = 99;

/** קישור ניווט בודד — יעד מגע 44px, סימון פעיל דרך aria-current. */
function AdminNavLink({
  item,
  active,
  onNavigate,
  badgeCount,
}: {
  item: AdminNavItem;
  active: boolean;
  onNavigate?: () => void;
  /** מספר לבאדג' (מוצג רק כשהערך גדול מ-0); undefined/0 → ללא באדג' */
  badgeCount?: number;
}) {
  const Icon = item.icon;
  const count = badgeCount ?? 0;
  const showBadge = count > 0;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
        "outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "bg-porcelain text-gold-deep shadow-sm"
          : "text-taupe hover:bg-porcelain/70 hover:text-charcoal"
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span>{item.label}</span>
      {showBadge && (
        <span
          aria-hidden="true"
          className="inline-flex min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-xs font-medium tabular-nums text-ink"
        >
          {count > BADGE_MAX ? `${BADGE_MAX}+` : count}
        </span>
      )}
      {showBadge && <span className="sr-only">({count} משימות פתוחות)</span>}
    </Link>
  );
}

/**
 * ניווט ראשי של ממשק הניהול (משימה 11.1).
 * דסקטופ (md ומעלה): שורת קישורים אופקית בתוך ה-Header.
 * נייד: כפתור המבורגר שפותח פאנל קישורים מתחת ל-Header (נסגר ב-Escape, בבחירת קישור ובמעבר נתיב).
 */
export function AdminNav({ openTasksCount = 0 }: { openTasksCount?: number } = {}) {
  // הפריטים נקראים כאן ולא מועברים כ-prop: אייקוני lucide אינם ניתנים לסריאליזציה
  // מ-Server Component ל-Client Component (משימה 11.2).
  // מספר המשימות הפתוחות כן מועבר כ-prop (מספר פשוט, נשלף בשרת — משימה 11.9).
  const items = adminNavItems;
  const badgeFor = (href: string) => (href === TASKS_HREF ? openTasksCount : undefined);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // סגירת הפאנל במקש Escape והחזרת הפוקוס לכפתור הפותח.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="flex flex-1 items-center justify-end md:justify-center">
      <ul className="hidden items-center gap-1 md:flex">
        {items.map((item) => (
          <li key={item.href}>
            <AdminNavLink
              item={item}
              active={isAdminNavItemActive(item.href, pathname)}
              badgeCount={badgeFor(item.href)}
            />
          </li>
        ))}
      </ul>

      <Button
        ref={toggleRef}
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 md:hidden"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "סגירת תפריט הניווט" : "פתיחת תפריט הניווט"}
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? <X /> : <Menu />}
      </Button>

      {open && (
        <nav
          id={panelId}
          aria-label="ניווט ראשי"
          className="absolute inset-inline-0 top-full border-b border-hairline-light bg-porcelain p-3 shadow-lift md:hidden"
        >
          <ul className="flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.href}>
                <AdminNavLink
                  item={item}
                  active={isAdminNavItemActive(item.href, pathname)}
                  onNavigate={() => setOpen(false)}
                  badgeCount={badgeFor(item.href)}
                />
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}

export default AdminNav;
