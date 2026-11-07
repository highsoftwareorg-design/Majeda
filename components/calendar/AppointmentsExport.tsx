"use client";

/**
 * כפתור "ייצוא תקופה" ביומן (משימה 10.2) — בחירת טווח תאריכים והורדת CSV של התורים.
 * מופיע רק לאדמין (המסך מעביר את הדגל). הקישור מפנה ל-GET /api/appointments/export.
 */

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function AppointmentsExport({
  defaultStart,
  defaultEnd,
}: {
  /** תאריך התחלה ברירת מחדל בפורמט YYYY-MM-DD (תחילת השבוע המוצג). */
  defaultStart: string;
  /** תאריך סיום ברירת מחדל בפורמט YYYY-MM-DD (סוף השבוע המוצג). */
  defaultEnd: string;
}) {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);

  const isValidRange = Boolean(start) && Boolean(end) && end >= start;
  const href = `/api/appointments/export?${new URLSearchParams({ start, end }).toString()}`;

  return (
    <details className="relative">
      <summary
        className={cn(
          "flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-gold-antique/40 bg-porcelain px-4 text-sm font-medium text-charcoal",
          "transition-colors hover:bg-champagne",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1"
        )}
      >
        ייצוא תקופה
      </summary>

      <div className="absolute end-0 z-20 mt-1 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-lg border border-gold-antique/40 bg-porcelain p-4 shadow-md">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-charcoal">מתאריך</span>
          <Input
            type="date"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            className="h-11 bg-champagne text-base"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-charcoal">עד תאריך</span>
          <Input
            type="date"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            className="h-11 bg-champagne text-base"
          />
        </label>

        {isValidRange ? (
          <a
            href={href}
            className={cn(
              "flex min-h-11 items-center justify-center rounded-lg bg-gold-dark px-4 text-sm font-medium text-champagne",
              "transition-colors hover:bg-gold-dark/90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1"
            )}
          >
            הורדת קובץ CSV
          </a>
        ) : (
          <p role="alert" className="text-sm text-destructive">
            יש לבחור טווח תאריכים תקין (תאריך הסיום לא לפני תאריך ההתחלה).
          </p>
        )}
      </div>
    </details>
  );
}
