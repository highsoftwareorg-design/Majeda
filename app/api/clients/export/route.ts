/**
 * GET /api/clients/export — ייצוא לקוחות מסוננים ל-CSV (משימה 3.12, FR-CL-10).
 *
 * פרמטרים: זהים ל-GET /api/clients (q, gender, treatments, treatmentOp,
 * lastVisitFrom, lastVisitTo, notVisitedDays, ageMin, ageMax, source,
 * tags, therapist, consentChannel).
 *
 * תגובה: קובץ CSV בקידוד UTF-8 (עם BOM לתמיכה ב-Excel), עם כותרות:
 *   שם פרטי, שם משפחה, טלפון, אימייל, עיר, מקור הגעה, תאריך הוספה
 *
 * הרשאה: TODO: restrict to admin role
 *   (placeholder — בדיקת תפקיד תמומש בתחום הרשאות נפרד; ראו SRS §11.1).
 *
 * אבטחה (§11): הנתונים הם PII — יש לוודא שהנתיב מוגן ב-middleware לפני שחשיפה לפרודקשן.
 */

import { Gender, MarketingConsentChannel } from "@prisma/client";
import { listClients } from "@/lib/db/clients";

/** עוטף שדה CSV אם יש בו פסיקים, מרכאות או שבירות שורה. */
function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** פורמט תאריך לפי הנהוג בישראל: DD/MM/YYYY. */
function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * GET /api/clients/export
 *
 * TODO: restrict to admin role — בדיקת תפקיד תמומש עם מימוש הרשאות מלא (SRS §11.1).
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  // ─── פענוח פרמטרים — זהה ל-GET /api/clients/route.ts ───────────────────
  const q = params.get("q") ?? undefined;

  const VALID_GENDERS: Gender[] = ["female", "male", "other"];
  const genderParam = params.get("gender");
  const gender =
    genderParam && VALID_GENDERS.includes(genderParam as Gender)
      ? (genderParam as Gender)
      : undefined;

  const treatmentsParam = params.get("treatments");
  const treatmentIds = treatmentsParam
    ? treatmentsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  const treatmentOpParam = params.get("treatmentOp");
  const treatmentOperator: "AND" | "OR" =
    treatmentOpParam === "AND" ? "AND" : "OR";

  const lastVisitFromParam = params.get("lastVisitFrom");
  const lastVisitFrom = lastVisitFromParam
    ? (() => {
        const d = new Date(lastVisitFromParam);
        return isNaN(d.getTime()) ? undefined : d;
      })()
    : undefined;

  const lastVisitToParam = params.get("lastVisitTo");
  const lastVisitTo = lastVisitToParam
    ? (() => {
        const d = new Date(lastVisitToParam + "T23:59:59.999Z");
        return isNaN(d.getTime()) ? undefined : d;
      })()
    : undefined;

  const notVisitedDaysParam = params.get("notVisitedDays");
  const notVisitedDays = (() => {
    if (!notVisitedDaysParam) return undefined;
    const n = parseInt(notVisitedDaysParam, 10);
    return !isNaN(n) && n > 0 ? n : undefined;
  })();

  const ageMinParam = params.get("ageMin");
  const ageMin = (() => {
    if (!ageMinParam) return undefined;
    const n = parseInt(ageMinParam, 10);
    return !isNaN(n) && n >= 0 ? n : undefined;
  })();

  const ageMaxParam = params.get("ageMax");
  const ageMax = (() => {
    if (!ageMaxParam) return undefined;
    const n = parseInt(ageMaxParam, 10);
    return !isNaN(n) && n >= 0 ? n : undefined;
  })();

  const source = params.get("source") ?? undefined;

  const tagsParam = params.get("tags");
  const tagIds = tagsParam
    ? tagsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  const therapist = params.get("therapist") ?? undefined;

  const VALID_CONSENT_CHANNELS: MarketingConsentChannel[] = [
    "none",
    "landing_page",
    "whatsapp",
    "sms",
    "email",
    "in_person",
  ];
  const consentChannelParam = params.get("consentChannel");
  const marketingConsentChannel =
    consentChannelParam &&
    VALID_CONSENT_CHANNELS.includes(
      consentChannelParam as MarketingConsentChannel
    )
      ? (consentChannelParam as MarketingConsentChannel)
      : undefined;

  // ─── שליפת לקוחות מסוננים ───────────────────────────────────────────────
  const clients = await listClients({
    search: q,
    gender,
    treatmentIds,
    treatmentOperator,
    lastVisitFrom,
    lastVisitTo,
    notVisitedDays,
    ageMin,
    ageMax,
    source,
    tagIds,
    therapist,
    marketingConsentChannel,
  });

  // ─── בניית CSV ───────────────────────────────────────────────────────────
  const CSV_HEADERS = [
    "שם פרטי",
    "שם משפחה",
    "טלפון",
    "אימייל",
    "עיר",
    "מקור הגעה",
    "תאריך הוספה",
  ];

  const rows = clients.map((client) =>
    [
      client.firstName,
      client.lastName,
      client.phone,
      client.email ?? "",
      client.city ?? "",
      client.source,
      formatDate(client.createdAt),
    ]
      .map(escapeCsvField)
      .join(",")
  );

  // BOM (﻿) מבטיח שקבצי CSV בעברית ייפתחו נכון ב-Excel ללא הגדרת קידוד ידנית.
  const csvContent =
    "﻿" + [CSV_HEADERS.join(","), ...rows].join("\r\n");

  // שם קובץ לפי תאריך הייצוא.
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `clients-${dateStr}.csv`;

  return new Response(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
