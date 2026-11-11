/**
 * מסך רשימת קמפיינים WhatsApp (משימה 9.1, FR-MK-01).
 *
 * Server Component: שולף את כל הקמפיינים מה-DB ומציג טבלה עם סטטוס בצבע.
 * נתיב: /campaigns
 * הרשאות: מוגן ב-middleware.ts (דרשה כניסה).
 */

import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { Button } from "@/components/ui/button";
import {
  campaignStatusClasses,
  campaignStatusLabel,
} from "@/lib/campaigns/status";

export const metadata = {
  title: "קמפיינים | MAJIDA Beauté",
};

const dateTimeFormatter = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function CampaignsPage() {
  // מאלץ הרצה ב-request time (לא prerender סטטי)
  await connection();

  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      scheduledAt: true,
      recipientCount: true,
    },
  });

  return (
    <div>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl text-charcoal">קמפיינים</h1>
            <p className="mt-1 text-sm text-taupe">
              קמפייני WhatsApp שיווקיים — טיוטות, מתוזמנים ושנשלחו.
            </p>
          </div>
          <Button
            asChild
            className="min-h-[44px] shrink-0 bg-gold text-ink hover:bg-gold-dark"
          >
            <Link href="/campaigns/new">צור קמפיין חדש</Link>
          </Button>
        </header>

        {campaigns.length === 0 ? (
          <div className="rounded-xl border border-hairline-dark bg-white px-6 py-12 text-center">
            <p className="text-taupe">אין קמפיינים עדיין.</p>
            <p className="mt-1 text-sm text-taupe">
              לחצי על &quot;צור קמפיין חדש&quot; כדי להתחיל.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-hairline-dark bg-white">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-sand text-right text-charcoal">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">שם הקמפיין</th>
                  <th scope="col" className="px-4 py-3 font-medium">סטטוס</th>
                  <th scope="col" className="px-4 py-3 font-medium">מועד תזמון</th>
                  <th scope="col" className="px-4 py-3 font-medium">מספר נמענים</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline-dark">
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="text-charcoal">
                    <td className="px-4 py-3 font-medium">{campaign.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${campaignStatusClasses(campaign.status)}`}
                      >
                        {campaignStatusLabel(campaign.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-taupe">
                      {campaign.scheduledAt
                        ? dateTimeFormatter.format(campaign.scheduledAt)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-taupe">
                      {campaign.recipientCount ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
