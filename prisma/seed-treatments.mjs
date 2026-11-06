// Seed script for the Treatment catalog (task 1.12).
//
// ⚠️ PLACEHOLDER DATA — TO REPLACE BEFORE PRODUCTION ⚠️
// The real MAJIDA treatment catalog (names, durations, prices, recommended
// return intervals) has not been supplied by the client yet. The records
// below are clearly-marked placeholders so the app has something to render
// end-to-end (landing page task 2.3, calendar domain 5) until the real list
// arrives. DO NOT launch to production with this data still in place.
//
// Usage: npm run seed:treatments
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PLACEHOLDER_TREATMENTS = [
  {
    name: "טיפול פנים בסיסי (PLACEHOLDER)",
    description: "תיאור PLACEHOLDER - טיפול ניקוי והזנה בסיסי לעור הפנים.",
    durationMinutes: 60,
    price: 250,
    recommendedReturn: "4 שבועות",
    recommendedReturnDays: 28,
  },
  {
    name: "טיפול פנים מתקדם (PLACEHOLDER)",
    description: "תיאור PLACEHOLDER - טיפול פנים מקצועי עם מכשור מתקדם.",
    durationMinutes: 90,
    price: 400,
    recommendedReturn: "4 שבועות",
    recommendedReturnDays: 28,
  },
  {
    name: "ניקוי פנים עמוק (PLACEHOLDER)",
    description: "תיאור PLACEHOLDER - ניקוי יסודי של נקבוביות ולכלוך עמוק.",
    durationMinutes: 75,
    price: 320,
    recommendedReturn: "6 שבועות",
    recommendedReturnDays: 42,
  },
  {
    name: "טיפול אנטי אייג'ינג (PLACEHOLDER)",
    description: "תיאור PLACEHOLDER - טיפול להחלקת קמטים וחידוש העור.",
    durationMinutes: 90,
    price: 450,
    recommendedReturn: "3 שבועות",
    recommendedReturnDays: 21,
  },
  {
    name: "מיקרונידלינג (PLACEHOLDER)",
    description: "תיאור PLACEHOLDER - גירוי קולגן טבעי לעור חלק ובריא.",
    durationMinutes: 60,
    price: 500,
    recommendedReturn: "6 שבועות",
    recommendedReturnDays: 42,
  },
  {
    name: "פילינג כימי (PLACEHOLDER)",
    description: "תיאור PLACEHOLDER - חידוש העור והבהרת כתמים בעזרת פילינג.",
    durationMinutes: 45,
    price: 380,
    recommendedReturn: "4 שבועות",
    recommendedReturnDays: 28,
  },
  {
    name: "עיסוי רקמות עמוק (PLACEHOLDER)",
    description: "תיאור PLACEHOLDER - עיסוי מרגיע לשחרור מתח שרירי.",
    durationMinutes: 60,
    price: 300,
    recommendedReturn: "2 שבועות",
    recommendedReturnDays: 14,
  },
  {
    name: "הסרת שיער בלייזר - אזור קטן (PLACEHOLDER)",
    description: "תיאור PLACEHOLDER - הסרת שיער בלייזר לאזור מוגדר וקטן.",
    durationMinutes: 30,
    price: 180,
    recommendedReturn: "4 שבועות",
    recommendedReturnDays: 28,
  },
];

console.warn(
  "⚠️  seed-treatments: מריץ נתוני PLACEHOLDER בלבד. " +
    "יש להחליף ברשימת הטיפולים האמיתית של מג'ידה לפני עלייה לפרודקשן."
);

try {
  for (const treatment of PLACEHOLDER_TREATMENTS) {
    await prisma.treatment.upsert({
      where: { name: treatment.name },
      update: treatment,
      create: treatment,
    });
  }

  const count = await prisma.treatment.count();
  console.log(`Treatment catalog seeded (placeholder data). Total rows: ${count}`);
} catch (err) {
  console.error("Failed to seed treatments:", err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
