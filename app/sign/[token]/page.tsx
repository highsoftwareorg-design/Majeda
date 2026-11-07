/**
 * עמוד חתימה על טופס הסכמה (משימה 7.6, FR-CF-04, FR-CF-05).
 *
 * עמוד ציבורי (ללא צורך בהתחברות) שמציג את טופס ההסכמה לחתימה דיגיטלית.
 * הגישה מאובטחת בטוקן חד-פעמי שנשלח ללקוח/ה דרך WhatsApp (משימה 7.4).
 *
 * Server Component — SSR לאימות הטוקן ולשליפת נתונים.
 * הטיפול בחתימה עצמה (שמירה, PDF, audit) — משימה 7.7.
 */

import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { SignConsentForm } from "@/components/consent/SignConsentForm";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const dynamic = "force-dynamic";

export default async function SigningPage({ params }: PageProps) {
  const { token } = await params;

  // שליפת רשומת ה-SignedConsent לפי הטוקן
  const consent = await prisma.signedConsent.findUnique({
    where: { signingToken: token },
    include: {
      client: {
        select: {
          firstName: true,
          lastName: true,
          birthDate: true,
          phone: true,
        },
      },
      template: true,
      appointment: {
        include: {
          treatment: true,
        },
      },
    },
  });

  // טוקן לא קיים
  if (!consent) return notFound();

  // הטופס כבר נחתם
  if (consent.signedAt) {
    return (
      <div
        dir="rtl"
        className="min-h-screen flex items-center justify-center p-6 bg-gray-50"
      >
        <div className="text-center bg-white rounded-xl shadow-sm border border-gray-200 p-10 max-w-md w-full">
          <div
            className="text-green-500 text-6xl mb-4"
            aria-hidden="true"
          >
            ✓
          </div>
          <h1 className="text-2xl font-bold text-green-700 mb-2">
            הטופס כבר נחתם
          </h1>
          <p className="text-gray-600">
            תודה! חתימתך נשמרה בהצלחה.
          </p>
          <p className="text-sm text-gray-400 mt-4">
            ניתן לסגור דף זה.
          </p>
        </div>
      </div>
    );
  }

  // הטוקן פג תוקף
  if (
    consent.signingTokenExpiresAt &&
    consent.signingTokenExpiresAt < new Date()
  ) {
    return (
      <div
        dir="rtl"
        className="min-h-screen flex items-center justify-center p-6 bg-gray-50"
      >
        <div className="text-center bg-white rounded-xl shadow-sm border border-gray-200 p-10 max-w-md w-full">
          <div
            className="text-red-400 text-6xl mb-4"
            aria-hidden="true"
          >
            ⏱
          </div>
          <h1 className="text-2xl font-bold text-red-700 mb-2">
            הקישור פג תוקף
          </h1>
          <p className="text-gray-600">
            קישור החתימה תקף ל-72 שעות בלבד.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            יש לפנות לקליניקה לקבלת קישור חדש.
          </p>
        </div>
      </div>
    );
  }

  // חישוב שם לקוח/ה וגיל
  const clientName =
    `${consent.client.firstName} ${consent.client.lastName}`.trim();

  const isMinor = (() => {
    const bd = consent.client.birthDate;
    if (!bd) return false;
    const today = new Date();
    const age =
      today.getFullYear() -
      bd.getFullYear() -
      (today <
      new Date(today.getFullYear(), bd.getMonth(), bd.getDate())
        ? 1
        : 0);
    return age < 18;
  })();

  // שדות הטופס מה-JSON (נשמרו בתבנית)
  // JSON מ-Prisma מוחזר כ-JsonValue — ה-cast בטוח כי ConsentTemplateEditor שומר בדיוק
  // את המבנה הזה (id, type, label, required) ב-7.2.
  const rawFields = Array.isArray(consent.template.fields)
    ? (consent.template.fields as unknown[])
    : [];

  const fields = rawFields
    .filter(
      (f): f is { id: string; type: "text" | "boolean" | "checkbox" | "signature"; label: string; required?: boolean } =>
        typeof f === "object" &&
        f !== null &&
        typeof (f as Record<string, unknown>).id === "string" &&
        typeof (f as Record<string, unknown>).type === "string" &&
        typeof (f as Record<string, unknown>).label === "string"
    );

  const treatmentName =
    consent.appointment?.treatment?.name ?? null;

  const appointmentTime =
    consent.appointment?.startTime?.toISOString() ?? null;

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gray-50 py-10 px-4"
    >
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        {/* כותרת */}
        <header className="text-center">
          {/* לוגו מינימלי */}
          <p className="text-sm text-gray-400 mb-1 font-medium tracking-wide uppercase">
            MAJIDA Beauté Center
          </p>
          <h1 className="text-2xl font-bold font-[var(--font-heading)] text-gray-900">
            {consent.template.name}
          </h1>
          {consent.template.isGeneral ? null : (
            <p className="text-sm text-gray-500 mt-1">
              טופס הסכמה לטיפול
            </p>
          )}
        </header>

        {/* הוראות */}
        <div
          className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800"
          role="note"
        >
          אנא קרא/י את תוכן הטופס בעיון, מלא/י את השדות הנדרשים
          וחתמ/י בתחתית.
        </div>

        {/* טופס החתימה */}
        <SignConsentForm
          token={token}
          signedConsentId={consent.id}
          clientName={clientName}
          isMinor={isMinor}
          fields={fields}
          treatmentName={treatmentName}
          signedAt={appointmentTime}
        />

        {/* footer */}
        <footer className="text-center text-xs text-gray-400 pb-6">
          מסמך זה נחתם דיגיטלית ומאובטח. פנייה לקליניקה לכל שאלה.
        </footer>
      </div>
    </div>
  );
}
