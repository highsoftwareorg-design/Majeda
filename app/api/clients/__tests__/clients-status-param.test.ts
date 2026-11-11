/**
 * בדיקות ל-GET /api/clients — מיפוי פרמטר ?status לתצוגת ארכיון (משימה 11.6).
 *
 * listClients ממוק — בודקים שהפרמטר ?status מתורגם נכון ל-archivedOnly, ושאר
 * ההתנהגות הקיימת (פעילים בלבד) נשמרת כרגרסיה.
 *
 * בודק:
 * 1. ?status=archived → listClients({ archivedOnly: true }).
 * 2. ללא status → archivedOnly=false (רגרסיה: פעילים בלבד).
 * 3. ?status=active / ערך אחר → archivedOnly=false (רק "archived" משנה).
 * 4. ?status=archived משולב עם ?q — שני הפרמטרים מועברים יחד.
 *
 * הרצה: `npx vitest run app/api/clients/__tests__/clients-status-param.test.ts`
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockListClients } = vi.hoisted(() => ({
  mockListClients: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

vi.mock("@/lib/db/clients", () => ({
  listClients: mockListClients,
}));

import { GET } from "@/app/api/clients/route";

function callGet(url: string) {
  return GET(new Request(url));
}

/** ארגומנט אחרון שהועבר ל-listClients. */
function lastArgs() {
  return mockListClients.mock.calls[0][0];
}

describe("GET /api/clients — פרמטר status (משימה 11.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListClients.mockResolvedValue([]);
  });

  it("?status=archived → listClients מקבל archivedOnly:true", async () => {
    await callGet("http://localhost/api/clients?status=archived");
    expect(lastArgs().archivedOnly).toBe(true);
  });

  it("ללא status → archivedOnly:false (רגרסיה: פעילים בלבד)", async () => {
    await callGet("http://localhost/api/clients");
    expect(lastArgs().archivedOnly).toBe(false);
  });

  it("?status=active → archivedOnly:false (רק 'archived' משנה)", async () => {
    await callGet("http://localhost/api/clients?status=active");
    expect(lastArgs().archivedOnly).toBe(false);
  });

  it("?status=garbage → archivedOnly:false", async () => {
    await callGet("http://localhost/api/clients?status=garbage");
    expect(lastArgs().archivedOnly).toBe(false);
  });

  it("?status=archived&q=דנה — מעביר גם archivedOnly:true וגם search", async () => {
    await callGet("http://localhost/api/clients?status=archived&q=%D7%93%D7%A0%D7%94");
    const args = lastArgs();
    expect(args.archivedOnly).toBe(true);
    expect(args.search).toBe("דנה");
  });

  it("GET מחזיר 200 עם { clients } (מבנה תגובה נשמר)", async () => {
    mockListClients.mockResolvedValue([{ id: "c1" }]);
    const res = await callGet("http://localhost/api/clients?status=archived");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clients).toEqual([{ id: "c1" }]);
  });
});
