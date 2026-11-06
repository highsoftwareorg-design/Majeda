/**
 * API ניהול לקוחות — יצירה (משימה 3.2, FR-CL-01).
 *
 * זהו ה-API הפונה לצוות המרפאה (admin), בנפרד מ-`lib/actions/contact.ts`
 * (Server Action צר יותר, לטופס השארת פרטים בדף הנחיתה הציבורי — upsert
 * לפי טלפון בלבד). אין לשנות/לשכפל את contact.ts; זהו משטח API חדש.
 *
 * הערה (פרטיות — §11): אין להדפיס ללוג פרטי PII של לקוח (שם/טלפון/הערה).
 */

import { NextResponse } from "next/server";
import { Gender, MarketingConsentChannel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { listClients } from "@/lib/db/clients";
import {
  validateCreateClient,
  isClientValid,
  normalizeIsraeliPhone,
  type CreateClientInput,
} from "@/lib/validations/clients";

/**
 * GET /api/clients — רשימת לקוחות פעילים בלבד (ברירת מחדל, ללא ארכיון).
 *
 * פרמטר `q` (משימה 3.5, FR-CL-03) — חיפוש גלובלי לפי שם/טלפון.
 * פרמטר `gender` (משימה 3.7, FR-CL-05) — פילטר מין (female/male/other).
 * פרמטר `treatments` (משימה 3.6, FR-CL-04) — מזהי Treatment מופרדים בפסיק.
 * פרמטר `treatmentOp` — אופרטור: "AND" או "OR" (ברירת מחדל "OR").
 *
 * פרמטרים נוספים — משימה 3.9 (FR-CL-07):
 *   lastVisitFrom=YYYY-MM-DD  — ביקור אחרון >= תאריך
 *   lastVisitTo=YYYY-MM-DD    — ביקור אחרון <= תאריך
 *   notVisitedDays=60         — לא ביקר/ה מעל X ימים (מספר שלם חיובי)
 *   ageMin=18                 — גיל מינימלי
 *   ageMax=65                 — גיל מקסימלי
 *   source=landing_page       — מקור הגעה (התאמה חלקית)
 *   tags=id1,id2              — מזהי תגיות ישירות של לקוח (AND)
 *   therapist=שם              — שם מטפל/ת (התאמה חלקית)
 *   consentChannel=email      — ערוץ הסכמה לדיוור (ערך enum מדויק)
 *
 * כל הפרמטרים אופציונליים; ערכים לא חוקיים מתעלמים בשקט.
 */
export async function GET(request?: Request) {
  const params = request
    ? new URL(request.url).searchParams
    : new URLSearchParams();
  const q = params.get("q") ?? undefined;

  // ולידציה: רק ערכים חוקיים של ה-enum Gender יועברו ל-listClients.
  const VALID_GENDERS: Gender[] = ["female", "male", "other"];
  const genderParam = params.get("gender");
  const gender =
    genderParam && VALID_GENDERS.includes(genderParam as Gender)
      ? (genderParam as Gender)
      : undefined;

  // פרמטר טיפולים — מחרוזת מזהים מופרדים בפסיק; מסוננים לערכים לא ריקים.
  const treatmentsParam = params.get("treatments");
  const treatmentIds = treatmentsParam
    ? treatmentsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  const treatmentOpParam = params.get("treatmentOp");
  const treatmentOperator: "AND" | "OR" =
    treatmentOpParam === "AND" ? "AND" : "OR";

  // ─── פרמטרים נוספים — משימה 3.9 (FR-CL-07) ────────────────────────────

  // lastVisitFrom / lastVisitTo — תאריכים; דחיית Date לא תקין בשקט.
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
        // כדי לכלול את כל שעות היום של lastVisitTo, מגדירים את הסוף לסוף היום.
        const d = new Date(lastVisitToParam + "T23:59:59.999Z");
        return isNaN(d.getTime()) ? undefined : d;
      })()
    : undefined;

  // notVisitedDays — מספר שלם חיובי בלבד.
  const notVisitedDaysParam = params.get("notVisitedDays");
  const notVisitedDays = (() => {
    if (!notVisitedDaysParam) return undefined;
    const n = parseInt(notVisitedDaysParam, 10);
    return !isNaN(n) && n > 0 ? n : undefined;
  })();

  // ageMin / ageMax — מספרים שלמים אי-שליליים.
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

  // source — מחרוזת חופשית (התאמה חלקית ב-listClients).
  const source = params.get("source") ?? undefined;

  // tags — מזהי תגיות ישירות של לקוח, מופרדים בפסיק.
  const tagsParam = params.get("tags");
  const tagIds = tagsParam
    ? tagsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  // therapist — מחרוזת חופשית (התאמה חלקית ב-listClients).
  const therapist = params.get("therapist") ?? undefined;

  // consentChannel — ולידציה מול ערכי ה-enum.
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
    VALID_CONSENT_CHANNELS.includes(consentChannelParam as MarketingConsentChannel)
      ? (consentChannelParam as MarketingConsentChannel)
      : undefined;

  // ─────────────────────────────────────────────────────────────────────────

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
  return NextResponse.json({ clients });
}

/** POST /api/clients — יצירת לקוח חדש. */
export async function POST(request: Request) {
  let body: CreateClientInput;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "גוף הבקשה אינו JSON תקין" },
      { status: 400 }
    );
  }

  const errors = validateCreateClient(body);

  if (!isClientValid(errors)) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const phone = normalizeIsraeliPhone(body.phone);

  try {
    const client = await prisma.client.create({
      data: {
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        phone,
        gender: body.gender ?? undefined,
        birthDate: body.birthDate ? new Date(body.birthDate) : undefined,
        email: body.email?.trim() || undefined,
        city: body.city?.trim() || undefined,
        source: body.source?.trim() || undefined,
        utmSource: body.utmSource ?? undefined,
        utmMedium: body.utmMedium ?? undefined,
        utmCampaign: body.utmCampaign ?? undefined,
        utmTerm: body.utmTerm ?? undefined,
        utmContent: body.utmContent ?? undefined,
        note: body.note?.trim() || undefined,
        marketingConsentChannel: body.marketingConsentChannel ?? undefined,
        marketingConsentAt:
          body.marketingConsentChannel && body.marketingConsentChannel !== "none"
            ? new Date()
            : undefined,
        requestedTreatmentId: body.requestedTreatmentId || undefined,
        ...(body.tagIds?.length
          ? { tags: { create: body.tagIds.map((tagId) => ({ tagId })) } }
          : {}),
      },
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          errors: {
            phone: "מספר הטלפון כבר קיים במערכת ושייך ללקוח אחר — לא ניתן ליצור כפילות",
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "אירעה שגיאה ביצירת הלקוח" },
      { status: 500 }
    );
  }
}
