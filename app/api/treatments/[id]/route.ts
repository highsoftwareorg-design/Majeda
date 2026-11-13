/**
 * API טיפול בודד — עדכון (משימה 11.7, FR-AP-02) ומחיקה לצמיתות (משימה 12.3).
 *
 * PATCH /api/treatments/:id — עדכון חלקי של שדות הטיפול (רק שדות שהוגשו).
 * DELETE /api/treatments/:id — מחיקה לצמיתות (אין soft-delete לטיפולים). מנתקת תורים
 *   ובקשות מדף הנחיתה, ומוחקת כללי מעקב ופריטי טיפול בביקורים — ראו
 *   `lib/db/hard-delete-treatment.ts`.
 *
 * כללי המעקב לטיפול נמצאים תחת `./follow-up-rules`.
 *
 * אבטחה (§11): נדרש session מחובר בלבד — אין RBAC לפי החלטת הבעלים. לא מדפיסים PII ללוג.
 */

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { hardDeleteTreatment } from "@/lib/db/hard-delete-treatment";
import {
  isTreatmentValid,
  parseTreatmentInput,
} from "@/lib/validations/treatments";

type RouteParams = { params: Promise<{ id: string }> };

/** DELETE /api/treatments/:id — מחיקה לצמיתות של טיפול מהקטלוג (משימה 12.3). */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  }

  const { id } = await params;

  let deleted: boolean;
  try {
    deleted = await hardDeleteTreatment(id);
  } catch {
    // ללא פירוט השגיאה; הטרנזקציה בוטלה (rollback) — לא נשאר טיפול "חצי מחוק".
    return NextResponse.json(
      { error: "אירעה שגיאה במחיקה לצמיתות — לא בוצע שינוי, נא לנסות שוב" },
      { status: 500 }
    );
  }

  if (!deleted) {
    return NextResponse.json({ error: "טיפול לא נמצא" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

/** PATCH /api/treatments/:id — עדכון חלקי של טיפול קיים. */
export async function PATCH(request: Request, { params }: RouteParams) {
  // אבטחה (§11): ה-middleware אינו מכסה נתיבי /api — נדרשת בדיקת session כאן.
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "גוף הבקשה אינו JSON תקין" },
      { status: 400 }
    );
  }

  const { errors, data } = parseTreatmentInput(body, "update");
  if (!isTreatmentValid(errors)) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const existing = await prisma.treatment.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "טיפול לא נמצא" }, { status: 404 });
  }

  try {
    const treatment = await prisma.treatment.update({
      where: { id },
      data,
    });

    return NextResponse.json({ treatment });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { errors: { name: "כבר קיים טיפול בשם הזה בקטלוג" } },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "אירעה שגיאה בעדכון הטיפול" },
      { status: 500 }
    );
  }
}
