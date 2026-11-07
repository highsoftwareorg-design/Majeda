/**
 * סטטוסי קמפיין — תוויות בעברית וצבעי תגית (משימה 9.1, FR-MK-01).
 *
 * DRAFT (טיוטה, אפור) | SCHEDULED (מתוזמן, כחול) | SENDING (בשליחה, צהוב)
 * | SENT (נשלח, ירוק) | CANCELLED (בוטל, אדום).
 *
 * צבעי הטקסט עומדים ב-WCAG AA (טקסט כהה על רקע בהיר).
 */

export const CAMPAIGN_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "SENDING",
  "SENT",
  "CANCELLED",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: "טיוטה",
  SCHEDULED: "מתוזמן",
  SENDING: "בשליחה",
  SENT: "נשלח",
  CANCELLED: "בוטל",
};

export const CAMPAIGN_STATUS_CLASSES: Record<CampaignStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-800 ring-gray-300",
  SCHEDULED: "bg-blue-50 text-blue-800 ring-blue-300",
  SENDING: "bg-yellow-50 text-yellow-900 ring-yellow-400",
  SENT: "bg-green-50 text-green-800 ring-green-300",
  CANCELLED: "bg-red-50 text-red-800 ring-red-300",
};

/** תווית בעברית לסטטוס; ערך לא מוכר מוצג כמות שהוא */
export function campaignStatusLabel(status: string): string {
  return (CAMPAIGN_STATUS_LABELS as Record<string, string>)[status] ?? status;
}

/** מחלקות צבע לתגית סטטוס; ברירת מחדל אפורה לערך לא מוכר */
export function campaignStatusClasses(status: string): string {
  return (
    (CAMPAIGN_STATUS_CLASSES as Record<string, string>)[status] ??
    CAMPAIGN_STATUS_CLASSES.DRAFT
  );
}
