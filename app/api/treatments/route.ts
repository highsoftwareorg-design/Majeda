/**
 * API קטלוג הטיפולים — רשימה ויצירה (משימות 3.6 / 11.7, FR-AP-02).
 *
 * GET  /api/treatments — רשימת כל הטיפולים (id, name, durationMinutes) ממוינת
 *                        אלפביתית, לשימוש בפילטרים ובטפסים.
 * POST /api/treatments — יצירת טיפול חדש (ראו `parseTreatmentInput`).
 *
 * עדכון טיפול קיים: `PATCH /api/treatments/:id` (ראו `./[id]/route.ts`).
 *
 * הערה (פרטיות — §11): הקטלוג אינו מכיל PII של לקוחות — ניתן להציגו
 * בממשק הניהול ללא סינון נוסף.
 */

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  DEFAULT_TREATMENT_COLOR,
  isTreatmentValid,
  parseTreatmentInput,
} from "@/lib/validations/treatments";

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

/** POST /api/treatments — יצירת טיפול חדש (שם, משך ומחיר חובה). */
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

  const { errors, data } = parseTreatmentInput(body, "create");
  if (!isTreatmentValid(errors)) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  try {
    const treatment = await prisma.treatment.create({
      data: {
        name: data.name!,
        description: data.description ?? null,
        durationMinutes: data.durationMinutes!,
        price: data.price!,
        recommendedReturn: data.recommendedReturn ?? null,
        recommendedReturnDays: data.recommendedReturnDays ?? null,
        color: data.color ?? DEFAULT_TREATMENT_COLOR,
        requiresConsentForm: data.requiresConsentForm ?? false,
        authorizedTherapists: data.authorizedTherapists ?? null,
      },
    });

    return NextResponse.json({ treatment }, { status: 201 });
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
      { error: "אירעה שגיאה ביצירת הטיפול" },
      { status: 500 }
    );
  }
}
