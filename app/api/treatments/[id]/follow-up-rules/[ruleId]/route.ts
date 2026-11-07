/**
 * DELETE /api/treatments/:id/follow-up-rules/:ruleId — מחיקה רכה של כלל מעקב (משימה 8.2).
 *
 * לא מוחקים פיזית: FollowUp קיים עשוי להפנות לכלל (ruleId), ולכן רק מסמנים isActive=false.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

type RouteParams = { params: Promise<{ id: string; ruleId: string }> };

/** DELETE /api/treatments/:id/follow-up-rules/:ruleId */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id, ruleId } = await params;

  const rule = await prisma.followUpRule.findFirst({
    where: { id: ruleId, treatmentId: id },
    select: { id: true },
  });
  if (!rule) {
    return NextResponse.json({ error: "כלל מעקב לא נמצא" }, { status: 404 });
  }

  try {
    await prisma.followUpRule.update({
      where: { id: ruleId },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/treatments/:id/follow-up-rules/:ruleId]", err);
    return NextResponse.json(
      { error: "שגיאה במחיקת כלל המעקב — נסה שוב" },
      { status: 500 }
    );
  }
}
