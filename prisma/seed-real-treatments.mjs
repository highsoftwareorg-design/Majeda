// One-off seed: replace the generic "(PLACEHOLDER)" treatments with MAJIDA's
// real treatment menu (source: lib/landing/treatment-menu.ts — the Hebrew menu).
// Prices/durations are set to editable defaults (0 / 60 min) and can be adjusted
// per treatment via the catalog "עריכה" dialog.
//
// Run: npx dotenv -e .env.local -- node prisma/seed-real-treatments.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_COLOR = "#D2AB2E";
const DEFAULT_DURATION = 60;
const DEFAULT_PRICE = 0;

// name + optional device + description, flattened from the 4 menu categories.
const MENU = [
  ["אלמה סופרנו (מהדורה מיוחדת)", "Alma Soprano Special Edition", "הדגם החדש והחזק בסדרת אלמה להסרת שיער בלייזר, ביעילות גבוהה וללא כאב, לכל סוגי העור. מעניק כיסוי מהיר ומקיף בזכות הטכנולוגיות המשולבות שבו, לתוצאות שנשמרות לאורך זמן."],
  ["דקה אגיין", "DEKA Again", "לייזר משולב המחבר בין שני סוגי קרניים (אלכסנדרייט ו-Nd:YAG) להסרת שיער יעילה במיוחד עם מערכת קירור מתקדמת. בולט במהירותו וביכולתו לטפל בכל סוגי השיער בבטחה מלאה."],
  ["אפילציה חשמלית לשיער שיבה ובהיר", null, "טכניקה מדויקת וייעודית המכוונת לזקיקי שיער לבן ובהיר שאינם מגיבים למכשירי לייזר רגילים. מבטיחה סילוק יסודי של שיער עיקש זה בדיוק גבוה ובבטחה."],
  ["טיפולי עיבוי וצמיחת שיער", null, "פרוטוקולים טיפוליים משולבים הכוללים טכנולוגיות ומרכיבים מזינים מתקדמים להפעלת זקיקי שיער רדומים ולהתמודדות עם קרחות ואזורים דלילים. מסייעים להאיץ את מחזור צמיחת השיער ולשפר את איכותו, לצפיפות ניכרת ולמראה טבעי."],
  ["דקה אונדה", "DEKA Onda", "מכשיר פורץ דרך לעיצוב הגוף, להפחתת צלוליט ולחיטוב, באמצעות גלי מיקרו קרים (Coolwaves). פועל לפירוק תאי שומן ולמיצוק העור ביעילות ובבטחה, ללא צורך בניתוח."],
  ["אלמה אקסנט פריים", "Alma Accent Prime", "מהטכנולוגיות החדשות של אלמה למיצוק רפיון ולחיטוב גוף מקומי, באמצעות אולטרסאונד ותדרי רדיו (RF). מעניק תוצאות מהירות ובולטות בשיפור מתאר הגוף ובהגברת גמישות העור."],
  ["דקה רד טאצ'", "DEKA Red Touch Pro", "טכנולוגיה מתקדמת שתוכננה במיוחד לעידוד ייצור קולגן ולחידוש העור באמצעות אורכי גל מדויקים. מטפלת בפיגמנטציה עמוקה ובסימני הזדקנות, ומעניקה לעור זוהר ומרקם חלק."],
  ["דקה SUO2 — לייזר פרקציונלי CO2", "DEKA SmartXide Tetra CO2", "לייזר פרקציונלי עוצמתי לחידוש פני העור ולטיפול בצלקות, בפיגמנטציה ובסימני מתיחה ביעילות גבוהה. תורם למיצוק העור ולמראה צעיר יותר בזכות טכנולוגיית הפעימות המתקדמת."],
  ["מצלמת ניתוח ואבחון עור", null, "טכנולוגיית צילום מתקדמת הסורקת לעומק את שכבות העור וחושפת פרטים ובעיות דקים שאינם נראים לעין. מסייעת לנו לבנות תוכנית טיפול מדויקת ומותאמת אישית לצורכי כל עור."],
  ["הסרת קעקועים וטאטו גבות", "DEKA Studio QS", "טכנולוגיית לייזר מדויקת ובטוחה לפירוק דיו של קעקועים וטאטו גבות ישן, או לניקויו, ללא הותרת צלקות. מסירה את הצבעים ביעילות תוך שמירה על שלמות העור הסובב."],
  ["פילינג ירוק גרמני", "Dr. Schrammek Green Peel", "טיפול טבעי ב-100% לחידוש העור באמצעות תערובת צמחי מרפא המעודדת את זרימת הדם ומסירה תאים מתים. יעיל מאוד בטיפול באקנה, בנקבוביות מורחבות ובאיחוד גוון העור."],
  ["פילינג ספונג'ילה", "Spongilla", "טכניקת פילינג ביולוגי המבוססת על מחטיות טבעיות דקיקות לחידוש תאי העור ולעידוד ייצור קולגן. מצוינת לטיפול בפיגמנטציה ולהענקת זוהר ורעננות מיידיים לפנים."],
  ["הסרת שומות (נקודות חן) ויבלות עור", null, "טיפול מהיר ובטוח לסילוק שומות ויבלות עור באמצעות טכנולוגיות מתקדמות, להבטחת תוצאה אסתטית מיטבית. ההליך מתבצע בדיוק גבוה להותרת עור נקי ואחיד, ללא הותרת סימנים."],
  ["הסרת שומות בטכנולוגיית פלזמה", "Plasmage", "שימוש בטכנולוגיית פלזמה מדויקת ובטוחה לאידוי ולהסרת שומות ללא צורך בניתוח או בתפירה. מבטיחה סילוק יעיל של שומות עם החלמה מהירה וללא הותרת צלקות בולטות."],
  ["טיפול בסימני מתיחה", "Stretch Marks", "פרוטוקולים ייעודיים המעודדים קולגן ואלסטין בשכבות העור העמוקות לשיקום הסדקים. מסייעים להפחית את מראה הסימנים ולשפר את מרקם וגוון העור באופן ניכר."],
  ["מפגשי רעננות וטיפוח עור", null, "מפגשים משולבים בשימוש בחומרים הקוסמטיים הטובים ביותר להזנת העור, להענקת לחות עמוקה ולהשבת החיוניות. מעניקים לפנים זוהר מיידי ורכות יוצאת דופן, להתמודדות עם דהות ועייפות."],
  ["עיסויי הרגעה (פנים, ראש וכתפיים)", null, "מפגשי עיסוי ייעודיים להפגת מתח ולחץ ולהמרצת זרימת הדם. מספקים חוויית רוגע עמוקה המשתקפת לטובה במנוחת הגוף, בצלילות המחשבה ובהרגעת העצבים."],
  ["עיסויים, כוסות רוח (חיג'אמה) וטיפול כוסות סיני", null, "עיסויים וטיפולי כוסות רוח (חיג'אמה) בשילוב טכניקת כוסות בסגנון סיני, להמרצת זרימת הדם, לשחרור מתחים ולתחושת רעננות וחיוניות."],
];

