/**
 * שאילתות בסיס נתונים להגדרות מרפאה (ClinicSettings) — משימה 5.7, FR-AP-05.
 *
 * הרשומה היא singleton (id = "singleton"). GET מחזיר ברירות מחדל אם אין רשומה,
 * PUT שומר עם upsert.
 */

import { prisma } from "@/lib/db/prisma";

/** ברירות מחדל להגדרות מרפאה */
export const DEFAULT_CLINIC_SETTINGS = {
  openHour: 8,
  closeHour: 21,
  breakStartHour: null as number | null,
  breakStartMin: null as number | null,
  breakEndHour: null as number | null,
  breakEndMin: null as number | null,
};

export type ClinicSettingsData = typeof DEFAULT_CLINIC_SETTINGS;

/**
 * מחזיר את הגדרות המרפאה. אם אין רשומה בבסיס הנתונים — מחזיר ברירות מחדל
 * (ללא כתיבה לבסיס הנתונים).
 */
export async function getClinicSettings(): Promise<ClinicSettingsData> {
  const row = await prisma.clinicSettings.findUnique({
    where: { id: "singleton" },
  });

  if (!row) return { ...DEFAULT_CLINIC_SETTINGS };

  return {
    openHour: row.openHour,
    closeHour: row.closeHour,
    breakStartHour: row.breakStartHour,
    breakStartMin: row.breakStartMin,
    breakEndHour: row.breakEndHour,
    breakEndMin: row.breakEndMin,
  };
}

/**
 * שומר (upsert) הגדרות מרפאה.
 */
export async function upsertClinicSettings(
  data: ClinicSettingsData
): Promise<ClinicSettingsData> {
  const row = await prisma.clinicSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      openHour: data.openHour,
      closeHour: data.closeHour,
      breakStartHour: data.breakStartHour,
      breakStartMin: data.breakStartMin,
      breakEndHour: data.breakEndHour,
      breakEndMin: data.breakEndMin,
    },
    update: {
      openHour: data.openHour,
      closeHour: data.closeHour,
      breakStartHour: data.breakStartHour,
      breakStartMin: data.breakStartMin,
      breakEndHour: data.breakEndHour,
      breakEndMin: data.breakEndMin,
    },
  });

  return {
    openHour: row.openHour,
    closeHour: row.closeHour,
    breakStartHour: row.breakStartHour,
    breakStartMin: row.breakStartMin,
    breakEndHour: row.breakEndHour,
    breakEndMin: row.breakEndMin,
  };
}
