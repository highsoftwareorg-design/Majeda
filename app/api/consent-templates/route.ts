/**
 * API לתבניות טפסי הסכמה (משימה 7.2, FR-CF-01).
 *
 * GET  /api/consent-templates  — רשימת כל התבניות הפעילות (orderBy: createdAt desc)
 * POST /api/consent-templates  — יצירת תבנית חדשה
 *
 * הערה (פרטיות — §11): אין להדפיס ללוג מזהי לקוחות או מידע רפואי.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/consent-templates
 * מחזיר רשימת תבניות פעילות בלבד (isActive=true), מסודרות לפי תאריך יצירה יורד.
 */
export async function GET() {
  try {
    const templates = await prisma.consentTemplate.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
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
