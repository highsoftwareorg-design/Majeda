/**
 * בדיקת אינטגרציה למשימה 3.5: חיפוש גלובלי לפי שם/טלפון ב-`listClients`
 * (FR-CL-03) — מסונן ברמת ה-DB (Prisma `contains`), לא ברמת הקוד.
 *
 * זורעת שלוש לקוחות בדיקה עם שמות וטלפונים מובחנים, ומוודאת שחיפוש חלקי
 * (גם בטלפון וגם בשם) מחזיר בדיוק את תת-הקבוצה המתאימה.
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
  "listClients search (task 3.5, real DB)",
  () => {
    // מספרי בדיקה מומצאים בעליל — אינם שייכים ללקוחות אמיתיות.
    const PHONE_SARAH = "0501110081";
    const PHONE_MIRIAM = "0501110082";
    const PHONE_DAVID = "0501110083";
    const PHONES = [PHONE_SARAH, PHONE_MIRIAM, PHONE_DAVID];

    async function cleanup() {
      const { prisma } = await import("@/lib/db/prisma");
      await prisma.client.deleteMany({ where: { phone: { in: PHONES } } });
    }

    beforeAll(async () => {
      await cleanup();
      const { prisma } = await import("@/lib/db/prisma");
      await prisma.client.createMany({
        data: [
          { firstName: "שרה", lastName: "כהן-בדיקה", phone: PHONE_SARAH },
          { firstName: "מרים", lastName: "לוי-בדיקה", phone: PHONE_MIRIAM },
          { firstName: "דוד", lastName: "בדיקה-אחר", phone: PHONE_DAVID },
        ],
      });
    });

    afterAll(async () => {
      await cleanup();
      const { prisma } = await import("@/lib/db/prisma");
      await prisma.$disconnect();
    });

    it("חיפוש לפי מספר טלפון חלקי מחזיר רק את הלקוח התואם", async () => {
      const { listClients } = await import("@/lib/db/clients");

      const results = await listClients({ search: "111008" }); // תחילית משותפת — כל השלוש
      const matchedPhones = results
        .filter((c) => PHONES.includes(c.phone))
        .map((c) => c.phone);
      expect(matchedPhones.sort()).toEqual([...PHONES].sort());

      const narrow = await listClients({ search: PHONE_SARAH.slice(-4) }); // "0081" — ייחודי לשרה
      const narrowPhones = narrow
        .filter((c) => PHONES.includes(c.phone))
        .map((c) => c.phone);
      expect(narrowPhones).toEqual([PHONE_SARAH]);
    });

    it("חיפוש לפי שם פרטי חלקי (לא רגיש לרישיות) מחזיר רק את הלקוחות התואמים", async () => {
      const { listClients } = await import("@/lib/db/clients");

      const results = await listClients({ search: "שרה" });
      const matched = results.filter((c) => PHONES.includes(c.phone));
      expect(matched).toHaveLength(1);
      expect(matched[0].phone).toBe(PHONE_SARAH);
    });

    it("חיפוש לפי שם משפחה חלקי משותף לכמה לקוחות מחזיר את כולם, ולא את מי שלא תואם", async () => {
      const { listClients } = await import("@/lib/db/clients");

      const results = await listClients({ search: "בדיקה" });
      const matchedPhones = results
        .filter((c) => PHONES.includes(c.phone))
        .map((c) => c.phone);
      expect(matchedPhones.sort()).toEqual([...PHONES].sort());
    });

    it("חיפוש שלא תואם שום לקוח מחזיר רשימה ריקה מבין לקוחות הבדיקה", async () => {
      const { listClients } = await import("@/lib/db/clients");

      const results = await listClients({ search: "זזזזלאקיים999" });
      const matched = results.filter((c) => PHONES.includes(c.phone));
      expect(matched).toHaveLength(0);
    });
  }
);
