/**
 * בדיקת אינטגרציה למשימה 3.8: חיפוש בהערות ובתגיות עם נרמול עברי
 * (FR-CL-06) — מסונן ברמת ה-DB (Prisma `contains`), עם הסרת תחילית ה/ו/ב
 * ממונח החיפוש לפני בניית השאילתה.
 *
 * קריטריוני קבלה:
 *   1. הערה "בטיפול עמוק" נמצאת בחיפוש "טיפול" (contains רגיל — "ב" הוא חלק
 *      ממחרוזת ה-DB ו-"טיפול" הוא substring שלה, לכן normalizeHebrewSearchTerm
 *      שומר "טיפול" כמות שהוא).
 *   2. הערה "והגיעה מאוחר" נמצאת בחיפוש "הגיעה" (normalizeHebrewSearchTerm
 *      מסיר "ה" → "גיעה"; "גיעה" הוא substring של "הגיעה" שב-"והגיעה מאוחר").
 *   3. חיפוש לפי שם תגית מוצא את הלקוחה המתויגת.
 *
 * חשוב (פרטיות — §11): אין להשתמש בנתוני לקוחות אמיתיים. מספרי הטלפון כאן
 * הם מספרי בדיקה מומצאים בעליל, ונמחקים מהמסד בסיום הבדיקה (afterAll).
 *
 * Opt-in: רצה רק עם RUN_DB_TESTS=1 וגם DATABASE_URL מוגדר, כמו שאר בדיקות
 * האינטגרציה בפרויקט.
 */
import { config as loadEnv } from "dotenv";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const dbTestsEnabled = process.env.RUN_DB_TESTS === "1";
if (dbTestsEnabled) loadEnv({ path: ".env.local", quiet: true });

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

describe.skipIf(!dbTestsEnabled || !hasDatabaseUrl)(
  "listClients note/tag search (task 3.8, real DB)",
  () => {
    // מספרי בדיקה מומצאים בעליל — אינם שייכים ללקוחות אמיתיות.
    const PHONE_NOTE_BTIPU = "0509999031"; // הערה: "בטיפול עמוק"
    const PHONE_NOTE_VHIGIA = "0509999032"; // הערה: "והגיעה מאוחר"
    const PHONE_TAGGED = "0509999033"; // תגית: TEST_TAG_NAME
    const PHONES = [PHONE_NOTE_BTIPU, PHONE_NOTE_VHIGIA, PHONE_TAGGED];
    const TEST_TAG_NAME = "תגית-בדיקה-3.8";

    async function cleanup() {
      const { prisma } = await import("@/lib/db/prisma");
      await prisma.clientTag.deleteMany({
        where: { client: { phone: { in: PHONES } } },
      });
      await prisma.client.deleteMany({ where: { phone: { in: PHONES } } });
      await prisma.tag.deleteMany({ where: { name: TEST_TAG_NAME } });
    }

    beforeAll(async () => {
      await cleanup();
      const { prisma } = await import("@/lib/db/prisma");

      // לקוחה עם הערה "בטיפול עמוק"
      await prisma.client.create({
        data: {
          firstName: "דינה",
          lastName: "בדיקה-הערה1",
          phone: PHONE_NOTE_BTIPU,
          note: "בטיפול עמוק",
        },
      });

      // לקוחה עם הערה "והגיעה מאוחר"
      await prisma.client.create({
        data: {
          firstName: "רחל",
          lastName: "בדיקה-הערה2",
          phone: PHONE_NOTE_VHIGIA,
          note: "והגיעה מאוחר",
        },
      });

      // לקוחה עם תגית
      const tag = await prisma.tag.create({ data: { name: TEST_TAG_NAME } });
      await prisma.client.create({
        data: {
          firstName: "לאה",
          lastName: "בדיקה-תגית",
          phone: PHONE_TAGGED,
          tags: {
            create: { tagId: tag.id },
          },
        },
      });
    });

    afterAll(async () => {
      await cleanup();
      const { prisma } = await import("@/lib/db/prisma");
      await prisma.$disconnect();
    });

    it('חיפוש "טיפול" מוצא לקוחה עם הערה "בטיפול עמוק" (substring match)', async () => {
      const { listClients } = await import("@/lib/db/clients");
      const results = await listClients({ search: "טיפול" });
      const matched = results.filter((c) => PHONES.includes(c.phone));
      expect(matched.map((c) => c.phone)).toContain(PHONE_NOTE_BTIPU);
      // ודא שהלקוחה האחרת (אין "טיפול" בהערה שלה) לא הוחזרה
      expect(matched.map((c) => c.phone)).not.toContain(PHONE_NOTE_VHIGIA);
    });

    it('חיפוש "הגיעה" מוצא לקוחה עם הערה "והגיעה מאוחר" (strip "ה" → "גיעה" → substring)', async () => {
      const { listClients } = await import("@/lib/db/clients");
      const results = await listClients({ search: "הגיעה" });
      const matched = results.filter((c) => PHONES.includes(c.phone));
      expect(matched.map((c) => c.phone)).toContain(PHONE_NOTE_VHIGIA);
    });

    it("חיפוש לפי שם תגית מוצא את הלקוחה המתויגת", async () => {
      const { listClients } = await import("@/lib/db/clients");
      const results = await listClients({ search: TEST_TAG_NAME });
      const matched = results.filter((c) => PHONES.includes(c.phone));
      expect(matched.map((c) => c.phone)).toContain(PHONE_TAGGED);
      // ודא שלקוחות ללא התגית לא הוחזרו
      expect(matched.map((c) => c.phone)).not.toContain(PHONE_NOTE_BTIPU);
      expect(matched.map((c) => c.phone)).not.toContain(PHONE_NOTE_VHIGIA);
    });

    it("חיפוש שלא תואם שום לקוח (הערה/תגית) מחזיר רשימה ריקה מבין לקוחות הבדיקה", async () => {
      const { listClients } = await import("@/lib/db/clients");
      const results = await listClients({ search: "זזזזבדיקה-לאקיים999" });
      const matched = results.filter((c) => PHONES.includes(c.phone));
      expect(matched).toHaveLength(0);
    });
  }
);
