/**
 * מסך כללי מעקב לטיפול (משימה 8.2, FR-FU-01).
 *
 * Server Component: שולף את הטיפול וכללי המעקב הפעילים שלו מה-DB,
 * ומעביר ל-FollowUpRulesPanel (Client Component) לניהול הרשימה, מחיקה והוספה.
 *
 * נתיב: /treatments/:id
 * הרשאות: מוגן ב-middleware.ts (דרשה כניסה).
 */

import { connection } from "next/server";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { FollowUpRulesPanel } from "@/components/followups/FollowUpRulesPanel";
import type { FollowUpRuleData } from "@/components/followups/FollowUpRuleEditor";

export const metadata = {
  title: "כללי מעקב לטיפול | MAJIDA Beauté",
};

type PageProps = { params: Promise<{ id: string }> };

export default async function TreatmentFollowUpRulesPage({ params }: PageProps) {
  // מאלץ הרצה ב-request time (לא prerender סטטי)
  await connection();

  const { id } = await params;

  const treatment = await prisma.treatment.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!treatment) {
    notFound();
  }

  const rawRules = await prisma.followUpRule.findMany({
    where: { treatmentId: id, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  const rules: FollowUpRuleData[] = rawRules.map((r) => ({
    id: r.id,
    treatmentId: r.treatmentId,
    name: r.name,
    offsetDays: r.offsetDays,
    recipientType: r.recipientType,
    adminNote: r.adminNote,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return (
    <div>
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-1">
          <p className="text-sm text-taupe">טיפול</p>
          <h1 className="font-heading text-2xl text-charcoal break-words">
            {treatment.name}
          </h1>
        </header>
        <FollowUpRulesPanel treatmentId={id} initialRules={rules} />
      </div>
    </div>
  );
}
