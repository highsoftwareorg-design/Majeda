/**
 * דשבורד / מסך בית לאדמין (משימה 11.10) — יעד ברירת המחדל אחרי התחברות.
 *
 * Server Component: שליפות שרת בלבד (prisma.client.count, getAppointmentsByDateRange
 * לטווח היום+7, ספירת AdminTask OPEN, לקוחות אחרונים וסגמנטים מרכזיים).
 * מוגן ב-middleware.ts; מוצג בתוך AdminShell דרך app/(admin)/layout.tsx.
 * PII: שמות לקוחות/טיפולים מוצגים בלבד — אין לוגים (§11).
 */

import Link from "next/link";
import { connection } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarPlus, ListChecks, UserPlus, Users } from "lucide-react";
import { getAppointmentsByDateRange } from "@/lib/db/appointments";
import { listClients } from "@/lib/db/clients";
import { prisma } from "@/lib/db/prisma";
import { ISRAEL_TZ } from "@/lib/exports/csv";
import { getUpcomingHorizon, UPCOMING_DAYS } from "@/lib/dashboard/horizon";
import { countOpenAdminTasks } from "@/lib/db/admin-tasks";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** מספר הסגמנטים המרכזיים (המוצגים במבט-על) — שני הסגמנטים האחרונים שנשמרו */
const KEY_SEGMENTS_COUNT = 2;
/** מספר הלקוחות האחרונים שנוספו שמוצגים */
const RECENT_CLIENTS_COUNT = 5;

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "נקבע",
  CONFIRMED: "אושר",
  ARRIVED: "הגיע/ה",
  COMPLETED: "בוצע",
  CANCELLED: "בוטל",
  NO_SHOW: "לא הגיע/ה",
};

type ListClientsOptions = NonNullable<Parameters<typeof listClients>[0]>;

