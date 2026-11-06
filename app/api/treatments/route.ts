/**
 * GET /api/treatments — רשימת כל הטיפולים בקטלוג (לשימוש בפילטרים ובטפסים).
 *
 * נקודת קצה פשוטה לקריאה בלבד — לא נדרשת ולידציה מיוחדת.
 * מחזירה: id, name, durationMinutes (לשימוש עתידי בבחירת תור).
 * ממוינת לפי name אלפביתית לנוחות המשתמש/ת בתיבות בחירה/checkboxes.
 *
 * הערה (פרטיות — §11): הקטלוג אינו מכיל PII של לקוחות — ניתן להציגו
 * בממשק הניהול ללא סינון נוסף.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const treatments = await prisma.treatment.findMany({
    select: {
      id: true,
      name: true,
      durationMinutes: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ treatments });
}
