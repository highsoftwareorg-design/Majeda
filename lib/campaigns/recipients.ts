/**
 * lib/campaigns/recipients.ts
 * Tasks 9.4 / 9.5 — חישוב נמענים לקמפיין (FR-MK-03, FR-MK-04).
 *
 * הנמענים = לקוחות שמתאימים לפילטר הסגמנט של הקמפיין, ואז מסוננים:
 *   - status = active (לקוחות מאורכבים מוחרגים — excluded.archived)
 *   - marketingConsentChannel != none (ללא הסכמה לדיוור — excluded.noConsent)
 *   - phone != null (השדה חובה בסכמה; הבדיקה נשארת כהגנה)
 *
 * הערה (פרטיות — §11): אין להדפיס ללוג רשימות נמענים או מספרי טלפון.
 */

import { prisma } from "@/lib/db/prisma";
import { listClients } from "@/lib/db/clients";

type ListClientsOptions = NonNullable<Parameters<typeof listClients>[0]>;

/** לקוח/ה שעומד/ת בכל התנאים לשליחת קמפיין שיווקי */
export interface CampaignRecipient {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface RecipientSummary {
  /** כל הלקוחות שמתאימים לפילטר הסגמנט (כולל מאורכבים ללא הסכמה) */
  total: number;
  /** נמענים תקינים — active + הסכמה + טלפון */
  withConsent: number;
  excluded: {
    noConsent: number;
    archived: number;
  };
}

export interface SegmentRecipients {
  summary: RecipientSummary;
  eligible: CampaignRecipient[];
}

/**
 * טוען את כל הלקוחות שמתאימים לפילטר הסגמנט ומחשב את הסיכום והנמענים התקינים.
 * segmentId = null/לא קיים → אין קהל יעד → כל הספירות אפס.
 */
export async function getSegmentRecipients(
  segmentId: string | null | undefined
): Promise<SegmentRecipients> {
  const empty: SegmentRecipients = {
    summary: { total: 0, withConsent: 0, excluded: { noConsent: 0, archived: 0 } },
    eligible: [],
  };
  if (!segmentId) return empty;

  const segment = await prisma.segment.findUnique({
    where: { id: segmentId },
    select: { filters: true },
  });
  if (!segment) return empty;

  // includeArchived=true כדי לספור גם מאורכבים (לצורך excluded.archived)
  const options = {
    ...((segment.filters ?? {}) as object),
    includeArchived: true,
  } as ListClientsOptions;
  const clients = await listClients(options);

  const eligible: CampaignRecipient[] = [];
  let noConsent = 0;
  let archived = 0;

  for (const client of clients) {
    if (client.status === "archived") {
      archived += 1;
      continue;
    }
    if (client.marketingConsentChannel === "none") {
      noConsent += 1;
      continue;
    }
    if (!client.phone) continue;
    eligible.push({
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      phone: client.phone,
    });
  }

  return {
    summary: {
      total: clients.length,
      withConsent: eligible.length,
      excluded: { noConsent, archived },
    },
    eligible,
  };
}

/** סיכום ספירת נמענים לקמפיין נתון (לנתיב ה-GET וללוח הבקרה) */
export async function getCampaignRecipientSummary(
  campaignId: string
): Promise<RecipientSummary | null> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { segmentId: true },
  });
  if (!campaign) return null;
  const { summary } = await getSegmentRecipients(campaign.segmentId);
  return summary;
}
