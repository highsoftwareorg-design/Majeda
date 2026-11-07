/**
 * מסך ניהול טפסי הסכמה (משימה 7.2, FR-CF-01).
 *
 * Server Component: שולף רשימת תבניות פעילות מה-DB ומעביר ל-ConsentTemplatesList
 * (Client Component) שמנהל את מצב הרשימה, יצירה ועריכה.
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
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
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
    <main
      dir="rtl"
      lang="he"
      className="min-h-screen bg-champagne px-4 py-8 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-5xl">
        <ConsentTemplatesList initialTemplates={templates} />
      </div>
    </main>
  );
}
