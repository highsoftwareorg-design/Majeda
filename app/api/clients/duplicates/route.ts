/**
 * API לזיהוי כפילויות (משימה 3.4, FR-CL-02) — ראו `lib/db/clients.ts`
 * (`findDuplicateClientGroups`) לפירוט לוגיקת הזיהוי (טלפון זהה/דומה מאוד
 * לפי 8 הספרות האחרונות, בקרב לקוחות פעילים בלבד).
 */

import { NextResponse } from "next/server";
import { findDuplicateClientGroups } from "@/lib/db/clients";

export async function GET() {
  const groups = await findDuplicateClientGroups();
  return NextResponse.json({ groups });
}
