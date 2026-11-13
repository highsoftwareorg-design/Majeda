import type { ReactNode } from "react";
import { signOut } from "@/lib/auth/auth";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { AdminNav } from "@/components/layout/AdminNav";
import { AdminGlobalSearch } from "@/components/layout/AdminGlobalSearch";
import { ToastProvider } from "@/components/common/Toast";

interface AdminShellProps {
  children: ReactNode;
  /** מספר משימות מעקב פתוחות (AdminTask OPEN) לבאדג' בניווט — נשלף בשרת ב-layout (משימה 11.9) */
  openTasksCount?: number;
}

/**
 * מעטפת ממשק הניהול (משימות 11.1, 11.3): Header אחיד עם הלוגו, הניווט הראשי,
 * כפתור "התנתקות" יחיד ושורת חיפוש גלובלית (FR-CL-03), מעל תוכן העמוד.
 * מסך אדמין יחיד — כל פריטי הניווט מוצגים תמיד.
 * רקע שמפניה, RTL, ורוחב תוכן מוגבל לדסקטופ.
 *
 * שורת החיפוש יושבת בשורה נפרדת מתחת לשורה העליונה (ברוחב מלא בנייד, מרוכזת
 * בדסקטופ) כדי שלא תצמצם את הניווט הראשי.
 *
 * מוחל על כל עמודי הניהול דרך `app/(admin)/layout.tsx` (משימה 11.2).
 */
export function AdminShell({ children, openTasksCount = 0 }: AdminShellProps) {
  return (
    <div dir="rtl" className="min-h-screen bg-champagne text-charcoal">
      {/* ToastProvider ברמת ה-Shell — ההודעות שורדות ניווט בין מסכי הניהול */}
      <ToastProvider>
      <header className="sticky top-0 z-40 border-b border-hairline-light bg-champagne/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-3 py-1 sm:px-6">
          {/* relative — מעגן את פאנל הניווט הנייד מתחת לשורה העליונה */}
          <div className="relative flex items-center gap-2 sm:gap-4">
            <Logo size={120} className="shrink-0" />

            <AdminNav openTasksCount={openTasksCount} />

            <form
              className="shrink-0"
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button type="submit" variant="outline" size="lg" className="min-h-11">
                התנתקות
              </Button>
            </form>
          </div>

          <AdminGlobalSearch className="mx-auto pb-1 md:max-w-md" />
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
      </ToastProvider>
    </div>
  );
}

export default AdminShell;
