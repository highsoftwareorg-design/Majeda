/**
 * API שחזור לקוח/ה מארכיון — משימה 11.6, FR-CL-01.
 *
 * POST /api/clients/:id/restore — מחזיר לקוח/ה מארכיון לרשימה הפעילה:
 * `status="active"` ו-`archivedAt=null`. זו הפעולה היחידה שמשנה סטטוס
 * מארכיון לפעיל; PATCH /api/clients/:id אינו מקבל שדה `status` (כדי שלא
 * יהפוך לערוץ כתיבה כללי לסטטוס). הפעולה אינה מוחקת רשומות.
 *
 * הערה (פרטיות — §11): אין להדפיס ללוג פרטי PII של לקוח.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getClientById } from "@/lib/db/clients";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const existing = await getClientById(id);
  if (!existing) {
    return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
  }

  // לקוח/ה שכבר פעיל/ה — אין שינוי (הפעולה idempotent).
  if (existing.status === "active") {
    return NextResponse.json({ client: existing });
  }

  const client = await prisma.client.update({
    where: { id },
    data: { status: "active", archivedAt: null },
  });

  return NextResponse.json({ client });
}
