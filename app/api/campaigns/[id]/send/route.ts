/**
 * הפעלת שליחת קמפיין (משימה 9.5, FR-MK-04, FR-MK-05).
 *
 * POST /api/campaigns/:id/send
 *   Body (אופציונלי): { scheduledAt?: string } — תאריך ISO.
 *   - scheduledAt בעתיד → status=SCHEDULED (הפעלה בפועל ע"י processCampaigns ב-cron)
 *   - אחרת (או ללא scheduledAt) → status=SENDING ו-sentAt=now (נשלח בסבב ה-cron הבא)
 *
 * השליחה עצמה מתבצעת ב-lib/campaigns/sender.ts דרך handler ה-cron המאוחד.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";

type RouteParams = { params: Promise<{ id: string }> };

/** סטטוסים שממנו מותר להפעיל שליחה */
const SENDABLE_STATUSES = ["DRAFT", "SCHEDULED"];

export async function POST(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });

  const { id } = await params;

  // גוף ריק מותר (שליחה מיידית)
  let body: Record<string, unknown> = {};
  const raw = await request.text();
  if (raw.trim() !== "") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ error: "גוף הבקשה אינו תקין" }, { status: 400 });
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "גוף הבקשה אינו JSON תקין" }, { status: 400 });
    }
  }

  let scheduledAt: Date | null = null;
  if (body.scheduledAt !== undefined && body.scheduledAt !== null && body.scheduledAt !== "") {
    if (typeof body.scheduledAt !== "string") {
      return NextResponse.json({ error: "מועד התזמון חייב להיות תאריך תקין" }, { status: 400 });
    }
    const parsedDate = new Date(body.scheduledAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "מועד התזמון חייב להיות תאריך תקין" }, { status: 400 });
    }
    scheduledAt = parsedDate;
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, status: true, segmentId: true, templateId: true },
  });
  if (!campaign) {
    return NextResponse.json({ error: "קמפיין לא נמצא" }, { status: 404 });
  }
  if (!SENDABLE_STATUSES.includes(campaign.status)) {
    return NextResponse.json(
      { error: "ניתן להפעיל שליחה רק לקמפיין בטיוטה או מתוזמן" },
      { status: 409 }
    );
  }
  if (!campaign.segmentId || !campaign.templateId) {
    return NextResponse.json(
      { error: "יש לבחור סגמנט ותבנית לפני השליחה" },
      { status: 400 }
    );
  }

  const now = new Date();
  const isFuture = scheduledAt !== null && scheduledAt.getTime() > now.getTime();

  try {
    const updated = await prisma.campaign.update({
      where: { id },
      data: isFuture
        ? { status: "SCHEDULED", scheduledAt }
        : { status: "SENDING", scheduledAt: null, sentAt: now },
      select: { id: true, status: true, scheduledAt: true, sentAt: true },
    });
    return NextResponse.json({ campaign: updated });
  } catch {
    return NextResponse.json({ error: "אירעה שגיאה בהפעלת השליחה" }, { status: 500 });
  }
}
