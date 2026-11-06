/**
 * API ניהול לקוח בודד — עדכון ו"מחיקה" רכה (ארכיון) — משימה 3.2, FR-CL-01.
 *
 * "מחיקה" (DELETE) אינה מוחקת את הרשומה פיזית: היא מסמנת
 * `status="archived"` ו-`archivedAt` בלבד, כך שהרשומה ממשיכה להתקיים
 * במסד הנתונים אך לא תוחזר משאילתות רשימה רגילות (ראו `lib/db/clients.ts`).
 */

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getClientById } from "@/lib/db/clients";
import {
  validateUpdateClient,
  isClientValid,
  normalizeIsraeliPhone,
  type UpdateClientInput,
} from "@/lib/validations/clients";

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/clients/:id — שליפת לקוח בודד (פעיל או בארכיון). */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const client = await getClientById(id);

  if (!client) {
    return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
  }

  return NextResponse.json({ client });
}

/** PATCH /api/clients/:id — עדכון חלקי של שדות הלקוח. */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;

  let body: UpdateClientInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "גוף הבקשה אינו JSON תקין" },
      { status: 400 }
    );
  }

  const errors = validateUpdateClient(body);

  if (!isClientValid(errors)) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const existing = await getClientById(id);
  if (!existing) {
    return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
  }

  const data: Prisma.ClientUpdateInput = {};

  if (body.firstName !== undefined) data.firstName = body.firstName.trim();
  if (body.lastName !== undefined) data.lastName = body.lastName.trim();
  if (body.phone !== undefined) data.phone = normalizeIsraeliPhone(body.phone);
  if (body.gender !== undefined) data.gender = body.gender;
  if (body.birthDate !== undefined) {
    data.birthDate = body.birthDate ? new Date(body.birthDate) : null;
  }
  if (body.email !== undefined) data.email = body.email?.trim() || null;
  if (body.city !== undefined) data.city = body.city?.trim() || null;
  if (body.source !== undefined) data.source = body.source;
  if (body.utmSource !== undefined) data.utmSource = body.utmSource;
  if (body.utmMedium !== undefined) data.utmMedium = body.utmMedium;
  if (body.utmCampaign !== undefined) data.utmCampaign = body.utmCampaign;
  if (body.utmTerm !== undefined) data.utmTerm = body.utmTerm;
  if (body.utmContent !== undefined) data.utmContent = body.utmContent;
  if (body.note !== undefined) data.note = body.note?.trim() || null;
  if (body.marketingConsentChannel !== undefined) {
    data.marketingConsentChannel = body.marketingConsentChannel;
    data.marketingConsentAt =
      body.marketingConsentChannel !== "none" ? new Date() : null;
  }
  if (body.requestedTreatmentId !== undefined) {
    data.requestedTreatment = body.requestedTreatmentId
      ? { connect: { id: body.requestedTreatmentId } }
      : { disconnect: true };
  }

  // התראות רפואיות — task 4.3
  if (body.allergies !== undefined) data.allergies = body.allergies?.trim() || null;
  if (body.medications !== undefined) data.medications = body.medications?.trim() || null;
  if (body.pregnancyNursing !== undefined) data.pregnancyNursing = body.pregnancyNursing?.trim() || null;
  if (body.medicalConditions !== undefined) data.medicalConditions = body.medicalConditions?.trim() || null;

  try {
    const client = await prisma.client.update({
      where: { id },
      data,
    });

    return NextResponse.json({ client });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          errors: {
            phone: "מספר הטלפון כבר קיים במערכת ושייך ללקוח אחר — לא ניתן לעדכן לכפילות",
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "אירעה שגיאה בעדכון הלקוח" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/:id — ארכיון ("מחיקה רכה") בלבד. הרשומה נשארת
 * במסד הנתונים עם `status="archived"` ו-`archivedAt` מעודכן, ולא נמחקת
 * פיזית (FR-CL-01).
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const existing = await getClientById(id);
  if (!existing) {
    return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
  }

  const client = await prisma.client.update({
    where: { id },
    data: { status: "archived", archivedAt: new Date() },
  });

  return NextResponse.json({ client });
}
