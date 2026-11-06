import { Gender, MarketingConsentChannel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { normalizeHebrewSearchTerm } from "@/lib/validations/hebrew-search";

/**
 * שאילתת ברירת מחדל לרשימת לקוחות — מחריגה לקוחות בארכיון (status="archived")
 * אלא אם התבקש אחרת במפורש (FR-CL-01: ארכיון אינו מחיקה פיזית, אך גם לא
 * אמור להופיע ברשימות הרגילות). נוצר כבר כעת כדי שמשימות עתידיות (3.5
 * רשימת לקוחות, 3.3/3.4 כפילויות/סגמנטים) לא "יסתרו" את ההתנהגות הזו
 * בטעות ע"י שליפה ישירה דרך `prisma.client.findMany` בלי פילטר.
 *
 * `search` (משימה 3.5, FR-CL-03): חיפוש גלובלי לפי שם פרטי/שם משפחה
 * (התאמה חלקית, לא רגישה לרישיות) **או** טלפון (התאמה חלקית על המחרוזת
 * הגולמית, כפי ששמורה ב-DB אחרי נרמול ביצירה) — מסונן ברמת ה-DB (Prisma
 * `contains`), לא ברמת הקוד, לשמירה על סקיילביליות עם כמות לקוחות גדלה.
 *
 * משימה 3.8 (FR-CL-06): הורחב לחפש גם ב`note` ובשמות תגיות (`Tag.name`) תוך
 * נרמול עברי — הסרת ניקוד ותחילית יחידה ה/ו/ב ממונח החיפוש לפני בניית השאילתה
 * (ראו `normalizeHebrewSearchTerm` ב-`lib/validations/hebrew-search.ts`).
 * הנרמול מתבצע על מונח החיפוש בלבד; הנתונים ב-DB נשמרים כרגיל.
 *
 * משימה 3.9 (FR-CL-07): פילטרים נוספים — ביקור אחרון (טווח תאריכים), "לא
 * ביקר/ה מעל X ימים", טווח גילאים (מחושב מ-birthDate), מקור הגעה, תגיות
 * ישירות של לקוח (AND), מטפל/ת (חיפוש חלקי על Visit.therapist), ערוץ הסכמה
 * לדיוור. כולם מסוננים ברמת ה-DB בתוך אותה שאילתה.
 */
export async function listClients(options?: {
  includeArchived?: boolean;
  search?: string;
  /** פילטר מין (FR-CL-05, משימה 3.7) — מסונן ברמת ה-DB כשדה סקלרי פשוט. */
  gender?: Gender;
  /** פילטר לפי טיפולים שבוצעו (FR-CL-04, משימה 3.6) — רשימת מזהי Treatment. */
  treatmentIds?: string[];
  /** אופרטור הפילטר: "AND" = כל הטיפולים בוצעו, "OR" = לפחות אחד (ברירת מחדל). */
  treatmentOperator?: "AND" | "OR";
  /**
   * FR-CL-07 (משימה 3.9) — פילטרים נוספים:
   *
   * lastVisitFrom/lastVisitTo: טווח תאריך ביקור אחרון.
   *   lastVisitFrom: לקוחות שהביקור האחרון שלהם >= תאריך זה
   *                  (מקביל ל: יש לפחות ביקור אחד עם visitDate >= lastVisitFrom).
   *   lastVisitTo:   לקוחות שהביקור האחרון שלהם <= תאריך זה
   *                  (יש לפחות ביקור אחד AND אין ביקור > lastVisitTo).
   *
   * notVisitedDays: לא ביקר/ה מעל X ימים — לקוחות שאין להם ביקור ב-X הימים
   *   האחרונים (כולל לקוחות ללא ביקורים כלל).
   *
   * ageMin/ageMax: טווח גילאים. גיל = floor((היום - birthDate) / 365.25).
   *   ageMin: birthDate <= היום − ageMin*365.25 ימים.
   *   ageMax: birthDate > היום − (ageMax+1)*365.25 ימים.
   *   לקוחות ללא birthDate לא יתאימו לאף אחד מהפילטרים האלה.
   *
   * source: התאמה חלקית על שדה source (לא רגישה לרישיות).
   *
   * tagIds: תגיות ישירות של לקוח (ClientTag) — AND: כל התגיות שצוינו.
   *   שונה מ-treatmentIds שמסנן לפי טיפולים בביקורים.
   *
   * therapist: התאמה חלקית על Visit.therapist — לקוחות שהייתה להם לפחות
   *   ביקור אחד עם המטפל/ת שצוינ/ה.
   *
   * marketingConsentChannel: פילטר מדויק על שדה MarketingConsentChannel.
   */
  lastVisitFrom?: Date;
  lastVisitTo?: Date;
  notVisitedDays?: number;
  ageMin?: number;
  ageMax?: number;
  source?: string;
  /** תגיות ישירות על הלקוח (ClientTag) — AND: כל התגיות שצוינו. */
  tagIds?: string[];
  therapist?: string;
  marketingConsentChannel?: MarketingConsentChannel;
}) {
  const statusFilter: Prisma.ClientWhereInput | undefined =
    options?.includeArchived ? undefined : { status: "active" };

  const search = options?.search?.trim();
  // מונח מנורמל לעברית (ללא ניקוד, ללא תחילית ה/ו/ב) — משמש לחיפוש בהערות
  // ובשמות תגיות (משימה 3.8, FR-CL-06). אם הנרמול מחזיר מחרוזת ריקה (למשל
  // כשהמונח הוא רק "ה" או "ו") — לא מוסיפים ענפי OR עבור הערות/תגיות.
  const normalizedSearch = search ? normalizeHebrewSearchTerm(search) : undefined;
  const searchFilter: Prisma.ClientWhereInput | undefined = search
    ? {
        OR: [
          { phone: { contains: search } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          // חיפוש בשדה הערות (משימה 3.8) — משתמש במונח המנורמל
          ...(normalizedSearch
            ? ([
                {
                  note: {
                    contains: normalizedSearch,
                    mode: "insensitive",
                  },
                },
                {
                  tags: {
                    some: {
                      tag: {
                        name: {
                          contains: normalizedSearch,
                          mode: "insensitive",
                        },
                      },
                    },
                  },
                },
              ] as Prisma.ClientWhereInput[])
            : []),
        ],
      }
    : undefined;

  // פילטר מין — מחיל רק כשהפרמטר סופק (undefined = "הכל", ללא סינון).
  const genderFilter: Prisma.ClientWhereInput | undefined = options?.gender
    ? { gender: options.gender }
    : undefined;

  // פילטר טיפולים (משימה 3.6, FR-CL-04).
  // OR: לקוח שיש לו לפחות ביקור אחד הכולל אחד מהטיפולים שנבחרו.
  // AND: לקוח שביצע את **כל** הטיפולים שנבחרו (לאו דווקא באותו ביקור).
  const treatmentIds = options?.treatmentIds?.filter(Boolean);
  const treatmentFilter: Prisma.ClientWhereInput | undefined =
    treatmentIds && treatmentIds.length > 0
      ? options?.treatmentOperator === "AND"
        ? {
            AND: treatmentIds.map((tid) => ({
              visits: {
                some: {
                  visitTreatments: {
                    some: { treatmentId: tid },
                  },
                },
              },
            })),
          }
        : // OR — ברירת מחדל
          {
            visits: {
              some: {
                visitTreatments: {
                  some: { treatmentId: { in: treatmentIds } },
                },
              },
            },
          }
      : undefined;

  // ─── פילטרים נוספים — משימה 3.9 (FR-CL-07) ───────────────────────────────

  // קבוע כדי לאמוד גיל וסף "לא ביקר" ממועד אחד עקבי בתוך הקריאה.
  const now = new Date();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const MS_PER_YEAR = 365.25 * MS_PER_DAY;

  // lastVisitFrom: הביקור האחרון >= תאריך.
  // מספיק לבדוק שיש לפחות ביקור אחד עם visitDate >= lastVisitFrom, כי
  // אם הביקור האחרון >= X, בהכרח קיים ביקור >= X, ולהפך.
  const lastVisitFromFilter: Prisma.ClientWhereInput | undefined =
    options?.lastVisitFrom
      ? { visits: { some: { visitDate: { gte: options.lastVisitFrom } } } }
      : undefined;

  // lastVisitTo: הביקור האחרון <= תאריך.
  // מימוש: (1) קיים לפחות ביקור אחד עם visitDate <= lastVisitTo,
  //         (2) אין ביקורים לאחר lastVisitTo.
  // ביחד: כל הביקורים <= lastVisitTo וקיים לפחות אחד.
  const lastVisitToFilter: Prisma.ClientWhereInput | undefined =
    options?.lastVisitTo
      ? {
          AND: [
            { visits: { some: { visitDate: { lte: options.lastVisitTo } } } },
            { visits: { every: { visitDate: { lte: options.lastVisitTo } } } },
          ],
        }
      : undefined;

  // notVisitedDays: לא ביקר/ה מעל X ימים.
  // visits.none.visitDate >= threshold → אין ביקורים ב-X הימים האחרונים.
  // כולל לקוחות ללא ביקורים בכלל (none על קבוצה ריקה = true).
  const notVisitedFilter: Prisma.ClientWhereInput | undefined =
    options?.notVisitedDays != null && options.notVisitedDays > 0
      ? {
          visits: {
            none: {
              visitDate: {
                gte: new Date(now.getTime() - options.notVisitedDays * MS_PER_DAY),
              },
            },
          },
        }
      : undefined;

  // ageMin: גיל >= ageMin → birthDate <= היום − ageMin*365.25 ימים.
  // לקוחות ללא birthDate (null) לא יתאימו לתנאי זה.
  const ageMinFilter: Prisma.ClientWhereInput | undefined =
    options?.ageMin != null
      ? {
          birthDate: {
            lte: new Date(now.getTime() - options.ageMin * MS_PER_YEAR),
          },
        }
      : undefined;

  // ageMax: גיל <= ageMax → birthDate > היום − (ageMax+1)*365.25 ימים.
  const ageMaxFilter: Prisma.ClientWhereInput | undefined =
    options?.ageMax != null
      ? {
          birthDate: {
            gt: new Date(now.getTime() - (options.ageMax + 1) * MS_PER_YEAR),
          },
        }
      : undefined;

  // source: התאמה חלקית, לא רגישה לרישיות.
  const sourceFilter: Prisma.ClientWhereInput | undefined =
    options?.source?.trim()
      ? {
          source: {
            contains: options.source.trim(),
            mode: "insensitive",
          },
        }
      : undefined;

  // tagIds: תגיות ישירות על הלקוח (ClientTag) — AND: כל התגיות שצוינו.
  // שונה מ-treatmentIds (תחום 3.6) שמסנן לפי טיפולים בביקורים.
  const clientTagIds = options?.tagIds?.filter(Boolean);
  const clientTagIdsFilter: Prisma.ClientWhereInput | undefined =
    clientTagIds && clientTagIds.length > 0
      ? clientTagIds.length === 1
        ? { tags: { some: { tagId: clientTagIds[0] } } }
        : {
            AND: clientTagIds.map((tagId) => ({
              tags: { some: { tagId } },
            })),
          }
      : undefined;

  // therapist: התאמה חלקית על Visit.therapist — לקוחות שהייתה להם לפחות
  // ביקור אחד עם המטפל/ת שצוינ/ה.
  const therapistFilter: Prisma.ClientWhereInput | undefined =
    options?.therapist?.trim()
      ? {
          visits: {
            some: {
              therapist: {
                contains: options.therapist.trim(),
                mode: "insensitive",
              },
            },
          },
        }
      : undefined;

  // marketingConsentChannel: פילטר מדויק על שדה ה-enum.
  const consentFilter: Prisma.ClientWhereInput | undefined =
    options?.marketingConsentChannel != null
      ? { marketingConsentChannel: options.marketingConsentChannel }
      : undefined;

  // ─── סיום פילטרים 3.9 ────────────────────────────────────────────────────

  const filters = [
    statusFilter,
    searchFilter,
    genderFilter,
    treatmentFilter,
    lastVisitFromFilter,
    lastVisitToFilter,
    notVisitedFilter,
    ageMinFilter,
    ageMaxFilter,
    sourceFilter,
    clientTagIdsFilter,
    therapistFilter,
    consentFilter,
  ].filter(
    (f): f is Prisma.ClientWhereInput => f !== undefined
  );

  const where: Prisma.ClientWhereInput | undefined =
    filters.length === 0
      ? undefined
      : filters.length === 1
        ? filters[0]
        : { AND: filters };

  return prisma.client.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

export async function getClientById(id: string) {
  return prisma.client.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } } },
  });
}

