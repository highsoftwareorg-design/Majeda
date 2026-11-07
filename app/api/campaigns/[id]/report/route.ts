/**
 * דוח קמפיין (משימה 9.6, FR-MK-06).
 *
 * GET /api/campaigns/:id/report
 *   → { campaign, stats: { total, sent, delivered, read, failed, booked }, messages }
 */

import { NextResponse } from "next/server";
import { getCampaignReport } from "@/lib/campaigns/report";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const report = await getCampaignReport(id);
  if (!report) {
    return NextResponse.json({ error: "קמפיין לא נמצא" }, { status: 404 });
  }
  return NextResponse.json(report);
}
