/**
 * בדיקת אינטגרציה למשימה 3.7: פילטר שם חלקי ופילטר מין ב-`listClients`
 * (FR-CL-05) — מסונן ברמת ה-DB (Prisma `contains` + `gender`).
 *
 * מכסה את קריטריוני הקבלה של המשימה:
 * (א) חיפוש "דנ" מחזיר "דנה" ו"דניאל" אך לא "רחל".
 * (ב) פילטר מין=female מחזיר רק לקוחות נקבה.
 * (ג) שם + מין (AND) מצמצם את התוצאות כהלכה.
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
  "listClients gender filter (task 3.7, real DB)",
  () => {
    // מספרי בדיקה מומצאים בעליל — אינם שייכים ללקוחות אמיתיים.
    const PHONE_DANA = "0509990071"; // דנה, נקבה
    const PHONE_DANIEL = "0509990072"; // דניאל, זכר
    const PHONE_RACHEL = "0509990073"; // רחל, נקבה
    const PHONE_ALEX = "0509990074"; // אלכס, אחר
    const PHONES = [PHONE_DANA, PHONE_DANIEL, PHONE_RACHEL, PHONE_ALEX];

    async function cleanup() {
      const { prisma } = await import("@/lib/db/prisma");
      await prisma.client.deleteMany({ where: { phone: { in: PHONES } } });
    }

    beforeAll(async () => {
      await cleanup();
      const { prisma } = await import("@/lib/db/prisma");
      await prisma.client.createMany({
        data: [
          { firstName: "דנה", lastName: "בדיקה-א", phone: PHONE_DANA, gender: "female" },
          { firstName: "דניאל", lastName: "בדיקה-ב", phone: PHONE_DANIEL, gender: "male" },
          { firstName: "רחל", lastName: "בדיקה-ג", phone: PHONE_RACHEL, gender: "female" },
          { firstName: "אלכס", lastName: "בדיקה-ד", phone: PHONE_ALEX, gender: "other" },
        ],
      });
    });

    afterAll(async () => {
      await cleanup();
      const { prisma } = await import("@/lib/db/prisma");
      await prisma.$disconnect();
    });

    it('(א) חיפוש חלקי "דנ" מחזיר דנה ודניאל אך לא רחל', async () => {
      const { listClients } = await import("@/lib/db/clients");

      const results = await listClients({ search: "דנ" });
      const matched = results.filter((c) => PHONES.includes(c.phone));

      const phones = matched.map((c) => c.phone).sort();
      expect(phones).toEqual([PHONE_DANA, PHONE_DANIEL].sort());
    });

    it("(ב) פילטר gender=female מחזיר רק לקוחות נקבה מקבוצת הבדיקה", async () => {
      const { listClients } = await import("@/lib/db/clients");

      const results = await listClients({ gender: "female" });
      const matched = results.filter((c) => PHONES.includes(c.phone));

      const phones = matched.map((c) => c.phone).sort();
      expect(phones).toEqual([PHONE_DANA, PHONE_RACHEL].sort());
    });

    it("(ב) פילטר gender=male מחזיר רק לקוחות זכר מקבוצת הבדיקה", async () => {
      const { listClients } = await import("@/lib/db/clients");

      const results = await listClients({ gender: "male" });
      const matched = results.filter((c) => PHONES.includes(c.phone));

      expect(matched).toHaveLength(1);
      expect(matched[0].phone).toBe(PHONE_DANIEL);
    });

    it("(ב) פילטר gender=other מחזיר רק לקוחות אחר מקבוצת הבדיקה", async () => {
      const { listClients } = await import("@/lib/db/clients");

      const results = await listClients({ gender: "other" });
      const matched = results.filter((c) => PHONES.includes(c.phone));

      expect(matched).toHaveLength(1);
      expect(matched[0].phone).toBe(PHONE_ALEX);
    });

    it('(ג) שם "דנ" + gender=female — מחזיר רק דנה (AND, לא דניאל)', async () => {
      const { listClients } = await import("@/lib/db/clients");

      const results = await listClients({ search: "דנ", gender: "female" });
      const matched = results.filter((c) => PHONES.includes(c.phone));

      expect(matched).toHaveLength(1);
      expect(matched[0].phone).toBe(PHONE_DANA);
    });

    it('(ג) שם "דנ" + gender=male — מחזיר רק דניאל (AND, לא דנה)', async () => {
      const { listClients } = await import("@/lib/db/clients");

      const results = await listClients({ search: "דנ", gender: "male" });
      const matched = results.filter((c) => PHONES.includes(c.phone));

      expect(matched).toHaveLength(1);
      expect(matched[0].phone).toBe(PHONE_DANIEL);
    });

    it("פילטר ללא שום תוצאות (שם לא קיים + מין) מחזיר רשימה ריקה מקבוצת הבדיקה", async () => {
      const { listClients } = await import("@/lib/db/clients");

      const results = await listClients({ search: "דנ", gender: "other" });
      const matched = results.filter((c) => PHONES.includes(c.phone));

      expect(matched).toHaveLength(0);
    });
  }
);
