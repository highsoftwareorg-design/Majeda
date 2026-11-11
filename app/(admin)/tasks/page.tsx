import { connection } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  AdminTasksList,
  type AdminTaskItem,
} from "@/components/followups/AdminTasksList";

/**
 * מסך משימות "להתקשר היום" לאדמין (משימה 8.6, FR-FU-04).
 *
 * שליפה בצד השרת של כל המשימות בסטטוס OPEN, ממוינות לפי תאריך המעקב.
 * התאריכים מעוצבים כאן (אזור זמן ישראל) כדי שה-SSR וה-hydration יתאימו.
 * הפעולות על כל משימה (נקבע תור / לא ענה / לא מעוניין) מטופלות ע"י AdminTasksList.
 */
export default async function TasksPage() {
  // Signals to Next.js that this route runs at request time (not prerendered).
  await connection();

  const openTasks = await prisma.adminTask.findMany({
    where: { status: "OPEN" },
    include: {
      client: { select: { firstName: true, lastName: true, phone: true } },
      followUp: { select: { scheduledDate: true, rule: { select: { adminNote: true } } } },
    },
    orderBy: { followUp: { scheduledDate: "asc" } },
  });

  const tasks: AdminTaskItem[] = openTasks.map((task) => ({
    id: task.id,
    clientName: `${task.client.firstName} ${task.client.lastName}`.trim(),
    phone: task.client.phone,
    followUpDate: task.followUp.scheduledDate.toLocaleDateString("he-IL", {
      timeZone: "Asia/Jerusalem",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    adminNote: task.followUp.rule?.adminNote ?? null,
  }));

  return (
    <div>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-2xl text-charcoal">
              משימות להתקשר היום
            </h1>
            <span
              aria-label={`${tasks.length} משימות פתוחות`}
              className="inline-flex min-w-7 items-center justify-center rounded-full bg-gold px-2 py-0.5 text-sm font-medium text-ink"
            >
              {tasks.length}
            </span>
          </div>
          <p className="text-taupe">
            מעקבים שהגיע מועדם ודורשים שיחה טלפונית. בחרי את תוצאת השיחה לכל לקוחה.
          </p>
        </header>

        <AdminTasksList initialTasks={tasks} />
      </div>
    </div>
  );
}
