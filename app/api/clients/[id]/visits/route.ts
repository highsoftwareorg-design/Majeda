/**
 * POST /api/clients/:id/visits — יצירת ביקור חדש עבור לקוח (משימה 4.5, FR-PR-02).
 *
 * שדות:
 *   visitDate       (חובה) — תאריך הביקור (ISO string)
 *   treatmentIds    — מזהי הטיפולים שבוצעו (מערך, אופציונלי)
 *   therapist       — שם המטפל/ת (טקסט חופשי, אופציונלי)
 *   treatedArea     — אזור מטופל (טקסט חופשי, אופציונלי)
 *   products        — מוצרים/חומרים כולל מספר אצווה (טקסט חופשי, אופציונלי)
 *   parameters      — מינון/פרמטרים (טקסט חופשי, אופציונלי)
 *   notes           — סיכום טיפול חופשי (FR-PR-03, אופציונלי)
 *   clientReaction  — תוצאה/תגובת לקוחה (FR-PR-03 שדה מובנה בסיסי, אופציונלי)
 *   price           — מחיר בש"ח (מספר, אופציונלי)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getClientById } from "@/lib/db/clients";

type RouteParams = { params: Promise<{ id: string }> };

/** POST /api/clients/:id/visits — יצירת ביקור חדש */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;

  // ולידציה: הלקוח קיים ופעיל
  const client = await getClientById(id);
  if (!client) {
    return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
  }
  if (client.status === "archived") {
    return NextResponse.json(
      { error: "לא ניתן להוסיף ביקור ללקוח בארכיון" },
      { status: 409 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "גוף הבקשה אינו JSON תקין" },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "נתונים חסרים" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;

  // ולידציה: תאריך ביקור — שדה חובה
  const visitDateRaw = data.visitDate;
  if (!visitDateRaw || typeof visitDateRaw !== "string") {
    return NextResponse.json(
      { error: "תאריך הביקור הוא שדה חובה" },
      { status: 400 }
    );
  }
  const visitDate = new Date(visitDateRaw);
  if (isNaN(visitDate.getTime())) {
    return NextResponse.json(
      { error: "תאריך הביקור אינו תקין" },
      { status: 400 }
    );
  }

  // ולידציה: מחיר (אופציונלי — חייב להיות מספר אי-שלילי אם סופק)
  let price: number | null = null;
  if (data.price !== undefined && data.price !== null && data.price !== "") {
    const p = Number(data.price);
    if (isNaN(p) || p < 0) {
      return NextResponse.json(
        { error: "המחיר חייב להיות מספר אי-שלילי" },
        { status: 400 }
      );
    }
    price = p;
  }

  // ולידציה: רשימת מזהי טיפולים (אופציונלי)
  const treatmentIds: string[] = [];
  if (Array.isArray(data.treatmentIds)) {
    for (const tid of data.treatmentIds) {
      if (typeof tid === "string" && tid.trim()) {
        treatmentIds.push(tid.trim());
      }
    }
  }

  // שדות טקסט אופציונליים — מחרוזת ריקה הופכת ל-null
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;

  try {
    const visit = await prisma.visit.create({
      data: {
        clientId: id,
        visitDate,
        therapist: str(data.therapist),
        treatedArea: str(data.treatedArea),
        notes: str(data.notes),
        clientReaction: str(data.clientReaction),
        products: str(data.products),
        parameters: str(data.parameters),
        price: price !== null ? price : undefined,
        ...(treatmentIds.length > 0
          ? {
              visitTreatments: {
                create: treatmentIds.map((tid) => ({ treatmentId: tid })),
              },
            }
          : {}),
      },
      include: {
        visitTreatments: {
          include: {
            // כולל recommendedReturnDays כדי שה-VisitForm יוכל לחשב הצעת תאריך חזרה (משימה 4.7)
            treatment: { select: { id: true, name: true, recommendedReturnDays: true } },
          },
        },
      },
    });

    return NextResponse.json({ visit }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/clients/:id/visits]", err);
    return NextResponse.json(
      { error: "שגיאה בשמירת הביקור — נסה שוב" },
      { status: 500 }
    );
  }
}
