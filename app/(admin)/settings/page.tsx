/**
 * מסך הגדרות מרפאה — שעות פעילות (משימה 5.7, FR-AP-05).
 *
 * Server Component: שולף הגדרות נוכחיות מה-DB ומעביר לטופס.
 * הרשאות: מוגן ב-middleware.ts (דרשה כניסה).
 */

import Link from "next/link";
import { connection } from "next/server";
import { getClinicSettings } from "@/lib/db/clinicSettings";
import { ClinicSettingsForm } from "@/components/settings/ClinicSettingsForm";

export const metadata = {
  title: "הגדרות מרפאה | MAJIDA Beauté",
};

export default async function SettingsPage() {
  await connection();
  const settings = await getClinicSettings();

  return (
    <div>
      <div className="mx-auto max-w-xl">
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-medium text-charcoal">
            הגדרות מרפאה
          </h1>
          <p className="mt-1 text-sm text-taupe">
            הגדרות שעות פעילות גלובליות — חלות על כל מסך היומן
          </p>
          <Link
            href="/settings/templates"
            className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-gold-dark underline-offset-2 hover:underline"
          >
            תבניות הודעות WhatsApp
          </Link>
        </div>

        <ClinicSettingsForm initialSettings={settings} />
      </div>
    </div>
  );
}
