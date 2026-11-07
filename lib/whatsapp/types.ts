/**
 * lib/whatsapp/types.ts
 * Task 6.1 — ממשקי WhatsApp משותפים לכל המימושים (Mock ו-Twilio).
 */

export interface SendTemplateParams {
  /** מספר טלפון היעד בפורמט E.164 (לדוגמה: +972501234567) */
  to: string;
  /** שם/מזהה התבנית (Twilio Content Template SID or friendly name) */
  templateName: string;
  /** ערכי המשתנים שימולאו בגוף התבנית */
  variables: Record<string, string>;
  /** מזהה רשומת Message ב-DB — לעדכון סטטוס לאחר השליחה */
  messageId: string;
}

export interface WebhookEvent {
  type: "status_update" | "inbound_message";
  /** מזהה ה-Message שעוּדכן (מתוך externalId) */
  messageId?: string;
  /** סטטוס חדש: delivered | read | failed וכו' */
  status?: string;
  /** מספר הטלפון ששלח הודעה נכנסת */
  from?: string;
  /** גוף הודעה נכנסת */
  body?: string;
  timestamp?: string;
}

export interface WhatsAppService {
  /**
   * שולח תבנית WhatsApp ומחזיר את ה-externalId (Twilio SID).
   * חייב לעדכן את Message.status ב-DB בתוך הפונקציה.
   */
  sendTemplate(params: SendTemplateParams): Promise<{ externalId: string }>;

  /**
   * מנתח אירוע webhook (עדכון סטטוס / הודעה נכנסת).
   * מחזיר null אם החתימה אינה תקינה או הפורמט אינו מוכר.
   */
  parseWebhookEvent(body: unknown, signature: string): WebhookEvent | null;
}
