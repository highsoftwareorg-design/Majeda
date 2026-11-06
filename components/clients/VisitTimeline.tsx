/**
 * VisitTimeline — ציר זמן ביקורים עבור פרופיל לקוח (משימה 4.4, §4.1).
 * משימה 4.8 (FR-PR-07): הצגת מצב "נעול לעריכה" ורשימת תיקונים לביקורים ישנים.
 *
 * Server Component (ללא "use client") — מקבל את הביקורים כ-prop ומציג אותם.
 * הרכיב VisitAmendmentForm (Client Component) מיובא להוספת תיקונים אינטראקטיבית.
 * RTL, עברית, mobile-responsive, עם קו ציר ימני בצבע זהב המותג.
 */

import type { ClientVisitWithTreatments } from "@/lib/db/visits";
import { VisitAmendmentForm } from "@/components/clients/VisitAmendmentForm";

/** האם הביקור נעול? (נוצר לפני יותר מ-24 שעות) */
function isLocked(createdAt: Date | string): boolean {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return new Date(createdAt) < twentyFourHoursAgo;
}

// פורמטר תאריך עברי — "5 בנובמבר 2026"
const hebrewDateFormatter = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

// פורמטר תאריך+שעה עברי עבור תיקונים
const hebrewDateTimeFormatter = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(date: Date | string): string {
  return hebrewDateFormatter.format(new Date(date));
}

function formatDateTime(date: Date | string): string {
  return hebrewDateTimeFormatter.format(new Date(date));
}

const FIELD_LABELS: Record<string, string> = {
  notes: "סיכום טיפול",
  clientReaction: "תוצאה / תגובת לקוחה",
};

// ----- רכיב כרטיס ביקור בודד -----

