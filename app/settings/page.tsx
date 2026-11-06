/**
 * מסך הגדרות מרפאה — שעות פעילות (משימה 5.7, FR-AP-05).
 *
 * Server Component: שולף הגדרות נוכחיות מה-DB ומעביר לטופס.
 * הרשאות: מוגן ב-middleware.ts (דרשה כניסה).
 */

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
    <main
      dir="rtl"
      lang="he"
      className="min-h-screen bg-champagne px-4 py-8 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-xl">
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-medium text-charcoal">
            הגדרות מרפאה
          </h1>
          <p className="mt-1 text-sm text-taupe">
            הגדרות שעות פעילות גלובליות — חלות על כל מסך היומן
          </p>
        </div>

        <ClinicSettingsForm initialSettings={settings} />
      </div>
    </main>
  );
}
