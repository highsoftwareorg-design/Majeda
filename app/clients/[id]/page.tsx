/**
 * עמוד פרופיל לקוח — משימה 4.2, §4.1 כותרת.
 *
 * Server Component: שולף את נתוני הלקוח (כולל תגיות) ומציג כותרת פרופיל.
 * מחזיר 404 אם הלקוח לא נמצא או בארכיון.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getClientById } from "@/lib/db/clients";
import { getClientVisits } from "@/lib/db/visits";
import { getTreatments } from "@/lib/db/treatments";
import { ClientProfileHeader } from "@/components/clients/ClientProfileHeader";
import { MedicalAlertsBlock } from "@/components/clients/MedicalAlertsBlock";
import { MedicalAlertsForm } from "@/components/clients/MedicalAlertsForm";
import { VisitTimeline } from "@/components/clients/VisitTimeline";
import { VisitForm } from "@/components/clients/VisitForm";
import { NextReturnReminder } from "@/components/clients/NextReturnReminder";
import { FilesBlock } from "@/components/clients/FilesBlock";
import { ConsentFormsBlock } from "@/components/clients/ConsentFormsBlock";

// Opts out of static prerendering — reads DB on every request (Next.js 16 cacheComponents API).
export const instant = false;

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [client, visits, treatments] = await Promise.all([
    getClientById(id),
    getClientVisits(id),
    getTreatments(),
  ]);

  // 404 אם לא נמצא או בארכיון (ארכיון נחשב כ"לא זמין" לעיון ישיר)
  if (!client || client.status === "archived") {
    notFound();
  }

  return (
    <main
      dir="rtl"
      lang="he"
      className="min-h-screen bg-champagne px-4 py-6 sm:px-6 sm:py-8"
    >
      <div className="mx-auto max-w-3xl">
        {/* קישור חזרה לרשימה */}
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-sm text-gold-dark hover:text-gold-deep transition-colors mb-6 min-h-11 group"
          aria-label="חזרה לרשימת הלקוחות"
        >
          {/* בגלל RTL — ArrowLeft הוא "אחורה" (חזרה) */}
          <ArrowLeft
            className="w-4 h-4 shrink-0 transition-transform group-hover:-translate-x-0.5"
            aria-hidden="true"
          />
          <span>חזרה לרשימה</span>
        </Link>

        {/* כותרת פרופיל */}
        <ClientProfileHeader client={client} />

        {/* בלוק התראות רפואיות (משימה 4.3) — מוצג מיד מתחת לכותרת */}
        <div className="mt-4 space-y-3">
          <MedicalAlertsBlock
            data={{
              allergies: client.allergies ?? null,
              medications: client.medications ?? null,
              pregnancyNursing: client.pregnancyNursing ?? null,
              medicalConditions: client.medicalConditions ?? null,
            }}
          />
          <MedicalAlertsForm
            clientId={client.id}
            initialData={{
              allergies: client.allergies ?? null,
              medications: client.medications ?? null,
              pregnancyNursing: client.pregnancyNursing ?? null,
              medicalConditions: client.medicalConditions ?? null,
            }}
          />
        </div>

        {/* תזכורת חזרה הבאה — משימה 4.9, §4.1 */}
        <div className="mt-4">
          <NextReturnReminder clientId={id} visits={visits} />
        </div>

        {/* ציר זמן ביקורים — משימה 4.4 + טופס רישום ביקור — משימה 4.5 */}
        <section aria-labelledby="visit-history-heading" className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2
              id="visit-history-heading"
              className="text-lg font-semibold text-charcoal"
            >
              היסטוריית ביקורים
            </h2>
          </div>

          {/* טופס הוספת ביקור (משימה 4.5) */}
          <div className="mb-6">
            <VisitForm
              clientId={client.id}
              treatments={treatments.map((t) => ({
                id: t.id,
                name: t.name,
                recommendedReturnDays: t.recommendedReturnDays ?? null,
              }))}
            />
          </div>

          {/* ציר הזמן */}
          <VisitTimeline visits={visits} clientId={id} />
        </section>

        {/* בלוק קבצים ותמונות — משימה 4.10, §4.1 (Phase 2 placeholder) */}
        <div className="mt-8">
          <FilesBlock />
        </div>

        {/* בלוק טפסי הסכמה — משימה 4.11, §4.1 FR-PR-08 (Phase future placeholder) */}
        <div className="mt-4">
          <ConsentFormsBlock />
        </div>
      </div>
    </main>
  );
}
