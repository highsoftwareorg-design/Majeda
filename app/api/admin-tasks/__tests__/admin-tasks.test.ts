/**
 * app/api/admin-tasks/__tests__/admin-tasks.test.ts
 * Task 8.6 — בדיקות PATCH /api/admin-tasks/:id (FR-FU-04/06).
 *
 * כל קריאות ל-Prisma ואימות ה-session ממוקות.
 * אין גישה אמיתית ל-DB.
 *
 * בודק:
 * 1. PATCH עם action=booked → FollowUp.status=BOOKED + AdminTask.status=DONE.
 * 2. PATCH עם action=no_answer → FollowUp.scheduledDate += 2 ימים + status=PENDING + AdminTask.status=DONE.
 * 3. PATCH עם action=not_interested → FollowUp.status=CANCELLED + AdminTask.status=DONE.
 * 4. PATCH ללא session → 401.
 * 5. PATCH על משימה לא קיימת → 404.
 * 6. PATCH על משימה שכבר טופלה (status != OPEN) → 409.
 * 7. PATCH עם action לא חוקי → 400.
 *
 * הרצה: `npx vitest run app/api/admin-tasks/__tests__/admin-tasks.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// --- Mocks (vi.hoisted חייב לפני ה-imports) ---

const {
  mockAuth,
  mockAdminTaskFindUnique,
  mockFollowUpFindUnique,
  mockFollowUpUpdate,
  mockAdminTaskUpdate,
  mockTransaction,
} = vi.hoisted(() => {
  const mockFollowUpFindUnique = vi.fn();
  const mockFollowUpUpdate = vi.fn().mockResolvedValue({});
  const mockAdminTaskUpdate = vi.fn().mockResolvedValue({});

  // מדמה $transaction: מקבל callback ומריץ אותו עם אובייקט tx מדומה
  const mockTransaction = vi.fn().mockImplementation(
    async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        followUp: {
          findUnique: mockFollowUpFindUnique,
          update: mockFollowUpUpdate,
        },
        adminTask: {
          update: mockAdminTaskUpdate,
        },
      };
      return cb(tx);
    }
  );

  return {
    mockAuth: vi.fn(),
    mockAdminTaskFindUnique: vi.fn(),
    mockFollowUpFindUnique,
    mockFollowUpUpdate,
    mockAdminTaskUpdate,
    mockTransaction,
  };
});

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    adminTask: {
      findUnique: mockAdminTaskFindUnique,
      update: mockAdminTaskUpdate,
    },
    followUp: {
      findUnique: mockFollowUpFindUnique,
      update: mockFollowUpUpdate,
    },
    $transaction: mockTransaction,
  },
}));

// --- Import אחרי ה-mocks ---
import { PATCH } from "@/app/api/admin-tasks/[id]/route";

// --- עזרים ---

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/admin-tasks/task-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

const BASE_DATE = new Date("2026-11-07T10:00:00Z");
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

const MOCK_TASK_OPEN = {
  id: "task-1",
  status: "OPEN",
  followUpId: "followup-1",
};

const MOCK_FOLLOW_UP = {
  scheduledDate: BASE_DATE,
};

// --- בדיקות ---

describe("PATCH /api/admin-tasks/:id — פעולות על משימת מעקב", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // ברירות מחדל
    mockAuth.mockResolvedValue({ user: { email: "admin@majida.com" } });
    mockAdminTaskFindUnique.mockResolvedValue(MOCK_TASK_OPEN);
    mockFollowUpFindUnique.mockResolvedValue(MOCK_FOLLOW_UP);
    mockFollowUpUpdate.mockResolvedValue({});
    mockAdminTaskUpdate.mockResolvedValue({});
    mockTransaction.mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          followUp: {
            findUnique: mockFollowUpFindUnique,
            update: mockFollowUpUpdate,
          },
          adminTask: {
            update: mockAdminTaskUpdate,
          },
        };
        return cb(tx);
      }
    );
  });

  // ════════════════════════════════════════════════════════
  // 1. action=booked
  // ════════════════════════════════════════════════════════

  describe("action=booked — נקבע תור", () => {
    it("מחזיר status 200 עם success:true", async () => {
      const req = makeRequest({ action: "booked" });
      const res = await PATCH(req, makeParams("task-1"));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it("followUp.update נקרא עם status=BOOKED", async () => {
      const req = makeRequest({ action: "booked" });
      await PATCH(req, makeParams("task-1"));

      expect(mockFollowUpUpdate).toHaveBeenCalledOnce();
      const updateArg = mockFollowUpUpdate.mock.calls[0][0];
      expect(updateArg.data.status).toBe("BOOKED");
      expect(updateArg.data.callResult).toBe("appointment_booked");
    });

    it("adminTask.update נקרא עם status=DONE", async () => {
      const req = makeRequest({ action: "booked" });
      await PATCH(req, makeParams("task-1"));

      expect(mockAdminTaskUpdate).toHaveBeenCalledOnce();
      const updateArg = mockAdminTaskUpdate.mock.calls[0][0];
      expect(updateArg.where.id).toBe("task-1");
      expect(updateArg.data.status).toBe("DONE");
    });
  });

  // ════════════════════════════════════════════════════════
  // 2. action=no_answer
  // ════════════════════════════════════════════════════════

  describe("action=no_answer — לא ענה/תה", () => {
    it("מחזיר status 200 עם success:true", async () => {
      const req = makeRequest({ action: "no_answer" });
      const res = await PATCH(req, makeParams("task-1"));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it("followUp.scheduledDate מוגדל ב-2 ימים ו-status=PENDING", async () => {
      const req = makeRequest({ action: "no_answer" });
      await PATCH(req, makeParams("task-1"));

      expect(mockFollowUpUpdate).toHaveBeenCalledOnce();
      const updateArg = mockFollowUpUpdate.mock.calls[0][0];
      expect(updateArg.data.status).toBe("PENDING");
      expect(updateArg.data.callResult).toBe("no_answer");

      // scheduledDate צריך להיות BASE_DATE + 2 ימים
      const expectedDate = new Date(BASE_DATE.getTime() + TWO_DAYS_MS);
      expect(updateArg.data.scheduledDate.getTime()).toBe(expectedDate.getTime());
    });

    it("adminTask.update נקרא עם status=DONE", async () => {
      const req = makeRequest({ action: "no_answer" });
      await PATCH(req, makeParams("task-1"));

      expect(mockAdminTaskUpdate).toHaveBeenCalledOnce();
      const updateArg = mockAdminTaskUpdate.mock.calls[0][0];
      expect(updateArg.data.status).toBe("DONE");
    });
  });

  // ════════════════════════════════════════════════════════
  // 3. action=not_interested
  // ════════════════════════════════════════════════════════

  describe("action=not_interested — לא מעוניין/ת", () => {
    it("מחזיר status 200 עם success:true", async () => {
      const req = makeRequest({ action: "not_interested" });
      const res = await PATCH(req, makeParams("task-1"));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it("followUp.update נקרא עם status=CANCELLED", async () => {
      const req = makeRequest({ action: "not_interested" });
      await PATCH(req, makeParams("task-1"));

      expect(mockFollowUpUpdate).toHaveBeenCalledOnce();
      const updateArg = mockFollowUpUpdate.mock.calls[0][0];
      expect(updateArg.data.status).toBe("CANCELLED");
      expect(updateArg.data.callResult).toBe("not_interested");
    });

    it("adminTask.update נקרא עם status=DONE", async () => {
      const req = makeRequest({ action: "not_interested" });
      await PATCH(req, makeParams("task-1"));

      expect(mockAdminTaskUpdate).toHaveBeenCalledOnce();
      const updateArg = mockAdminTaskUpdate.mock.calls[0][0];
      expect(updateArg.data.status).toBe("DONE");
    });
  });

  // ════════════════════════════════════════════════════════
  // 4. ללא session → 401
  // ════════════════════════════════════════════════════════

  describe("אימות session", () => {
    it("ללא session → 401", async () => {
      mockAuth.mockResolvedValue(null);

      const req = makeRequest({ action: "booked" });
      const res = await PATCH(req, makeParams("task-1"));

      expect(res.status).toBe(401);
      expect(mockAdminTaskFindUnique).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════
  // 5. משימה לא קיימת → 404
  // ════════════════════════════════════════════════════════

  describe("משימה לא קיימת", () => {
    it("adminTask.findUnique מחזיר null → 404", async () => {
      mockAdminTaskFindUnique.mockResolvedValue(null);

      const req = makeRequest({ action: "booked" });
      const res = await PATCH(req, makeParams("nonexistent"));

      expect(res.status).toBe(404);
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════
  // 6. משימה שכבר טופלה → 409
  // ════════════════════════════════════════════════════════

  describe("משימה שכבר טופלה", () => {
    it("adminTask.status=DONE → 409", async () => {
      mockAdminTaskFindUnique.mockResolvedValue({ ...MOCK_TASK_OPEN, status: "DONE" });

      const req = makeRequest({ action: "booked" });
      const res = await PATCH(req, makeParams("task-1"));

      expect(res.status).toBe(409);
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════
  // 7. פעולה לא חוקית → 400
  // ════════════════════════════════════════════════════════

  describe("ולידציה — action לא חוקי", () => {
    it("action לא מוכר → 400", async () => {
      const req = makeRequest({ action: "unknown_action" });
      const res = await PATCH(req, makeParams("task-1"));

      expect(res.status).toBe(400);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it("חסר שדה action → 400", async () => {
      const req = makeRequest({});
      const res = await PATCH(req, makeParams("task-1"));

      expect(res.status).toBe(400);
    });

    it("JSON לא תקין → 400", async () => {
      const req = new Request("http://localhost/api/admin-tasks/task-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      });
      const res = await PATCH(req, makeParams("task-1"));

      expect(res.status).toBe(400);
    });
  });
});
