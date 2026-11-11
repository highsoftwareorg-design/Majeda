/**
 * מסך קטלוג טיפולים — משימה 11.7 (FR-AP-02).
 *
 * Server Component: שולף את כל הטיפולים מה-DB (כולל השדות המלאים של
 * FR-AP-02) ומעביר ל-TreatmentsCatalog (Client Component) לתצוגה, יצירה ועריכה.
 *
 * נתיב: /treatments (תחת route group `(admin)` → מקבל את AdminShell).
 * הרשאות: מוגן ב-middleware.ts (דרשה כניסה).
 */

import { connection } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { TreatmentsCatalog } from "@/components/treatments/TreatmentsCatalog";
import type { TreatmentListItem } from "@/components/treatments/TreatmentFormDialog";

export const metadata = {
  title: "קטלוג טיפולים | MAJIDA Beauté",
};

export default async function TreatmentsPage() {
  // מאלץ הרצה ב-request time (לא prerender סטטי)
  await connection();

  const rows = await prisma.treatment.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      durationMinutes: true,
      price: true,
      recommendedReturn: true,
      recommendedReturnDays: true,
      color: true,
      requiresConsentForm: true,
      authorizedTherapists: true,
    },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <TreatmentsCatalog initialTreatments={rows} />
    </div>
  );
}
