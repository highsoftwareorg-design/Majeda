'use client';

/**
 * MessageTimeline — יומן שליחה בפרופיל הלקוח (משימה 6.7, FR-WA-06).
 *
 * מציג רשימת הודעות ממוינת מהחדש לישן: תאריך, סוג, תבנית, סטטוס עם אינדיקטור.
 */

import React from 'react';

interface Message {
  id: string;
  channel: string;
  templateId: string | null;
  status: string;
  sourceType: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface MessageTimelineProps {
  messages: Message[];
}

const STATUS_LABELS: Record<string, { label: string; color: string; dot: string }> = {
  MOCK:      { label: 'מדומה (פיתוח)', color: 'text-orange-600', dot: 'bg-orange-400' },
  PENDING:   { label: 'ממתין',         color: 'text-gray-500',   dot: 'bg-gray-400'   },
  SENDING:   { label: 'בשליחה',        color: 'text-blue-500',   dot: 'bg-blue-400'   },
  SENT:      { label: 'נשלח',          color: 'text-green-600',  dot: 'bg-green-500'  },
  DELIVERED: { label: 'נמסר',          color: 'text-blue-600',   dot: 'bg-blue-500'   },
  READ:      { label: 'נקרא',          color: 'text-purple-600', dot: 'bg-purple-500' },
  FAILED:    { label: 'נכשל',          color: 'text-red-600',    dot: 'bg-red-500'    },
};

const SOURCE_LABELS: Record<string, string> = {
  appointment: 'תזכורת תור',
  follow_up:   'מעקב',
  campaign:    'קמפיין',
  consent:     'טופס הסכמה',
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  sms:      'SMS',
  email:    'דואל',
};

export function MessageTimeline({ messages }: MessageTimelineProps) {
  if (messages.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-right py-3">
        אין הודעות ללקוח זה
      </p>
    );
  }

  return (
    <div className="space-y-2" dir="rtl">
      {messages.map((msg) => {
        const statusInfo = STATUS_LABELS[msg.status] ?? {
          label: msg.status,
          color: 'text-gray-600',
          dot: 'bg-gray-400',
        };
        const sourceLabel = msg.sourceType
          ? (SOURCE_LABELS[msg.sourceType] ?? msg.sourceType)
          : 'אחר';
        const channelLabel = CHANNEL_LABELS[msg.channel] ?? msg.channel;
        const date = new Date(msg.sentAt ?? msg.createdAt);
        const dateStr = date.toLocaleDateString('he-IL', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        const timeStr = date.toLocaleTimeString('he-IL', {
          hour: '2-digit',
          minute: '2-digit',
        });

        return (
          <div
            key={msg.id}
            className="flex items-center justify-between gap-3 p-3 border border-gray-200 rounded-lg bg-white"
          >
            {/* מידע שמאלי (RTL: אנחנו ב-dir=rtl, אז "שמאלי" הוא בתחילת הרצף) */}
            <div className="flex flex-col text-right min-w-0">
              <span className="text-sm font-medium text-charcoal truncate">
                {sourceLabel}
              </span>
              <span className="text-xs text-gray-500 mt-0.5">
                {channelLabel}
                {msg.templateId && (
                  <span className="mr-1 text-gray-400">· {msg.templateId}</span>
                )}
              </span>
            </div>

            {/* סטטוס ותאריך (ימני ב-RTL) */}
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-sm font-medium ${statusInfo.color} flex items-center gap-1`}>
                <span
                  className={`inline-block w-2 h-2 rounded-full ${statusInfo.dot}`}
                  aria-hidden="true"
                />
                {statusInfo.label}
              </span>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {dateStr} {timeStr}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