export default async function DashboardPage() {
  // מאלץ הרצה ב-request time (לא prerender סטטי)
  await connection();

  const horizon = getUpcomingHorizon();

  const [
    activeClientsCount,
    recentClients,
    keySegmentsRaw,
    upcomingAppointments,
    openTasksCount,
  ] = await Promise.all([
    prisma.client.count({ where: { status: "active" } }),
    prisma.client.findMany({
      where: { status: "active" },
      select: { id: true, firstName: true, lastName: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: RECENT_CLIENTS_COUNT,
    }),
    prisma.segment.findMany({
      select: { id: true, name: true, filters: true },
      orderBy: { createdAt: "desc" },
      take: KEY_SEGMENTS_COUNT,
    }),
    getAppointmentsByDateRange(horizon.start, horizon.end),
    countOpenAdminTasks(),
  ]);

  // ספירת לקוחות לכל סגמנט — אותו מנגנון כמו lib/campaigns/recipients.ts (ללא מאורכבים)
  const keySegments = await Promise.all(
    keySegmentsRaw.map(async (segment) => {
      const options = (
        typeof segment.filters === "object" && segment.filters !== null
          ? segment.filters
          : {}
      ) as ListClientsOptions;
      const clients = await listClients(options);
      return { id: segment.id, name: segment.name, count: clients.length };
    })
  );

  // קיבוץ התורים לפי יום (שעון ישראל), בסדר כרונולוגי
  const groupedByDay = new Map<string, typeof upcomingAppointments>();
  for (const apt of upcomingAppointments) {
    const dayKey = formatInTimeZone(apt.startTime, ISRAEL_TZ, "yyyy-MM-dd");
    const bucket = groupedByDay.get(dayKey) ?? [];
    bucket.push(apt);
    groupedByDay.set(dayKey, bucket);
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl text-charcoal">דשבורד</h1>
        <p className="text-taupe">מבט-על על הלקוחות, הטיפולים הקרובים והמשימות הפתוחות.</p>
      </header>

      {/* קיצורי דרך — כפתורי פעולה מהירה ומשימות פתוחות */}
      <section aria-labelledby="shortcuts-heading" className="flex flex-col gap-3">
        <h2 id="shortcuts-heading" className="sr-only">
          קיצורי דרך
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href="/tasks"
            className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-hairline-light bg-white p-4 text-charcoal transition-colors hover:bg-champagne"
          >
            <span className="flex items-center gap-3">
              <ListChecks aria-hidden className="size-5 text-gold" />
              <span className="font-medium">משימות מעקב פתוחות</span>
            </span>
            <span
              aria-label={`${openTasksCount} משימות פתוחות`}
              className="inline-flex min-w-7 items-center justify-center rounded-full bg-gold px-2 py-0.5 text-sm font-medium text-ink"
            >
              {openTasksCount}
            </span>
          </Link>

          <Link
            href="/clients"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-11 justify-start gap-2")}
          >
            <UserPlus aria-hidden className="size-5" />
            לקוח/ה חדש/ה
          </Link>

          <Link
            href="/calendar"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-11 justify-start gap-2")}
          >
            <CalendarPlus aria-hidden className="size-5" />
            תור חדש
          </Link>
        </div>
      </section>

      {/* (א) מבט-על לקוחות */}
      <section aria-labelledby="clients-heading" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle id="clients-heading" className="flex items-center gap-2 font-heading text-lg">
              <Users aria-hidden className="size-5 text-gold" />
              לקוחות
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="text-sm text-taupe">סה&quot;כ לקוחות פעילים</p>
              <p className="font-heading text-3xl text-charcoal">{activeClientsCount}</p>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-charcoal">סגמנטים מרכזיים</h3>
              {keySegments.length === 0 ? (
                <p className="text-sm text-taupe">אין סגמנטים שמורים עדיין.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {keySegments.map((segment) => (
                    <li key={segment.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-charcoal">{segment.name}</span>
                      <span className="font-medium text-charcoal">{segment.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-heading text-lg">לקוחות שנוספו לאחרונה</CardTitle>
          </CardHeader>
          <CardContent>
            {recentClients.length === 0 ? (
              <p className="text-sm text-taupe">עדיין לא נוספו לקוחות.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-hairline-light">
                {recentClients.map((client) => (
                  <li key={client.id}>
                    <Link
                      href={`/clients/${client.id}`}
                      className="flex min-h-11 items-center justify-between gap-3 py-2 text-charcoal hover:text-gold"
                    >
                      <span className="font-medium">
                        {client.firstName} {client.lastName}
                      </span>
                      <span className="text-sm text-taupe">
                        {formatInTimeZone(client.createdAt, ISRAEL_TZ, "dd/MM/yyyy")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* (ב) הטיפולים הקרובים — היום ועד היום ה-N */}
      <section aria-labelledby="upcoming-heading">
        <Card>
          <CardHeader>
            <CardTitle id="upcoming-heading" className="font-heading text-lg">
              הטיפולים הקרובים
            </CardTitle>
            <p className="text-sm text-taupe">
              היום ועד {UPCOMING_DAYS} ימים קדימה, לפי שעה.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {upcomingAppointments.length === 0 ? (
              <p className="text-sm text-taupe">אין טיפולים מתוכננים בטווח הזה.</p>
            ) : (
              [...groupedByDay.entries()].map(([dayKey, appointments]) => (
                <div key={dayKey} className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium text-gold">
                    {dayKey === horizon.todayYmd ? "היום" : formatInTimeZone(appointments[0].startTime, ISRAEL_TZ, "dd/MM/yyyy")}
                  </h3>
                  <ul className="flex flex-col divide-y divide-hairline-light rounded-lg border border-hairline-light bg-white">
                    {appointments.map((apt) => (
                      <li
                        key={apt.id}
                        className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
                      >
                        <span className="w-16 shrink-0 font-medium tabular-nums text-charcoal">
                          {formatInTimeZone(apt.startTime, ISRAEL_TZ, "HH:mm")}
                        </span>
                        <Link
                          href={`/clients/${apt.clientId}`}
                          className="min-h-11 flex-1 font-medium text-charcoal hover:text-gold"
                        >
                          {apt.client.firstName} {apt.client.lastName}
                        </Link>
                        <span className="text-sm text-taupe">
                          {apt.treatment?.name ?? "ללא טיפול"}
                        </span>
                        <span className="text-sm text-taupe">{apt.therapist}</span>
                        <span className="inline-flex w-fit items-center rounded-full border border-hairline-light px-2 py-0.5 text-xs text-charcoal">
                          {STATUS_LABELS[apt.status] ?? apt.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}

            <Link
              href="/calendar"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-11 w-full sm:w-fit")}
            >
              לצפייה ביומן המלא
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