try {
  // 1. identify placeholder treatments
  const placeholders = await prisma.treatment.findMany({
    where: { name: { contains: "PLACEHOLDER" } },
    select: { id: true, name: true },
  });
  const ids = placeholders.map((p) => p.id);
  console.log(`found ${placeholders.length} placeholder treatments`);

  if (ids.length > 0) {
    // 2. detach / remove references so the delete is safe (placeholders are test data)
    const rules = await prisma.followUpRule.deleteMany({ where: { treatmentId: { in: ids } } });
    const appts = await prisma.appointment.updateMany({ where: { treatmentId: { in: ids } }, data: { treatmentId: null } });
    const clients = await prisma.client.updateMany({ where: { requestedTreatmentId: { in: ids } }, data: { requestedTreatmentId: null } });
    console.log(`detached: ${rules.count} follow-up rules, ${appts.count} appointments, ${clients.count} client requests`);

    // 3. delete placeholders (VisitTreatment has onDelete:Restrict — skip & report any blocked)
    const blocked = [];
    for (const p of placeholders) {
      try {
        await prisma.treatment.delete({ where: { id: p.id } });
      } catch {
        blocked.push(p.name);
      }
    }
    console.log(`deleted ${placeholders.length - blocked.length} placeholders` + (blocked.length ? `; kept ${blocked.length} (have visit history): ${blocked.join(", ")}` : ""));
  }

  // 4. insert the real menu (idempotent via upsert on unique name)
  let created = 0;
  for (const [name, device, description] of MENU) {
    const fullDescription = device ? `${device} — ${description}` : description;
    await prisma.treatment.upsert({
      where: { name },
      update: { description: fullDescription },
      create: {
        name,
        description: fullDescription,
        durationMinutes: DEFAULT_DURATION,
        price: DEFAULT_PRICE,
        color: DEFAULT_COLOR,
        requiresConsentForm: false,
      },
    });
    created++;
  }

  const total = await prisma.treatment.count();
  console.log(`\nseeded ${created} real treatments. total treatments in DB: ${total}`);
} catch (err) {
  console.error("seed failed:", err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
