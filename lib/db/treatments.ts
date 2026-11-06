import { cache } from "react";
import { prisma } from "@/lib/db/prisma";

/**
 * שליפת רשימת הטיפולים — מקור נתונים יחיד המשותף לכל רכיבי דף הנחיתה
 * (סקשן "הטיפולים" וטופס השארת פרטים), כדי למנוע מערך נתונים כפול בקוד.
 * עטוף ב-`cache()` של React כדי לדדפל (dedupe) בקשות זהות באותו render.
 */
export const getTreatments = cache(async function getTreatments() {
  return prisma.treatment.findMany({
    orderBy: { createdAt: "asc" },
  });
});
