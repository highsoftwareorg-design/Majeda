/**
 * בדיקת אינטגרציה למשימה 3.4: זיהוי כפילויות (`findDuplicateClientGroups`)
 * ומיזוג (`mergeClients`) — מקצה לקצה מול בסיס נתונים אמיתי (Neon).
 *
 * חשוב (פרטיות — §11): אין להשתמש בנתוני לקוחות אמיתיים. מספרי הטלפון כאן
 * הם מספרי בדיקה מומצאים בעליל, ונמחקים מהמסד בסיום הבדיקה (afterAll).
 *
 * הערה: הייחודיות של `phone` נאכפת ב-DB (@unique) על המחרוזת הגולמית, לא
 * על הערך המנורמל. כדי לדמות "כפילות לגיטימית" (למשל נתוני ייבוא/היסטוריה
 * שהוזנו לפני נרמול, או בפורמטים שונים) אנו יוצרים כאן שני לקוחות עם
 * מחרוזות טלפון *שונות* שמייצגות את אותו מספר מקומי (עם/בלי קידומת מדינה),
 * דרך Prisma ישירות — ולא דרך ה-API הציבורי שמנרמל ובכך היה חוסם זאת.
 *
 * Opt-in: רצה רק עם RUN_DB_TESTS=1 וגם DATABASE_URL מוגדר, כמו שאר בדיקות
 * האינטגרציה בפרויקט.
 */
import { config as loadEnv } from "dotenv";
import { describe, it, expect, afterAll } from "vitest";

const dbTestsEnabled = process.env.RUN_DB_TESTS === "1";
if (dbTestsEnabled) loadEnv({ path: ".env.local", quiet: true });

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

describe.skipIf(!dbTestsEnabled || !hasDatabaseUrl)(
  "זיהוי ומיזוג כפילויות (משימה 3.4, real DB)",
  () => {
    // מספרי בדיקה מומצאים בעליל — שתי מחרוזות שונות המייצגות את אותו מספר.
    const LOCAL_FORMAT = "0501110098";
    const INTL_FORMAT = "+972501110098";
    const OTHER_PHONE = "0501110099";

    async function cleanup() {
      const { prisma } = await import("@/lib/db/prisma");
      await prisma.client.deleteMany({
        where: { phone: { in: [LOCAL_FORMAT, INTL_FORMAT, OTHER_PHONE] } },
      });
    }

    afterAll(async () => {
      await cleanup();
      const { prisma } = await import("@/lib/db/prisma");
      await prisma.$disconnect();
    });

    it("מזהה כפילות לפי 8 הספרות האחרונות של הטלפון, ומיזוג משאיר רשומה אחת עם נתונים משולבים והשנייה בארכיון", async () => {
      const { prisma } = await import("@/lib/db/prisma");
      const { findDuplicateClientGroups } = await import("./clients");
      const { mergeClients } = await import("./merge-clients");

      await cleanup();

      try {
        // --- דימוי "דאטה לגיטימית" (ייבוא/היסטוריה לפני נרמול): שני לקוחות,
        // אותו מספר מקומי בפועל, מחרוזות טלפון גולמיות שונות ---
        const clientA = await prisma.client.create({
          data: {
            firstName: "לקוח",
            lastName: "א",
            phone: LOCAL_FORMAT,
            city: "חיפה",
          },
        });
        const clientB = await prisma.client.create({
          data: {
            firstName: "לקוח",
            lastName: "ב",
            phone: INTL_FORMAT,
            email: "client-b@example.test",
          },
        });
        // לקוח "רועש" נוסף עם טלפון שונה לגמרי — לא אמור להופיע כקבוצה.
        await prisma.client.create({
          data: { firstName: "אחר", lastName: "לא-כפילות", phone: OTHER_PHONE },
        });

        // --- איתור כפילויות ---
        const groups = await findDuplicateClientGroups();
        const group = groups.find(
          (g) =>
            g.clients.some((c) => c.id === clientA.id) &&
            g.clients.some((c) => c.id === clientB.id)
        );
        expect(group).toBeTruthy();
        expect(group!.clients).toHaveLength(2);

        // לקוח עם טלפון שונה לא נכלל בשום קבוצה
        const otherInAnyGroup = groups.some((g) =>
          g.clients.some((c) => c.phone === OTHER_PHONE)
        );
        expect(otherInAnyGroup).toBe(false);

        // --- מיזוג: לקוח א׳ שורד, עם עיר מלקוח א׳ ואימייל מלקוח ב׳ ---
        const merged = await mergeClients(clientA.id, clientB.id, {
          firstName: "לקוח",
          lastName: "משולב",
          phone: LOCAL_FORMAT,
          city: "חיפה",
          email: "client-b@example.test",
        });

        expect(merged.id).toBe(clientA.id);
        expect(merged.lastName).toBe("משולב");
        expect(merged.city).toBe("חיפה");
        expect(merged.email).toBe("client-b@example.test");

        // הרשומה השורדת מעודכנת ב-DB בפועל
        const survivorInDb = await prisma.client.findUnique({
          where: { id: clientA.id },
        });
        expect(survivorInDb?.status).toBe("active");
        expect(survivorInDb?.email).toBe("client-b@example.test");

        // הרשומה הכפולה בארכיון — לא נמחקה פיזית
        const duplicateInDb = await prisma.client.findUnique({
          where: { id: clientB.id },
        });
        expect(duplicateInDb).not.toBeNull();
        expect(duplicateInDb?.status).toBe("archived");
        expect(duplicateInDb?.archivedAt).not.toBeNull();

        // אחרי המיזוג, הקבוצה לא אמורה להופיע יותר (הכפול בארכיון, מוחרג)
        const groupsAfterMerge = await findDuplicateClientGroups();
        const stillGrouped = groupsAfterMerge.some((g) =>
          g.clients.some((c) => c.id === clientB.id)
        );
        expect(stillGrouped).toBe(false);
      } finally {
        await cleanup();
      }
    });
  }
);
