import { connection } from "next/server";
import { signOut } from "@/lib/auth/auth";
import { Button } from "@/components/ui/button";
import { listClients } from "@/lib/db/clients";
import { prisma } from "@/lib/db/prisma";
import {
  ClientsListView,
  type ClientListItem,
  type SegmentItem,
  type TagOption,
  type TreatmentOption,
} from "@/components/clients/ClientsListView";

/**
 * מסך רשימת לקוחות (משימה 3.5, FR-CL-03).
 *
 * שליפה ראשונית (SSR) של כל הלקוחות הפעילים (ללא ארכיון, לפי ברירת המחדל
 * של `listClients`), ומסירה ל-`ClientsListView` (Client Component) שמנהלת
 * את שדה החיפוש ואת רענון הרשימה מול `GET /api/clients?q=`.
 *
 * פילטרים נוספים (טיפול/מין/תגיות/תאריכים/סגמנטים/פעולות קבוצתיות) הם
 * משימות 3.6–3.12 נפרדות ולא כלולים כאן. קישור לכרטיס לקוח בודד (`/clients/[id]`)
 * לא נוסף בכוונה — פרופיל הלקוח (משימה 4.2) עדיין לא קיים, ושורת טבלה
 * "דוממת" נמנעת מהבטחת ניווט שלא עובד.
 */
// Opts out of static prerendering (קורא מה-DB בכל בקשה).
export const instant = false;

export default async function ClientsPage() {
  // Signals to Next.js 16 that this route runs at request time (not prerendered).
  await connection();

  // שליפה מקבילה: רשימת לקוחות + קטלוג טיפולים (3.6) + תגיות (3.9) + סגמנטים (3.11).
  const [clients, treatmentsRaw, tagsRaw, segmentsRaw] = await Promise.all([
    listClients(),
    prisma.treatment.findMany({
      select: { id: true, name: true, durationMinutes: true },
      orderBy: { name: "asc" },
    }),
    prisma.tag.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.segment.findMany({
      select: { id: true, name: true, filters: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const serializedClients: ClientListItem[] = clients.map((client) => ({
    id: client.id,
    firstName: client.firstName,
    lastName: client.lastName,
    phone: client.phone,
    city: client.city,
    createdAt: client.createdAt.toISOString(),
  }));

  const treatments: TreatmentOption[] = treatmentsRaw.map((t) => ({
    id: t.id,
    name: t.name,
    durationMinutes: t.durationMinutes,
  }));

  const tags: TagOption[] = tagsRaw.map((t) => ({
    id: t.id,
    name: t.name,
  }));

  const segments: SegmentItem[] = segmentsRaw.map((s) => ({
    id: s.id,
    name: s.name,
    // Prisma מחזיר Json כ-unknown — נוודא שזה object (אם לא, נחזיר מסנן ריק)
    filters: (typeof s.filters === "object" && s.filters !== null
      ? s.filters
      : {}) as SegmentItem["filters"],
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <main dir="rtl" className="min-h-screen bg-champagne p-4 sm:p-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-2xl text-charcoal">
              ניהול לקוחות
            </h1>
            <p className="text-taupe">
              רשימת הלקוחות הפעילים במערכת. ניתן לחפש לפי שם, טלפון או לסנן
              לפי מין וטיפולים שבוצעו.
            </p>
          </div>

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="outline">
              התנתקות
            </Button>
          </form>
        </header>

        <ClientsListView
          initialClients={serializedClients}
          treatments={treatments}
          tags={tags}
          initialSegments={segments}
        />
      </div>
    </main>
  );
}
