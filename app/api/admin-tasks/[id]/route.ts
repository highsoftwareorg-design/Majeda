/**
 * PATCH /api/admin-tasks/:id — פעולה על משימת "להתקשר היום" (משימה 8.6, FR-FU-04/06).
 *
 * גוף הבקשה: { action: "booked" | "no_answer" | "not_interested" }
 *   booked         — נקבע תור: FollowUp.status=BOOKED, callResult=appointment_booked
 *   no_answer      — לא ענה/תה: FollowUp.scheduledDate += 2 ימים, status=PENDING (חוזר ל-Scheduler)
 *   not_interested — לא מעוניין/ת: FollowUp.status=CANCELLED, callResult=not_interested
 *
 * בכל הפעולות AdminTask.status=DONE ו-callResultAt נשמר.
 * נדרש session מחובר (middleware מגן על עמודים בלבד, לא על /api).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth/auth";

type RouteParams = { params: Promise<{ id: string }> };

const ACTIONS = ["booked", "no_answer", "not_interested"] as const;
type AdminTaskAction = (typeof ACTIONS)[number];

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

function isAdminTaskAction(value: unknown): value is AdminTaskAction {
  return typeof value === "string" && (ACTIONS as readonly string[]).includes(value);
}

/** PATCH /api/admin-tasks/:id */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו JSON תקין" }, { status: 400 });
  }

  const action = (body as { action?: unknown } | null)?.action;
  if (!isAdminTaskAction(action)) {
    return NextResponse.json({ error: "פעולה לא מוכרת" }, { status: 400 });
  }

  const task = await prisma.adminTask.findUnique({
    where: { id },
    select: { id: true, status: true, followUpId: true },
  });
  if (!task) {
    return NextResponse.json({ error: "משימה לא נמצאה" }, { status: 404 });
  }
  if (task.status !== "OPEN") {
    return NextResponse.json({ error: "המשימה כבר טופלה" }, { status: 409 });
  }

  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const followUp = await tx.followUp.findUnique({
        where: { id: task.followUpId },
        select: { scheduledDate: true },
      });
      if (!followUp) {
        throw new Error("FOLLOW_UP_NOT_FOUND");
      }

      if (action === "no_answer") {
        await tx.followUp.update({
          where: { id: task.followUpId },
          data: {
            scheduledDate: new Date(followUp.scheduledDate.getTime() + TWO_DAYS_MS),
            status: "PENDING",
            callResult: "no_answer",
            callResultAt: now,
          },
        });
      } else {
        await tx.followUp.update({
          where: { id: task.followUpId },
          data: {
            status: action === "booked" ? "BOOKED" : "CANCELLED",
            callResult: action === "booked" ? "appointment_booked" : "not_interested",
            callResultAt: now,
          },
        });
      }

      await tx.adminTask.update({
        where: { id: task.id },
        data: { status: "DONE" },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "FOLLOW_UP_NOT_FOUND") {
      return NextResponse.json({ error: "המעקב המקושר לא נמצא" }, { status: 404 });
    }
    console.error("[PATCH /api/admin-tasks/:id]", err);
    return NextResponse.json(
      { error: "שגיאה בעדכון המשימה — נסה שוב" },
      { status: 500 }
    );
  }
}
