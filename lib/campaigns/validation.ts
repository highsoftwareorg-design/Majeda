/**
 * ולידציה משותפת לקמפיינים WhatsApp (משימה 9.1, FR-MK-01).
 *
 * משמשת את POST /api/campaigns וגם את PATCH /api/campaigns/[id].
 * ב-PATCH כל השדות אופציונליים (עדכון חלקי); ב-POST רק `name` הוא חובה.
 *
 * הערה (פרטיות — §11): אין להדפיס ללוג את תוכן הבקשה.
 */

export interface CampaignInput {
  name?: string;
  segmentId?: string | null;
  templateId?: string | null;
  mediaUrl?: string | null;
  linkButtonUrl?: string | null;
  linkButtonText?: string | null;
  scheduledAt?: Date | null;
}

export type CampaignParseResult =
  | { ok: true; data: CampaignInput }
  | { ok: false; error: string };

/** מגבלת תווים לכפתור תבנית WhatsApp (Meta) */
const LINK_BUTTON_TEXT_MAX = 25;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** מחזיר string מנורמל (trim), null לערך ריק, או undefined אם השדה לא נשלח */
function optionalString(
  raw: unknown,
  field: string
): { value: string | null | undefined } | { error: string } {
  if (raw === undefined) return { value: undefined };
  if (raw === null) return { value: null };
  if (typeof raw !== "string") return { error: `השדה ${field} חייב להיות טקסט` };
  const trimmed = raw.trim();
  return { value: trimmed === "" ? null : trimmed };
}

/**
 * ולידציה ונרמול של גוף בקשה ליצירה/עדכון קמפיין.
 * @param body   גוף הבקשה (אחרי JSON.parse)
 * @param mode   "create" — name חובה; "update" — כל השדות אופציונליים
 */
export function parseCampaignInput(
  body: unknown,
  mode: "create" | "update"
): CampaignParseResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "גוף הבקשה אינו תקין" };
  }
  const raw = body as Record<string, unknown>;
  const data: CampaignInput = {};

  // שם הקמפיין
  if (raw.name !== undefined || mode === "create") {
    if (typeof raw.name !== "string" || !raw.name.trim()) {
      return { ok: false, error: "שם הקמפיין הוא שדה חובה" };
    }
    const name = raw.name.trim();
    if (name.length > 100) {
      return { ok: false, error: "שם הקמפיין לא יכול לעלות על 100 תווים" };
    }
    data.name = name;
  }

  // מזהי סגמנט ותבנית (אופציונליים — נבדקים מול ה-DB ב-route)
  for (const field of ["segmentId", "templateId"] as const) {
    if (raw[field] === undefined) continue;
    const res = optionalString(raw[field], field);
    if ("error" in res) return { ok: false, error: res.error };
    data[field] = res.value;
  }

  // URL מדיה (תמונה/וידאו)
  if (raw.mediaUrl !== undefined) {
    const res = optionalString(raw.mediaUrl, "mediaUrl");
    if ("error" in res) return { ok: false, error: res.error };
    if (res.value && (!isHttpUrl(res.value) || res.value.length > 2000)) {
      return { ok: false, error: "כתובת המדיה אינה תקינה (נדרש קישור http/https)" };
    }
    data.mediaUrl = res.value;
  }

  // כפתור קישור: כתובת + טקסט
  if (raw.linkButtonUrl !== undefined) {
    const res = optionalString(raw.linkButtonUrl, "linkButtonUrl");
    if ("error" in res) return { ok: false, error: res.error };
    if (res.value && (!isHttpUrl(res.value) || res.value.length > 2000)) {
      return { ok: false, error: "כתובת כפתור הקישור אינה תקינה (נדרש קישור http/https)" };
    }
    data.linkButtonUrl = res.value;
  }
  if (raw.linkButtonText !== undefined) {
    const res = optionalString(raw.linkButtonText, "linkButtonText");
    if ("error" in res) return { ok: false, error: res.error };
    if (res.value && res.value.length > LINK_BUTTON_TEXT_MAX) {
      return {
        ok: false,
        error: `טקסט כפתור הקישור לא יכול לעלות על ${LINK_BUTTON_TEXT_MAX} תווים`,
      };
    }
    data.linkButtonText = res.value;
  }

  // מועד תזמון (ISO string או null)
  if (raw.scheduledAt !== undefined) {
    if (raw.scheduledAt === null || raw.scheduledAt === "") {
      data.scheduledAt = null;
    } else if (typeof raw.scheduledAt === "string") {
      const date = new Date(raw.scheduledAt);
      if (isNaN(date.getTime())) {
        return { ok: false, error: "מועד התזמון אינו תקין" };
      }
      data.scheduledAt = date;
    } else {
      return { ok: false, error: "מועד התזמון אינו תקין" };
    }
  }

  return { ok: true, data };
}
