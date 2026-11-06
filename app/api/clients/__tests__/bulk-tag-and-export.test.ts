/**
 * בדיקות ל-POST /api/clients/bulk-tag וכן ל-GET /api/clients/export
 * משימה 3.12 (FR-CL-10).
 *
 * כל הקריאות ל-Prisma ול-listClients ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * bulk-tag בודק:
 *  1. בקשה תקינה — מחזירה 200 עם { created: N }.
 *  2. חסר clientIds — 400.
 *  3. clientIds מערך ריק — 400.
 *  4. חסר tagId — 400.
 *  5. tagId מחרוזת ריקה — 400.
 *  6. תגית לא קיימת ב-DB — 404.
 *  7. createMany נקראת עם הנתונים הנכונים כשהבקשה תקינה.
 *
 * export בודק:
 *  1. מחזיר 200 עם Content-Type text/csv.
 *  2. שורת הכותרת מכילה את שבעת הכותרות בעברית הנדרשות.
 *  3. מספר שורות הנתונים תואם למספר הלקוחות שהוחזרו.
 *  4. listClients ריקה — מחזיר CSV עם כותרת בלבד (שורה אחת בנוסף ל-BOM).
 *
 * הרצה: `npx vitest run --reporter=verbose app/api/clients/__tests__/bulk-tag-and-export.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ─── Hoisted mock factories (חייבים לפני ה-imports) ─────────────────────────

const {
  mockTagFindUnique,
  mockClientTagCreateMany,
  mockListClients,
} = vi.hoisted(() => ({
  mockTagFindUnique: vi.fn(),
  mockClientTagCreateMany: vi.fn(),
  mockListClients: vi.fn(),
}));

// ─── Mocks ───────────────────────────────────────────────────────────────────

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
    tag: { findUnique: mockTagFindUnique },
    clientTag: { createMany: mockClientTagCreateMany },
  },
}));

vi.mock("@prisma/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@prisma/client")>();
  return {
    ...actual,
    Prisma: {
      ...(actual.Prisma ?? {}),
      PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
        code: string;
        constructor(message: string, { code }: { code: string }) {
          super(message);
          this.code = code;
        }
      },
    },
  };
});

vi.mock("@/lib/db/clients", () => ({
  listClients: mockListClients,
}));

// ─── Import route handlers after mocks ───────────────────────────────────────

import { POST } from "@/app/api/clients/bulk-tag/route";
import { GET as GET_EXPORT } from "@/app/api/clients/export/route";

// ─── עזרים ───────────────────────────────────────────────────────────────────

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/clients/bulk-tag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetExportRequest(params = ""): Request {
  return new Request(`http://localhost/api/clients/export${params}`);
}

/** מחזיר לקוח מדומה. */
function makeFakeClient(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "client-1",
    firstName: "שרה",
    lastName: "כהן",
    phone: "0501234567",
    email: "sarah@example.com",
    city: "תל אביב",
    source: "landing_page",
    createdAt: new Date("2024-01-15"),
    ...overrides,
  };
}

// ─── POST /api/clients/bulk-tag ───────────────────────────────────────────────

