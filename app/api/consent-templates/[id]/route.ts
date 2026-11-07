/**
 * API לתבנית הסכמה בודדת (משימה 7.2, FR-CF-01).
 *
 * GET    /api/consent-templates/[id]  — שליפת תבנית בודדת
 * PATCH  /api/consent-templates/[id]  — ניהול גרסאות: הגרסה הישנה מסומנת isActive=false,
 *                                        נוצרת גרסה חדשה עם version+1 ו-previousVersionId (משימה 7.3, FR-CF-03)
 * DELETE /api/consent-templates/[id]  — מחיקה רכה (isActive=false)
 */

import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/consent-templates/[id]
 * מחזיר תבנית בודדת לפי מזהה.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const template = await prisma.consentTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: "תבנית הסכמה לא נמצאה" },
        { status: 404 }
      );
    }

    return NextResponse.json({ template });
  } catch (err) {
    console.error("[GET /api/consent-templates/:id]", err);
    return NextResponse.json(
      { error: "שגיאה בשליפת תבנית הסכמה" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/consent-templates/[id]
 * ניהול גרסאות טופס הסכמה (FR-CF-03).
 * שדות אופציונליים: name, isGeneral, treatmentIds, validityDays, language, fields.
 *
 * לוגיקה:
 *   1. מסמן את הגרסה הנוכחית כ-isActive=false.
 *   2. יוצר רשומה חדשה עם version+1, previousVersionId=currentId, isActive=true.
 *   3. מחזיר { id, version } של הגרסה החדשה.
 *
 * חתימות ישנות (SignedConsent) ממשיכות להפנות לרשומה הישנה לפי templateId+templateVersion —
 * הן אינן מושפעות כי עדכון הגרסה אינו משנה את הרשומה הישנה (רק isActive=false).
 */
export async function PATCH(request: Request, { params }: RouteContext) {
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

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "נתונים חסרים" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;

  // ולידציה בסיסית של השם אם סופק
  if (typeof data.name === "string" && !data.name.trim()) {
    return NextResponse.json(
      { error: "שם התבנית לא יכול להיות ריק" },
      { status: 400 }
    );
  }

  if (
    typeof data.language === "string" &&
    !["he", "ar"].includes(data.language)
  ) {
    return NextResponse.json(
      { error: "שפה לא חוקית — ערכים מותרים: he, ar" },
      { status: 400 }
    );
  }

  try {
    const current = await prisma.consentTemplate.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json(
        { error: "תבנית הסכמה לא נמצאה" },
        { status: 404 }
      );
    }

    // עסקה: סימון הגרסה הישנה כלא פעילה + יצירת גרסה חדשה
    const result = await prisma.$transaction(async (tx) => {
      // 1. סמן את הגרסה הנוכחית כלא פעילה
      await tx.consentTemplate.update({
        where: { id },
        data: { isActive: false },
      });

      // 2. קבע validityDays לגרסה החדשה
      let newValidityDays = current.validityDays;
      if ("validityDays" in data) {
        if (data.validityDays === null || data.validityDays === undefined) {
          newValidityDays = null;
        } else if (
          typeof data.validityDays === "number" &&
          data.validityDays > 0
        ) {
          newValidityDays = data.validityDays;
        }
      }

      // 3. צור גרסה חדשה
      const newTemplate = await tx.consentTemplate.create({
        data: {
          name:
            typeof data.name === "string" ? data.name.trim() : current.name,
          isGeneral:
            typeof data.isGeneral === "boolean"
              ? data.isGeneral
              : current.isGeneral,
          treatmentIds: (Array.isArray(data.treatmentIds)
            ? data.treatmentIds
            : current.treatmentIds) as unknown as Prisma.InputJsonValue,
          fields: (Array.isArray(data.fields)
            ? data.fields
            : current.fields) as unknown as Prisma.InputJsonValue,
          validityDays: newValidityDays,
          language:
            typeof data.language === "string" &&
            ["he", "ar"].includes(data.language)
              ? (data.language as "he" | "ar")
              : current.language,
          version: current.version + 1,
          previousVersionId: current.id,
          isActive: true,
        },
      });

      return newTemplate;
    });

    return NextResponse.json({ id: result.id, version: result.version }, { status: 200 });
  } catch (err) {
    console.error("[PATCH /api/consent-templates/:id]", err);
    return NextResponse.json(
      { error: "שגיאה בעדכון תבנית הסכמה" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/consent-templates/[id]
 * מחיקה רכה: מסמן את התבנית כלא פעילה (isActive=false).
 * הרשומה נשארת בבסיס הנתונים לצורכי audit ולחתימות קיימות.
 */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const existing = await prisma.consentTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "תבנית הסכמה לא נמצאה" },
        { status: 404 }
      );
    }

    await prisma.consentTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/consent-templates/:id]", err);
    return NextResponse.json(
      { error: "שגיאה בביטול תבנית הסכמה" },
      { status: 500 }
    );
  }
}
