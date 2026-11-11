/**
 * בדיקת רינדור לדף הדשבורד (משימה 11.10).
 *
 * Server Component אסינכרוני — כל שליפות השרת ממוקאות; מרנדרים את העץ שהוא
 * מחזיר ומוודאים שלושת הבלוקים, תוויות בעברית, שעה 24h, קישורים, ושאין לוג PII.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { fromZonedTime } from "date-fns-tz";

// --- מוקים לשליפות השרת ---
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    client: { count: vi.fn(), findMany: vi.fn() },
    segment: { findMany: vi.fn() },
    adminTask: { count: vi.fn() },
  },
}));
vi.mock("@/lib/db/appointments", () => ({ getAppointmentsByDateRange: vi.fn() }));
vi.mock("@/lib/db/clients", () => ({ listClients: vi.fn() }));

import DashboardPage from "@/app/(admin)/dashboard/page";
import { prisma } from "@/lib/db/prisma";
import { getAppointmentsByDateRange } from "@/lib/db/appointments";
import { listClients } from "@/lib/db/clients";

const APPT_TIME = fromZonedTime("2026-06-14T09:30:00", "Asia/Jerusalem");

beforeEach(() => {
  vi.mocked(prisma.client.count).mockResolvedValue(42 as never);
  vi.mocked(prisma.client.findMany).mockResolvedValue([
    {
      id: "c1",
      firstName: "שרה",
      lastName: "כהן",
      createdAt: new Date("2026-06-10T09:00:00Z"),
    },
  ] as never);
  vi.mocked(prisma.segment.findMany).mockResolvedValue([
    { id: "s1", name: "לקוחות VIP", filters: {} },
    { id: "s2", name: "חדשים החודש", filters: {} },
  ] as never);
  vi.mocked(prisma.adminTask.count).mockResolvedValue(5 as never);
  vi.mocked(getAppointmentsByDateRange).mockResolvedValue([
    {
      id: "a1",
      clientId: "c1",
      client: { firstName: "שרה", lastName: "כהן" },
      treatment: { name: "טיפול פנים" },
      therapist: "מאיה",
      status: "CONFIRMED",
      startTime: APPT_TIME,
    },
  ] as never);
  vi.mocked(listClients).mockResolvedValue([{}, {}, {}, {}, {}, {}, {}] as never);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function renderDashboard() {
  render(await DashboardPage());
}

describe("DashboardPage — three blocks", () => {
  it("renders the Hebrew page heading", async () => {
    await renderDashboard();
    expect(screen.getByRole("heading", { level: 1, name: "דשבורד" })).toBeInTheDocument();
  });

  it("(א) clients at-a-glance: active count, recent client, segment counts", async () => {
    await renderDashboard();
    expect(screen.getByText('סה"כ לקוחות פעילים')).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    // סגמנטים מרכזיים
    expect(screen.getByText("לקוחות VIP")).toBeInTheDocument();
    expect(screen.getByText("חדשים החודש")).toBeInTheDocument();
    // ספירת לקוחות לכל סגמנט (listClients → 7)
    expect(screen.getAllByText("7").length).toBeGreaterThanOrEqual(1);
    // לקוח אחרון + קישור לפרופיל
    expect(
      document.querySelector('a[href="/clients/c1"]')
    ).toBeInTheDocument();
  });

  it("(ב) upcoming treatments: 24h time, client/treatment/therapist/status + profile link", async () => {
    await renderDashboard();
    // CardTitle של shadcn מרונדר כ-div (לא role=heading) — מאותרים לפי טקסט
    expect(screen.getByText("הטיפולים הקרובים")).toBeInTheDocument();
    // שעה בפורמט 24h (Asia/Jerusalem)
    expect(screen.getByText("09:30")).toBeInTheDocument();
    expect(screen.getByText("טיפול פנים")).toBeInTheDocument();
    expect(screen.getByText("מאיה")).toBeInTheDocument();
    // סטטוס CONFIRMED → תווית עברית
    expect(screen.getByText("אושר")).toBeInTheDocument();
    // שם הלקוח/ה מופיע (ברשימת האחרונים וגם בתור)
    expect(screen.getAllByText("שרה כהן").length).toBeGreaterThanOrEqual(1);
  });

  it("(ג) shortcuts: open-tasks count linking /tasks and quick-action links", async () => {
    await renderDashboard();
    expect(screen.getByText("משימות מעקב פתוחות")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByLabelText("5 משימות פתוחות")).toBeInTheDocument();

    expect(document.querySelector('a[href="/tasks"]')).toBeInTheDocument();
    // "לקוח/ה חדש/ה" → /clients
    const newClient = screen.getByRole("link", { name: /לקוח\/ה חדש\/ה/ });
    expect(newClient).toHaveAttribute("href", "/clients");
    // "תור חדש" → /calendar
    const newAppt = screen.getByRole("link", { name: /תור חדש/ });
    expect(newAppt).toHaveAttribute("href", "/calendar");
    // קישור ליומן המלא
    expect(
      screen.getByRole("link", { name: "לצפייה ביומן המלא" })
    ).toHaveAttribute("href", "/calendar");
  });

  it("empty states render Hebrew fallbacks with no appointments/clients/segments", async () => {
    vi.mocked(prisma.client.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.segment.findMany).mockResolvedValue([] as never);
    vi.mocked(getAppointmentsByDateRange).mockResolvedValue([] as never);
    await renderDashboard();
    expect(screen.getByText("אין טיפולים מתוכננים בטווח הזה.")).toBeInTheDocument();
    expect(screen.getByText("עדיין לא נוספו לקוחות.")).toBeInTheDocument();
    expect(screen.getByText("אין סגמנטים שמורים עדיין.")).toBeInTheDocument();
  });

  it("mobile-first responsive grid (hebrew-ui): single column on small screens", async () => {
    const { container } = render(await DashboardPage());
    expect(container.querySelector('[class*="grid-cols-1"]')).toBeInTheDocument();
    cleanup();
  });

  it("does not log PII to the console during render", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    await renderDashboard();
    expect(logSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(debugSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
    infoSpy.mockRestore();
    debugSpy.mockRestore();
  });
});
