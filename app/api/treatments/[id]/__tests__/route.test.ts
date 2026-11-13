/**
 * בדיקות ל-PATCH /api/treatments/:id — עדכון חלקי של טיפול (משימה 11.7, FR-AP-02).
 *
 * prisma.treatment.{findUnique,update} ממוקים; `@prisma/client` אמיתי ל-P2002.
 *
 * בודק:
 * 1. עדכון חלקי מצליח — update מקבל רק את השדות שהוגשו; מחזיר { treatment }.
 * 2. 404 כאשר הטיפול אינו קיים — ללא קריאה ל-update.
 * 3. 400 על payload לא תקין (שדה שהוגש פסול).
 * 4. 409 על שם כפול (P2002).
 * 5. 400 על JSON פגום.
 *
 * הרצה: `npx vitest run "app/api/treatments/[id]/__tests__/route.test.ts"`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const { mockFindUnique, mockUpdate } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

// session מאומת קבוע — PATCH דורש התחברות (§11); ה-middleware לא מכסה /api.
vi.mock("@/lib/auth/auth", () => ({
  auth: () => Promise.resolve({ user: { id: "admin", email: "admin@test" } }),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    treatment: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));

import { PATCH } from "@/app/api/treatments/[id]/route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/treatments/t1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeBadJsonRequest(): Request {
  return new Request("http://localhost/api/treatments/t1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: "{ broken",
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/treatments/:id — משימה 11.7", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue({ id: "t1" });
    mockUpdate.mockResolvedValue({ id: "t1", name: "בוטוקס", price: 750 });
  });

  it("עדכון חלקי: update מקבל רק את השדות שהוגשו", async () => {
    const res = await PATCH(makeRequest({ price: 750 }), makeParams("t1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.treatment).toBeTruthy();

    expect(mockUpdate).toHaveBeenCalledOnce();
    const arg = mockUpdate.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "t1" });
    expect(arg.data).toEqual({ price: 750 });
    // לא נשלחים שדות שלא הוגשו
    expect(arg.data.name).toBeUndefined();
    expect(arg.data.durationMinutes).toBeUndefined();
  });

  it("404 כאשר הטיפול אינו קיים — ללא update", async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ price: 750 }), makeParams("missing"));
    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("400 על שדה שהוגש פסול (שם ריק)", async () => {
    const res = await PATCH(makeRequest({ name: "   " }), makeParams("t1"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors.name).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("409 על שם כפול (P2002)", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique failed", {
      code: "P2002",
      clientVersion: "6.19.3",
    });
    mockUpdate.mockRejectedValue(p2002);

    const res = await PATCH(makeRequest({ name: "בוטוקס" }), makeParams("t1"));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.errors.name).toBeTruthy();
  });

  it("400 על JSON פגום — ללא findUnique/update", async () => {
    const res = await PATCH(makeBadJsonRequest(), makeParams("t1"));
    expect(res.status).toBe(400);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
