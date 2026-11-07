/**
 * lib/followups/email.ts
 * Task 8.7 — מייל סיכום יומי לאדמין על משימות מעקב חדשות (FR-FU-07).
 *
 * נקרא מה-handler המאוחד app/api/cron/run/route.ts לאחר עיבוד המעקבים.
 * המייל אינו כולל פרטי לקוחות (PII) — רק מספר המשימות וקישור למסך המשימות.
 *
 * מצב mock: WHATSAPP_MODE !== "real" או חסר EMAIL_PROVIDER_API_KEY → console.info בלבד.
 * שליחה אמיתית (SendGrid/Resend) טרם מומשה — ראו Notes/Risks ב-PLAN.md.
 */

export async function sendDailyAdminEmail(newTaskCount: number): Promise<void> {
  if (newTaskCount === 0) return;

  const isEmailMock =
    process.env.WHATSAPP_MODE === 'mock' || !process.env.EMAIL_PROVIDER_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@majida.com';

  const subject = `${newTaskCount} משימות מעקב לטיפול היום`;
  const body =
    `שלום,\n\n` +
    `יש לך ${newTaskCount} משימות מעקב חדשות לטיפול היום.\n` +
    `כנסי לממשק הניהול לצפייה: ${process.env.NEXT_PUBLIC_APP_URL}/tasks\n\n` +
    `Majida CRM`;

  if (isEmailMock) {
    console.info(`[Email Mock] To: ${adminEmail}, Subject: ${subject}\n${body}`);
    return;
  }

  // TODO: שליחה אמיתית דרך EMAIL_PROVIDER_API_KEY (SendGrid/Resend) מ-EMAIL_FROM_ADDRESS.
  console.info(`[Email] Would send to ${adminEmail}: ${subject}`);
}
