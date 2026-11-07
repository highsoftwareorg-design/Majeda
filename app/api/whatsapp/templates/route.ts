/**
 * API ניהול תבניות WhatsApp — רשימה ויצירה (משימה 6.8, FR-WA-05).
 *
 * GET  /api/whatsapp/templates — רשימת כל התבניות הפעילות (ממוינות לפי תאריך יצירה יורד)
 * POST /api/whatsapp/templates — יצירת תבנית חדשה
 *
 * שים לב: הגשה ל-Meta נדרשת ידנית דרך Meta Business Suite — ראו Notes/Risks ב-PLAN.md.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/whatsapp/templates — רשימת תבניות.
 * פרמטר אופציונלי `category` (UTILITY | MARKETING) לסינון — משימה 9.2 (בחירת תבנית שיווקית).
 */
export async function GET(request?: Request) {
  const category = request
    ? new URL(request.url).searchParams.get("category")
    : null;
  const templates = await prisma.whatsAppTemplate.findMany({
    where: category ? { category } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ templates });
}

/** POST /api/whatsapp/templates — יצירת תבנית חדשה */
export async function POST(request: Request) {
  let body: {
    name?: string;
    category?: string;
    body?: string;
    variables?: string[];
    language?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "גוף הבקשה אינו JSON תקין" },
      { status: 400 }
    );
  }

  // ולידציה בסיסית
  const name = body.name?.trim();
  const templateBody = body.body?.trim();

  if (!name) {
    return NextResponse.json({ error: "שם התבנית הוא שדה חובה" }, { status: 400 });
  }
  if (!templateBody) {
    return NextResponse.json({ error: "גוף ההודעה הוא שדה חובה" }, { status: 400 });
  }

  // ולידציה: שם תבנית Meta — אותיות קטנות, ספרות וקו תחתון בלבד
  if (!/^[a-z0-9_]+$/.test(name)) {
    return NextResponse.json(
      { error: "שם התבנית יכול להכיל רק אותיות לטיניות קטנות, ספרות וקו תחתון (_)" },
      { status: 400 }
    );
  }

  const VALID_CATEGORIES = ["UTILITY", "MARKETING"];
  const category = body.category ?? "UTILITY";
  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "קטגוריה לא חוקית" }, { status: 400 });
  }

  const VALID_LANGUAGES = ["he", "ar"];
  const language = body.language ?? "he";
  if (!VALID_LANGUAGES.includes(language)) {
    return NextResponse.json({ error: "שפה לא חוקית" }, { status: 400 });
  }

  const variables = Array.isArray(body.variables) ? body.variables : [];

  try {
    const template = await prisma.whatsAppTemplate.create({
      data: {
        name,
        category,
        body: templateBody,
        variables,
        language,
      },
    });
    return NextResponse.json({ template }, { status: 201 });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "תבנית עם שם זה כבר קיימת" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "אירעה שגיאה ביצירת התבנית" },
      { status: 500 }
    );
  }
}
