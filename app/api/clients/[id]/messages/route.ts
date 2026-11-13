/**
 * GET /api/clients/[id]/messages — יומן שליחה ללקוח (משימה 6.7, FR-WA-06).
 *
 * מחזיר רשימת הודעות ממוינות מהחדש לישן עבור לקוח ספציפי.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { auth } from '@/lib/auth/auth';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });

  const { id } = await params;
  const messages = await prisma.message.findMany({
    where: { clientId: id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      channel: true,
      templateId: true,
      status: true,
      sourceType: true,
      externalId: true,
      sentAt: true,
      deliveredAt: true,
      readAt: true,
      createdAt: true,
      content: true,
    },
  });
  return NextResponse.json(messages);
}
