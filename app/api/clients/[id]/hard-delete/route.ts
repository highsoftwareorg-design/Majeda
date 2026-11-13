/**
 * DELETE /api/clients/:id/hard-delete — מחיקה לצמיתות של לקוח/ה (משימה 12.2, §12).
 *
 * מוחק את הלקוח/ה וכל רשומותיו/ה (תורים, ביקורים, טפסים חתומים, הודעות, מעקבים
 * ומשימות) בטרנזקציה אחת — ראו `lib/db/hard-delete-client.ts`.
 * נתיב זה **נפרד** מ-`DELETE /api/clients/:id` שהוא ארכוב רך (לא נדרס).
 *
 * אבטחה (§11): נדרש session מחובר בלבד — אין RBAC לפי החלטת הבעלים.
 * לא מדפיסים PII ללוג. מפתחות R2 מוחזרים בלי שמות לקוח/ה.
 *
 * תשובה:
 *   200 { success: true, orphanedPdfKeys: string[] }
 *   401 לא מחובר · 404 לקוח/ה לא קיים/ת · 500 כשל (הטרנזקציה בוטלה במלואה)
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { hardDeleteClient } from "@/lib/db/hard-delete-client";

type RouteParams = { params: Promise<{ id: string }> };

/** DELETE /api/clients/:id/hard-delete */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  }

  const { id } = await params;

  let result: Awaited<ReturnType<typeof hardDeleteClient>>;
  try {
    result = await hardDeleteClient(id);
  } catch {
    // ללא פירוט השגיאה כדי לא להדפיס/להחזיר PII; הטרנזקציה בוטלה (rollback).
    return NextResponse.json(
      { error: "אירעה שגיאה במחיקה לצמיתות — לא בוצע שינוי, נא לנסות שוב" },
      { status: 500 }
    );
  }

  if (!result) {
    return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    orphanedPdfKeys: result.orphanedPdfKeys,
  });
}