/**
 * מפתח להשוואת טלפונים לצורך זיהוי כפילויות (משימה 3.4, FR-CL-02).
 *
 * חרף אילוץ הייחודיות של `phone` ב-DB (@unique), שתי רשומות יכולות בכל זאת
 * "לייצג" את אותו מספר טלפון בפועל אם הן הוזנו/יובאו בפורמטים שונים לפני
 * שעברו נרמול (למשל "+972501234567" מול "0501234567", או עם מקפים/רווחים) —
 * אלו מחרוזות שונות מבחינת ה-DB ולכן אינן מתנגשות באילוץ, אך הן אותו לקוח.
 * לכן ההשוואה כאן אינה על `phone` הגולמי אלא על 8 הספרות האחרונות שלו
 * (המספר המקומי בפועל, בלי קידומת מדינה/אפס מוביל) — זהה בכוונה ל"טלפון
 * דומה מאוד" שהמשימה מבקשת, כדי לא לבנות שתי לוגיקות נפרדות (מדויק/מקורב).
 */
export function phoneSimilarityKey(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, "");
  return digitsOnly.slice(-8);
}

/** לקוח + התגיות שלו (שם מפורש, לא רק מזהה) — לצורך תצוגת מיזוג (משימה 3.4). */
async function listActiveClientsWithTags() {
  return prisma.client.findMany({
    where: { status: "active" },
    include: { tags: { include: { tag: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export type DuplicateClientGroup = {
  key: string;
  clients: Awaited<ReturnType<typeof listActiveClientsWithTags>>;
};

/**
 * איתור קבוצות לקוחות (פעילים) עם מספר טלפון זהה או דומה מאוד (8 ספרות
 * אחרונות זהות) — משימה 3.4. לקוחות בארכיון אינם נכללים בסקירת כפילויות
 * (כבר "נפתרו" או שאינם רלוונטיים לעבודה השוטפת).
 */
export async function findDuplicateClientGroups(): Promise<DuplicateClientGroup[]> {
  const clients = await listActiveClientsWithTags();

  const groups = new Map<string, typeof clients>();
  for (const client of clients) {
    const key = phoneSimilarityKey(client.phone);
    if (!key) continue;
    const existing = groups.get(key);
    if (existing) {
      existing.push(client);
    } else {
      groups.set(key, [client]);
    }
  }

  return Array.from(groups.entries())
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({
      key,
      clients: group.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      ),
    }));
}
