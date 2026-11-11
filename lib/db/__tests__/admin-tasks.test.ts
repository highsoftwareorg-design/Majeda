/**
 * בדיקות יחידה ל-countOpenAdminTasks() — משימה 11.9 (FR-FU-07).
 *
 * מקור ספירה אחד לבאדג' הניווט (AdminShell) ולכרטיס המשימות בדשבורד (11.10).
 * כל קריאות ל-Prisma ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * בודק:
 * 1. קורא ל-prisma.adminTask.count עם where: { status: "OPEN" } בלבד.
 * 2. מחזיר את הערך המספרי שהוחזר מ-Prisma.
 * 3. מחזיר 0 כשאין משימות פתוחות.
 *
 * הרצה: `npx vitest run lib/db/__tests__/admin-tasks.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockCount } = vi.hoisted(() => ({
  mockCount: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    adminTask: {
      count: mockCount,
    },
  },
}));

import { countOpenAdminTasks } from "@/lib/db/admin-tasks";

beforeEach(() => {
  mockCount.mockReset();
});

describe("countOpenAdminTasks — ספירת משימות פתוחות (11.9)", () => {
  it('קורא ל-adminTask.count עם status="OPEN" בלבד', async () => {
    mockCount.mockResolvedValue(5);
    await countOpenAdminTasks();
    expect(mockCount).toHaveBeenCalledTimes(1);
    expect(mockCount).toHaveBeenCalledWith({ where: { status: "OPEN" } });
  });

  it("מחזיר את הספירה שהוחזרה מ-Prisma", async () => {
    mockCount.mockResolvedValue(7);
    await expect(countOpenAdminTasks()).resolves.toBe(7);
  });

  it("מחזיר 0 כשאין משימות פתוחות", async () => {
    mockCount.mockResolvedValue(0);
    await expect(countOpenAdminTasks()).resolves.toBe(0);
  });
});
