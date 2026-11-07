/**
 * API ניהול תבנית WhatsApp בודדת (משימה 6.8, FR-WA-05).
 *
 * GET    /api/whatsapp/templates/:id — שליפת תבנית בודדת
 * PATCH  /api/whatsapp/templates/:id — עדכון שדות תבנית
 * DELETE /api/whatsapp/templates/:id — מחיקה רכה (isActive=false)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/whatsapp/templates/:id */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const template = await prisma.whatsAppTemplate.findUnique({ where: { id } });
  if (!template) {
    return NextResponse.json({ error: "תבנית לא נמצאה" }, { status: 404 });
  }
  return NextResponse.json({ template });
}

/** PATCH /api/whatsapp/templates/:id — עדכון חלקי */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;

  const existing = await prisma.whatsAppTemplate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "תבנית לא נמצאה" }, { status: 404 });
  }

  let body: {
    category?: string;
    body?: string;
    variables?: string[];
    language?: string;
    approvedByMeta?: boolean;
    isActive?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "גוף הבקשה אינו JSON תקין" },
      { status: 400 }
    );
  }

  const VALID_CATEGORIES = ["UTILITY", "MARKETING"];
  if (body.category !== undefined && !VALID_CATEGORIES.includes(body.category)) {
    return NextResponse.json({ error: "קטגוריה לא חוקית" }, { status: 400 });
  }

  const VALID_LANGUAGES = ["he", "ar"];
  if (body.language !== undefined && !VALID_LANGUAGES.includes(body.language)) {
    return NextResponse.json({ error: "שפה לא חוקית" }, { status: 400 });
  }

  if (body.body !== undefined && !body.body.trim()) {
    return NextResponse.json({ error: "גוף ההודעה אינו יכול להיות ריק" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.category !== undefined) updateData.category = body.category;
  if (body.body !== undefined) updateData.body = body.body.trim();
  if (body.variables !== undefined && Array.isArray(body.variables))
    updateData.variables = body.variables;
  if (body.language !== undefined) updateData.language = body.language;
  if (body.approvedByMeta !== undefined)
    updateData.approvedByMeta = Boolean(body.approvedByMeta);
  if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);

  const template = await prisma.whatsAppTemplate.update({
    where: { id },
    data: updateData,
  });
  return NextResponse.json({ template });
}

/** DELETE /api/whatsapp/templates/:id — מחיקה רכה (isActive=false) */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const existing = await prisma.whatsAppTemplate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "תבנית לא נמצאה" }, { status: 404 });
  }

  await prisma.whatsAppTemplate.update({
    where: { id },
    data: { isActive: false },
  });
  return NextResponse.json({ ok: true });
}
