/**
 * בדיקות ל-PATCH /api/clients/:id — שדה status אינו ערוץ כתיבה (משימה 11.6).
 *
 * PATCH מעדכן שדות פרופיל בלבד; שינוי status (ארכוב/שחזור) מתבצע אך ורק דרך
 * DELETE (ארכוב) ו-POST /restore (שחזור). כאן מוודאים ש-body הכולל status
 * אינו גורם ל-prisma.client.update לכתוב status.
 *
 * כל הקריאות ל-Prisma ול-getClientById ממוקות (הוולידציה האמיתית בשימוש —
 * היא מתעלמת משדות לא מוכרים כמו status).
 *
 * הרצה: `npx vitest run app/api/clients/[id]/__tests__/patch-no-status.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockClientUpdate, mockGetClientById } = vi.hoisted(() => ({
  mockClientUpdate: vi.fn(),
  mockGetClientById: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: () => Promise.resolve({ user: { id: "admin", email: "admin@test" } }),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    client: {
      update: mockClientUpdate,
    },
  },
}));

vi.mock("@/lib/db/clients", () => ({
  getClientById: mockGetClientById,
}));

import { PATCH } from "@/app/api/clients/[id]/route";

const EXISTING_CLIENT = {
  id: "client-1",
  firstName: "בדיקה",
  lastName: "פטץ",
  phone: "0501110097",
  status: "active",
  archivedAt: null,
};

function callPatch(body: unknown) {
  const req = new Request("http://localhost/api/clients/client-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return PATCH(req, { params: Promise.resolve({ id: "client-1" }) });
}

describe("PATCH /api/clients/:id — status אינו נכתב (משימה 11.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClientById.mockResolvedValue(EXISTING_CLIENT);
    mockClientUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...EXISTING_CLIENT,
      ...data,
    }));
  });

  it("body עם status בלבד → update נקרא עם data ריק (ללא status/archivedAt)", async () => {
    const res = await callPatch({ status: "archived" });

    expect(res.status).toBe(200);
    expect(mockClientUpdate).toHaveBeenCalledTimes(1);
    const data = mockClientUpdate.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("status");
    expect(data).not.toHaveProperty("archivedAt");
    expect(Object.keys(data)).toHaveLength(0);
  });

  it("body עם status לצד שדה חוקי (city) → רק city נכתב, status מושמט", async () => {
    const res = await callPatch({ city: "חיפה", status: "archived" });

    expect(res.status).toBe(200);
    const data = mockClientUpdate.mock.calls[0][0].data;
    expect(data.city).toBe("חיפה");
    expect(data).not.toHaveProperty("status");
    expect(data).not.toHaveProperty("archivedAt");
  });

  it("status='active' ב-body גם הוא מושמט (אין שחזור דרך PATCH)", async () => {
    await callPatch({ status: "active", firstName: "חדש" });
    const data = mockClientUpdate.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("status");
    expect(data.firstName).toBe("חדש");
  });
});
