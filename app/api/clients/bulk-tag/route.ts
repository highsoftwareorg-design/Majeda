/**
 * POST /api/clients/bulk-tag — הוספת תגית לקבוצת לקוחות (משימה 3.12, FR-CL-10).
 *
 * גוף הבקשה: { clientIds: string[], tagId: string }
 * תגובה:    { created: number } — מספר רשומות ClientTag שנוצרו (כפילויות מדולגות).
 *
 * הרשאה: TODO: restrict to admin role (placeholder — בדיקת תפקיד תמומש בתחום הרשאות נפרד).
 * אבטחה (§11): לא נרשמים PII של לקוחות ב-log.
 */

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  let body: { clientIds?: unknown; tagId?: unknown };
  try {
    body = (await request.json()) as { clientIds?: unknown; tagId?: unknown };
  } catch {
    return NextResponse.json(
      { error: "גוף הבקשה אינו JSON תקין" },
      { status: 400 }
    );
  }

  const { clientIds, tagId } = body;

  // ולידציה בסיסית של הקלט
  if (!Array.isArray(clientIds) || clientIds.length === 0) {
    return NextResponse.json(
      { error: "יש לבחור לפחות לקוח אחד" },
      { status: 400 }
    );
  }
  if (!tagId || typeof tagId !== "string" || !tagId.trim()) {
    return NextResponse.json(
      { error: "יש לבחור תגית תקינה" },
      { status: 400 }
    );
  }
  // בדיקה שכל clientIds הם מחרוזות לא ריקות
  const clientIdStrings = clientIds.filter(
    (id): id is string => typeof id === "string" && id.trim().length > 0
  );
  if (clientIdStrings.length === 0) {
    return NextResponse.json(
      { error: "מזהי הלקוחות אינם תקינים" },
      { status: 400 }
    );
  }

  // ולידציה: התגית קיימת ב-DB
  const tag = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!tag) {
    return NextResponse.json({ error: "התגית לא נמצאה" }, { status: 404 });
  }

  try {
    // יצירת רשומות ClientTag בבת אחת — skipDuplicates מדלג על כפילויות קיימות
    // (לקוח שכבר מתויג בתגית זו לא יגרום לשגיאה).
    const result = await prisma.clientTag.createMany({
      data: clientIdStrings.map((clientId) => ({ clientId, tagId })),
      skipDuplicates: true,
    });

    return NextResponse.json({ created: result.count });
  } catch (error) {
    // P2003 — foreign key violation: אחד מה-clientId אינו קיים ב-DB
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        { error: "אחד מהלקוחות שנבחרו אינו קיים במערכת" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "אירעה שגיאה בהוספת התגית" },
      { status: 500 }
    );
  }
}
