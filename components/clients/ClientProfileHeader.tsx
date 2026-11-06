/**
 * ClientProfileHeader — כותרת פרופיל לקוח (משימה 4.2, §4.1 כותרת).
 *
 * מציג: שם מלא, טלפון כקישור wa.me, גיל מחושב מתאריך לידה, מין, תגיות,
 * מקור הגעה וסטטוס הסכמה לדיוור.
 *
 * RTL, מותאם לנייד, עברית בלבד לפי הנחיית hebrew-ui.
 */

import { MessageCircle, Calendar, MapPin, Tag as TagIcon } from "lucide-react";

// טיפוסים מינימליים — תואמים לפלט של getClientById (כולל include תגיות)
export type ClientProfileHeaderData = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  gender: "female" | "male" | "other" | null;
  birthDate: Date | null;
  source: string;
  marketingConsentChannel:
    | "none"
    | "landing_page"
    | "whatsapp"
    | "sms"
    | "email"
    | "in_person";
  tags: { tag: { id: string; name: string } }[];
};

/** ממיר מספר ישראלי מקומי (05XXXXXXXX) לפורמט wa.me (972XXXXXXXXX). */
export function toWhatsAppLink(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, "");
  // אם כבר מתחיל ב-972 (פורמט בינלאומי) — השתמש ישירות
  if (digitsOnly.startsWith("972")) {
    return `https://wa.me/${digitsOnly}`;
  }
  // פורמט מקומי (מתחיל ב-0) — הסר את ה-0 המוביל, הוסף 972
  const withoutLeadingZero = digitsOnly.startsWith("0")
    ? digitsOnly.slice(1)
    : digitsOnly;
  return `https://wa.me/972${withoutLeadingZero}`;
}

/** מחשב גיל בשנים שלמות מתאריך לידה. מחזיר null אם לא סופק תאריך. */
export function computeAge(birthDate: Date | null): number | null {
  if (!birthDate) return null;
  const now = new Date();
  const birth = new Date(birthDate);
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

const GENDER_LABELS: Record<string, string> = {
  female: "נקבה",
  male: "זכר",
  other: "אחר",
};

const SOURCE_LABELS: Record<string, string> = {
  direct: "ישיר",
  landing_page: "דף נחיתה",
  instagram: "אינסטגרם",
  facebook: "פייסבוק",
  referral: "המלצה",
  google: "גוגל",
};

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

function consentLabel(
  channel: ClientProfileHeaderData["marketingConsentChannel"]
): { text: string; variant: "positive" | "negative" | "neutral" } {
  if (channel === "none") return { text: "לא צוין", variant: "neutral" };
  return { text: "כן", variant: "positive" };
}

type ConsentVariant = "positive" | "negative" | "neutral";

function consentBadgeClass(variant: ConsentVariant): string {
  if (variant === "positive")
    return "bg-success/15 text-success border-success/30";
  if (variant === "negative")
    return "bg-error/15 text-error border-error/30";
  return "bg-taupe/15 text-taupe border-taupe/30";
}

export function ClientProfileHeader({
  client,
}: {
  client: ClientProfileHeaderData;
}) {
  const age = computeAge(client.birthDate);
  const waLink = toWhatsAppLink(client.phone);
  const { text: consentText, variant: consentVariant } = consentLabel(
    client.marketingConsentChannel
  );

  return (
    <section
      dir="rtl"
      aria-label="פרטי לקוח"
      className="rounded-brand bg-white border border-gold-antique/40 p-5 sm:p-7 shadow-sm"
    >
      {/* שם מלא */}
      <h1 className="font-heading text-3xl sm:text-4xl text-charcoal mb-1 leading-snug">
        {client.firstName} {client.lastName}
      </h1>

      {/* גיל ומין */}
      <div className="flex flex-wrap items-center gap-2 mt-2 mb-4">
        {age !== null && (
          <span className="flex items-center gap-1 text-taupe text-sm">
            <Calendar className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              גיל <strong className="text-charcoal">{age}</strong>
            </span>
          </span>
        )}
        {age === null && (
          <span className="text-taupe text-sm">גיל: —</span>
        )}
        {client.gender && (
          <span className="inline-flex items-center rounded-full border border-taupe/40 px-2.5 py-0.5 text-xs font-normal text-taupe">
            {GENDER_LABELS[client.gender] ?? client.gender}
          </span>
        )}
      </div>

      {/* טלפון — קישור WhatsApp */}
      <div className="mb-4">
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`פתח שיחת WhatsApp עם ${client.firstName} ${client.lastName}`}
          className="inline-flex items-center gap-2 text-gold-dark hover:text-gold-deep transition-colors min-h-11 font-medium text-base"
        >
          <MessageCircle
            className="w-5 h-5 shrink-0 text-gold"
            aria-hidden="true"
          />
          <span dir="ltr">{client.phone}</span>
        </a>
      </div>

      {/* תגיות */}
      {client.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <TagIcon
            className="w-4 h-4 text-taupe shrink-0"
            aria-hidden="true"
          />
          {client.tags.map(({ tag }) => (
            <span
              key={tag.id}
              className="inline-flex items-center rounded-full border border-gold-antique/40 bg-gold/10 px-2.5 py-0.5 text-xs font-normal text-gold-dark"
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* מקור הגעה */}
      <div className="flex items-center gap-2 mb-3 text-sm">
        <MapPin className="w-4 h-4 text-taupe shrink-0" aria-hidden="true" />
        <span className="text-taupe">מקור הגעה:</span>
        <span className="text-charcoal font-medium">
          {sourceLabel(client.source)}
        </span>
      </div>

      {/* הסכמה לדיוור */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-taupe">הסכמה לדיוור:</span>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${consentBadgeClass(consentVariant)}`}
        >
          {consentText}
        </span>
      </div>
    </section>
  );
}
