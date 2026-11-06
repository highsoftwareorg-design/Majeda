/**
 * בדיקת אינטגרציה למשימה 2.7: `submitContactForm` מול מסד הנתונים האמיתי
 * (Neon, סביבת פיתוח בלבד — ראו `.env.local`).
 *
 * חשוב (פרטיות — §11, הנחיות הארגון): אין להשתמש בנתוני לקוחות אמיתיים.
 * מספר הטלפון כאן הוא מספר בדיקה מומצא בעליל (אינו מספר ישראלי אמיתי
 * שהוקצה לאדם), ונמחק מהמסד בסיום הבדיקה (afterAll/finally).
 *
 * Opt-in (2.17): רצה רק עם RUN_DB_TESTS=1 (למשל `RUN_DB_TESTS=1 npx vitest run lib/actions/contact.integration.test.ts`)
 * וגם DATABASE_URL מוגדר; אחרת מדולגת — `npx vitest run` רגיל לא נוגע במסד הנתונים.
 */
import { config as loadEnv } from "dotenv";
import { describe, it, expect, afterAll } from "vitest";

const dbTestsEnabled = process.env.RUN_DB_TESTS === "1";
// .env.local נטען רק כשהבדיקה הופעלה במפורש (quiet — ללא הדפסה)
if (dbTestsEnabled) loadEnv({ path: ".env.local", quiet: true });

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

describe.skipIf(!dbTestsEnabled || !hasDatabaseUrl)("submitContactForm (integration, real DB)", () => {
  // מספר בדיקה מומצא בעליל — אינו שייך ללקוחה אמיתית.
  const FAKE_TEST_PHONE = "0501110099";

  afterAll(async () => {
    const { prisma } = await import("@/lib/db/prisma");
    await prisma.client.deleteMany({ where: { phone: FAKE_TEST_PHONE } });
    await prisma.$disconnect();
  });

  it("יוצר לקוח חדש בפעם הראשונה, ומעדכן (ולא משכפל) באותו טלפון בפעם השנייה", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const { submitContactForm } = await import("@/lib/actions/contact");

    // ודא שאין שארית מבדיקה קודמת שנכשלה
    await prisma.client.deleteMany({ where: { phone: FAKE_TEST_PHONE } });

    const firstResult = await submitContactForm({
      name: "לקוחת בדיקה ראשונה",
      phone: FAKE_TEST_PHONE,
      treatmentId: "",
      note: "",
      marketingConsent: false,
    });

    expect(firstResult.ok).toBe(true);

    const afterFirst = await prisma.client.findUnique({
      where: { phone: FAKE_TEST_PHONE },
    });

    expect(afterFirst).not.toBeNull();
    expect(afterFirst?.source).toBe("landing_page");
    expect(afterFirst?.firstName).toBe("לקוחת");
    expect(afterFirst?.lastName).toBe("בדיקה ראשונה");

    const secondResult = await submitContactForm({
      name: "לקוחת בדיקה מעודכנת",
      phone: FAKE_TEST_PHONE,
      treatmentId: "",
      note: "הערה מעודכנת",
      marketingConsent: true,
    });

    expect(secondResult.ok).toBe(true);

    const allMatching = await prisma.client.findMany({
      where: { phone: FAKE_TEST_PHONE },
    });

    // אין כפילות — עדיין רשומה יחידה
    expect(allMatching).toHaveLength(1);

    const afterSecond = allMatching[0];
    expect(afterSecond.id).toBe(afterFirst!.id);
    expect(afterSecond.firstName).toBe("לקוחת");
    expect(afterSecond.lastName).toBe("בדיקה מעודכנת");
    expect(afterSecond.note).toBe("הערה מעודכנת");
    expect(afterSecond.marketingConsentChannel).toBe("landing_page");
    expect(afterSecond.marketingConsentAt).not.toBeNull();
    expect(afterSecond.source).toBe("landing_page");
  });
});
