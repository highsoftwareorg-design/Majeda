/**
 * API טיפול בודד — עדכון (משימה 11.7, FR-AP-02).
 *
 * PATCH /api/treatments/:id — עדכון חלקי של שדות הטיפול (רק שדות שהוגשו).
 *
 * הערה: אין מחיקה כאן (לא נדרשת במשימה 11.7). כללי המעקב לטיפול נמצאים
 * תחת `./follow-up-rules`.
 */

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  isTreatmentValid,
  parseTreatmentInput,
} from "@/lib/validations/treatments";

type RouteParams = { params: Promise<{ id: string }> };

/** PATCH /api/treatments/:id — עדכון חלקי של טיפול קיים. */
export async function PATCH(request: Request, { params }: RouteParams) {
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

  const { errors, data } = parseTreatmentInput(body, "update");
  if (!isTreatmentValid(errors)) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const existing = await prisma.treatment.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "טיפול לא נמצא" }, { status: 404 });
  }

  try {
    const treatment = await prisma.treatment.update({
      where: { id },
      data,
    });

    return NextResponse.json({ treatment });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { errors: { name: "כבר קיים טיפול בשם הזה בקטלוג" } },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "אירעה שגיאה בעדכון הטיפול" },
      { status: 500 }
    );
  }
}
