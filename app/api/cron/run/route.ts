/**
 * app/api/cron/run/route.ts
 * Tasks 6.4 / 6.5 — consolidated cron handler (single Vercel Cron job).
 *
 * Architecture note: Vercel Hobby plan allows only one cron job.
 * All scheduled work is dispatched from this single handler which runs daily
 * at 06:00 UTC (09:00 Israel time). Each sub-handler is isolated in its own
 * module so it can be tested and extended independently.
 *
 * Schedule (vercel.json): "0 6 * * *"
 *
 * Authentication: Vercel sets the Authorization header to
 * "Bearer <CRON_SECRET>" on every cron invocation. External callers without
 * the secret receive 401.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendReminders24h, sendReminders3h } from '@/lib/whatsapp/reminders';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // Verify cron secret — protects the endpoint from unauthorized calls.
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  // ── 1. 24h appointment reminders ────────────────────────────────────────────
  try {
    results.reminders24h = await sendReminders24h();
  } catch (e) {
    results.reminders24h = { error: String(e) };
  }

  // ── 2. 3h appointment reminders ─────────────────────────────────────────────
  try {
    results.reminders3h = await sendReminders3h();
  } catch (e) {
    results.reminders3h = { error: String(e) };
  }

  // ── 3. Follow-ups + daily admin email (tasks 8.5 / 8.6 / 8.7) ───────────────
  try {
    const { processFollowUps } = await import('@/lib/followups/scheduler');
    const { sendDailyAdminEmail } = await import('@/lib/followups/email');

    const followUpResult = await processFollowUps();
    results.followUps = followUpResult;

    // מייל סיכום לאדמין רק אם נוצרו משימות חדשות במחזור הזה
    if (followUpResult.adminTasksCreated > 0) {
      await sendDailyAdminEmail(followUpResult.adminTasksCreated);
    }
  } catch (e) {
    results.followUps = { error: String(e) };
  }

  // ── 4. Campaigns: scheduled + throttled sending (task 9.5, FR-MK-04/05) ─────
  try {
    const { processCampaigns } = await import('@/lib/campaigns/sender');
    results.campaigns = await processCampaigns();
  } catch (e) {
    results.campaigns = { error: String(e) };
  }

  // More sub-handlers will be added in future tasks:
  //   - birthday greetings (phase 3)

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), results });
}