describe("POST /api/clients/bulk-tag — משימה 3.12", () => {
  const FAKE_TAG = { id: "tag-1", name: "VIP" };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTagFindUnique.mockResolvedValue(FAKE_TAG);
    mockClientTagCreateMany.mockResolvedValue({ count: 2 });
  });

  it("בקשה תקינה — מחזיר 200 עם { created: N }", async () => {
    const req = makePostRequest({ clientIds: ["c1", "c2"], tagId: "tag-1" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("created", 2);
  });

  it("חסר clientIds — מחזיר 400", async () => {
    const req = makePostRequest({ tagId: "tag-1" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("clientIds מערך ריק — מחזיר 400", async () => {
    const req = makePostRequest({ clientIds: [], tagId: "tag-1" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("חסר tagId — מחזיר 400", async () => {
    const req = makePostRequest({ clientIds: ["c1"] });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("tagId מחרוזת ריקה (רווחים בלבד) — מחזיר 400", async () => {
    const req = makePostRequest({ clientIds: ["c1"], tagId: "   " });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("תגית לא קיימת ב-DB — מחזיר 404", async () => {
    mockTagFindUnique.mockResolvedValue(null);
    const req = makePostRequest({ clientIds: ["c1"], tagId: "no-such-tag" });
    const res = await POST(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("קורא ל-createMany עם הנתונים הנכונים", async () => {
    const req = makePostRequest({
      clientIds: ["c1", "c2", "c3"],
      tagId: "tag-1",
    });
    await POST(req);
    expect(mockClientTagCreateMany).toHaveBeenCalledOnce();
    const callArg = mockClientTagCreateMany.mock.calls[0][0];
    expect(callArg.data).toEqual([
      { clientId: "c1", tagId: "tag-1" },
      { clientId: "c2", tagId: "tag-1" },
      { clientId: "c3", tagId: "tag-1" },
    ]);
    expect(callArg.skipDuplicates).toBe(true);
  });

  it("body שאינו JSON תקין — מחזיר 400", async () => {
    const req = new Request("http://localhost/api/clients/bulk-tag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{{{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/clients/export ──────────────────────────────────────────────────

describe("GET /api/clients/export — משימה 3.12", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("מחזיר status 200", async () => {
    mockListClients.mockResolvedValue([makeFakeClient()]);
    const res = await GET_EXPORT(makeGetExportRequest());
    expect(res.status).toBe(200);
  });

  it("Content-Type הוא text/csv", async () => {
    mockListClients.mockResolvedValue([makeFakeClient()]);
    const res = await GET_EXPORT(makeGetExportRequest());
    const contentType = res.headers.get("Content-Type");
    expect(contentType).toContain("text/csv");
  });

  it("שורת הכותרת מכילה את שבעת הכותרות בעברית הנדרשות", async () => {
    mockListClients.mockResolvedValue([]);
    const res = await GET_EXPORT(makeGetExportRequest());
    const text = await res.text();
    // הסרת ה-BOM (U+FEFF) מתחילת הקובץ לצורך בדיקה
    const withoutBom = text.replace(/^﻿/, "");
    const headerLine = withoutBom.split(/\r?\n/)[0];
    expect(headerLine).toContain("שם פרטי");
    expect(headerLine).toContain("שם משפחה");
    expect(headerLine).toContain("טלפון");
    expect(headerLine).toContain("אימייל");
    expect(headerLine).toContain("עיר");
    expect(headerLine).toContain("מקור הגעה");
    expect(headerLine).toContain("תאריך הוספה");
  });

  it("מספר שורות הנתונים תואם למספר הלקוחות שהוחזרו", async () => {
    const clients = [
      makeFakeClient({ id: "c1", phone: "0501111111" }),
      makeFakeClient({ id: "c2", phone: "0502222222" }),
      makeFakeClient({ id: "c3", phone: "0503333333" }),
    ];
    mockListClients.mockResolvedValue(clients);
    const res = await GET_EXPORT(makeGetExportRequest());
    const text = await res.text();
    const withoutBom = text.replace(/^﻿/, "");
    // שורות לא ריקות בלבד (תוצאת split יכולה להכיל שורה ריקה אחרי \r\n אחרון)
    const lines = withoutBom.split(/\r?\n/).filter((l) => l.trim() !== "");
    // שורה אחת לכותרת + שורה אחת לכל לקוח
    expect(lines).toHaveLength(1 + clients.length);
  });

  it("listClients ריקה — CSV עם כותרת בלבד (שורה 1)", async () => {
    mockListClients.mockResolvedValue([]);
    const res = await GET_EXPORT(makeGetExportRequest());
    const text = await res.text();
    const withoutBom = text.replace(/^﻿/, "");
    const lines = withoutBom.split(/\r?\n/).filter((l) => l.trim() !== "");
    expect(lines).toHaveLength(1);
  });

  it("ה-CSV מכיל את ה-BOM (EF BB BF) בתחילתו לתמיכה ב-Excel", async () => {
    mockListClients.mockResolvedValue([makeFakeClient()]);
    const res = await GET_EXPORT(makeGetExportRequest());
    // TextDecoder.text() מסיר את ה-BOM; בודקים את הבתים הגולמיים.
    const ab = await res.arrayBuffer();
    const bytes = new Uint8Array(ab);
    expect(bytes[0]).toBe(0xef);
    expect(bytes[1]).toBe(0xbb);
    expect(bytes[2]).toBe(0xbf);
  });
});
