/**
 * בדיקות ל-POST /api/treatments — יצירת טיפול בקטלוג (משימה 11.7, FR-AP-02).
 *
 * prisma.treatment.create ממוק; `@prisma/client` אמיתי כדי ש-P2002 יהיה
 * מופע אמיתי של PrismaClientKnownRequestError (כפי שהראוטר בודק עם instanceof).
 *
 * בודק:
 * 1. 201 על payload תקין + prisma.create נקרא עם הערכים המנורמלים.
 * 2. 400 על payload לא תקין (שם חסר) — ללא קריאה ל-create.
 * 3. 409 על שם כפול (P2002) עם errors.name.
 * 4. 400 על JSON פגום.
 *
 * הרצה: `npx vitest run app/api/treatments/__tests__/post-route.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const { mockTreatmentCreate } = vi.hoisted(() => ({
  mockTreatmentCreate: vi.fn(),
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
    treatment: {
      create: mockTreatmentCreate,
    },
  },
}));

import { POST } from "@/app/api/treatments/route";

const CREATED = { id: "t-new", name: "בוטוקס" };

const VALID_BODY = {
  name: "בוטוקס",
  description: "החלקת קמטים",
  durationMinutes: 30,
  price: 500,
  recommendedReturn: "4 חודשים",
  recommendedReturnDays: 120,
  color: "#aabbcc",
  requiresConsentForm: true,
  authorizedTherapists: "שרה, נועה",
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/treatments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** בקשה עם גוף שאינו JSON תקין. */
function makeBadJsonRequest(): Request {
  return new Request("http://localhost/api/treatments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{ not json",
  });
}

describe("POST /api/treatments — משימה 11.7", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTreatmentCreate.mockResolvedValue(CREATED);
  });

  it("201 על payload תקין ומחזיר { treatment }", async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.treatment).toEqual(CREATED);
  });

  it("קורא ל-prisma.treatment.create עם ערכים מנורמלים", async () => {
    await POST(makeRequest({ ...VALID_BODY, name: "  בוטוקס  ", color: "#aabbcc" }));
    expect(mockTreatmentCreate).toHaveBeenCalledOnce();
    const arg = mockTreatmentCreate.mock.calls[0][0];
    expect(arg.data.name).toBe("בוטוקס");
    expect(arg.data.color).toBe("#AABBCC");
    expect(arg.data.durationMinutes).toBe(30);
    expect(arg.data.price).toBe(500);
    expect(arg.data.requiresConsentForm).toBe(true);
    expect(arg.data.authorizedTherapists).toBe("שרה,נועה");
  });

  it("400 על payload לא תקין (שם חסר) ללא קריאה ל-create", async () => {
    const res = await POST(makeRequest({ durationMinutes: 30, price: 100 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toBeTruthy();
    expect(body.errors.name).toBeTruthy();
    expect(mockTreatmentCreate).not.toHaveBeenCalled();
  });

  it("400 על משך מחוץ לטווח", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, durationMinutes: 0 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors.durationMinutes).toBeTruthy();
  });

  it("409 על שם כפול (P2002) עם errors.name", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique failed", {
      code: "P2002",
      clientVersion: "6.19.3",
    });
    mockTreatmentCreate.mockRejectedValue(p2002);

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.errors.name).toBeTruthy();
  });

  it("400 על JSON פגום (ללא קריאה ל-create)", async () => {
    const res = await POST(makeBadJsonRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
    expect(mockTreatmentCreate).not.toHaveBeenCalled();
  });

  it("שגיאת DB אחרת → 500", async () => {
    mockTreatmentCreate.mockRejectedValue(new Error("boom"));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);
  });
});
