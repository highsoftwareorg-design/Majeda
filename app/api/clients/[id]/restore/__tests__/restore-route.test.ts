/**
 * בדיקות ל-POST /api/clients/:id/restore — משימה 11.6 (FR-CL-01).
 *
 * כל הקריאות ל-Prisma ול-getClientById ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * בודק:
 * 1. לקוח/ה בארכיון → שחזור מגדיר status="active" ו-archivedAt=null, מחזיר 200.
 * 2. מזהה לא קיים → 404 (ולא קורא ל-update).
 * 3. לקוח/ה שכבר פעיל/ה → 200 idempotent, בלי כתיבה כפולה (update לא נקרא).
 * 4. פרטיות (§11) — אין הדפסת PII ללוג במהלך הפעולה.
 *
 * הרצה: `npx vitest run app/api/clients/[id]/restore/__tests__/restore-route.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// --- Mocks (חייבים לפני ה-imports של המודולים הממוקים) ---

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

// --- Import handler after mocks ---
import { POST } from "@/app/api/clients/[id]/restore/route";

// --- עזרים ---

function makeRequest(id: string): Request {
  return new Request(`http://localhost/api/clients/${id}/restore`, {
    method: "POST",
  });
}

function callPost(id: string) {
  return POST(makeRequest(id), { params: Promise.resolve({ id }) });
}

const ARCHIVED_CLIENT = {
  id: "client-arch",
  firstName: "בדיקה",
  lastName: "ארכיון",
  phone: "0501110099",
  status: "archived",
  archivedAt: new Date("2025-01-01T00:00:00.000Z"),
};

const ACTIVE_CLIENT = {
  id: "client-active",
  firstName: "בדיקה",
  lastName: "פעיל",
  phone: "0501110098",
  status: "active",
  archivedAt: null,
};

// --- בדיקות ---

describe("POST /api/clients/:id/restore — משימה 11.6", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("לקוח/ה בארכיון → מחזיר/ה לפעיל: status='active', archivedAt=null, 200", async () => {
    mockGetClientById.mockResolvedValue(ARCHIVED_CLIENT);
    mockClientUpdate.mockResolvedValue({
      ...ARCHIVED_CLIENT,
      status: "active",
      archivedAt: null,
    });

    const res = await callPost("client-arch");

    expect(res.status).toBe(200);
    expect(mockClientUpdate).toHaveBeenCalledTimes(1);
    expect(mockClientUpdate).toHaveBeenCalledWith({
      where: { id: "client-arch" },
      data: { status: "active", archivedAt: null },
    });

    const body = await res.json();
    expect(body.client.status).toBe("active");
    expect(body.client.archivedAt).toBeNull();
  });

  it("מזהה לא קיים → 404, ואינו מבצע update", async () => {
    mockGetClientById.mockResolvedValue(null);

    const res = await callPost("no-such-id");

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeTruthy();
    expect(mockClientUpdate).not.toHaveBeenCalled();
  });

  it("לקוח/ה שכבר פעיל/ה → 200 idempotent בלי כתיבה (update לא נקרא)", async () => {
    mockGetClientById.mockResolvedValue(ACTIVE_CLIENT);

    const res = await callPost("client-active");

    expect(res.status).toBe(200);
    expect(mockClientUpdate).not.toHaveBeenCalled();

    const body = await res.json();
    expect(body.client.id).toBe("client-active");
    expect(body.client.status).toBe("active");
  });

  it("שחזור חוזר על לקוח/ה שכבר שוחזר/ה — עדיין 200 ואין update שני", async () => {
    // קריאה ראשונה: מארכיון לפעיל
    mockGetClientById.mockResolvedValueOnce(ARCHIVED_CLIENT);
    mockClientUpdate.mockResolvedValueOnce({
      ...ARCHIVED_CLIENT,
      status: "active",
      archivedAt: null,
    });
    const first = await callPost("client-arch");
    expect(first.status).toBe(200);
    expect(mockClientUpdate).toHaveBeenCalledTimes(1);

    // קריאה שנייה: כעת הלקוח/ה כבר פעיל/ה → אין update נוסף
    mockGetClientById.mockResolvedValueOnce({
      ...ARCHIVED_CLIENT,
      status: "active",
      archivedAt: null,
    });
    const second = await callPost("client-arch");
    expect(second.status).toBe(200);
    expect(mockClientUpdate).toHaveBeenCalledTimes(1); // לא גדל
  });

  it("פרטיות (§11) — אין הדפסת console עם פרטי לקוח במהלך הפעולה", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockGetClientById.mockResolvedValue(ARCHIVED_CLIENT);
    mockClientUpdate.mockResolvedValue({
      ...ARCHIVED_CLIENT,
      status: "active",
      archivedAt: null,
    });

    await callPost("client-arch");

    expect(logSpy).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
    errSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
