/**
 * PATCH /api/clients/:id/visits/:visitId — עדכון חלקי של ביקור קיים (משימות 4.6, 4.7, 4.8).
 *
 * שדות ניתנים לעדכון:
 *   notes           — סיכום טיפול חופשי (FR-PR-03, משימה 4.6)
 *   clientReaction  — תוצאה/תגובת לקוחה (FR-PR-03, משימה 4.6)
 *   returnDate      — תאריך חזרה מוצע/מאושר (FR-PR-05, משימה 4.7)
 *
 * נעילת 24 שעות (FR-PR-07, משימה 4.8):
 *   - אם הביקור נשמר לפני יותר מ-24 שעות ("נעול"):
 *       • שינוי notes/clientReaction → נשמר כ-VisitAmendment (הסיכום המקורי לא נמחק)
 *       • שינוי returnDate → מותר תמיד (מעודכן ישירות)
 *   - אם הביקור נשמר בתוך 24 שעות האחרונות: עדכון ישיר כרגיל (התנהגות קיימת).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getClientById } from "@/lib/db/clients";
import { auth } from "@/lib/auth/auth";

type RouteParams = { params: Promise<{ id: string; visitId: string }> };

/** האם הביקור נעול? (נוצר לפני יותר מ-24 שעות) */
function isVisitLocked(createdAt: Date | undefined | null): boolean {
  if (!createdAt) return false;
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return new Date(createdAt) < twentyFourHoursAgo;
}

/** PATCH /api/clients/:id/visits/:visitId — עדכון סיכום/תגובה/תאריך לביקור */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id, visitId } = await params;

  // קבל את המשתמש המחובר (לשם editedBy בתיקונים)
  const session = await auth();
  const editedBy = session?.user?.email ?? "system";

  // ולידציה: הלקוח קיים ופעיל
  const client = await getClientById(id);
  if (!client) {
    return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
  }
  if (client.status === "archived") {
    return NextResponse.json(
      { error: "לא ניתן לערוך ביקור של לקוח בארכיון" },
      { status: 409 }
    );
  }

  // ולידציה: הביקור קיים ושייך ללקוח זה
  const existingVisit = await prisma.visit.findFirst({
    where: { id: visitId, clientId: id },
  });
  if (!existingVisit) {
    return NextResponse.json({ error: "ביקור לא נמצא" }, { status: 404 });
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

  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;

  // בנה את אובייקט העדכון הישיר (רק שדות שסופקו ולא נעולים, ו-returnDate/returnNoteHandled תמיד)
  const directUpdateData: {
    notes?: string | null;
    clientReaction?: string | null;
    returnDate?: Date | null;
    returnNoteHandled?: boolean;
  } = {};

  // שדות שדורשים תיקון אם הביקור נעול
  const lockedFieldUpdates: Array<{
    field: "notes" | "clientReaction";
    oldValue: string | null;
    newValue: string | null;
  }> = [];

  const locked = isVisitLocked(existingVisit.createdAt);

  if ("notes" in data) {
    const newVal = str(data.notes);
    if (locked) {
      lockedFieldUpdates.push({
        field: "notes",
        oldValue: existingVisit.notes,
        newValue: newVal,
      });
    } else {
      directUpdateData.notes = newVal;
    }
  }

  if ("clientReaction" in data) {
    const newVal = str(data.clientReaction);
    if (locked) {
      lockedFieldUpdates.push({
        field: "clientReaction",
        oldValue: existingVisit.clientReaction,
        newValue: newVal,
      });
    } else {
      directUpdateData.clientReaction = newVal;
    }
  }

  // returnNoteHandled — תמיד ניתן לעדכון ישיר (לא נעול), משימה 4.9
  if ("returnNoteHandled" in data) {
    if (typeof data.returnNoteHandled === "boolean") {
      directUpdateData.returnNoteHandled = data.returnNoteHandled;
    } else {
      return NextResponse.json(
        { error: "שדה returnNoteHandled חייב להיות ערך בוליאני" },
        { status: 400 }
      );
    }
  }

  // returnDate — תמיד ניתן לעדכון ישיר (לא נעול)
  if ("returnDate" in data) {
    if (data.returnDate === null || data.returnDate === "") {
      directUpdateData.returnDate = null;
    } else if (typeof data.returnDate === "string") {
      const d = new Date(data.returnDate);
      if (isNaN(d.getTime())) {
        return NextResponse.json(
          { error: "תאריך החזרה אינו תקין" },
          { status: 400 }
        );
      }
      directUpdateData.returnDate = d;
    } else {
      return NextResponse.json(
        { error: "תאריך החזרה אינו תקין" },
        { status: 400 }
      );
    }
  }

  // דרוש לפחות שדה אחד (עדכון ישיר או תיקון)
  if (
    Object.keys(directUpdateData).length === 0 &&
    lockedFieldUpdates.length === 0
  ) {
    return NextResponse.json(
      {
        error:
          "יש לספק לפחות שדה אחד לעדכון (notes, clientReaction, returnDate, או returnNoteHandled)",
      },
      { status: 400 }
    );
  }

  try {
    // --- מקרה פשוט: אין תיקונים נדרשים (ביקור לא נעול / רק returnDate) ---
    if (lockedFieldUpdates.length === 0) {
      // עדכון ישיר — אותה התנהגות כמו לפני משימה 4.8
      const updated = await prisma.visit.update({
        where: { id: visitId },
        data: directUpdateData,
        include: {
          visitTreatments: { include: { treatment: true } },
          amendments: { orderBy: { editedAt: "asc" } },
        },
      });
      return NextResponse.json({ visit: updated, locked });
    }

    // --- מקרה עם תיקונים: ביקור נעול, יש שדות שצריך לתיקון ---
    // טרנזקציה: עדכון ישיר (returnDate אם סופק) + יצירת תיקונים
    await prisma.$transaction(async (tx) => {
      // עדכון returnDate אם סופק (תמיד מותר)
      if (Object.keys(directUpdateData).length > 0) {
        await tx.visit.update({
          where: { id: visitId },
          data: directUpdateData,
        });
      }
      // יצירת תיקונים לשדות נעולים
      for (const { field, oldValue, newValue } of lockedFieldUpdates) {
        await tx.visitAmendment.create({
          data: { visitId, field, oldValue, newValue, editedBy },
        });
      }
    });

    // טען את הביקור המעודכן עם כל הקשרים
    const visitWithRelations = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        visitTreatments: { include: { treatment: true } },
        amendments: { orderBy: { editedAt: "asc" } },
      },
    });

    return NextResponse.json({ visit: visitWithRelations, locked });
  } catch (err) {
    console.error("[PATCH /api/clients/:id/visits/:visitId]", err);
    return NextResponse.json(
      { error: "שגיאה בעדכון הביקור — נסה שוב" },
      { status: 500 }
    );
  }
}
