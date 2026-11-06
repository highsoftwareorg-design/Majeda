/**
 * בדיקת אינטגרציה למשימה 4.1: יצירת רשומת `Visit` מקושרת ל-`Client` ו-`Treatment`
 * ושליפתה עם כל הקשרים (visitTreatments → treatment, client).
 *
 * חשוב (פרטיות — §11): מספרי הטלפון ושמות הבדיקה כאן מומצאים בעליל ואינם
 * שייכים ללקוחות אמיתיים. כל הרשומות נמחקות מהמסד בסיום הבדיקה (afterAll).
 *
 * Opt-in: רצה רק עם RUN_DB_TESTS=1 וגם DATABASE_URL מוגדר.
 * הרצה: RUN_DB_TESTS=1 npx vitest run --reporter=verbose lib/db/visit-model.integration.test.ts
 *
 * סינון ב-CI: הבדיקה מסומנת @db בשמה כדי שניתן לסנן אותה החוצה:
 *   npx vitest run --reporter=verbose --testNamePattern="@db"
 */
import { config as loadEnv } from "dotenv";
import { describe, it, expect, afterAll } from "vitest";

const dbTestsEnabled = process.env.RUN_DB_TESTS === "1";
if (dbTestsEnabled) loadEnv({ path: ".env.local", quiet: true });

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

describe.skipIf(!dbTestsEnabled || !hasDatabaseUrl)(
  "@db Visit model (task 4.1, real DB round-trip)",
  () => {
    // מזהים של רשומות שנוצרו — לניקוי ב-afterAll
    let createdVisitId: string | undefined;
    let createdClientId: string | undefined;
    let createdTreatmentId: string | undefined;

    afterAll(async () => {
      const { prisma } = await import("@/lib/db/prisma");
      // מוחק לפי סדר תלויות: join → visit → client → treatment
      if (createdVisitId) {
        await prisma.visitTreatment.deleteMany({ where: { visitId: createdVisitId } });
        await prisma.visit.deleteMany({ where: { id: createdVisitId } });
      }
      if (createdClientId) {
        await prisma.client.deleteMany({ where: { id: createdClientId } });
      }
      if (createdTreatmentId) {
        await prisma.treatment.deleteMany({ where: { id: createdTreatmentId } });
      }
      await prisma.$disconnect();
    });

    it(
      "@db יוצר Visit המקושר ל-Client קיים ול-Treatment קיים ושולף אותו עם קשרים מלאים",
      async () => {
        const { prisma } = await import("@/lib/db/prisma");

        // --- הכנת רשומות עזר (client + treatment) ---
        const treatment = await prisma.treatment.create({
          data: {
            name: `טיפול-בדיקה-4.1-${Date.now()}`,
            durationMinutes: 45,
            price: 350,
            recommendedReturn: "4 שבועות",
          },
        });
        createdTreatmentId = treatment.id;

        const client = await prisma.client.create({
          data: {
            firstName: "בדיקה",
            lastName: "ביקור",
            // מספר מומצא בעליל — לא שייך ללקוחה אמיתית
            phone: `0509991234`,
          },
        });
        createdClientId = client.id;

        // --- יצירת Visit עם VisitTreatment ---
        const visitDate = new Date("2026-11-01T10:00:00.000Z");
        const returnDate = new Date("2026-11-29T10:00:00.000Z");

        const visit = await prisma.visit.create({
          data: {
            clientId: client.id,
            visitDate,
            therapist: "מג'ידה",
            treatedArea: "פנים",
            notes: "טיפול בדיקה — לא נתונים אמיתיים",
            price: 350,
            products: "סרום X אצווה #1234",
            parameters: "עוצמה 3, 20 שניות",
            returnDate,
            returnNoteHandled: false,
            visitTreatments: {
              create: [{ treatmentId: treatment.id }],
            },
          },
        });
        createdVisitId = visit.id;

        // --- שליפה עם כל הקשרים ---
        const fetched = await prisma.visit.findUnique({
          where: { id: visit.id },
          include: {
            visitTreatments: {
              include: { treatment: true },
            },
            client: true,
          },
        });

        // --- אסרציות ---
        expect(fetched).not.toBeNull();
        expect(fetched?.clientId).toBe(client.id);
        expect(fetched?.client.firstName).toBe("בדיקה");
        expect(fetched?.client.phone).toBe("0509991234");
        expect(fetched?.therapist).toBe("מג'ידה");
        expect(fetched?.treatedArea).toBe("פנים");
        expect(fetched?.notes).toBe("טיפול בדיקה — לא נתונים אמיתיים");
        expect(Number(fetched?.price)).toBe(350);
        expect(fetched?.products).toBe("סרום X אצווה #1234");
        expect(fetched?.parameters).toBe("עוצמה 3, 20 שניות");
        expect(fetched?.visitDate.toISOString()).toBe(visitDate.toISOString());
        expect(fetched?.returnDate?.toISOString()).toBe(returnDate.toISOString());
        expect(fetched?.returnNoteHandled).toBe(false);

        // VisitTreatment join — בדיקת קשר לטיפול
        expect(fetched?.visitTreatments).toHaveLength(1);
        expect(fetched?.visitTreatments[0]?.treatmentId).toBe(treatment.id);
        expect(fetched?.visitTreatments[0]?.treatment.name).toContain("טיפול-בדיקה-4.1");
        expect(fetched?.visitTreatments[0]?.treatment.durationMinutes).toBe(45);
      }
    );
  }
);
