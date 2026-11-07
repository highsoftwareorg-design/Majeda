/**
 * דף פרטי קמפיין + דוח (משימות 9.3 / 9.4 / 9.6, FR-MK-02, FR-MK-03, FR-MK-06).
 *
 * נתיב: /campaigns/[id]
 * הרשאות: מוגן ב-middleware.ts (דרשה כניסה).
 *
 * שרת בלבד: טוען את הדוח וספירת הנמענים ישירות מ-lib (ללא fetch עצמי).
 * לקמפיין בטיוטה/מתוזמן מוצגת גם תצוגה מקדימה + שליחת בדיקה (CampaignPreview).
 *
 * הערה (פרטיות — §11): הטבלה מציגה שמות נמענים בלבד, ללא מספרי טלפון.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCampaignReport, messageStatusLabel, percentOf, BOOKING_WINDOW_DAYS } from "@/lib/campaigns/report";
import { getSegmentRecipients } from "@/lib/campaigns/recipients";
import {
  campaignStatusClasses,
  campaignStatusLabel,
} from "@/lib/campaigns/status";
import { CampaignPreview } from "@/components/campaigns/CampaignPreview";

type PageProps = { params: Promise<{ id: string }> };

export const metadata = {
  title: "פרטי קמפיין | MAJIDA Beauté",
};

const PREVIEW_STATUSES = ["DRAFT", "SCHEDULED"];

const dateTimeFormatter = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return dateTimeFormatter.format(new Date(value));
}

function formatPercent(value: number): string {
  return `${value}%`;
}

export default async function CampaignDetailPage({ params }: PageProps) {
  const { id } = await params;

  const report = await getCampaignReport(id);
  if (!report) return notFound();

  const { campaign, stats, messages } = report;
  const recipients = await getSegmentRecipients(campaign.segmentId);
  const summary = recipients.summary;

  const statCards = [
    { label: "נמענים שנשלחו", value: stats.total, percent: null },
    { label: "נשלחו", value: stats.sent, percent: percentOf(stats.sent, stats.total) },
    { label: "נמסרו", value: stats.delivered, percent: percentOf(stats.delivered, stats.sent) },
    { label: "נקראו", value: stats.read, percent: percentOf(stats.read, stats.sent) },
    { label: "נכשלו", value: stats.failed, percent: percentOf(stats.failed, stats.total) },
    { label: "הזמינו תור", value: stats.booked, percent: percentOf(stats.booked, stats.sent) },
  ];

  return (
    <main dir="rtl" lang="he" className="min-h-screen bg-champagne p-4 sm:p-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Link
          href="/campaigns"
          className="inline-flex min-h-11 items-center gap-2 self-start text-sm text-taupe hover:text-charcoal"
        >
          <ArrowRight className="size-4" aria-hidden="true" />
          חזרה לרשימת הקמפיינים
        </Link>

        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-2xl text-charcoal break-words">{campaign.name}</h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${campaignStatusClasses(campaign.status)}`}
            >
              {campaignStatusLabel(campaign.status)}
            </span>
          </div>
          <dl className="grid grid-cols-1 gap-2 text-sm text-taupe sm:grid-cols-2">
            <div className="flex flex-wrap gap-1">
              <dt>סגמנט:</dt>
              <dd className="font-medium text-charcoal">{campaign.segment?.name ?? "—"}</dd>
            </div>
            <div className="flex flex-wrap gap-1">
              <dt>תבנית:</dt>
              <dd className="font-medium text-charcoal">{campaign.template?.name ?? "—"}</dd>
            </div>
            <div className="flex flex-wrap gap-1">
              <dt>מועד מתוזמן:</dt>
              <dd className="font-medium text-charcoal">{formatDateTime(campaign.scheduledAt)}</dd>
            </div>
            <div className="flex flex-wrap gap-1">
              <dt>נשלח בתאריך:</dt>
              <dd className="font-medium text-charcoal">{formatDateTime(campaign.sentAt)}</dd>
            </div>
          </dl>
        </header>

        {PREVIEW_STATUSES.includes(campaign.status) && campaign.template && (
          <CampaignPreview campaignId={campaign.id} body={campaign.template.body} />
        )}

        <section
          aria-labelledby="recipients-title"
          className="flex flex-col gap-4 rounded-xl border border-hairline-dark bg-champagne p-4 sm:p-6"
        >
          <h2 id="recipients-title" className="font-heading text-lg text-charcoal">
            ספירת נמענים
          </h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="סה״כ בסגמנט" value={summary.total} />
            <Metric label="נמענים תקינים" value={summary.withConsent} />
            <Metric label="ללא הסכמה לדיוור" value={summary.excluded.noConsent} />
            <Metric label="מאורכבים" value={summary.excluded.archived} />
          </dl>
        </section>

        <section
          aria-labelledby="stats-title"
          className="flex flex-col gap-4 rounded-xl border border-hairline-dark bg-champagne p-4 sm:p-6"
        >
          <div className="flex flex-col gap-1">
            <h2 id="stats-title" className="font-heading text-lg text-charcoal">
              דוח קמפיין
            </h2>
            <p className="text-xs text-taupe">
              אחוזים מחושבים מתוך הנשלחים (או מתוך סך הנמענים לנכשלו). הזמנות נספרות בתוך {BOOKING_WINDOW_DAYS} יום מהשליחה.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {statCards.map((card) => (
              <div
                key={card.label}
                className="flex flex-col gap-1 rounded-lg bg-white p-3 shadow-sm"
              >
                <dt className="text-xs text-taupe">{card.label}</dt>
                <dd className="flex items-baseline gap-2">
                  <span className="font-heading text-2xl text-charcoal">{card.value}</span>
                  {card.percent !== null && (
                    <span className="text-sm text-taupe">({formatPercent(card.percent)})</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          aria-labelledby="messages-title"
          className="flex flex-col gap-4 rounded-xl border border-hairline-dark bg-champagne p-4 sm:p-6"
        >
          <h2 id="messages-title" className="font-heading text-lg text-charcoal">
            סטטוס לכל נמען/ת
          </h2>
          {messages.length === 0 ? (
            <p className="text-sm text-taupe">עדיין לא נשלחו הודעות לקמפיין זה.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-sm">
                <thead>
                  <tr className="border-b border-hairline-dark text-start text-taupe">
                    <th scope="col" className="py-2 pe-3 text-start font-medium">שם</th>
                    <th scope="col" className="py-2 pe-3 text-start font-medium">סטטוס</th>
                    <th scope="col" className="py-2 text-start font-medium">נשלחה</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((message) => (
                    <tr key={message.id} className="border-b border-hairline-dark/50 align-top">
                      <td className="py-2 pe-3 text-charcoal">
                        <bdi>
                          {message.client
                            ? `${message.client.firstName} ${message.client.lastName}`.trim()
                            : "—"}
                        </bdi>
                      </td>
                      <td className="py-2 pe-3">
                        <span className="text-charcoal">{messageStatusLabel(message.status)}</span>
                        {message.errorMessage && (
                          <span className="mt-0.5 block text-xs text-red-800">{message.errorMessage}</span>
                        )}
                      </td>
                      <td className="py-2 text-taupe">{formatDateTime(message.sentAt ?? message.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-white p-3 shadow-sm">
      <dt className="text-xs text-taupe">{label}</dt>
      <dd className="font-heading text-xl text-charcoal">{value}</dd>
    </div>
  );
}
