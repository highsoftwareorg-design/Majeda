/**
 * בדיקות ל-GET /api/appointments/export — משימה 10.2.
 *
 * כל הקריאות ל-Prisma ו-auth ממוקות — אין גישה אמיתית לבסיס הנתונים.
 *
 * בודק:
 * 1. admin session + 2 תורים + טווח תקין → CSV עם 2 שורות נתונים + header נכון.
 * 2. admin session + טווח ריק (אין תורים) → CSV עם header בלבד.
 * 3. ללא session → 401.
 *
 * הרצה: `npx vitest run app/api/appointments/__tests__/export.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ─── Hoisted mock factories (חייבים לפני ה-imports) ─────────────────────────

const { mockAuth, mockAppointmentFindMany } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockAppointmentFindMany: vi.fn(),
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

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    appointment: {
      findMany: mockAppointmentFindMany,
    },
  },
}));

// ─── Import route handler after mocks ────────────────────────────────────────

import { GET } from "@/app/api/appointments/export/route";

// ─── עזרים ───────────────────────────────────────────────────────────────────

function makeAdminSession() {
  return { user: { id: "user-1", role: "admin", name: "Admin" } };
}

function makeRequest(params = "") {
  return new Request(`http://localhost/api/appointments/export${params}`);
}

function makeFakeAppointment(overrides: Record<string, unknown> = {}) {
  return {
    startTime: new Date("2026-01-15T10:00:00Z"),
    therapist: "מאיה",
    room: "חדר 1",
    status: "SCHEDULED",
    client: { firstName: "שרה", lastName: "כהן", phone: "0501234567" },
    treatment: { name: "פנים", price: 350 },
    ...overrides,
  };
}

// ─── בדיקות ──────────────────────────────────────────────────────────────────

describe("GET /api/appointments/export — משימה 10.2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admin + 2 תורים → CSV עם 2 שורות נתונים ו-header נכון", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockAppointmentFindMany.mockResolvedValue([
      makeFakeAppointment(),
      makeFakeAppointment({
        client: { firstName: "דנה", lastName: "לוי", phone: "0509876543" },
      }),
    ]);

    const res = await GET(makeRequest("?start=2026-01-01&end=2026-01-31"));

    // Content-Type
    expect(res.headers.get("Content-Type")).toContain("text/csv");

    const text = await res.text();
    const withoutBom = text.replace(/^﻿/, "");
    const lines = withoutBom.split(/\r?\n/).filter((l) => l.trim() !== "");

    // 1 שורת כותרות + 2 שורות נתונים
    expect(lines).toHaveLength(3);

    // בדיקת כותרות
    const header = lines[0];
    expect(header).toContain("תאריך");
    expect(header).toContain("שעה");
    expect(header).toContain("שם לקוח");
    expect(header).toContain("טלפון");
    expect(header).toContain("טיפול");
    expect(header).toContain("מטפל");
    expect(header).toContain("סטטוס");
  });

  it("טווח ריק (אין תורים) → CSV עם header בלבד (שורה 1)", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockAppointmentFindMany.mockResolvedValue([]);

    const res = await GET(makeRequest("?start=2026-01-01&end=2026-01-31"));
    const text = await res.text();
    const withoutBom = text.replace(/^﻿/, "");
    const lines = withoutBom.split(/\r?\n/).filter((l) => l.trim() !== "");

    // שורת כותרות בלבד
    expect(lines).toHaveLength(1);
  });

  it("ללא session → 401", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await GET(makeRequest("?start=2026-01-01&end=2026-01-31"));
    expect(res.status).toBe(401);
  });
});
