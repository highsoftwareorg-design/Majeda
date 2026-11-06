/**
 * בדיקת אינטגרציה למשימה 3.1: יצירת רשומת `Client` עם כל השדות ושליפתה
 * בחזרה עם ערכים זהים (קריטריון הבדיקה המילולי של 3.1 ב-PLAN.md).
 *
 * חשוב (פרטיות — §11): אין להשתמש בנתוני לקוחות אמיתיים. מספר הטלפון כאן
 * הוא מספר בדיקה מומצא בעליל, ונמחק מהמסד בסיום הבדיקה (afterAll).
 *
 * Opt-in: רצה רק עם RUN_DB_TESTS=1 וגם DATABASE_URL מוגדר; אחרת מדולגת,
 * כמו `lib/actions/contact.integration.test.ts`.
 */
import { config as loadEnv } from "dotenv";
import { describe, it, expect, afterAll } from "vitest";

const dbTestsEnabled = process.env.RUN_DB_TESTS === "1";
if (dbTestsEnabled) loadEnv({ path: ".env.local", quiet: true });

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

describe.skipIf(!dbTestsEnabled || !hasDatabaseUrl)("Client model (task 3.1, real DB round-trip)", () => {
  // מספר בדיקה מומצא בעליל — אינו שייך ללקוחה אמיתית.
  const FAKE_TEST_PHONE = "0501110098";
  let createdClientId: string | undefined;
  let createdTagId: string | undefined;
  let createdTreatmentId: string | undefined;

  afterAll(async () => {
    const { prisma } = await import("@/lib/db/prisma");
    await prisma.clientTag.deleteMany({ where: { clientId: createdClientId } });
    await prisma.client.deleteMany({ where: { phone: FAKE_TEST_PHONE } });
    if (createdTagId) await prisma.tag.deleteMany({ where: { id: createdTagId } });
    if (createdTreatmentId) {
      await prisma.treatment.deleteMany({ where: { id: createdTreatmentId } });
    }
    await prisma.$disconnect();
  });

  it("יוצר לקוח עם כל השדות ושולף אותו בחזרה עם ערכים זהים", async () => {
    const { prisma } = await import("@/lib/db/prisma");

    // ודא שאין שארית מבדיקה קודמת שנכשלה
    await prisma.client.deleteMany({ where: { phone: FAKE_TEST_PHONE } });

    const tag = await prisma.tag.create({
      data: { name: `tag-בדיקה-3.1-${Date.now()}` },
    });
    createdTagId = tag.id;

    const treatment = await prisma.treatment.create({
      data: {
        name: `טיפול-בדיקה-3.1-${Date.now()}`,
        durationMinutes: 30,
        price: 100,
      },
    });
    createdTreatmentId = treatment.id;

    const birthDate = new Date("1990-05-15T00:00:00.000Z");
    const marketingConsentAt = new Date("2026-01-01T10:00:00.000Z");
    const archivedAt = new Date("2026-02-01T10:00:00.000Z");

    const created = await prisma.client.create({
      data: {
        firstName: "בדיקה",
        lastName: "שלושים-ואחד",
        phone: FAKE_TEST_PHONE,
        gender: "female",
        birthDate,
        email: "test-client-31@example.com",
        city: "תל אביב",
        source: "landing_page",
        utmSource: "facebook",
        utmMedium: "cpc",
        utmCampaign: "summer_promo",
        utmTerm: "beauty",
        utmContent: "ad1",
        note: "הערה לבדיקה",
        marketingConsentChannel: "landing_page",
        marketingConsentAt,
        status: "archived",
        archivedAt,
        requestedTreatmentId: treatment.id,
        tags: {
          create: [{ tagId: tag.id }],
        },
      },
    });
    createdClientId = created.id;

    const fetched = await prisma.client.findUnique({
      where: { id: created.id },
      include: { tags: true, requestedTreatment: true },
    });

    expect(fetched).not.toBeNull();
    expect(fetched?.firstName).toBe("בדיקה");
    expect(fetched?.lastName).toBe("שלושים-ואחד");
    expect(fetched?.phone).toBe(FAKE_TEST_PHONE);
    expect(fetched?.gender).toBe("female");
    expect(fetched?.birthDate?.toISOString()).toBe(birthDate.toISOString());
    expect(fetched?.email).toBe("test-client-31@example.com");
    expect(fetched?.city).toBe("תל אביב");
    expect(fetched?.source).toBe("landing_page");
    expect(fetched?.utmSource).toBe("facebook");
    expect(fetched?.utmMedium).toBe("cpc");
    expect(fetched?.utmCampaign).toBe("summer_promo");
    expect(fetched?.utmTerm).toBe("beauty");
    expect(fetched?.utmContent).toBe("ad1");
    expect(fetched?.note).toBe("הערה לבדיקה");
    expect(fetched?.marketingConsentChannel).toBe("landing_page");
    expect(fetched?.marketingConsentAt?.toISOString()).toBe(marketingConsentAt.toISOString());
    expect(fetched?.status).toBe("archived");
    expect(fetched?.archivedAt?.toISOString()).toBe(archivedAt.toISOString());
    expect(fetched?.requestedTreatment?.id).toBe(treatment.id);
    expect(fetched?.tags).toHaveLength(1);
    expect(fetched?.tags[0]?.tagId).toBe(tag.id);
  });

  it("אוכף ייחודיות טלפון (phone unique)", async () => {
    const { prisma } = await import("@/lib/db/prisma");

    await expect(
      prisma.client.create({
        data: {
          firstName: "כפילות",
          lastName: "בדיקה",
          phone: FAKE_TEST_PHONE,
        },
      })
    ).rejects.toThrow();
  });
});
