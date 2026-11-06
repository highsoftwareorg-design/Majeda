/**
 * API סגמנט בודד — מחיקה (משימה 3.11, FR-CL-09).
 *
 * DELETE /api/segments/[id] — מחיקת סגמנט לפי מזהה.
 * הסגמנט נמחק לצמיתות (אין soft-delete — פילטרים שמורים אינם נתוני PII).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "מזהה סגמנט חסר" }, { status: 400 });
  }

  try {
    await prisma.segment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    // Prisma P2025 = רשומה לא נמצאה
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "הסגמנט לא נמצא" }, { status: 404 });
    }
    return NextResponse.json({ error: "שגיאה פנימית — נא לנסות שוב" }, { status: 500 });
  }
}
