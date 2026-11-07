/**
 * ConsentList — רשימת טפסי הסכמה חתומים בפרופיל הלקוח (task 7.9, FR-PR-08).
 *
 * Server Component — מקבל מערך ConsentItem כ-props ומציג טבלה RTL-first.
 * במובייל מוצגות כרטיסים (cards) במקום שורות טבלה כדי לשמור על קריאות.
 *
 * Hebrew, RTL, mobile-responsive — לפי הנחיית hebrew-ui.
 */

import { FileText, Download, AlertCircle } from 'lucide-react';

export type ConsentStatus = 'בתוקף' | 'פג תוקף' | 'ממתין לחתימה';

export interface ConsentItem {
  id: string;
  templateName: string;
  templateVersion: number;
  signedAt: string | null;
  expiresAt: string | null;
  pdfStorageKey: string | null;
  status: ConsentStatus;
}

interface ConsentListProps {
  consents: ConsentItem[];
}

const STATUS_STYLES: Record<
  ConsentStatus,
  { badge: string; label: string }
> = {
  'בתוקף': {
    badge:
      'inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800',
    label: 'בתוקף',
  },
  'פג תוקף': {
    badge:
      'inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800',
    label: 'פג תוקף',
  },
  'ממתין לחתימה': {
    badge:
      'inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800',
    label: 'ממתין לחתימה',
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function ConsentList({ consents }: ConsentListProps) {
  if (consents.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <FileText className="h-10 w-10 text-gold/30" aria-hidden="true" />
        <p className="text-sm font-medium text-taupe">אין טפסי הסכמה עדיין</p>
      </div>
    );
  }

  return (
    <div dir="rtl">
      {/* תצוגת טבלה — מסכים גדולים */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm text-right" aria-label="טפסי הסכמה">
          <thead>
            <tr className="border-b border-gold/20 text-xs text-taupe uppercase tracking-wide">
              <th scope="col" className="py-3 pe-4 font-semibold">
                שם הטופס
              </th>
              <th scope="col" className="py-3 pe-4 font-semibold">
                גרסה
              </th>
              <th scope="col" className="py-3 pe-4 font-semibold">
                תאריך חתימה
              </th>
              <th scope="col" className="py-3 pe-4 font-semibold">
                תפוגה
              </th>
              <th scope="col" className="py-3 pe-4 font-semibold">
                סטטוס
              </th>
              <th scope="col" className="py-3 font-semibold">
                הורדה
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gold/10">
            {consents.map((c) => {
              const st = STATUS_STYLES[c.status];
              return (
                <tr key={c.id} className="hover:bg-champagne/30 transition-colors">
                  <td className="py-3 pe-4 font-medium text-charcoal">
                    {c.templateName}
                  </td>
                  <td className="py-3 pe-4 text-taupe">v{c.templateVersion}</td>
                  <td className="py-3 pe-4 text-taupe">{formatDate(c.signedAt)}</td>
                  <td className="py-3 pe-4 text-taupe">{formatDate(c.expiresAt)}</td>
                  <td className="py-3 pe-4">
                    <span className={st.badge}>{st.label}</span>
                  </td>
                  <td className="py-3">
                    {c.pdfStorageKey ? (
                      <a
                        href={`/api/consent-tokens/${c.id}/pdf`}
                        className="inline-flex items-center gap-1 text-gold-dark hover:text-gold-deep underline text-xs min-h-[44px] leading-none py-3"
                        aria-label={`הורד PDF של ${c.templateName}`}
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>הורד PDF</span>
                      </a>
                    ) : (
                      <span className="text-taupe/50 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* תצוגת כרטיסים — מסכי נייד */}
      <div className="sm:hidden space-y-3">
        {consents.map((c) => {
          const st = STATUS_STYLES[c.status];
          return (
            <div
              key={c.id}
              className="rounded-brand border border-gold/20 bg-champagne/20 p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="font-medium text-charcoal text-sm leading-tight">
                  {c.templateName}
                </span>
                <span className={st.badge}>{st.label}</span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-taupe">
                <dt className="font-medium text-charcoal/70">גרסה</dt>
                <dd>v{c.templateVersion}</dd>
                <dt className="font-medium text-charcoal/70">חתימה</dt>
                <dd>{formatDate(c.signedAt)}</dd>
                <dt className="font-medium text-charcoal/70">תפוגה</dt>
                <dd>{formatDate(c.expiresAt)}</dd>
              </dl>
              {c.pdfStorageKey && (
                <a
                  href={`/api/consent-tokens/${c.id}/pdf`}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-gold-dark hover:text-gold-deep underline min-h-[44px] leading-none py-3"
                  aria-label={`הורד PDF של ${c.templateName}`}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>הורד PDF</span>
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * ConsentMissingWarning — פס אזהרה כתום על טופס הסכמה חסר (task 7.9, FR-CF-09).
 *
 * מוצג בראש פרופיל הלקוח כאשר יש תור מתוכנן שמחייב טופס הסכמה
 * אך לא קיים טופס חתום בתוקף.
 */
export function ConsentMissingWarning({ treatmentNames }: { treatmentNames: string[] }) {
  if (treatmentNames.length === 0) return null;

  return (
    <div
      role="alert"
      dir="rtl"
      className="flex items-start gap-2.5 rounded-brand border border-orange-300 bg-orange-50 px-4 py-3 text-sm"
      aria-label="אזהרה: טופס הסכמה חסר"
    >
      <AlertCircle
        className="mt-0.5 h-4 w-4 shrink-0 text-orange-600"
        aria-hidden="true"
      />
      <div className="space-y-1">
        {treatmentNames.map((name) => (
          <p key={name} className="text-orange-800 font-medium leading-snug">
            לקוח/ה חסר/ה טופס הסכמה לטיפול{' '}
            <strong className="font-semibold">{name}</strong>
          </p>
        ))}
      </div>
    </div>
  );
}
