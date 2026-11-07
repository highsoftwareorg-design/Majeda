/**
 * GET /api/clients/export — ייצוא לקוחות מסוננים (משימות 3.12, 10.1, FR-CL-10).
 *
 * פרמטרים: `format=csv|xlsx` (ברירת מחדל: csv) + אותם פרמטרי סינון כמו GET /api/clients
 * (q, gender, treatments, treatmentOp, lastVisitFrom, lastVisitTo, notVisitedDays,
 * ageMin, ageMax, source, tags, therapist, consentChannel).
 *
 * שדות: שם פרטי, שם משפחה, טלפון, מין, תאריך לידה, עיר, מקור, תגיות (מופרדות בפסיק),
 * ביקור אחרון, מספר ביקורים, הסכמה לדיוור, סטטוס.
 *
 * הרשאה: אדמין בלבד (session.user.role === "admin"). לא מחובר → 401, לא אדמין → 403.
 * הקובץ לא נשמר בשרת — מוחזר ישירות בתגובה (§11, PII).
 */

import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import type { Gender, MarketingConsentChannel } from "@prisma/client";
import { auth } from "@/lib/auth/auth";
import { listClients } from "@/lib/db/clients";
import { prisma } from "@/lib/db/prisma";
import {
  buildCsv,
  csvResponse,
  formatIsraelDate,
  xlsxResponse,
} from "@/lib/exports/csv";

const EXPORT_HEADERS = [
  "שם פרטי",
  "שם משפחה",
  "טלפון",
  "מין",
  "תאריך לידה",
  "עיר",
  "מקור",
  "תגיות",
  "ביקור אחרון",
  "ביקורים",
  "הסכמה לדיוור",
  "סטטוס",
];

const GENDER_LABELS: Record<Gender, string> = {
  female: "נקבה",
  male: "זכר",
  other: "אחר",
};

const CONSENT_LABELS: Record<MarketingConsentChannel, string> = {
  none: "ללא הסכמה",
  landing_page: "דף נחיתה",
  whatsapp: "וואטסאפ",
  sms: "SMS",
  email: "אימייל",
  in_person: "במקום",
};

const STATUS_LABELS: Record<"active" | "archived", string> = {
  active: "פעיל",
  archived: "בארכיון",
};

/**
 * GET /api/clients/export
 */
export async function GET(request: Request) {
  // ─── הרשאות: אדמין בלבד ─────────────────────────────────────────────────
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  }
  if (session.user?.role !== "admin") {
    return NextResponse.json({ error: "אין הרשאה לייצוא" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;

  // ─── פורמט הייצוא ───────────────────────────────────────────────────────
  const format = params.get("format") ?? "csv";
  if (format !== "csv" && format !== "xlsx") {
    return NextResponse.json(
      { error: "פורמט לא נתמך (csv או xlsx)" },
      { status: 400 }
    );
  }

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

  // ─── שליפת לקוחות מסוננים (ללא pagination) ─────────────────────────────
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

  // ─── נתונים נלווים: תגיות וסיכום ביקורים (שאילתות מאוגדות, ללא N+1) ────
  const clientIds = clients.map((c) => c.id);
  const [clientTags, visitStats] =
    clientIds.length > 0
      ? await Promise.all([
          prisma.clientTag.findMany({
            where: { clientId: { in: clientIds } },
            select: { clientId: true, tag: { select: { name: true } } },
            orderBy: { tag: { name: "asc" } },
          }),
          prisma.visit.groupBy({
            by: ["clientId"],
            where: { clientId: { in: clientIds } },
            _count: { _all: true },
            _max: { visitDate: true },
          }),
        ])
      : [[], []];

  const tagsByClient = new Map<string, string[]>();
  for (const ct of clientTags) {
    const list = tagsByClient.get(ct.clientId) ?? [];
    list.push(ct.tag.name);
    tagsByClient.set(ct.clientId, list);
  }

  const visitsByClient = new Map(
    visitStats.map((v) => [
      v.clientId,
      { count: v._count._all, lastVisit: v._max.visitDate },
    ])
  );

  // ─── בניית שורות (משותפות ל-CSV ול-XLSX) ───────────────────────────────
  const rows: string[][] = clients.map((c) => {
    const visits = visitsByClient.get(c.id);
    return [
      c.firstName,
      c.lastName,
      c.phone,
      c.gender ? GENDER_LABELS[c.gender] : "",
      c.birthDate ? formatIsraelDate(c.birthDate) : "",
      c.city ?? "",
      c.source,
      (tagsByClient.get(c.id) ?? []).join(", "),
      visits?.lastVisit ? formatIsraelDate(visits.lastVisit) : "",
      String(visits?.count ?? 0),
      CONSENT_LABELS[c.marketingConsentChannel],
      STATUS_LABELS[c.status],
    ];
  });

  const dateStr = new Date().toISOString().slice(0, 10);

  // ─── CSV ────────────────────────────────────────────────────────────────
  if (format === "csv") {
    return csvResponse(
      buildCsv(EXPORT_HEADERS, rows),
      `clients-${dateStr}.csv`
    );
  }

  // ─── XLSX ───────────────────────────────────────────────────────────────
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("לקוחות", {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
  });
  // הגדרת העמודות כותבת את שורת הכותרות (שורה 1) אוטומטית.
  sheet.columns = EXPORT_HEADERS.map((header) => ({
    header,
    width: Math.max(12, header.length + 4),
  }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return xlsxResponse(buffer as ArrayBuffer, `clients-${dateStr}.xlsx`);
}
