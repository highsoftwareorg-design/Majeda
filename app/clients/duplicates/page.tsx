import Link from "next/link";
import { findDuplicateClientGroups } from "@/lib/db/clients";
import {
  DuplicatesReview,
  type DuplicateGroupView,
} from "@/components/clients/DuplicatesReview";

// עמוד איתור ומיזוג כפילויות (משימה 3.4, FR-CL-02). מוגן ע"י ה-middleware
// הקיים (`/clients/:path*`, משימה 1.11). עמוד עצמאי — לא תלוי במסך רשימת
// הלקוחות המלא (משימה 3.5+, עדיין לא קיים).
// Opts out of static prerendering (קורא מה-DB בכל בקשה).
export const instant = false;

export default async function ClientDuplicatesPage() {
  const groups = await findDuplicateClientGroups();

  // הערה: אם קבוצה מכילה יותר משני לקוחות (נדיר), ממשק המיזוג (3.4) מציג
  // ומטפל בשני הראשונים בלבד — זהו היקף המשימה ("שני פרופילים"); אם יישארו
  // יותר משני לקוחות עם אותו טלפון אחרי המיזוג, הקבוצה תופיע מחדש בטעינה
  // הבאה של העמוד לטיפול בזוג הנותר.
  const serializedGroups: DuplicateGroupView[] = groups.map((group) => ({
    key: group.key,
    clients: group.clients.slice(0, 2).map((client) => ({
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      phone: client.phone,
      gender: client.gender,
      birthDate: client.birthDate ? client.birthDate.toISOString() : null,
      email: client.email,
      city: client.city,
      source: client.source,
      note: client.note,
      marketingConsentChannel: client.marketingConsentChannel,
      createdAt: client.createdAt.toISOString(),
      tags: client.tags.map(({ tag }) => ({ id: tag.id, name: tag.name })),
    })),
  }));

  return (
    <main dir="rtl" className="min-h-screen bg-champagne p-4 sm:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <Link
            href="/clients"
            className="text-sm text-gold-dark underline-offset-2 hover:underline"
          >
            → חזרה לניהול לקוחות
          </Link>
          <h1 className="font-heading text-2xl text-charcoal">
            איתור ומיזוג כפילויות
          </h1>
          <p className="text-taupe">
            הרשימה הבאה מציגה לקוחות פעילים עם מספר טלפון זהה או דומה מאוד
            (8 הספרות האחרונות תואמות) — למשל נתוני ייבוא/היסטוריה שהוזנו
            בפורמטים שונים. ניתן לבחור, לכל שדה, מאיזה משני הפרופילים לשמור
            את הערך הסופי; הלקוח שלא נבחר יועבר לארכיון ולא יימחק.
          </p>
        </header>

        {serializedGroups.length === 0 ? (
          <p className="rounded-lg border border-gold-antique/30 bg-porcelain p-4 text-taupe">
            לא נמצאו כפילויות פעילות כרגע.
          </p>
        ) : (
          <DuplicatesReview groups={serializedGroups} />
        )}
      </div>
    </main>
  );
}
