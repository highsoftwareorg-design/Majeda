/**
 * API כללי מעקב לטיפול (משימה 8.2, FR-FU-01).
 *
 * GET  /api/treatments/:id/follow-up-rules — רשימת הכללים הפעילים לטיפול
 * POST /api/treatments/:id/follow-up-rules — יצירת כלל מעקב חדש לטיפול
 *
 * שדות POST:
 *   name         (חובה) — תיאור הכלל, למשל "בדיקת שלומות"
 *   offsetDays   (חובה) — מספר ימים מתאריך הביקור (מספר שלם ≥ 0)
 *   recipientType (אופציונלי, ברירת מחדל "client") — client | admin | both
 *   adminNote    (אופציונלי) — נוסח המשימה לאדמין
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";

type RouteParams = { params: Promise<{ id: string }> };

const VALID_RECIPIENT_TYPES = ["client", "admin", "both"];

/** GET /api/treatments/:id/follow-up-rules */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });

  const { id } = await params;

  const treatment = await prisma.treatment.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!treatment) {
    return NextResponse.json({ error: "טיפול לא נמצא" }, { status: 404 });
  }

  const rules = await prisma.followUpRule.findMany({
    where: { treatmentId: id, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ rules });
}

/** POST /api/treatments/:id/follow-up-rules */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });

  const { id } = await params;

  const treatment = await prisma.treatment.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!treatment) {
    return NextResponse.json({ error: "טיפול לא נמצא" }, { status: 404 });
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

  // שם הכלל — חובה
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "שם הכלל הוא שדה חובה" }, { status: 400 });
  }

  // מרווח בימים — מספר שלם אי-שלילי, חובה
  const offsetRaw = data.offsetDays;
  const offsetDays =
    typeof offsetRaw === "number"
      ? offsetRaw
      : typeof offsetRaw === "string" && offsetRaw.trim() !== ""
        ? Number(offsetRaw)
        : NaN;
  if (!Number.isInteger(offsetDays) || offsetDays < 0) {
    return NextResponse.json(
      { error: "מספר הימים חייב להיות מספר שלם, אפס או גדול ממנו" },
      { status: 400 }
    );
  }

  // נמען — ברירת מחדל: לקוח/ה
  const recipientType =
    data.recipientType === undefined || data.recipientType === ""
      ? "client"
      : data.recipientType;
  if (typeof recipientType !== "string" || !VALID_RECIPIENT_TYPES.includes(recipientType)) {
    return NextResponse.json({ error: "נמען לא חוקי" }, { status: 400 });
  }

  // הנחיה לאדמין — אופציונלית (מחרוזת ריקה → null)
  const adminNote =
    typeof data.adminNote === "string" && data.adminNote.trim()
      ? data.adminNote.trim()
      : null;

  try {
    const rule = await prisma.followUpRule.create({
      data: {
        treatmentId: id,
        name,
        offsetDays,
        recipientType,
        adminNote,
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/treatments/:id/follow-up-rules]", err);
    return NextResponse.json(
      { error: "שגיאה בשמירת כלל המעקב — נסה שוב" },
      { status: 500 }
    );
  }
}
