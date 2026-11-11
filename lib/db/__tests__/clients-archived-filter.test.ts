/**
 * בדיקות יחידה לפילטר הארכיון ב-listClients() — משימה 11.6 (FR-CL-01).
 *
 * כל קריאות ל-Prisma ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * בודק:
 * 1. ברירת מחדל (ללא אפשרויות) — where עם status="active" בלבד.
 * 2. archivedOnly:true — where עם status="archived" בלבד.
 * 3. includeArchived:true — ללא פילטר status כלל (where === undefined).
 * 4. archivedOnly גובר על includeArchived — status="archived".
 * 5. שילוב archivedOnly עם פילטר נוסף (search) — status="archived" נשמר ב-AND.
 *
 * הרצה: `npx vitest run lib/db/__tests__/clients-archived-filter.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    client: {
      findMany: mockFindMany,
    },
  },
}));

vi.mock("@/lib/validations/hebrew-search", () => ({
  normalizeHebrewSearchTerm: (s: string) => s,
}));

import { listClients } from "@/lib/db/clients";

function getWhereClause() {
  return mockFindMany.mock.calls[0][0].where;
}

describe("listClients — פילטר ארכיון (משימה 11.6, FR-CL-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
  });

  it("ברירת מחדל (ללא אפשרויות) — מחזיר רק פעילים (status='active')", async () => {
    await listClients();
    expect(getWhereClause()).toEqual({ status: "active" });
  });

  it("archivedOnly:true — מחזיר רק מאורכבים (status='archived')", async () => {
    await listClients({ archivedOnly: true });
    expect(getWhereClause()).toEqual({ status: "archived" });
  });

  it("includeArchived:true — ללא פילטר status (where === undefined)", async () => {
    await listClients({ includeArchived: true });
    expect(getWhereClause()).toBeUndefined();
  });

  it("archivedOnly גובר על includeArchived — status='archived'", async () => {
    await listClients({ archivedOnly: true, includeArchived: true });
    expect(getWhereClause()).toEqual({ status: "archived" });
  });

  it("archivedOnly:false מפורש — נופל חזרה לברירת המחדל (פעילים בלבד)", async () => {
    await listClients({ archivedOnly: false });
    expect(getWhereClause()).toEqual({ status: "active" });
  });

  it("archivedOnly עם search — status='archived' נשמר כחלק מ-AND", async () => {
    await listClients({ archivedOnly: true, search: "דנה" });
    const where = getWhereClause();
    expect(where.AND).toBeDefined();
    expect(where.AND).toContainEqual({ status: "archived" });
    // ולא מופיע status="active" בשום מקום
    expect(where.AND).not.toContainEqual({ status: "active" });
  });

  it("orderBy תמיד createdAt:'desc' גם בתצוגת ארכיון", async () => {
    await listClients({ archivedOnly: true });
    expect(mockFindMany.mock.calls[0][0].orderBy).toEqual({ createdAt: "desc" });
  });
});
