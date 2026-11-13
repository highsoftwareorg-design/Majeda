/**
 * API לתבניות טפסי הסכמה (משימה 7.2, FR-CF-01).
 *
 * GET  /api/consent-templates  — רשימת התבניות הפעילות (orderBy: createdAt desc);
 *      עם `?includeInactive=1` — גם לא-פעילות (פעילות תחילה), למסך הניהול (12.5).
 * POST /api/consent-templates  — יצירת תבנית חדשה
 *
 * הערה (פרטיות — §11): אין להדפיס ללוג מזהי לקוחות או מידע רפואי.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/consent-templates
 * ברירת מחדל: תבניות פעילות בלבד (isActive=true), לפי תאריך יצירה יורד — לבחירת תבנית לחתימה.
 * `?includeInactive=1`: כל התבניות, פעילות תחילה — למסך ניהול התבניות (מחיקה לצמיתות של
 * תבנית שנמחקה רכה, משימה 12.5).
 */
export async function GET(request?: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });

  const includeInactive = request
    ? new URL(request.url).searchParams.get("includeInactive") === "1"
    : false;

  try {
    const templates = await prisma.consentTemplate.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: includeInactive
        ? [{ isActive: "desc" }, { createdAt: "desc" }]
        : { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        isGeneral: true,
        treatmentIds: true,
        validityDays: true,
        language: true,
        version: true,
        isActive: true,
        fields: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ templates });
  } catch (err) {
    console.error("[GET /api/consent-templates]", err);
    return NextResponse.json(
      { error: "שגיאה בשליפת תבניות הסכמה" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/consent-templates
 * יצירת תבנית הסכמה חדשה.
 *
 * שדות חובה: name
 * שדות אופציונליים: isGeneral, treatmentIds, validityDays, language, fields
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });

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

  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { error: "שם התבנית הוא שדה חובה" },
      { status: 400 }
    );
  }

  const isGeneral = typeof data.isGeneral === "boolean" ? data.isGeneral : false;
  const treatmentIds = Array.isArray(data.treatmentIds) ? data.treatmentIds : [];
  const validityDays =
    typeof data.validityDays === "number" && data.validityDays > 0
      ? data.validityDays
      : null;
  const language =
    typeof data.language === "string" && ["he", "ar"].includes(data.language)
      ? data.language
      : "he";
  const fields = Array.isArray(data.fields) ? data.fields : [];

  try {
    const template = await prisma.consentTemplate.create({
      data: {
        name,
        isGeneral,
        treatmentIds,
        validityDays,
        language,
        fields,
        version: 1,
        isActive: true,
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/consent-templates]", err);
    return NextResponse.json(
      { error: "שגיאה ביצירת תבנית הסכמה" },
      { status: 500 }
    );
  }
}
