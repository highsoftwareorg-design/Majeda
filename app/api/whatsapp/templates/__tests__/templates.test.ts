/**
 * בדיקות ל-API ניהול תבניות WhatsApp — משימה 6.8 (FR-WA-05).
 *
 * כל הקריאות ל-Prisma ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * בודק:
 * 1. POST — יצירת תבנית: mock יוצר רשומה, verify create נקרא עם נתונים נכונים.
 * 2. PATCH — עדכון תבנית בודדת: mock findUnique + update, verify update נקרא.
 * 3. DELETE — מחיקה רכה: verify update נקרא עם {isActive: false} ולא delete.
 *
 * הרצה: `npx vitest run app/api/whatsapp/templates/__tests__/`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני כל import
// ---------------------------------------------------------------------------

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
    whatsAppTemplate: {
      create: mockCreate,
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}));

// ---------------------------------------------------------------------------
// Import handlers after mocks
// ---------------------------------------------------------------------------

import { POST, GET as GETList } from "@/app/api/whatsapp/templates/route";
import {
  GET as GETSingle,
  PATCH,
  DELETE,
} from "@/app/api/whatsapp/templates/[id]/route";

// ---------------------------------------------------------------------------
// נתוני עזר
// ---------------------------------------------------------------------------

/** params מדומה (Promise) */
function makeParams(id = "template-1") {
  return { params: Promise.resolve({ id }) };
}

/** רשומת תבנית מדומה כפי שמגיעה מ-Prisma */
const MOCK_TEMPLATE = {
  id: "template-1",
  name: "appointment_confirmation",
  category: "UTILITY",
  body: "שלום {name}",
  variables: ["name"],
  approvedByMeta: false,
  language: "he",
  isActive: true,
  createdAt: new Date("2026-11-07T10:00:00.000Z"),
  updatedAt: new Date("2026-11-07T10:00:00.000Z"),
};

// ---------------------------------------------------------------------------
// בדיקות POST — יצירת תבנית
// ---------------------------------------------------------------------------

