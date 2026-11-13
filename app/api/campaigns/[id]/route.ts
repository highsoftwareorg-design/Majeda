/**
 * API קמפיין בודד (משימה 9.1, FR-MK-01).
 *
 * GET    /api/campaigns/:id — שליפת קמפיין בודד
 * PATCH  /api/campaigns/:id — עדכון שדות (רק בסטטוס DRAFT או SCHEDULED)
 * DELETE /api/campaigns/:id — ביטול קמפיין (status=CANCELLED; ללא מחיקה פיזית)
 *
 * שינוי סטטוס ל-SENDING/SENT מתבצע אך ורק על ידי מנגנון השליחה (משימה 9.5) — לא דרך PATCH.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { parseCampaignInput } from "@/lib/campaigns/validation";

type RouteParams = { params: Promise<{ id: string }> };

/** סטטוסים שבהם מותר לערוך קמפיין */
const EDITABLE_STATUSES = ["DRAFT", "SCHEDULED"];
/** סטטוסים שבהם מותר לבטל קמפיין */
const CANCELLABLE_STATUSES = ["DRAFT", "SCHEDULED"];

const campaignInclude = {
  segment: { select: { id: true, name: true } },
  template: { select: { id: true, name: true } },
} as const;

/** GET /api/campaigns/:id */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });

  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: campaignInclude,
  });
  if (!campaign) {
    return NextResponse.json({ error: "קמפיין לא נמצא" }, { status: 404 });
  }
  return NextResponse.json({ campaign });
}

/** PATCH /api/campaigns/:id — עדכון חלקי */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "קמפיין לא נמצא" }, { status: 404 });
  }
  if (!EDITABLE_STATUSES.includes(existing.status)) {
    return NextResponse.json(
      { error: "לא ניתן לערוך קמפיין שכבר נשלח או בוטל" },
      { status: 409 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו JSON תקין" }, { status: 400 });
  }

  const parsed = parseCampaignInput(body, "update");
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const data = parsed.data;

  if (data.segmentId) {
    const segment = await prisma.segment.findUnique({
      where: { id: data.segmentId },
      select: { id: true },
    });
    if (!segment) {
      return NextResponse.json({ error: "הסגמנט שנבחר לא נמצא" }, { status: 400 });
    }
  }
  if (data.templateId) {
    const template = await prisma.whatsAppTemplate.findUnique({
      where: { id: data.templateId },
      select: { id: true },
    });
    if (!template) {
      return NextResponse.json({ error: "התבנית שנבחרה לא נמצאה" }, { status: 400 });
    }
  }

  try {
    const campaign = await prisma.campaign.update({
      where: { id },
      data,
      include: campaignInclude,
    });
    return NextResponse.json({ campaign });
  } catch {
    return NextResponse.json({ error: "אירעה שגיאה בעדכון הקמפיין" }, { status: 500 });
  }
}

/** DELETE /api/campaigns/:id — ביטול (status=CANCELLED) */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "קמפיין לא נמצא" }, { status: 404 });
  }
  // ביטול חוזר של קמפיין שכבר מבוטל — אידמפוטנטי
  if (existing.status === "CANCELLED") {
    return NextResponse.json({ success: true, status: "CANCELLED" });
  }
  if (!CANCELLABLE_STATUSES.includes(existing.status)) {
    return NextResponse.json(
      { error: "לא ניתן לבטל קמפיין שנמצא בשליחה או שכבר נשלח" },
      { status: 409 }
    );
  }

  try {
    const campaign = await prisma.campaign.update({
      where: { id },
      data: { status: "CANCELLED" },
      select: { id: true, status: true },
    });
    return NextResponse.json({ success: true, status: campaign.status });
  } catch {
    return NextResponse.json({ error: "אירעה שגיאה בביטול הקמפיין" }, { status: 500 });
  }
}
