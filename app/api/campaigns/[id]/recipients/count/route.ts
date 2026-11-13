/**
 * ספירת נמענים לקמפיין (משימה 9.4, FR-MK-03).
 *
 * GET /api/campaigns/:id/recipients/count
 *   → { total, withConsent, excluded: { noConsent, archived } }
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getCampaignRecipientSummary } from "@/lib/campaigns/recipients";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });

  const { id } = await params;

  const summary = await getCampaignRecipientSummary(id);
  if (!summary) {
    return NextResponse.json({ error: "קמפיין לא נמצא" }, { status: 404 });
  }
  return NextResponse.json(summary);
}
