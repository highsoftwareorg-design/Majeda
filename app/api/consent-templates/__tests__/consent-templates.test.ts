/**
 * בדיקות API לתבניות הסכמה — משימה 7.2 (FR-CF-01).
 *
 * כל קריאות ל-Prisma ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * בודק:
 * 1. POST עם נתונים תקינים → prisma.consentTemplate.create נקרא עם השדות הנכונים → 201.
 * 2. POST ללא name → 400 עם הודעת שגיאה עברית.
 * 3. POST עם body לא-JSON → 400.
 * 4. GET → מחזיר רשימת תבניות.
 * 5. GET → prisma.consentTemplate.findMany נקרא עם where: { isActive: true }.
 * 6. DELETE (soft delete) → prisma.consentTemplate.update נקרא עם { isActive: false }.
 * 7. DELETE → prisma.consentTemplate.delete לא נקרא (מחיקה רכה בלבד).
 * 8. DELETE על תבנית שאינה קיימת → 404.
 *
 * הרצה: `npx vitest run app/api/consent-templates/__tests__/consent-templates.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// --- Mocks (חייבים לפני ה-imports של המודולים הממוקים) ---

const {
  mockCreate,
  mockFindMany,
  mockFindUnique,
  mockUpdate,
  mockDelete,
} = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
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
    consentTemplate: {
      create: mockCreate,
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}));

// --- Import handlers after mocks ---

import { GET as listGET, POST } from "@/app/api/consent-templates/route";
import {
  DELETE,
  GET as singleGET,
} from "@/app/api/consent-templates/[id]/route";

// --- עזרים ---

/** יוצר Request מדומה עם body JSON */
function makeRequest(body: unknown, method = "POST"): Request {
  return new Request("http://localhost/api/consent-templates", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** פרמטרי route מדומים */
function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** תבנית מדומה */
const MOCK_TEMPLATE = {
  id: "template-1",
  name: "טופס הסכמה כללי",
  isGeneral: true,
  treatmentIds: [],
  validityDays: 365,
  language: "he",
  version: 1,
  isActive: true,
  fields: [{ id: "f1", type: "checkbox", label: "קראתי והסכמתי", required: true }],
  createdAt: new Date("2026-11-07T10:00:00Z"),
  updatedAt: new Date("2026-11-07T10:00:00Z"),
};

// --- בדיקות ---

describe("POST /api/consent-templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue(MOCK_TEMPLATE);
  });

  it("נתונים תקינים → prisma.create נקרא עם השדות הנכונים → 201", async () => {
    const req = makeRequest({
      name: "טופס הסכמה כללי",
      isGeneral: true,
      treatmentIds: [],
      validityDays: 365,
      language: "he",
      fields: [{ id: "f1", type: "checkbox", label: "קראתי והסכמתי", required: true }],
    });

    const res = await POST(req);

    expect(res.status).toBe(201);

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.data.name).toBe("טופס הסכמה כללי");
    expect(callArg.data.isGeneral).toBe(true);
    expect(callArg.data.language).toBe("he");
    expect(callArg.data.validityDays).toBe(365);
    expect(callArg.data.version).toBe(1);
    expect(callArg.data.isActive).toBe(true);
  });

  it("name ריק → 400 עם הודעה עברית", async () => {
    const req = makeRequest({ name: "   " });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect((body as Record<string, string>).error).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("name חסר → 400", async () => {
    const req = makeRequest({ isGeneral: true });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("body לא-JSON → 400", async () => {
    const req = new Request("http://localhost/api/consent-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-valid-json",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("language לא חוקית (en) → ברירת מחדל he", async () => {
    const req = makeRequest({ name: "טופס", language: "en" });

    const res = await POST(req);

    expect(res.status).toBe(201);
    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.data.language).toBe("he");
  });

  it("validityDays שלילי → null (ברירת מחדל)", async () => {
    const req = makeRequest({ name: "טופס", validityDays: -5 });

    const res = await POST(req);

    expect(res.status).toBe(201);
    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.data.validityDays).toBeNull();
  });
});

describe("GET /api/consent-templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([MOCK_TEMPLATE]);
  });

  it("מחזיר רשימת תבניות עם status 200", async () => {
    const res = await listGET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.templates).toHaveLength(1);
    expect(body.templates[0].id).toBe("template-1");
  });

  it("prisma.findMany נקרא עם where: { isActive: true }", async () => {
    await listGET();

    expect(mockFindMany).toHaveBeenCalledOnce();
    const callArg = mockFindMany.mock.calls[0][0];
    expect(callArg.where).toEqual({ isActive: true });
  });

  it("רשימה ריקה → מחזיר מערך ריק", async () => {
    mockFindMany.mockResolvedValue([]);

    const res = await listGET();

    const body = await res.json();
    expect(body.templates).toHaveLength(0);
  });
});

describe("DELETE /api/consent-templates/[id] — מחיקה רכה", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue(MOCK_TEMPLATE);
    mockUpdate.mockResolvedValue({ ...MOCK_TEMPLATE, isActive: false });
  });

  it("prisma.update נקרא עם { isActive: false }", async () => {
    const req = new Request("http://localhost/api/consent-templates/template-1", {
      method: "DELETE",
    });

    const res = await DELETE(req, makeParams("template-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect(mockUpdate).toHaveBeenCalledOnce();
    const callArg = mockUpdate.mock.calls[0][0];
    expect(callArg.where).toEqual({ id: "template-1" });
    expect(callArg.data).toEqual({ isActive: false });
  });

  it("prisma.delete לא נקרא — מחיקה רכה בלבד", async () => {
    const req = new Request("http://localhost/api/consent-templates/template-1", {
      method: "DELETE",
    });

    await DELETE(req, makeParams("template-1"));

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("תבנית שאינה קיימת → 404", async () => {
    mockFindUnique.mockResolvedValue(null);

    const req = new Request("http://localhost/api/consent-templates/does-not-exist", {
      method: "DELETE",
    });

    const res = await DELETE(req, makeParams("does-not-exist"));

    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("GET /api/consent-templates/[id] — שליפת תבנית בודדת", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("תבנית קיימת → 200 עם תבנית", async () => {
    mockFindUnique.mockResolvedValue(MOCK_TEMPLATE);

    const req = new Request("http://localhost/api/consent-templates/template-1");
    const res = await singleGET(req, makeParams("template-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.template.id).toBe("template-1");
    expect(body.template.name).toBe("טופס הסכמה כללי");
  });

  it("תבנית שאינה קיימת → 404", async () => {
    mockFindUnique.mockResolvedValue(null);

    const req = new Request("http://localhost/api/consent-templates/missing");
    const res = await singleGET(req, makeParams("missing"));

    expect(res.status).toBe(404);
  });
});

