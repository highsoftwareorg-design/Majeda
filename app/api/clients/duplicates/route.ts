/**
 * API לזיהוי כפילויות (משימה 3.4, FR-CL-02) — ראו `lib/db/clients.ts`
 * (`findDuplicateClientGroups`) לפירוט לוגיקת הזיהוי (טלפון זהה/דומה מאוד
 * לפי 8 הספרות האחרונות, בקרב לקוחות פעילים בלבד).
 */

import { NextResponse } from "next/server";
import { findDuplicateClientGroups } from "@/lib/db/clients";
import { auth } from "@/lib/auth/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });

  const groups = await findDuplicateClientGroups();
  return NextResponse.json({ groups });
}