function VisitCard({
  visit,
  clientId,
}: {
  visit: ClientVisitWithTreatments;
  clientId: string;
}) {
  const treatmentNames = visit.visitTreatments
    .map((vt) => vt.treatment.name)
    .join(", ");

  const formattedDate = formatDate(visit.visitDate);
  const locked = isLocked(visit.createdAt);

  // קבץ תיקונים לפי שדה, לצורך הצגה מאורגנת
  const amendmentsByField: Record<string, typeof visit.amendments> = {};
  for (const a of visit.amendments) {
    if (!amendmentsByField[a.field]) amendmentsByField[a.field] = [];
    amendmentsByField[a.field].push(a);
  }

  return (
    <div className="relative flex gap-4">
      {/* עיגול ציר (נקודת ציר הזמן) */}
      <div
        className="relative z-10 mt-1 flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-gold ring-2 ring-champagne"
        aria-hidden="true"
      />

      {/* תוכן הכרטיס */}
      <article className="mb-6 flex-1 rounded-brand border border-hairline-light bg-porcelain p-4 shadow-sm">
        {/* תאריך */}
        <time
          dateTime={new Date(visit.visitDate).toISOString().slice(0, 10)}
          className="mb-2 block text-sm font-semibold text-gold-dark"
        >
          {formattedDate}
        </time>

        {/* שם/י הטיפול/ים */}
        {treatmentNames ? (
          <p className="text-base font-medium text-charcoal">
            {treatmentNames}
          </p>
        ) : null}

        {/* מטפל/ת */}
        {visit.therapist ? (
          <p className="mt-1 text-sm text-taupe">
            <span className="font-medium">מטפל/ת:</span> {visit.therapist}
          </p>
        ) : null}

        {/* אזור מטופל */}
        {visit.treatedArea ? (
          <p className="mt-1 text-sm text-taupe">
            <span className="font-medium">אזור:</span> {visit.treatedArea}
          </p>
        ) : null}

        {/* מוצרים ואצווה */}
        {visit.products ? (
          <p className="mt-1 text-sm text-taupe">
            <span className="font-medium">מוצרים:</span> {visit.products}
          </p>
        ) : null}

        {/* פרמטרים */}
        {visit.parameters ? (
          <p className="mt-1 text-sm text-taupe">
            <span className="font-medium">פרמטרים:</span> {visit.parameters}
          </p>
        ) : null}

        {/* מחיר */}
        {visit.price !== null && visit.price !== undefined ? (
          <p className="mt-1 text-sm text-taupe">
            <span className="font-medium">מחיר:</span>{" "}
            {Number(visit.price).toLocaleString("he-IL", {
              style: "currency",
              currency: "ILS",
              maximumFractionDigits: 0,
            })}
          </p>
        ) : null}

        {/* סיכום טיפול (FR-PR-03) — מוצג רק כאשר יש לפחות שדה אחד */}
        {(visit.notes || visit.clientReaction) ? (
          <div className="mt-3 rounded-brand border border-gold/20 bg-champagne/40 px-3 py-2.5">
            {/* כותרת + תווית נעול */}
            <div className="mb-1.5 flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gold-dark">
                סיכום טיפול
              </p>
              {locked && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-[#B26A00]/30 bg-[#B26A00]/10 px-2 py-0.5 text-[10px] font-medium text-[#B26A00]"
                  title="הסיכום נעול לעריכה ישירה. שינויים ייוצרו כתיקון נפרד."
                  role="img"
                  aria-label="נעול לעריכה ישירה"
                >
                  {/* אייקון מנעול */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3 w-3"
                    aria-hidden="true"
                  >
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  נעול לעריכה
                </span>
              )}
            </div>

            {/* סיכום חופשי — הסיכום המקורי */}
            {visit.notes ? (
              <p className="text-sm leading-relaxed text-charcoal/80 whitespace-pre-wrap">
                {visit.notes}
              </p>
            ) : null}

            {/* תוצאה / תגובת לקוחה */}
            {visit.clientReaction ? (
              <div className={visit.notes ? "mt-2 border-t border-gold/15 pt-2" : ""}>
                <p className="text-xs font-medium text-taupe">
                  תוצאה / תגובת לקוחה
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-charcoal/80 whitespace-pre-wrap">
                  {visit.clientReaction}
                </p>
              </div>
            ) : null}

            {/* תיקונים (amendments) — מוצגים לאחר הסיכום המקורי */}
            {visit.amendments.length > 0 && (
              <div className="mt-3 border-t border-gold/20 pt-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-taupe">
                  תיקונים שבוצעו
                </p>
                {visit.amendments.map((amendment) => (
                  <div
                    key={amendment.id}
                    className="rounded border border-gold/15 bg-white/60 px-3 py-2 text-xs"
                  >
                    {/* שורת מידע: שדה, מי ערך, מתי */}
                    <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-semibold text-gold-dark">
                        {FIELD_LABELS[amendment.field] ?? amendment.field}
                      </span>
                      <span className="text-taupe">
                        — ערך{" "}
                        <time dateTime={new Date(amendment.editedAt).toISOString()}>
                          {formatDateTime(amendment.editedAt)}
                        </time>
                      </span>
                      <span className="text-taupe">
                        על ידי {amendment.editedBy}
                      </span>
                    </div>

                    {/* ערך ישן */}
                    {amendment.oldValue !== null &&
                      amendment.oldValue !== undefined && (
                        <div className="mb-1">
                          <span className="text-taupe/80">לפני: </span>
                          <span className="text-charcoal/70 line-through whitespace-pre-wrap">
                            {amendment.oldValue}
                          </span>
                        </div>
                      )}

                    {/* ערך חדש */}
                    {amendment.newValue !== null &&
                      amendment.newValue !== undefined && (
                        <div>
                          <span className="text-taupe/80">אחרי: </span>
                          <span className="text-charcoal/80 whitespace-pre-wrap">
                            {amendment.newValue}
                          </span>
                        </div>
                      )}
                  </div>
                ))}
              </div>
            )}

            {/* כפתור "הוסף תיקון" — מוצג רק כאשר הביקור נעול */}
            {locked && (
              <VisitAmendmentForm
                clientId={clientId}
                visitId={visit.id}
                currentNotes={visit.notes}
                currentClientReaction={visit.clientReaction}
              />
            )}
          </div>
        ) : (
          /* אם אין עדיין סיכום אבל הביקור נעול — הצג כפתור תיקון בלבד */
          locked ? (
            <div className="mt-3 rounded-brand border border-gold/20 bg-champagne/40 px-3 py-2.5">
              <div className="mb-1.5 flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gold-dark">
                  סיכום טיפול
                </p>
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-[#B26A00]/30 bg-[#B26A00]/10 px-2 py-0.5 text-[10px] font-medium text-[#B26A00]"
                  role="img"
                  aria-label="נעול לעריכה ישירה"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3 w-3"
                    aria-hidden="true"
                  >
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  נעול לעריכה
                </span>
              </div>
              <p className="text-sm text-taupe">אין סיכום טיפול</p>
              <VisitAmendmentForm
                clientId={clientId}
                visitId={visit.id}
                currentNotes={visit.notes}
                currentClientReaction={visit.clientReaction}
              />
            </div>
          ) : null
        )}

        {/* מועד חזרה מוצע (FR-PR-05, משימה 4.7) */}
        {visit.returnDate ? (
          <div className="mt-3 flex items-center gap-2 rounded-brand border border-gold-dark/30 bg-gold/10 px-3 py-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 shrink-0 text-gold-dark"
              aria-hidden="true"
            >
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
              <path d="m9 16 2 2 4-4" />
            </svg>
            <p className="text-sm text-charcoal">
              <span className="font-medium text-gold-dark">מועד חזרה מוצע:</span>{" "}
              {formatDate(visit.returnDate)}
            </p>
          </div>
        ) : null}
      </article>
    </div>
  );
}

// ----- רכיב הציר הראשי -----

export type VisitTimelineProps = {
  visits: ClientVisitWithTreatments[];
  clientId: string;
};

export function VisitTimeline({ visits, clientId }: VisitTimelineProps) {
  // מצב ריק — אין ביקורים
  if (visits.length === 0) {
    return (
      <div
        dir="rtl"
        lang="he"
        className="rounded-brand border border-dashed border-hairline-light px-6 py-10 text-center"
        aria-label="אין ביקורים"
      >
        <p className="text-sm text-taupe">אין ביקורים עדיין</p>
      </div>
    );
  }

  return (
    <div dir="rtl" lang="he">
      {/*
       * קו ציר זמן אנכי בצד ימין (start ב-RTL):
       * המיכל הוא relative; הקו הוא absolute start-[5px] (מרכז העיגול 6px)
       * ונמשך לאורך כל הציר.
       */}
      <div className="relative ps-7">
        {/* קו הציר — border-s-2 (logical: צד ימין ב-RTL) */}
        <div
          className="pointer-events-none absolute inset-y-0 start-[5px] border-s-2 border-gold/40"
          aria-hidden="true"
        />

        {visits.map((visit) => (
          <VisitCard key={visit.id} visit={visit} clientId={clientId} />
        ))}
      </div>
    </div>
  );
}
