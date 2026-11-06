/**
 * API למיזוג כפילויות (משימה 3.4, FR-CL-02) — ראו `lib/db/merge-clients.ts`
 * לפירוט הלוגיקה (עדכון רשומת השורד, איחוד תגיות, נקודת הרחבה ל"איחוד
 * היסטוריה" של רשומות קשורות בעתיד, וארכוב הרשומה הכפולה — לא מחיקה
 * פיזית, כמו ב-3.2).
 */

import { NextResponse } from "next/server";
import {
  validateMergeClients,
  isClientValid,
  type MergeClientsInput,
} from "@/lib/validations/clients";
import { mergeClients, MergeClientNotFoundError } from "@/lib/db/merge-clients";

export async function POST(request: Request) {
  let body: Partial<MergeClientsInput>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "גוף הבקשה אינו JSON תקין" },
      { status: 400 }
    );
  }

  const errors = validateMergeClients(body);
  if (!isClientValid(errors)) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  try {
    const client = await mergeClients(
      body.survivorId!,
      body.duplicateId!,
      body.resolved!
    );
    return NextResponse.json({ client });
  } catch (error) {
    if (error instanceof MergeClientNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "אירעה שגיאה במיזוג הלקוחות" },
      { status: 500 }
    );
  }
}
