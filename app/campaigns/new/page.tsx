/**
 * מסך יצירת קמפיין WhatsApp חדש — 3 שלבים (משימה 9.2, FR-MK-01, FR-MK-07).
 *
 * נתיב: /campaigns/new
 * הרשאות: מוגן ב-middleware.ts (דרשה כניסה).
 *
 * Server wrapper: קורא את התעריף מ-WHATSAPP_COST_PER_MESSAGE_ILS בצד השרת
 * ומעביר אותו ל-CampaignForm (Client Component) — כך משתנה הסביבה אינו נחשף לדפדפן.
 */

import { connection } from "next/server";
import { CampaignForm } from "@/components/campaigns/CampaignForm";

export const metadata = {
  title: "קמפיין חדש | MAJIDA Beauté",
};

const DEFAULT_COST_PER_MESSAGE_ILS = 0.37;

function readCostPerMessage(): number {
  const raw = Number(process.env.WHATSAPP_COST_PER_MESSAGE_ILS);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_COST_PER_MESSAGE_ILS;
}

export default async function NewCampaignPage() {
  // מאלץ הרצה ב-request time (לא prerender סטטי)
  await connection();

  return (
    <main dir="rtl" lang="he" className="min-h-screen bg-champagne p-4 sm:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header>
          <h1 className="font-heading text-2xl text-charcoal">קמפיין חדש</h1>
          <p className="mt-1 text-sm text-taupe">
            יצירת קמפיין WhatsApp שיווקי לסגמנט נבחר. הקמפיין יישמר כטיוטה.
          </p>
        </header>

        <div className="rounded-xl border border-hairline-dark bg-champagne p-4 sm:p-6">
          <CampaignForm costPerMessageIls={readCostPerMessage()} />
        </div>
      </div>
    </main>
  );
}
