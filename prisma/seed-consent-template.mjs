// Seed a real general consent template WITH a digital-signature field.
// Field shape matches ConsentTemplateEditor / SignConsentForm: { id, type, label, required? }
// type ∈ "text" | "boolean" | "checkbox" | "signature".
// Idempotent: skips if an active template with the same name already exists.
//
// Run: npx dotenv -e .env.local -- node prisma/seed-consent-template.mjs
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const NAME = "הסכמה כללית לטיפול";
let i = 0;
const fid = () => `field_seed_${Date.now()}_${i++}`;

const fields = [
  { id: fid(), type: "checkbox", required: true,
    label: "קראתי והבנתי את מהות הטיפול, והוסברו לי מטרותיו, אופן ביצועו והתוצאות הצפויות." },
  { id: fid(), type: "checkbox", required: true,
    label: "הוסברו לי הסיכונים ותופעות הלוואי האפשריות, וכן ההנחיות לפני ואחרי הטיפול." },
  { id: fid(), type: "checkbox", required: true,
    label: "אני מצהיר/ה כי מסרתי מידע רפואי מלא ונכון, ובאחריותי לעדכן את הקליניקה בכל שינוי." },
  { id: fid(), type: "checkbox", required: true,
    label: "אני מסכים/ה לקבל את הטיפול מרצוני החופשי, ויודע/ת שאוכל לשאול שאלות ולהפסיק בכל עת." },
  { id: fid(), type: "checkbox", required: true,
    label: "אני מסכים/ה לשמירת פרטיי והמידע הרפואי לצורך מתן הטיפול והמעקב, בהתאם למדיניות הפרטיות של הקליניקה." },
  { id: fid(), type: "text", required: false,
    label: "הערות / רגישויות / מידע רפואי נוסף (לא חובה)" },
  { id: fid(), type: "signature", required: true,
    label: "חתימת הלקוח/ה" },
];

try {
  const existing = await prisma.consentTemplate.findFirst({
    where: { name: NAME, isActive: true },
    select: { id: true },
  });
  if (existing) {
    console.log(`template "${NAME}" already exists (id ${existing.id}) — skipping.`);
  } else {
    const t = await prisma.consentTemplate.create({
      data: {
        name: NAME,
        isGeneral: true,
        treatmentIds: [],
        validityDays: 365,
        language: "he",
        fields,
        version: 1,
        isActive: true,
      },
      select: { id: true, name: true },
    });
    console.log(`created template "${t.name}" (id ${t.id}) with ${fields.length} fields (incl. 1 signature).`);
  }
  const total = await prisma.consentTemplate.count({ where: { isActive: true } });
  console.log(`active templates in DB: ${total}`);
} catch (e) {
  console.error("seed failed:", e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
