/**
 * בדיקות ל-GET /api/clients/export — משימות 10.1 (FR-CL-10).
 *
 * כל הקריאות ל-Prisma, listClients ו-auth ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * בודק:
 * 1. CSV עם admin session + 3 לקוחות → Content-Type text/csv.
 * 2. CSV גוף התגובה מתחיל ב-BOM UTF-8 (﻿).
 * 3. CSV admin session + 3 לקוחות → 3 שורות נתונים.
 * 4. XLSX עם admin session + 3 לקוחות → Content-Type xlsx.
 * 5. XLSX הבאפר תקין וניתן לטעינה עם exceljs (ללא שגיאה).
 * 6. ללא session → 401.
 * 7. session עם role=therapist → 403.
 * 8. format=invalid → 400.
 *
 * הרצה: `npx vitest run app/api/clients/__tests__/export.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ─── Hoisted mock factories (חייבים לפני ה-imports) ─────────────────────────

const { mockAuth, mockListClients, mockClientTagFindMany, mockVisitGroupBy } =
  vi.hoisted(() => ({
    mockAuth: vi.fn(),
    mockListClients: vi.fn(),
    mockClientTagFindMany: vi.fn(),
    mockVisitGroupBy: vi.fn(),
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

vi.mock("@/lib/auth/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/db/clients", () => ({
  listClients: mockListClients,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    clientTag: { findMany: mockClientTagFindMany },
    visit: { groupBy: mockVisitGroupBy },
  },
}));

// ─── Import route handler after mocks ────────────────────────────────────────

import { GET } from "@/app/api/clients/export/route";
import ExcelJS from "exceljs";

// ─── עזרים ───────────────────────────────────────────────────────────────────

function makeAdminSession() {
  return { user: { id: "user-1", role: "admin", name: "Admin" } };
}

function makeTherapistSession() {
  return { user: { id: "user-2", role: "therapist", name: "Therapist" } };
}

function makeRequest(params = "") {
  return new Request(`http://localhost/api/clients/export${params}`);
}

function makeFakeClient(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    firstName: "שרה",
    lastName: "כהן",
    phone: "0501234567",
    gender: "female" as const,
    birthDate: null,
    city: "תל אביב",
    source: "landing_page",
    marketingConsentChannel: "none" as const,
    status: "active" as const,
    ...overrides,
  };
}

// ─── בדיקות ──────────────────────────────────────────────────────────────────

describe("GET /api/clients/export — משימה 10.1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // ברירות מחדל: ממוקים ריקים לנתונים נלווים
    mockClientTagFindMany.mockResolvedValue([]);
    mockVisitGroupBy.mockResolvedValue([]);
  });

  // ─── פורמט CSV ──────────────────────────────────────────────────────────

  it("CSV: admin session + 3 לקוחות → Content-Type text/csv", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockListClients.mockResolvedValue([
      makeFakeClient("c1"),
      makeFakeClient("c2"),
      makeFakeClient("c3"),
    ]);

    const res = await GET(makeRequest("?format=csv"));
    expect(res.headers.get("Content-Type")).toContain("text/csv");
  });

  it("CSV: גוף התגובה מתחיל ב-BOM UTF-8 (בתים גולמיים EF BB BF)", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockListClients.mockResolvedValue([makeFakeClient("c1")]);

    const res = await GET(makeRequest("?format=csv"));
    // Response.text() מסיר את ה-BOM — בודקים את הבתים הגולמיים דרך arrayBuffer
    const ab = await res.arrayBuffer();
    const bytes = new Uint8Array(ab);
    expect(bytes[0]).toBe(0xef); // UTF-8 BOM byte 1
    expect(bytes[1]).toBe(0xbb); // UTF-8 BOM byte 2
    expect(bytes[2]).toBe(0xbf); // UTF-8 BOM byte 3
  });

  it("CSV: admin session + 3 לקוחות → 3 שורות נתונים (+ 1 כותרת)", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockListClients.mockResolvedValue([
      makeFakeClient("c1"),
      makeFakeClient("c2"),
      makeFakeClient("c3"),
    ]);

    const res = await GET(makeRequest("?format=csv"));
    const text = await res.text();
    // הסרת ה-BOM לספירת שורות
    const withoutBom = text.replace(/^﻿/, "");
    const lines = withoutBom.split(/\r?\n/).filter((l) => l.trim() !== "");
    // 1 שורת כותרות + 3 שורות נתונים
    expect(lines).toHaveLength(4);
  });

  // ─── פורמט XLSX ─────────────────────────────────────────────────────────

  it("XLSX: admin session + 3 לקוחות → Content-Type xlsx", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockListClients.mockResolvedValue([
      makeFakeClient("c1"),
      makeFakeClient("c2"),
      makeFakeClient("c3"),
    ]);

    const res = await GET(makeRequest("?format=xlsx"));
    const contentType = res.headers.get("Content-Type");
    expect(contentType).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });

  it("XLSX: הבאפר תקין וניתן לטעינה עם exceljs ללא שגיאה", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockListClients.mockResolvedValue([
      makeFakeClient("c1"),
      makeFakeClient("c2"),
      makeFakeClient("c3"),
    ]);

    const res = await GET(makeRequest("?format=xlsx"));
    const ab = await res.arrayBuffer();

    const wb = new ExcelJS.Workbook();
    // אם הבאפר לא תקין, wb.xlsx.load יזרוק שגיאה
    await expect(wb.xlsx.load(ab)).resolves.toBeDefined();
  });

  // ─── בדיקות הרשאות ──────────────────────────────────────────────────────

  it("ללא session → 401", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("session עם role=therapist → 403", async () => {
    mockAuth.mockResolvedValue(makeTherapistSession());

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("format=invalid → 400", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    // פורמט לא נתמך — אין צורך ב-listClients
    mockListClients.mockResolvedValue([]);

    const res = await GET(makeRequest("?format=invalid"));
    expect(res.status).toBe(400);
  });
});
