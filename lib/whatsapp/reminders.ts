/**
 * lib/whatsapp/reminders.ts
 * Tasks 6.4 / 6.5 — sub-handlers for appointment reminder scheduling.
 *
 * Called from the consolidated cron handler (app/api/cron/run/route.ts).
 * Each function:
 *   1. Finds appointments in the relevant time window that haven't been reminded yet.
 *   2. Skips quiet hours / Shabbat.
 *   3. Creates a Message record and sends via WhatsApp.
 *   4. Stamps the reminderXXhSentAt field — idempotent guard against double-send.
 */

import { prisma } from '@/lib/db/prisma';
import { whatsappService } from '@/lib/whatsapp/index';
import { isQuietHour, isShabbat } from '@/lib/whatsapp/quiet-hours';

// ─── 24h reminder ────────────────────────────────────────────────────────────

/**
 * Send 24h appointment reminders.
 * Window: appointments starting between 23:50 and 24:10 from now.
 * Guard field: reminder24hSentAt — null means not yet sent.
 */
export async function sendReminders24h(): Promise<{ sent: number; skipped: number }> {
  const now = new Date();
  // 23:50 from now
  const windowStart = new Date(now.getTime() + (24 * 60 - 10) * 60 * 1000);
  // 24:10 from now
  const windowEnd = new Date(now.getTime() + (24 * 60 + 10) * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: {
      startTime: { gte: windowStart, lte: windowEnd },
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      reminder24hSentAt: null,
    },
    include: { client: true, treatment: true },
  });

  let sent = 0;
  let skipped = 0;

  for (const apt of appointments) {
    if (!apt.client?.phone) {
      skipped++;
      continue;
    }
    if (isQuietHour(now) || isShabbat(now)) {
      skipped++;
      continue;
    }

    const clientName = `${apt.client.firstName} ${apt.client.lastName}`.trim();

    const message = await prisma.message.create({
      data: {
        clientId: apt.client.id,
        channel: 'whatsapp',
        templateId: 'appointment_reminder_24h',
        content: { name: clientName, appointmentId: apt.id },
        direction: 'outbound',
        status: 'PENDING',
        sourceType: 'appointment',
        sourceId: apt.id,
      },
    });

    await whatsappService.sendTemplate({
      to: apt.client.phone,
      templateName: 'appointment_reminder_24h',
      variables: { name: clientName },
      messageId: message.id,
    });

    await prisma.appointment.update({
      where: { id: apt.id },
      data: { reminder24hSentAt: now },
    });

    sent++;
  }

  return { sent, skipped };
}

// ─── 3h reminder ─────────────────────────────────────────────────────────────

/**
 * Send 3h appointment reminders.
 * Window: appointments starting between 2:50 and 3:10 from now.
 * Guard field: reminder3hSentAt — null means not yet sent.
 */
export async function sendReminders3h(): Promise<{ sent: number; skipped: number }> {
  const now = new Date();
  // 2:50 from now
  const windowStart = new Date(now.getTime() + (3 * 60 - 10) * 60 * 1000);
  // 3:10 from now
  const windowEnd = new Date(now.getTime() + (3 * 60 + 10) * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: {
      startTime: { gte: windowStart, lte: windowEnd },
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      reminder3hSentAt: null,
    },
    include: { client: true, treatment: true },
  });

  let sent = 0;
  let skipped = 0;

  for (const apt of appointments) {
    if (!apt.client?.phone) {
      skipped++;
      continue;
    }
    if (isQuietHour(now) || isShabbat(now)) {
      skipped++;
      continue;
    }

    const clientName = `${apt.client.firstName} ${apt.client.lastName}`.trim();

    const message = await prisma.message.create({
      data: {
        clientId: apt.client.id,
        channel: 'whatsapp',
        templateId: 'appointment_reminder_3h',
        content: { name: clientName, appointmentId: apt.id },
        direction: 'outbound',
        status: 'PENDING',
        sourceType: 'appointment',
        sourceId: apt.id,
      },
    });

    await whatsappService.sendTemplate({
      to: apt.client.phone,
      templateName: 'appointment_reminder_3h',
      variables: { name: clientName },
      messageId: message.id,
    });

    await prisma.appointment.update({
      where: { id: apt.id },
      data: { reminder3hSentAt: now },
    });

    sent++;
  }

  return { sent, skipped };
}
