/**
 * עזרי ייצוא משותפים (משימות 10.1, 10.2) — בניית CSV, פורמט תאריכים לפי שעון ישראל,
 * ותגובת הורדה. הקובץ נוצר בזיכרון ומוחזר ישירות ללקוח — לא נשמר בשרת (§11, פרטיות).
 */

import { formatInTimeZone } from "date-fns-tz";

export const ISRAEL_TZ = "Asia/Jerusalem";

/** BOM של UTF-8 — מבטיח שאקסל יזהה עברית בקובץ CSV. */
export const UTF8_BOM = "﻿";

/** פורמט תאריך DD/MM/YYYY לפי שעון ישראל. */
export function formatIsraelDate(date: Date): string {
  return formatInTimeZone(date, ISRAEL_TZ, "dd/MM/yyyy");
}

/** פורמט שעה HH:mm לפי שעון ישראל. */
export function formatIsraelTime(date: Date): string {
  return formatInTimeZone(date, ISRAEL_TZ, "HH:mm");
}

/**
 * בונה תוכן CSV מכותרות ושורות. כל שדה עטוף במרכאות (כולל כפילות מרכאות פנימיות),
 * כך שפסיקים ושבירות שורה בתוך ערכים לא שוברים את המבנה.
 */
export function buildCsv(headers: string[], rows: string[][]): string {
  const toLine = (values: string[]) =>
    values.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
  return UTF8_BOM + [toLine(headers), ...rows.map(toLine)].join("\r\n");
}

/** תגובת הורדת CSV (UTF-8 עם BOM). */
export function csvResponse(content: string, filename: string): Response {
  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/** תגובת הורדת קובץ XLSX. */
export function xlsxResponse(buffer: ArrayBuffer | Uint8Array, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
