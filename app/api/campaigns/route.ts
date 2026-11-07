/**
 * API קמפיינים WhatsApp — רשימה ויצירה (משימה 9.1, FR-MK-01, §12.1 Campaign).
 *
 * GET  /api/campaigns — רשימת כל הקמפיינים (ממוינת לפי תאריך יצירה יורד)
 * POST /api/campaigns — יצירת קמפיין חדש בסטטוס DRAFT
 *
 * הערה (פרטיות — §11): אין להדפיס ללוג תוכן הקמפיין או פרטי נמענים.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { parseCampaignInput } from "@/lib/campaigns/validation";

/** GET /api/campaigns — רשימת קמפיינים */
export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      segment: { select: { id: true, name: true } },
      template: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ campaigns });
}

/** POST /api/campaigns — יצירת קמפיין חדש (סטטוס DRAFT) */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו JSON תקין" }, { status: 400 });
  }

  const parsed = parseCampaignInput(body, "create");
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const data = parsed.data;

  // בדיקת קיום סגמנט/תבנית (מזהים לא קיימים יחזירו 400 במקום שגיאת FK)
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
    const campaign = await prisma.campaign.create({
      data: {
        name: data.name!,
        segmentId: data.segmentId ?? null,
        templateId: data.templateId ?? null,
        mediaUrl: data.mediaUrl ?? null,
        linkButtonUrl: data.linkButtonUrl ?? null,
        linkButtonText: data.linkButtonText ?? null,
        scheduledAt: data.scheduledAt ?? null,
        status: "DRAFT",
      },
      include: {
        segment: { select: { id: true, name: true } },
        template: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ campaign }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "אירעה שגיאה ביצירת הקמפיין" }, { status: 500 });
  }
}
