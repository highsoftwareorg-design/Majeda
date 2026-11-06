/**
 * לוגיקת מיזוג כפילויות (משימה 3.4, FR-CL-02).
 *
 * מקבלת שני מזהי לקוח — "שורד" (`survivorId`) ו"כפול" (`duplicateId`) —
 * וערכים סופיים פתורים לכל שדה (`resolved`, ראו `validateMergeClients`).
 * הפעולה:
 *   1. מעדכנת את רשומת השורד עם הערכים הסופיים (כולל תגיות — איחוד בין
 *      התגיות של שני הלקוחות, אלא אם סופק `tagIds` מפורש).
 *   2. "מאחדת היסטוריה" — ראו `repointClientRelations` למטה.
 *   3. מארכבת (לא מוחקת פיזית) את רשומת הכפול, לפי אותו מכניזם משימה 3.2
 *      (`status="archived"` + `archivedAt`).
 * הכול בתוך טרנזקציית Prisma אחת כדי שלא תיוותר מצב חצי-ממוזג.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { CreateClientInput } from "@/lib/validations/clients";
import { normalizeIsraeliPhone } from "@/lib/validations/contact";

/**
 * נקודת הרחבה יחידה וברורה ל"איחוד היסטוריה" (re-point של רשומות קשורות
 * מהלקוח הכפול לשורד) — למשל `Visit`/`Appointment` בעתיד (תחומים 4/5,
 * שעדיין לא קיימים בסכימה כרגע). כל מודל עתידי שמצביע על `Client` צריך
 * להתעדכן כאן (בתוך אותה טרנזקציה) לפני ארכוב הכפול, כדי שההיסטוריה שלו
 * "תעבור" לשורד ולא תישאר תלויה ברשומה שתוארכב.
 *
 * כרגע (משימה 3.4): no-op — אין עדיין מודלים כאלה בסכימה.
 */
async function repointClientRelations(
  _tx: Prisma.TransactionClient,
  _fromClientId: string,
  _toClientId: string
): Promise<void> {
  // לדוגמה עתידית:
  // await tx.visit.updateMany({ where: { clientId: fromClientId }, data: { clientId: toClientId } });
  // await tx.appointment.updateMany({ where: { clientId: fromClientId }, data: { clientId: toClientId } });
}

export type MergeClientsResult = Awaited<
  ReturnType<typeof prisma.client.findUniqueOrThrow>
>;

export async function mergeClients(
  survivorId: string,
  duplicateId: string,
  resolved: CreateClientInput
): Promise<MergeClientsResult> {
  return prisma.$transaction(async (tx) => {
    const [survivor, duplicate] = await Promise.all([
      tx.client.findUnique({ where: { id: survivorId }, include: { tags: true } }),
      tx.client.findUnique({ where: { id: duplicateId }, include: { tags: true } }),
    ]);

    if (!survivor) {
      throw new MergeClientNotFoundError("survivor", survivorId);
    }
    if (!duplicate) {
      throw new MergeClientNotFoundError("duplicate", duplicateId);
    }

    // תגיות: איחוד בין שתי הרשומות (ברירת מחדל), אלא אם נבחרה רשימה מפורשת.
    const tagIds =
      resolved.tagIds ??
      Array.from(
        new Set([
          ...survivor.tags.map((t) => t.tagId),
          ...duplicate.tags.map((t) => t.tagId),
        ])
      );

    await repointClientRelations(tx, duplicateId, survivorId);

    await tx.clientTag.deleteMany({ where: { clientId: survivorId } });

    const updated = await tx.client.update({
      where: { id: survivorId },
      data: {
        firstName: resolved.firstName.trim(),
        lastName: resolved.lastName.trim(),
        phone: normalizeIsraeliPhone(resolved.phone),
        gender: resolved.gender ?? undefined,
        birthDate: resolved.birthDate ? new Date(resolved.birthDate) : null,
        email: resolved.email?.trim() || null,
        city: resolved.city?.trim() || null,
        source: resolved.source?.trim() || undefined,
        utmSource: resolved.utmSource ?? undefined,
        utmMedium: resolved.utmMedium ?? undefined,
        utmCampaign: resolved.utmCampaign ?? undefined,
        utmTerm: resolved.utmTerm ?? undefined,
        utmContent: resolved.utmContent ?? undefined,
        note: resolved.note?.trim() || null,
        marketingConsentChannel: resolved.marketingConsentChannel ?? undefined,
        marketingConsentAt:
          resolved.marketingConsentChannel &&
          resolved.marketingConsentChannel !== "none"
            ? new Date()
            : null,
        requestedTreatmentId: resolved.requestedTreatmentId || undefined,
        ...(tagIds.length
          ? { tags: { create: tagIds.map((tagId) => ({ tagId })) } }
          : {}),
      },
    });

    await tx.client.update({
      where: { id: duplicateId },
      data: { status: "archived", archivedAt: new Date() },
    });

    return updated;
  });
}

export class MergeClientNotFoundError extends Error {
  constructor(public readonly role: "survivor" | "duplicate", public readonly id: string) {
    super(`לקוח (${role}) עם מזהה ${id} לא נמצא`);
  }
}
