/**
 * API סגמנטים — רשימה ויצירה (משימה 3.11, FR-CL-09, §12.1).
 *
 * GET  /api/segments — רשימת כל הסגמנטים השמורים (ממוינת לפי תאריך יצירה יורד).
 * POST /api/segments — יצירת סגמנט חדש עם שם ייחודי והגדרת פילטרים ב-JSON.
 *
 * הערה (פרטיות — §11): שדות ה-filters מכילים מזהי סגמנטציה (IDs של תגיות/טיפולים)
 * ולא PII ישיר — אין צורך בהגבלות מיוחדות מעבר לאימות ה-session הקיים.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/** GET /api/segments — רשימת כל הסגמנטים */
export async function GET() {
  const segments = await prisma.segment.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      filters: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ segments });
}

/** POST /api/segments — יצירת סגמנט חדש */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו JSON תקין" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין" }, { status: 400 });
  }

  const { name, filters } = body as Record<string, unknown>;

  // ולידציה: שם
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "שם הסגמנט הוא שדה חובה" }, { status: 400 });
  }
  const trimmedName = name.trim();
  if (trimmedName.length > 100) {
    return NextResponse.json({ error: "שם הסגמנט לא יכול לעלות על 100 תווים" }, { status: 400 });
  }

  // ולידציה: filters
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    return NextResponse.json({ error: "הגדרת הפילטרים אינה תקינה" }, { status: 400 });
  }

  try {
    const segment = await prisma.segment.create({
      data: {
        name: trimmedName,
        filters: filters as object,
      },
      select: {
        id: true,
        name: true,
        filters: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ segment }, { status: 201 });
  } catch (err) {
    // Prisma P2002 = unique constraint violation (שם כבר קיים)
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "סגמנט עם שם זה כבר קיים — בחר שם ייחודי אחר" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "שגיאה פנימית — נא לנסות שוב" }, { status: 500 });
  }
}
