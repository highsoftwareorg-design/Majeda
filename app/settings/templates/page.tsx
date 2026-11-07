/**
 * מסך ניהול תבניות WhatsApp (משימה 6.8, FR-WA-05).
 *
 * Server Component: שולף רשימת תבניות מה-DB ומעביר ל-TemplatesList (Client Component).
 * הרשאות: מוגן ב-middleware.ts (דרשה כניסה).
 *
 * נתיב: /settings/templates
 */

import { connection } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { TemplatesList } from "@/components/whatsapp/TemplatesList";
import type { WhatsAppTemplateData } from "@/components/whatsapp/TemplateEditor";

export const metadata = {
  title: "תבניות WhatsApp | MAJIDA Beauté",
};

export default async function WhatsAppTemplatesPage() {
  await connection();

  const rawTemplates = await prisma.whatsAppTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });

  // המרה לסוג שהרכיב מצפה לו (DateTime → string)
  const templates: WhatsAppTemplateData[] = rawTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    body: t.body,
    variables: Array.isArray(t.variables) ? (t.variables as string[]) : [],
    approvedByMeta: t.approvedByMeta,
    language: t.language,
    isActive: t.isActive,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return (
    <main
      dir="rtl"
      lang="he"
      className="min-h-screen bg-champagne px-4 py-8 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-4xl">
        <TemplatesList initialTemplates={templates} />
      </div>
    </main>
  );
}
