/**
 * מסך ניהול טפסי הסכמה (משימה 7.2, FR-CF-01).
 *
 * Server Component: שולף את כל התבניות (פעילות תחילה, ואז לא-פעילות) מה-DB ומעביר
 * ל-ConsentTemplatesList (Client Component) שמנהל את מצב הרשימה, יצירה ועריכה.
 * תבניות לא-פעילות (מחיקה רכה) מוצגות כדי לאפשר מחיקה לצמיתות (משימה 12.5, מעקב).
 *
 * נתיב: /consent-templates
 * הרשאות: מוגן ב-middleware.ts (דרשה כניסה).
 */

import { connection } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { ConsentTemplatesList } from "@/components/consent/ConsentTemplatesList";
import type { ConsentTemplateData } from "@/components/consent/ConsentTemplateEditor";
import type { ConsentField } from "@/components/consent/ConsentTemplateEditor";

export const metadata = {
  title: "טפסי הסכמה | MAJIDA Beauté",
};

export default async function ConsentTemplatesPage() {
  // מאלץ הרצה ב-request time (לא prerender סטטי)
  await connection();

  const rawTemplates = await prisma.consentTemplate.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      isGeneral: true,
      treatmentIds: true,
      validityDays: true,
      language: true,
      version: true,
      isActive: true,
      fields: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // המרה לסוג שהרכיב מצפה לו (DateTime → string, Json → typed arrays)
  const templates: ConsentTemplateData[] = rawTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    isGeneral: t.isGeneral,
    treatmentIds: Array.isArray(t.treatmentIds)
      ? (t.treatmentIds as string[])
      : [],
    validityDays: t.validityDays,
    language: t.language,
    version: t.version,
    isActive: t.isActive,
    fields: Array.isArray(t.fields) ? (t.fields as unknown as ConsentField[]) : [],
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <ConsentTemplatesList initialTemplates={templates} />
    </div>
  );
}
