/**
 * בדיקת אינטגרציה למשימה 3.2: ה-API של ניהול לקוחות (admin) מקצה לקצה —
 * POST (יצירה) → PATCH (עדכון חלקי) → DELETE (ארכיון רך) → listClients.
 *
 * חשוב (פרטיות — §11): אין להשתמש בנתוני לקוחות אמיתיים. מספרי הטלפון כאן
 * הם מספרי בדיקה מומצאים בעליל, ונמחקים מהמסד בסיום הבדיקה (afterAll).
 *
 * Opt-in: רצה רק עם RUN_DB_TESTS=1 וגם DATABASE_URL מוגדר, כמו שאר בדיקות
 * האינטגרציה בפרויקט (`lib/actions/contact.integration.test.ts`,
 * `prisma/client-model.integration.test.ts`).
 */
import { config as loadEnv } from "dotenv";
import { describe, it, expect, afterAll } from "vitest";

const dbTestsEnabled = process.env.RUN_DB_TESTS === "1";
if (dbTestsEnabled) loadEnv({ path: ".env.local", quiet: true });

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

describe.skipIf(!dbTestsEnabled || !hasDatabaseUrl)(
  "Clients admin API (task 3.2, real DB, route handlers end-to-end)",
  () => {
    // מספרי בדיקה מומצאים בעליל — אינם שייכים ללקוחות אמיתיות.
    const FAKE_TEST_PHONE = "0501110097";
    const FAKE_TEST_PHONE_2 = "0501110096";

    afterAll(async () => {
      const { prisma } = await import("@/lib/db/prisma");
      await prisma.client.deleteMany({
        where: { phone: { in: [FAKE_TEST_PHONE, FAKE_TEST_PHONE_2] } },
      });
      await prisma.$disconnect();
    });

    it("POST יוצר לקוח, PATCH מעדכן שדה, DELETE מארכב (soft-delete) ולא מוחק פיזית", async () => {
      const { prisma } = await import("@/lib/db/prisma");
      const { listClients } = await import("@/lib/db/clients");

      // ודא שאין שארית מבדיקה קודמת שנכשלה
      await prisma.client.deleteMany({
        where: { phone: { in: [FAKE_TEST_PHONE, FAKE_TEST_PHONE_2] } },
      });

      const { POST, GET: GET_LIST } = await import("./route");
      const { GET: GET_ONE, PATCH, DELETE } = await import("./[id]/route");

      // --- POST: יצירה ---
      const postRequest = new Request("http://localhost/api/clients", {
        method: "POST",
        body: JSON.stringify({
          firstName: "בדיקה",
          lastName: "שתיים-ושתיים",
          phone: FAKE_TEST_PHONE,
        }),
      });
      const postResponse = await POST(postRequest);
      expect(postResponse.status).toBe(201);
      const postBody = await postResponse.json();
      expect(postBody.client).toBeTruthy();
      const clientId: string = postBody.client.id;

      const createdInDb = await prisma.client.findUnique({ where: { id: clientId } });
      expect(createdInDb).not.toBeNull();
      expect(createdInDb?.firstName).toBe("בדיקה");
      expect(createdInDb?.phone).toBe(FAKE_TEST_PHONE);
      expect(createdInDb?.status).toBe("active");

      // --- POST עם טלפון כפול: מצופה 409, לא כפילות ---
      const dupRequest = new Request("http://localhost/api/clients", {
        method: "POST",
        body: JSON.stringify({
          firstName: "כפילות",
          lastName: "בדיקה",
          phone: FAKE_TEST_PHONE,
        }),
      });
      const dupResponse = await POST(dupRequest);
      expect(dupResponse.status).toBe(409);
      const dupBody = await dupResponse.json();
      expect(dupBody.errors?.phone).toBeTruthy();

      const matchingAfterDup = await prisma.client.findMany({
        where: { phone: FAKE_TEST_PHONE },
      });
      expect(matchingAfterDup).toHaveLength(1);

      // --- PATCH: עדכון שדה בודד ---
      const patchRequest = new Request(`http://localhost/api/clients/${clientId}`, {
        method: "PATCH",
        body: JSON.stringify({ city: "חיפה" }),
      });
      const patchResponse = await PATCH(patchRequest, {
        params: Promise.resolve({ id: clientId }),
      });
      expect(patchResponse.status).toBe(200);
      const patchBody = await patchResponse.json();
      expect(patchBody.client.city).toBe("חיפה");
      // שדות אחרים לא השתנו (עדכון חלקי בלבד)
      expect(patchBody.client.firstName).toBe("בדיקה");
      expect(patchBody.client.phone).toBe(FAKE_TEST_PHONE);

      // --- DELETE: ארכיון רך ---
      const deleteRequest = new Request(`http://localhost/api/clients/${clientId}`, {
        method: "DELETE",
      });
      const deleteResponse = await DELETE(deleteRequest, {
        params: Promise.resolve({ id: clientId }),
      });
      expect(deleteResponse.status).toBe(200);
      const deleteBody = await deleteResponse.json();
      expect(deleteBody.client.status).toBe("archived");
      expect(deleteBody.client.archivedAt).not.toBeNull();

      // הרשומה עדיין קיימת בפועל במסד הנתונים
      const afterDelete = await prisma.client.findUnique({ where: { id: clientId } });
      expect(afterDelete).not.toBeNull();
      expect(afterDelete?.status).toBe("archived");
      expect(afterDelete?.archivedAt).not.toBeNull();

      // GET/:id עדיין מחזיר אותה (כולל ארכיון)
      const getOneResponse = await GET_ONE(new Request(`http://localhost/api/clients/${clientId}`), {
        params: Promise.resolve({ id: clientId }),
      });
      expect(getOneResponse.status).toBe(200);
      const getOneBody = await getOneResponse.json();
      expect(getOneBody.client.id).toBe(clientId);

      // listClients() ברירת מחדל מחריג ארכיון
      const activeOnly = await listClients();
      expect(activeOnly.find((c) => c.id === clientId)).toBeUndefined();

      // listClients({ includeArchived: true }) כולל אותו
      const withArchived = await listClients({ includeArchived: true });
      expect(withArchived.find((c) => c.id === clientId)).toBeTruthy();

      // GET /api/clients (רשימה רגילה דרך ה-route) גם מחריג אותו
      const listResponse = await GET_LIST();
      const listBody = await listResponse.json();
      expect(
        listBody.clients.find((c: { id: string }) => c.id === clientId)
      ).toBeUndefined();
    });

    it("PATCH לעדכון טלפון של לקוח א׳ לטלפון השייך ללקוח ב׳ מחזיר 409 ולא משנה את הטלפון בפועל (משימה 3.3)", async () => {
      const { prisma } = await import("@/lib/db/prisma");
      const { POST } = await import("./route");
      const { PATCH } = await import("./[id]/route");

      // ודא שאין שארית מבדיקה קודמת שנכשלה
      await prisma.client.deleteMany({
        where: { phone: { in: [FAKE_TEST_PHONE, FAKE_TEST_PHONE_2] } },
      });

      try {
        // --- יצירת לקוח א׳ ---
        const postA = await POST(
          new Request("http://localhost/api/clients", {
            method: "POST",
            body: JSON.stringify({
              firstName: "לקוח",
              lastName: "א",
              phone: FAKE_TEST_PHONE,
            }),
          })
        );
        expect(postA.status).toBe(201);
        const clientA = (await postA.json()).client;

        // --- יצירת לקוח ב׳ עם טלפון שונה ---
        const postB = await POST(
          new Request("http://localhost/api/clients", {
            method: "POST",
            body: JSON.stringify({
              firstName: "לקוח",
              lastName: "ב",
              phone: FAKE_TEST_PHONE_2,
            }),
          })
        );
        expect(postB.status).toBe(201);
        const clientB = (await postB.json()).client;

        // --- PATCH: עדכון טלפון לקוח א׳ לטלפון של לקוח ב׳ ---
        const patchResponse = await PATCH(
          new Request(`http://localhost/api/clients/${clientA.id}`, {
            method: "PATCH",
            body: JSON.stringify({ phone: FAKE_TEST_PHONE_2 }),
          }),
          { params: Promise.resolve({ id: clientA.id }) }
        );
        expect(patchResponse.status).toBe(409);
        const patchBody = await patchResponse.json();
        expect(patchBody.errors?.phone).toBeTruthy();
        // ברור ומובחן משגיאת ולידציה של פורמט
        expect(patchBody.errors.phone).not.toMatch(/פורמט|לא תקין/);

        // טלפון לקוח א׳ לא השתנה בפועל במסד הנתונים
        const unchanged = await prisma.client.findUnique({
          where: { id: clientA.id },
        });
        expect(unchanged?.phone).toBe(FAKE_TEST_PHONE);

        // לקוח ב׳ עדיין קיים בלי כפילות
        const matchingB = await prisma.client.findMany({
          where: { phone: FAKE_TEST_PHONE_2 },
        });
        expect(matchingB).toHaveLength(1);
        expect(matchingB[0].id).toBe(clientB.id);
      } finally {
        await prisma.client.deleteMany({
          where: { phone: { in: [FAKE_TEST_PHONE, FAKE_TEST_PHONE_2] } },
        });
      }
    });
  }
);
