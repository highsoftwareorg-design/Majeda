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
import { ConsentList, ConsentMissingWarning } from "@/components/clients/ConsentList";
import { ConsentSigningPanel } from "@/components/clients/ConsentSigningPanel";
import type { ConsentItem } from "@/components/clients/ConsentList";
import { MessageTimeline } from "@/components/clients/MessageTimeline";
import { prisma } from "@/lib/db/prisma";

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [client, visits, treatments, allTags, messages, rawConsents, upcomingAppointments] = await Promise.all([
    getClientById(id),
    getClientVisits(id),
    getTreatments(),
    // קטלוג תגיות — לבחירה בטופס עריכת הלקוח/ה (משימה 11.5)
    prisma.tag.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.message.findMany({
      where: { clientId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        channel: true,
        templateId: true,
        status: true,
        sourceType: true,
        sentAt: true,
        createdAt: true,
      },
    }),
    // טפסי הסכמה חתומים — task 7.9, FR-PR-08
    prisma.signedConsent.findMany({
      where: { clientId: id },
      include: { template: { select: { name: true, validityDays: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    // תורים קרובים שמחייבים טופס הסכמה — task 7.9, FR-CF-09
    prisma.appointment.findMany({
      where: {
        clientId: id,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        treatment: { requiresConsentForm: true },
      },
      select: {
        id: true,
        treatment: { select: { name: true } },
      },
    }),
  ]);

  // 404 אם לא נמצא או בארכיון (ארכיון נחשב כ"לא זמין" לעיון ישיר)
  if (!client || client.status === "archived") {
    notFound();
  }

  // חישוב סטטוס טפסי הסכמה — task 7.9, FR-PR-08
  const now = new Date();
  const consents: ConsentItem[] = rawConsents.map((c) => {
    const expiresAt =
      c.signedAt && c.template.validityDays
        ? new Date(
            c.signedAt.getTime() + c.template.validityDays * 24 * 60 * 60 * 1000
          )
        : null;

    let status: ConsentItem['status'];
    if (!c.signedAt) {
      status = 'ממתין לחתימה';
    } else if (expiresAt && expiresAt < now) {
      status = 'פג תוקף';
    } else {
      status = 'בתוקף';
    }

    return {
      id: c.id,
      templateName: c.template.name,
      templateVersion: c.templateVersion,
      signedAt: c.signedAt?.toISOString() ?? null,
      expiresAt: expiresAt?.toISOString() ?? null,
      pdfStorageKey: c.pdfStorageKey,
      status,
    };
  });

  // בדיקה: אילו תורים מחייבים טופס הסכמה אך אין לקוח/ה טופס בתוקף — task 7.9, FR-CF-09
  const hasValidConsent = consents.some((c) => c.status === 'בתוקף');
  const missingConsentTreatmentNames: string[] = hasValidConsent
    ? []
    : upcomingAppointments
        .map((a) => a.treatment?.name)
        .filter((name): name is string => !!name)
        // הסרת כפילויות
        .filter((name, idx, arr) => arr.indexOf(name) === idx);

  return (
    <div>
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
        <ClientProfileHeader client={client} tagOptions={allTags} />

        {/* אזהרת טופס הסכמה חסר (task 7.9, FR-CF-09) */}
        {missingConsentTreatmentNames.length > 0 && (
          <div className="mt-4">
            <ConsentMissingWarning treatmentNames={missingConsentTreatmentNames} />
          </div>
        )}

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

        {/* בלוק טפסי הסכמה — task 7.9, FR-PR-08 */}
        <section aria-labelledby="consents-heading" className="mt-8">
          <div className="rounded-brand border border-gold/20 bg-white p-4 sm:p-5">
            <h2
              id="consents-heading"
              className="mb-4 text-base font-semibold text-charcoal"
            >
              טפסי הסכמה
            </h2>
            {/* שליחת טופס לחתימה — משימה 11.12, FR-CF-02/FR-CF-06 */}
            <ConsentSigningPanel clientId={client.id} clientPhone={client.phone ?? null} />
            <ConsentList consents={consents} />
          </div>
        </section>

        {/* יומן שליחה — משימה 6.7, FR-WA-06 */}
        <section aria-labelledby="messages-heading" className="mt-8">
          <h2
            id="messages-heading"
            className="text-lg font-semibold text-charcoal mb-4"
          >
            יומן הודעות
          </h2>
          <MessageTimeline
            messages={messages.map((m) => ({
              ...m,
              sentAt: m.sentAt ? m.sentAt.toISOString() : null,
              createdAt: m.createdAt.toISOString(),
            }))}
          />
        </section>
      </div>
    </div>
  );
}