describe("POST /api/whatsapp/templates — יצירת תבנית", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mock יצירה מוצלחת → response status 201 ורשומה מוחזרת", async () => {
    mockCreate.mockResolvedValue(MOCK_TEMPLATE);

    const req = new Request("http://localhost/api/whatsapp/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "appointment_confirmation",
        category: "UTILITY",
        body: "שלום {name}",
        variables: ["name"],
        language: "he",
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body).toHaveProperty("template");
    expect(body.template.name).toBe("appointment_confirmation");
  });

  it("prisma.whatsAppTemplate.create נקרא עם הנתונים הנכונים", async () => {
    mockCreate.mockResolvedValue(MOCK_TEMPLATE);

    const req = new Request("http://localhost/api/whatsapp/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "appointment_confirmation",
        category: "UTILITY",
        body: "שלום {name}",
        variables: ["name"],
        language: "he",
      }),
    });

    await POST(req);

    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "appointment_confirmation",
          category: "UTILITY",
          body: "שלום {name}",
          variables: ["name"],
          language: "he",
        }),
      })
    );
  });

  it("שם חסר → status 400", async () => {
    const req = new Request("http://localhost/api/whatsapp/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "שלום {name}" }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("שם לא תקין (עברית) → status 400", async () => {
    const req = new Request("http://localhost/api/whatsapp/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "שם תבנית",
        body: "שלום {name}",
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("כפילות שם (Prisma P2002) → status 409", async () => {
    mockCreate.mockRejectedValue({ code: "P2002" });

    const req = new Request("http://localhost/api/whatsapp/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "appointment_confirmation",
        body: "שלום {name}",
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// בדיקות GET list
// ---------------------------------------------------------------------------

describe("GET /api/whatsapp/templates — רשימת תבניות", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("מחזיר רשימה ו-status 200", async () => {
    mockFindMany.mockResolvedValue([MOCK_TEMPLATE]);

    const response = await GETList();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("templates");
    expect(Array.isArray(body.templates)).toBe(true);
    expect(body.templates).toHaveLength(1);
  });

  it("prisma.findMany נקרא עם orderBy createdAt desc", async () => {
    mockFindMany.mockResolvedValue([]);

    await GETList();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      })
    );
  });
});

// ---------------------------------------------------------------------------
// בדיקות PATCH — עדכון תבנית
// ---------------------------------------------------------------------------

describe("PATCH /api/whatsapp/templates/:id — עדכון תבנית", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("עדכון body → prisma.update נקרא עם הנתון החדש", async () => {
    mockFindUnique.mockResolvedValue(MOCK_TEMPLATE);
    mockUpdate.mockResolvedValue({ ...MOCK_TEMPLATE, body: "הודעה חדשה" });

    const req = new Request(
      "http://localhost/api/whatsapp/templates/template-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "הודעה חדשה" }),
      }
    );

    const response = await PATCH(req, makeParams("template-1"));
    expect(response.status).toBe(200);

    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "template-1" },
        data: expect.objectContaining({ body: "הודעה חדשה" }),
      })
    );
  });

  it("updatedAt מנוהל על-ידי @updatedAt של Prisma — השדה לא נשלח ידנית ב-updateData", async () => {
    mockFindUnique.mockResolvedValue(MOCK_TEMPLATE);
    mockUpdate.mockResolvedValue({ ...MOCK_TEMPLATE, body: "הודעה חדשה" });

    const req = new Request(
      "http://localhost/api/whatsapp/templates/template-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "הודעה חדשה" }),
      }
    );

    await PATCH(req, makeParams("template-1"));

    // updatedAt לא אמור להיות ב-updateData — Prisma מנהל אותו אוטומטית
    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("updatedAt");
  });

  it("תבנית לא קיימת → status 404", async () => {
    mockFindUnique.mockResolvedValue(null);

    const req = new Request(
      "http://localhost/api/whatsapp/templates/nonexistent",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "הודעה" }),
      }
    );

    const response = await PATCH(req, makeParams("nonexistent"));
    expect(response.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// בדיקות DELETE — מחיקה רכה
// ---------------------------------------------------------------------------

describe("DELETE /api/whatsapp/templates/:id — מחיקה רכה", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("מחיקה רכה: prisma.update עם {isActive: false} — ולא prisma.delete", async () => {
    mockFindUnique.mockResolvedValue(MOCK_TEMPLATE);
    mockUpdate.mockResolvedValue({ ...MOCK_TEMPLATE, isActive: false });

    const req = new Request(
      "http://localhost/api/whatsapp/templates/template-1",
      { method: "DELETE" }
    );

    const response = await DELETE(req, makeParams("template-1"));
    expect(response.status).toBe(200);

    // ודא update נקרא עם isActive: false
    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "template-1" },
        data: { isActive: false },
      })
    );

    // ודא שלא נקרא delete
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("תבנית לא קיימת → status 404 ו-update לא נקרא", async () => {
    mockFindUnique.mockResolvedValue(null);

    const req = new Request(
      "http://localhost/api/whatsapp/templates/nonexistent",
      { method: "DELETE" }
    );

    const response = await DELETE(req, makeParams("nonexistent"));
    expect(response.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("response מחזיר {ok: true}", async () => {
    mockFindUnique.mockResolvedValue(MOCK_TEMPLATE);
    mockUpdate.mockResolvedValue({ ...MOCK_TEMPLATE, isActive: false });

    const req = new Request(
      "http://localhost/api/whatsapp/templates/template-1",
      { method: "DELETE" }
    );

    const response = await DELETE(req, makeParams("template-1"));
    const body = await response.json();
    expect(body).toHaveProperty("ok", true);
  });
});

// ---------------------------------------------------------------------------
// בדיקות GET single
// ---------------------------------------------------------------------------

describe("GET /api/whatsapp/templates/:id — תבנית בודדת", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("תבנית קיימת → status 200 ורשומה מוחזרת", async () => {
    mockFindUnique.mockResolvedValue(MOCK_TEMPLATE);

    const req = new Request(
      "http://localhost/api/whatsapp/templates/template-1"
    );
    const response = await GETSingle(req, makeParams("template-1"));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("template");
    expect(body.template.id).toBe("template-1");
  });

  it("תבנית לא קיימת → status 404", async () => {
    mockFindUnique.mockResolvedValue(null);

    const req = new Request(
      "http://localhost/api/whatsapp/templates/nonexistent"
    );
    const response = await GETSingle(req, makeParams("nonexistent"));
    expect(response.status).toBe(404);
  });
});
