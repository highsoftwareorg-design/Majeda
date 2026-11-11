/**
 * שאילתות משותפות ל-AdminTask (משימות מעקב לאדמין).
 *
 * משמש את באדג' "משימות" בניווט (AdminShell, משימה 11.9) ואת כרטיס המשימות
 * הפתוחות בדשבורד (משימה 11.10) — כדי שתהיה מקור ספירה אחד.
 */

import { prisma } from "@/lib/db/prisma";

/** ספירת משימות מעקב פתוחות (status=OPEN) */
export async function countOpenAdminTasks(): Promise<number> {
  return prisma.adminTask.count({ where: { status: "OPEN" } });
}
