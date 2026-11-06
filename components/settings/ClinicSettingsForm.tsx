"use client";

/**
 * טופס הגדרות מרפאה — שעות פעילות (משימה 5.7, FR-AP-05).
 *
 * כולל:
 *  - שעת פתיחה / סגירה (חובה)
 *  - הפסקה קבועה: שעת התחלה + סיום (אופציונלי)
 *
 * RTL, עברית, mobile-responsive, נגיש.
 * שמירה: PUT /api/settings/clinic
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ClinicSettingsData } from "@/lib/db/clinicSettings";

interface ClinicSettingsFormProps {
  initialSettings: ClinicSettingsData;
}

/** ממיר שעה (0-23) + דקות (0-59) לפורמט HH:MM */
function toTimeString(hour: number | null, min: number | null = 0): string {
  if (hour === null) return "";
  return `${String(hour).padStart(2, "0")}:${String(min ?? 0).padStart(2, "0")}`;
}

/** מנתח מחרוזת HH:MM ל-{ hour, min } — מחזיר null אם ריק */
function parseTimeString(value: string): { hour: number; min: number } | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return { hour: h, min: m };
}

export function ClinicSettingsForm({ initialSettings }: ClinicSettingsFormProps) {
  const [openTime, setOpenTime] = useState(
    toTimeString(initialSettings.openHour, 0)
  );
  const [closeTime, setCloseTime] = useState(
    toTimeString(initialSettings.closeHour, 0)
  );
  const [hasBreak, setHasBreak] = useState(
    initialSettings.breakStartHour !== null
  );
  const [breakStart, setBreakStart] = useState(
    toTimeString(initialSettings.breakStartHour, initialSettings.breakStartMin)
  );
  const [breakEnd, setBreakEnd] = useState(
    toTimeString(initialSettings.breakEndHour, initialSettings.breakEndMin)
  );

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    const openParsed = parseTimeString(openTime);
    const closeParsed = parseTimeString(closeTime);

    if (!openParsed || !closeParsed) {
      setErrorMsg("יש להזין שעת פתיחה וסגירה תקינות");
      return;
    }

    if (openParsed.hour >= closeParsed.hour) {
      setErrorMsg("שעת הפתיחה חייבת להיות לפני שעת הסגירה");
      return;
    }

    let breakStartHour: number | null = null;
    let breakStartMin: number | null = null;
    let breakEndHour: number | null = null;
    let breakEndMin: number | null = null;

    if (hasBreak) {
      const bStart = parseTimeString(breakStart);
      const bEnd = parseTimeString(breakEnd);
      if (!bStart || !bEnd) {
        setErrorMsg("יש להזין שעות הפסקה תקינות");
        return;
      }
      if (bStart.hour * 60 + bStart.min >= bEnd.hour * 60 + bEnd.min) {
        setErrorMsg("שעת תחילת הפסקה חייבת להיות לפני שעת סיומה");
        return;
      }
      breakStartHour = bStart.hour;
      breakStartMin = bStart.min;
      breakEndHour = bEnd.hour;
      breakEndMin = bEnd.min;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings/clinic", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openHour: openParsed.hour,
          closeHour: closeParsed.hour,
          breakStartHour,
          breakStartMin,
          breakEndHour,
          breakEndMin,
        }),
      });

      const json = (await res.json()) as { settings?: ClinicSettingsData; error?: string };

      if (!res.ok) {
        setErrorMsg(json.error ?? "שגיאה בשמירה — נסה שוב");
      } else {
        setSuccessMsg("הגדרות נשמרו בהצלחה");
      }
    } catch {
      setErrorMsg("שגיאת רשת — נסה שוב");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = cn(
    "h-11 w-full rounded-md border border-gold-antique/70 bg-white",
    "px-3 text-sm text-charcoal",
    "focus:outline-none focus:ring-2 focus:ring-gold-dark/40",
    "disabled:opacity-50"
  );

  return (
    <form
      onSubmit={handleSave}
      className="bg-white rounded-lg shadow-sm border border-gold-antique/20 overflow-hidden"
      aria-label="טופס הגדרות שעות פעילות מרפאה"
      noValidate
    >
      {/* ───── שעות פעילות ───── */}
      <section className="p-6 border-b border-border">
        <h2 className="font-heading text-base font-semibold text-charcoal mb-4">
          שעות פעילות
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* שעת פתיחה */}
          <div>
            <label
              htmlFor="open-time"
              className="block text-sm font-medium text-charcoal mb-1"
            >
              שעת פתיחה
              <span className="text-error ms-1" aria-hidden="true">*</span>
            </label>
            <input
              id="open-time"
              type="time"
              value={openTime}
              onChange={(e) => {
                setOpenTime(e.target.value);
                setSuccessMsg(null);
              }}
              required
              dir="ltr"
              className={fieldClass}
              aria-required="true"
              aria-describedby="open-time-desc"
            />
            <p id="open-time-desc" className="sr-only">
              שעת פתיחת המרפאה, בפורמט שע:דק
            </p>
          </div>

          {/* שעת סגירה */}
          <div>
            <label
              htmlFor="close-time"
              className="block text-sm font-medium text-charcoal mb-1"
            >
              שעת סגירה
              <span className="text-error ms-1" aria-hidden="true">*</span>
            </label>
            <input
              id="close-time"
              type="time"
              value={closeTime}
              onChange={(e) => {
                setCloseTime(e.target.value);
                setSuccessMsg(null);
              }}
              required
              dir="ltr"
              className={fieldClass}
              aria-required="true"
              aria-describedby="close-time-desc"
            />
            <p id="close-time-desc" className="sr-only">
              שעת סגירת המרפאה, בפורמט שע:דק
            </p>
          </div>
        </div>
      </section>

      {/* ───── הפסקה קבועה ───── */}
      <section className="p-6 border-b border-border">
        <div className="flex items-center gap-3 mb-4">
          <input
            id="has-break"
            type="checkbox"
            checked={hasBreak}
            onChange={(e) => {
              setHasBreak(e.target.checked);
              if (!e.target.checked) {
                setBreakStart("");
                setBreakEnd("");
              }
              setSuccessMsg(null);
            }}
            className="h-4 w-4 rounded border-gold-antique accent-gold-dark cursor-pointer"
            aria-controls="break-fields"
          />
          <label
            htmlFor="has-break"
            className="text-sm font-medium text-charcoal cursor-pointer select-none"
          >
            הגדרת הפסקה קבועה (אופציונלי)
          </label>
        </div>

        {hasBreak && (
          <div
            id="break-fields"
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {/* תחילת הפסקה */}
            <div>
              <label
                htmlFor="break-start"
                className="block text-sm font-medium text-charcoal mb-1"
              >
                תחילת הפסקה
              </label>
              <input
                id="break-start"
                type="time"
                value={breakStart}
                onChange={(e) => {
                  setBreakStart(e.target.value);
                  setSuccessMsg(null);
                }}
                dir="ltr"
                className={fieldClass}
                aria-describedby="break-start-desc"
              />
              <p id="break-start-desc" className="sr-only">
                שעת תחילת ההפסקה, בפורמט שע:דק
              </p>
            </div>

            {/* סיום הפסקה */}
            <div>
              <label
                htmlFor="break-end"
                className="block text-sm font-medium text-charcoal mb-1"
              >
                סיום הפסקה
              </label>
              <input
                id="break-end"
                type="time"
                value={breakEnd}
                onChange={(e) => {
                  setBreakEnd(e.target.value);
                  setSuccessMsg(null);
                }}
                dir="ltr"
                className={fieldClass}
                aria-describedby="break-end-desc"
              />
              <p id="break-end-desc" className="sr-only">
                שעת סיום ההפסקה, בפורמט שע:דק
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ───── הודעות + כפתור שמירה ───── */}
      <div className="p-6 flex flex-col gap-3">
        {/* הודעת שגיאה */}
        {errorMsg && (
          <p
            role="alert"
            className="text-sm text-error bg-error/10 rounded-md px-3 py-2"
          >
            {errorMsg}
          </p>
        )}

        {/* הודעת הצלחה */}
        {successMsg && (
          <p
            role="status"
            aria-live="polite"
            className="text-sm text-success bg-success/10 rounded-md px-3 py-2"
          >
            {successMsg}
          </p>
        )}

        <Button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto"
          aria-busy={saving}
        >
          {saving ? "שומר..." : "שמור הגדרות"}
        </Button>
      </div>
    </form>
  );
}
