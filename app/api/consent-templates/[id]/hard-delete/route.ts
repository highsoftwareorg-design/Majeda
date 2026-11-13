/**
 * DELETE /api/consent-templates/:id/hard-delete — מחיקה לצמיתות של תבנית הסכמה (משימה 12.5, §12).
 *
 * מוחק את התבנית, את הטפסים החתומים המבוססים עליה, ומנתק גרסאות עוקבות — בטרנזקציה אחת.
 * ראו `lib/db/hard-delete-consent-template.ts`.
 * נתיב זה **נפרד** מ-`DELETE /api/consent-templates/:id` שהוא מחיקה רכה (isActive=false) — לא נדרס.
 *
 * אבטחה (§11): נדרש session מחובר בלבד — אין RBAC לפי החלטת הבעלים.
 * לא מדפיסים PII ללוג. מפתחות R2 מוחזרים בלי פרטי לקוח/ה.
 *
 * תשובה:
 *   200 { success: true, orphanedPdfKeys: string[] }
 *   401 לא מחובר · 404 תבנית לא קיימת · 500 כשל (הטרנזקציה בוטלה במלואה)
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { hardDeleteConsentTemplate } from "@/lib/db/hard-delete-consent-template";

type RouteParams = { params: Promise<{ id: string }> };

/** DELETE /api/consent-templates/:id/hard-delete */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  }

  const { id } = await params;

  let result: Awaited<ReturnType<typeof hardDeleteConsentTemplate>>;
  try {
    result = await hardDeleteConsentTemplate(id);
  } catch {
    // ללא פירוט השגיאה כדי לא להדפיס/להחזיר מידע רגיש; הטרנזקציה בוטלה (rollback).
    return NextResponse.json(
      { error: "אירעה שגיאה במחיקה לצמיתות — לא בוצע שינוי, נא לנסות שוב" },
      { status: 500 }
    );
  }

  if (!result) {
    return NextResponse.json({ error: "תבנית הסכמה לא נמצאה" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    orphanedPdfKeys: result.orphanedPdfKeys,
  });
}
