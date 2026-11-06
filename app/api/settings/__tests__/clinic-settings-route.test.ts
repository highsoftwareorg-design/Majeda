/**
 * בדיקות ל-API הגדרות מרפאה — משימה 5.7 (FR-AP-05).
 *
 * GET /api/settings/clinic  — מחזיר ברירות מחדל (openHour=8, closeHour=21) כשאין רשומה
 * PUT /api/settings/clinic  — שומר הגדרות ומאמת closeHour > openHour
 *
 * הרצה: `npx vitest run --reporter=verbose app/api/settings/__tests__/clinic-settings-route.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// --- Mocks (חייבים לפני ה-imports של המודולים הממוקים) ---

const { mockGetClinicSettings, mockUpsertClinicSettings } = vi.hoisted(() => ({
  mockGetClinicSettings: vi.fn(),
  mockUpsertClinicSettings: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

vi.mock("@/lib/db/clinicSettings", () => ({
  getClinicSettings: mockGetClinicSettings,
  upsertClinicSettings: mockUpsertClinicSettings,
}));

// --- Import handlers after mocks ---

import { GET, PUT } from "@/app/api/settings/clinic/route";

// ===================================================================
// GET /api/settings/clinic
// ===================================================================

describe("GET /api/settings/clinic — ברירות מחדל", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("מחזיר הגדרות ברירת מחדל (openHour=8, closeHour=21) כשאין רשומה", async () => {
    mockGetClinicSettings.mockResolvedValue({
      openHour: 8,
      closeHour: 21,
      breakStartHour: null,
      breakStartMin: null,
      breakEndHour: null,
      breakEndMin: null,
    });

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settings).toBeDefined();
    expect(body.settings.openHour).toBe(8);
    expect(body.settings.closeHour).toBe(21);
    expect(mockGetClinicSettings).toHaveBeenCalledOnce();
  });

  it("מחזיר 500 כשיש שגיאת בסיס נתונים", async () => {
    mockGetClinicSettings.mockRejectedValue(new Error("DB error"));

    const res = await GET();

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});

// ===================================================================
// PUT /api/settings/clinic
// ===================================================================

describe("PUT /api/settings/clinic — שמירה תקינה", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("שומר הגדרות תקינות (openHour=9, closeHour=19) ומחזיר 200", async () => {
    const savedSettings = {
      openHour: 9,
      closeHour: 19,
      breakStartHour: null,
      breakStartMin: null,
      breakEndHour: null,
      breakEndMin: null,
    };
    mockUpsertClinicSettings.mockResolvedValue(savedSettings);

    const req = new Request("http://localhost/api/settings/clinic", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openHour: 9, closeHour: 19 }),
    });

    const res = await PUT(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settings).toBeDefined();
    expect(body.settings.openHour).toBe(9);
    expect(body.settings.closeHour).toBe(19);
    expect(mockUpsertClinicSettings).toHaveBeenCalledOnce();
  });
});

describe("PUT /api/settings/clinic — ולידציה: closeHour <= openHour", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("מחזיר 400 כש-closeHour שווה ל-openHour", async () => {
    const req = new Request("http://localhost/api/settings/clinic", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openHour: 10, closeHour: 10 }),
    });

    const res = await PUT(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
    expect(mockUpsertClinicSettings).not.toHaveBeenCalled();
  });

  it("מחזיר 400 כש-closeHour קטן מ-openHour", async () => {
    const req = new Request("http://localhost/api/settings/clinic", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openHour: 18, closeHour: 9 }),
    });

    const res = await PUT(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
    expect(mockUpsertClinicSettings).not.toHaveBeenCalled();
  });

  it("מחזיר 400 כש-openHour אינו מספר תקין", async () => {
    const req = new Request("http://localhost/api/settings/clinic", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openHour: "nine", closeHour: 19 }),
    });

    const res = await PUT(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
    expect(mockUpsertClinicSettings).not.toHaveBeenCalled();
  });
});
