import type { ReactNode } from "react";
import { connection } from "next/server";
import { AdminShell } from "@/components/layout/AdminShell";
import { countOpenAdminTasks } from "@/lib/db/admin-tasks";

/**
 * Layout משותף לכל מסכי הניהול (משימה 11.2): route group `(admin)` — לא משנה את
 * ה-URL. ה-Shell (Header + ניווט + התנתקות) נטען פעם אחת ונשאר קבוע בין מעברי עמודים.
 *
 * משימה 11.9: ספירת המשימות הפתוחות נשלפת כאן בשרת ומועברת ל-AdminShell (ומשם ל-AdminNav)
 * כ-prop, כך שהבאדג' בניווט תמיד מעודכן בטעינת עמוד.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  // מאלץ הרצה ב-request time (לא prerender סטטי) — כמו בדשבורד
  await connection();
  const openTasksCount = await countOpenAdminTasks();

  return <AdminShell openTasksCount={openTasksCount}>{children}</AdminShell>;
}
