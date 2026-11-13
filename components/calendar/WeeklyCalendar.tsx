"use client";

/**
 * WeeklyCalendar — יומן שבועי ויומי אינטראקטיבי (משימה 5.3 + 5.4 + 5.5, FR-AP-01).
 *
 * תצוגת שבוע עם ציר זמן אנכי (08:00–21:00), שבעה עמודות ימים (ראשון–שבת),
 * סינון לפי מטפל/ת וחדר, וכל תור צבוע בצבע הטיפול שלו (מ-5.2).
 * תצוגת יום: עמודה יחידה לתאריך הנבחר, עם ניווט קדימה/אחורה.
 * גרירה (DnD): HTML5 Drag & Drop (native API בלבד, ללא ספריות חיצוניות).
 *
 * על מסכים גדולים (md+) בתצוגת שבוע: גריד שבועי עם מיקום מוחלט של תורים.
 * על מסכים קטנים (נייד) בתצוגת שבוע: תצוגת רשימה מקובצת לפי יום.
 * תצוגת יום: גריד עמודה יחידה בכל גודלי מסך.
 *
 * RTL: עמוד ראשי dir="rtl"; גריד היומן עצמו dir="ltr" (זרימת זמן משמאל לימין
 * היא הנורמה הקלנדרית האוניברסלית, כולל בגרסאות עברית של Google Calendar).
 *
 * נגישות: aria-label על כל כפתור; role="region" על הגריד.
 *         כפתור "שנה מועד" בכל תור — נגיש ממקלדת (DnD אינו נגיש ממקלדת).
 * הגנה על PII: אין לוגים עם שמות/טלפונים לפי §11.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HardDeleteAppointmentDialog } from "@/components/calendar/HardDeleteAppointmentDialog";

// ---------------------------------------------------------------------------
// טיפוסים
// ---------------------------------------------------------------------------

export type SerializedStatusHistoryEntry = {
  id: string;
  fromStatus: string;
  toStatus: string;
  changedAt: string; // ISO 8601
  changedBy: string;
};

export type SerializedAppointment = {
  id: string;
  clientId: string;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  treatmentId: string | null;
  treatment: {
    id: string;
    name: string;
    durationMinutes: number;
    color: string | null;
  } | null;
  therapist: string;
  room: string | null;
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  status: string;
  notes: string | null;
  // היסטוריית שינויי סטטוס — 5 אחרונות, מהחדש לישן (משימה 5.8, FR-AP-04)
  statusHistory: SerializedStatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
};

/** טיפול לרשימת הבחירה בדיאלוג תור חדש (משימה 5.9, FR-AP-02) */
export type TreatmentOption = {
  id: string;
  name: string;
  durationMinutes: number;
  color: string | null;
};

/** לקוח/ה כתוצאת חיפוש בדיאלוג תור חדש */
type ClientSearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
};

export interface WeeklyCalendarProps {
  initialAppointments: SerializedAppointment[];
  initialWeekStart: string; // ISO date (YYYY-MM-DD)
  /** שעת פתיחה (0-23) — נשלפת מ-ClinicSettings, ברירת מחדל 8 */
  openHour?: number;
  /** שעת סגירה (0-23) — נשלפת מ-ClinicSettings, ברירת מחדל 21 */
  closeHour?: number;
  /** רשימת טיפולים לדיאלוג יצירת תור חדש (משימה 5.9) */
  treatments?: TreatmentOption[];
}

/** מצבי תצוגה: שבוע, יום או חודש (משימה 11.11) */
type ViewMode = "week" | "day" | "month";

/**
 * סוג תצוגת היום (משימה 11.11): גריד שעות (קיים) או רשימת "סדר יום" מסודרת לפי שעה.
 * ברירת מחדל: גריד; במסכים צרים (מובייל) מתעדכנת ל-"agenda" לאחר הטעינה.
 */
type DayLayout = "grid" | "agenda";

/** מצב slot שמועל מעליו סמן הגרירה */
interface DragOverSlot {
  /** 0–6 לשבוע, -1 לתצוגת יום */
  dayIdx: number;
  /** 0 = 08:00, 1 = 08:30, … */
  slotIdx: number;
}

// ---------------------------------------------------------------------------
// קבועים
// ---------------------------------------------------------------------------

/** ימי השבוע בעברית (ראשון=0 ... שבת=6) */
const WEEK_DAYS = [
  "ראשון",
  "שני",
  "שלישי",
  "רביעי",
  "חמישי",
  "שישי",
  "שבת",
] as const;

/** שעת פתיחה ביומן */
const CAL_START_HOUR = 8;
/** שעת סגירה ביומן */
const CAL_END_HOUR = 21;
/** פיקסלים לשעה */
const HOUR_HEIGHT_PX = 80;
/** פיקסלים לדקה */
const PX_PER_MIN = HOUR_HEIGHT_PX / 60;
/** צבע ברירת מחדל לתור ללא טיפול מוגדר (זהב מג׳ידה) */
const DEFAULT_APT_COLOR = "#D2AB2E";
/** גובה מינימלי לתור ביומן (פיקסלים) */
const MIN_APT_HEIGHT = 24;
// TOTAL_GRID_HEIGHT ו-TOTAL_SLOTS חושבים כנגזרות בתוך קומפוננטת WeeklyCalendar
// מתוך openHour/closeHour (ClinicSettings, משימה 5.7) — לא עוד קבועים ברמת מודול.

/** סטטוסי תור בעברית */
const STATUS_HE: Record<string, string> = {
  SCHEDULED: "נקבע",
  CONFIRMED: "אושר",
  ARRIVED: "הגיע/ה",
  COMPLETED: "בוצע",
  CANCELLED: "בוטל",
  NO_SHOW: "לא הגיע/ה",
};

/**
 * צבע רקע ל-badge הסטטוס בכרטיס התור.
 * הצבעים מתאימים לטקסט כהה (ink) כברירת מחדל.
 */
const STATUS_BADGE_STYLE: Record<string, { bg: string; text: string }> = {
  SCHEDULED:  { bg: "rgba(0,0,0,0.18)",   text: "inherit" },
  CONFIRMED:  { bg: "rgba(59,130,246,0.75)", text: "#fff" },
  ARRIVED:    { bg: "rgba(139,92,246,0.75)", text: "#fff" },
  COMPLETED:  { bg: "rgba(34,197,94,0.80)",  text: "#fff" },
  CANCELLED:  { bg: "rgba(239,68,68,0.80)",  text: "#fff" },
  NO_SHOW:    { bg: "rgba(249,115,22,0.80)", text: "#fff" },
};

/**
 * מעברי סטטוס חוקיים לפי FR-AP-04:
 * נקבע → אושר/בוטל
 * אושר → הגיע/ה / בוטל
 * הגיע/ה → בוצע / לא הגיע/ה / בוטל
 * בוצע / בוטל / לא הגיע/ה — סטטוסים סופיים ללא מעבר נוסף
 */
const NEXT_STATUSES: Record<string, string[]> = {
  SCHEDULED:  ["CONFIRMED", "CANCELLED"],
  CONFIRMED:  ["ARRIVED", "CANCELLED"],
  ARRIVED:    ["COMPLETED", "NO_SHOW", "CANCELLED"],
  COMPLETED:  [],
  CANCELLED:  [],
  NO_SHOW:    [],
};

// ---------------------------------------------------------------------------
// פונקציות עזר
// ---------------------------------------------------------------------------

/** מחזיר את תחילת השבוע (ראשון) עבור תאריך נתון. */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // Sunday = 0
  d.setHours(0, 0, 0, 0);
  return d;
}

/** YYYY-MM-DD */
function toIsoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * YYYY-MM-DD לפי התאריך המקומי (לא UTC).
 * משמש לטווח חודש (11.11) ולברירת מחדל של יום בחודש — כדי שלא תוזז התאריך באזור Asia/Jerusalem.
 */
function toLocalIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** שמות חודשים בעברית (לועזי) לכותרת תצוגת חודש */
const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
] as const;

/** DD/MM */
function toDayMonth(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** HH:MM */
function toTimeStr(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** האם תאריך הוא היום */
function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

/** האם שני תאריכים הם אותו יום */
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * מחשב מיקום ביומן עבור תור.
 * מחזיר top ו-height בפיקסלים, או null אם התור מחוץ לטווח הנראה.
 *
 * @param calStartHour שעת פתיחה (נגזרת מ-ClinicSettings, ברירת מחדל CAL_START_HOUR)
 * @param calEndHour   שעת סגירה (נגזרת מ-ClinicSettings, ברירת מחדל CAL_END_HOUR)
 */
function calcPosition(
  startIso: string,
  endIso: string,
  calStartHour: number,
  calEndHour: number
): { top: number; height: number } | null {
  const start = new Date(startIso);
  const end = new Date(endIso);

  const startMins = start.getHours() * 60 + start.getMinutes();
  const endMins = end.getHours() * 60 + end.getMinutes();
  const calStartMins = calStartHour * 60;
  const calEndMins = calEndHour * 60;

  const clampedStart = Math.max(calStartMins, startMins);
  const clampedEnd = Math.min(calEndMins, endMins);

  if (clampedStart >= clampedEnd) return null;

  return {
    top: (clampedStart - calStartMins) * PX_PER_MIN,
    height: Math.max(MIN_APT_HEIGHT, (clampedEnd - clampedStart) * PX_PER_MIN),
  };
}

/**
 * מחשב אם צבע רקע דורש טקסט כהה (true) או בהיר (false).
 * מבוסס על לומינסנס WCAG.
 */
function needsDarkText(hexColor: string): boolean {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexColor);
  if (!m) return true;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

// ---------------------------------------------------------------------------
// תת-קומפוננטה: כרטיס תור ביומן
// ---------------------------------------------------------------------------

interface AppointmentCardProps {
  apt: SerializedAppointment;
  pos: { top: number; height: number };
  /** האם להציג פרטים נוספים (מטפל/ת, חדר) — בתצוגת יום יש יותר מקום */
  showExtended?: boolean;
  /** האם תור זה עצמו מוגרר כרגע — מוריד opacity */
  isDragging?: boolean;
  /** קאלבק onDragStart — מועבר מהקומפוננטה הראשית */
  onDragStart: (e: React.DragEvent, apt: SerializedAppointment) => void;
  /** קאלבק onDragEnd */
  onDragEnd: () => void;
  /** קאלבק לפתיחת דיאלוג שינוי מועד (נגישות ממקלדת) */
  onReschedule: (apt: SerializedAppointment) => void;
  /** קאלבק לשינוי סטטוס תור (משימה 5.8, FR-AP-04) */
  onStatusChange: (apt: SerializedAppointment, newStatus: string) => void;
}

function AppointmentCard({
  apt,
  pos,
  showExtended = false,
  isDragging = false,
  onDragStart,
  onDragEnd,
  onReschedule,
  onStatusChange,
}: AppointmentCardProps) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const bgColor = apt.treatment?.color ?? DEFAULT_APT_COLOR;
  const darkText = needsDarkText(bgColor);
  const clientName = `${apt.client.firstName} ${apt.client.lastName}`.trim();
  const displayName =
    showExtended
      ? clientName
      : clientName.length > 14
      ? clientName.slice(0, 13) + "…"
      : clientName;
  const startStr = toTimeStr(apt.startTime);
  const endStr = toTimeStr(apt.endTime);

  const nextStatuses = NEXT_STATUSES[apt.status] ?? [];
  const badgeStyle = STATUS_BADGE_STYLE[apt.status] ?? STATUS_BADGE_STYLE.SCHEDULED;

  // סגירת תפריט הסטטוס בלחיצה מחוצה לו
  const handleCardClick = useCallback(() => {
    if (showStatusMenu) setShowStatusMenu(false);
  }, [showStatusMenu]);

  return (
    <div
      draggable
      className={cn(
        "absolute inset-x-[2px] rounded overflow-hidden shadow-sm cursor-grab select-none group",
        "transition-opacity duration-150",
        isDragging && "opacity-30 cursor-grabbing"
      )}
      style={{
        top: pos.top + 1,
        height: pos.height - 2,
        backgroundColor: bgColor,
        color: darkText ? "#1C1A17" : "#FFFFFF",
        zIndex: isDragging ? 1 : showStatusMenu ? 20 : 2,
      }}
      onDragStart={(e) => onDragStart(e, apt)}
      onDragEnd={onDragEnd}
      onClick={handleCardClick}
      title={[
        clientName,
        apt.treatment?.name,
        `${startStr}–${endStr}`,
        apt.therapist,
        apt.room,
        STATUS_HE[apt.status] ?? apt.status,
      ]
        .filter(Boolean)
        .join(" | ")}
      role="article"
      aria-label={`תור: ${clientName}, ${apt.treatment?.name ?? "טיפול"}, ${startStr}–${endStr}, סטטוס: ${STATUS_HE[apt.status] ?? apt.status}`}
    >
      <div className="p-1 h-full overflow-hidden leading-tight relative" dir="rtl">
        {/* שם לקוח/ה */}
        <div className="text-[11px] font-semibold truncate pe-6">
          {displayName}
        </div>

        {/* שם טיפול */}
        {pos.height >= 38 && apt.treatment?.name && (
          <div className="text-[10px] opacity-85 truncate">
            {apt.treatment.name}
          </div>
        )}

        {/* שעות */}
        {pos.height >= 54 && (
          <div className="text-[10px] opacity-70 truncate" dir="ltr">
            {startStr}–{endStr}
          </div>
        )}

        {/* מטפל/ת וחדר */}
        {showExtended && pos.height >= 70 && apt.therapist && (
          <div className="text-[10px] opacity-70 truncate">
            {apt.therapist}
            {apt.room ? ` · ${apt.room}` : ""}
          </div>
        )}

        {/* Badge סטטוס — מוצג כשיש מספיק גובה או בתצוגה מורחבת */}
        {pos.height >= 54 && (
          <div className="mt-0.5">
            <span
              className="inline-block text-[9px] font-medium px-1 py-0.5 rounded-sm leading-none"
              style={{ backgroundColor: badgeStyle.bg, color: badgeStyle.text }}
              aria-label={`סטטוס: ${STATUS_HE[apt.status] ?? apt.status}`}
            >
              {STATUS_HE[apt.status] ?? apt.status}
            </span>
          </div>
        )}

        {/* היסטוריית שינויי סטטוס — 2 אחרונים, בתצוגה מורחבת בלבד */}
        {showExtended && pos.height >= 100 && apt.statusHistory.length > 0 && (
          <div className="mt-1 border-t border-white/20 pt-0.5">
            {apt.statusHistory.slice(0, 2).map((h) => (
              <div key={h.id} className="text-[9px] opacity-60 truncate leading-tight">
                {STATUS_HE[h.fromStatus] ?? h.fromStatus} → {STATUS_HE[h.toStatus] ?? h.toStatus}
              </div>
            ))}
          </div>
        )}

        {/*
          כפתור שינוי מועד (נגישות ממקלדת) — גלוי בעת hover/focus.
        */}
        <button
          draggable={false}
          className={cn(
            "absolute top-0.5 end-0.5",
            "opacity-0 group-hover:opacity-100 focus:opacity-100",
            "text-[9px] px-1 py-0.5 rounded",
            "bg-black/30 backdrop-blur-sm",
            darkText ? "text-ink" : "text-white",
            "transition-opacity duration-100",
            "focus:outline-none focus:ring-1 focus:ring-white/80",
            "cursor-pointer"
          )}
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onReschedule(apt);
          }}
          onDragStart={(e) => e.stopPropagation()}
          aria-label={`שנה מועד עבור ${clientName}`}
        >
          מועד
        </button>

        {/* כפתור שינוי סטטוס — מוצג רק אם יש סטטוסים אפשריים הבאים */}
        {nextStatuses.length > 0 && (
          <div className="absolute bottom-0.5 start-0.5" style={{ zIndex: 15 }}>
            <button
              draggable={false}
              className={cn(
                "opacity-0 group-hover:opacity-100 focus:opacity-100",
                "text-[9px] px-1 py-0.5 rounded",
                "bg-black/30 backdrop-blur-sm",
                darkText ? "text-ink" : "text-white",
                "transition-opacity duration-100",
                "focus:outline-none focus:ring-1 focus:ring-white/80",
                "cursor-pointer"
              )}
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setShowStatusMenu((v) => !v);
              }}
              onDragStart={(e) => e.stopPropagation()}
              aria-label={`שנה סטטוס עבור ${clientName}`}
              aria-expanded={showStatusMenu}
              aria-haspopup="listbox"
            >
              סטטוס ▾
            </button>

            {/* תפריט סטטוסים — נפתח מעל הכפתור */}
            {showStatusMenu && (
              <div
                role="listbox"
                aria-label="בחר סטטוס חדש"
                className={cn(
                  "absolute start-0 bottom-full mb-1",
                  "bg-white rounded shadow-lg border border-border",
                  "flex flex-col gap-0 overflow-hidden",
                  "min-w-[90px]"
                )}
                dir="rtl"
                onClick={(e) => e.stopPropagation()}
              >
                {nextStatuses.map((s) => {
                  const style = STATUS_BADGE_STYLE[s] ?? STATUS_BADGE_STYLE.SCHEDULED;
                  return (
                    <button
                      key={s}
                      role="option"
                      aria-selected={apt.status === s}
                      draggable={false}
                      className={cn(
                        "text-right text-[11px] font-medium px-2 py-1.5",
                        "hover:bg-champagne/80 transition-colors",
                        "focus:outline-none focus:bg-champagne/80",
                        "text-charcoal"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowStatusMenu(false);
                        onStatusChange(apt, s);
                      }}
                      onDragStart={(e) => e.stopPropagation()}
                      aria-label={`עדכן סטטוס ל: ${STATUS_HE[s] ?? s}`}
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-full me-1 align-middle"
                        style={{ backgroundColor: style.bg.replace(/,\s*[\d.]+\)$/, ",1)") }}
                        aria-hidden="true"
                      />
                      {STATUS_HE[s] ?? s}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// תת-קומפוננטה: רשת שעות (עמודת זמן + קווי גריד)
// ---------------------------------------------------------------------------

function TimeLabelsColumn({
  hourLabels,
  totalGridHeight,
}: {
  hourLabels: string[];
  totalGridHeight: number;
}) {
  return (
    <div
      className="shrink-0 relative bg-white border-e border-border"
      style={{ width: 56, height: totalGridHeight }}
    >
      {hourLabels.map((label, i) => (
        <div
          key={i}
          className="absolute text-right text-[10px] text-taupe leading-none pe-1 w-full"
          style={{
            top: i * HOUR_HEIGHT_PX - 6,
            right: 0,
          }}
        >
          {label}
        </div>
      ))}
    </div>
  );
}

function GridLines({ numHours }: { numHours: number }) {
  return (
    <>
      {Array.from(
        { length: numHours * 2 },
        (_, i) => (
          <div
            key={i}
            className={cn(
              "absolute inset-x-0 border-t",
              i % 2 === 0 ? "border-border/50" : "border-border/20"
            )}
            style={{ top: i * (HOUR_HEIGHT_PX / 2) }}
          />
        )
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// תת-קומפוננטה: שכבת Drop Zones (30 דקות לכל slot)
// ---------------------------------------------------------------------------

interface DropZoneLayerProps {
  /** האם כרגע מתבצעת גרירה */
  isDragging: boolean;
  /** האם ה-slot הפעיל הוא של עמודה זו */
  activeDayIdx: number | null;
  /** מזהה עמודה (dayIdx בשבוע, -1 בתצוגת יום) */
  dayIdx: number;
  activeSlotIdx: number | null;
  onDragOver: (slotIdx: number) => void;
  onDragLeave: () => void;
  onDrop: (slotIdx: number, e: React.DragEvent) => void;
  /** מספר ה-slots הכולל (נגזר מ-calStartHour/calEndHour) */
  totalSlots: number;
  /** שעת פתיחה (נגזרת מ-ClinicSettings) */
  calStartHour: number;
}

function DropZoneLayer({
  isDragging,
  activeDayIdx,
  dayIdx,
  activeSlotIdx,
  onDragOver,
  onDragLeave,
  onDrop,
  totalSlots,
  calStartHour,
}: DropZoneLayerProps) {
  if (!isDragging) return null;

  return (
    <>
      {Array.from({ length: totalSlots }, (_, slotIdx) => {
        const isActive =
          activeDayIdx === dayIdx && activeSlotIdx === slotIdx;
        const slotMins = calStartHour * 60 + slotIdx * 30;
        const slotHour = Math.floor(slotMins / 60);
        const slotMin = slotMins % 60;

        return (
          <div
            key={slotIdx}
            className={cn(
              "absolute inset-x-0 transition-colors duration-75",
              isActive &&
                "bg-gold/25 border-2 border-dashed border-gold-dark rounded"
            )}
            style={{
              top: slotIdx * (HOUR_HEIGHT_PX / 2),
              height: HOUR_HEIGHT_PX / 2,
              zIndex: 10,
            }}
            aria-label={`יעד גרירה: ${String(slotHour).padStart(2, "0")}:${String(slotMin).padStart(2, "0")}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              onDragOver(slotIdx);
            }}
            onDragLeave={onDragLeave}
            onDrop={(e) => {
              e.preventDefault();
              onDrop(slotIdx, e);
            }}
          />
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// תת-קומפוננטה: דיאלוג יצירת תור חדש (משימה 5.9, FR-AP-02)
// ---------------------------------------------------------------------------

interface NewAptDialogProps {
  treatments: TreatmentOption[];
  defaultDate: string; // YYYY-MM-DD
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * מוסיף דקות לשעה בפורמט HH:mm ומחזיר HH:mm (עטיפה בתוך היממה).
 * חציית חצות אינה נחסמת כאן — בדיקת תקינות שעת הסיום נעשית בשליחת הטופס.
 */
function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const DAY = 24 * 60;
  const total = (((h * 60 + m + minutes) % DAY) + DAY) % DAY;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60
  ).padStart(2, "0")}`;
}

function NewAppointmentDialog({
  treatments,
  defaultDate,
  onClose,
  onSuccess,
}: NewAptDialogProps) {
  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState<ClientSearchResult[]>([]);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const [selectedClient, setSelectedClient] =
    useState<ClientSearchResult | null>(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const [treatmentId, setTreatmentId] = useState("");
  const [therapist, setTherapist] = useState("");
  const [room, setRoom] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // חיפוש לקוח/ה עם השהייה 300ms (debounce)
  useEffect(() => {
    if (!clientQuery.trim() || clientQuery.trim().length < 2) {
      setClientResults([]);
      setShowClientDropdown(false);
      return;
    }
    setClientSearchLoading(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/clients?q=${encodeURIComponent(clientQuery.trim())}`
          );
          if (!res.ok) throw new Error();
          const data = (await res.json()) as {
            clients: ClientSearchResult[];
          };
          setClientResults(data.clients ?? []);
          setShowClientDropdown(true);
        } catch {
          setClientResults([]);
        } finally {
          setClientSearchLoading(false);
        }
      })();
    }, 300);
    return () => clearTimeout(timer);
  }, [clientQuery]);

  // מילוי אוטומטי של שעת הסיום (שעת התחלה + משך הטיפול) — מופעל רק בפעולת משתמש.
  // אם המשתמש/ת ערך/ה שעת סיום ידנית, הערך נשמר עד שבוחרים טיפול או משנים שעת התחלה.
  // בחירת "ללא טיפול ספציפי" לא משנה את שעת הסיום.
  const applyAutoEnd = (start: string, tid: string) => {
    const duration = treatments.find((t) => t.id === tid)?.durationMinutes;
    if (!tid || duration === undefined || !start) return;
    setEndTime(addMinutesToTime(start, duration));
  };

  const handleSubmit = async () => {
    setFormError(null);

    if (!selectedClient) {
      setFormError("יש לבחור לקוח/ה");
      return;
    }
    if (!therapist.trim()) {
      setFormError("יש להזין שם מטפל/ת");
      return;
    }
    if (!date) {
      setFormError("יש לבחור תאריך");
      return;
    }
    if (!startTime || !endTime) {
      setFormError("יש לבחור שעות התחלה וסיום");
      return;
    }

    const startISO = new Date(`${date}T${startTime}:00`).toISOString();
    const endISO = new Date(`${date}T${endTime}:00`).toISOString();

    if (new Date(startISO) >= new Date(endISO)) {
      setFormError("שעת ההתחלה חייבת להיות לפני שעת הסיום");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient.id,
          treatmentId: treatmentId || null,
          therapist: therapist.trim(),
          room: room.trim() || null,
          startTime: startISO,
          endTime: endISO,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "שגיאה ביצירת התור — נסה שוב"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-apt-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-auto overflow-y-auto max-h-[90vh]">
        <div className="p-5">
          <h2
            id="new-apt-dialog-title"
            className="text-base font-heading font-semibold text-charcoal mb-4"
          >
            הוספת תור חדש
          </h2>

          <div className="flex flex-col gap-4">
            {/* בחירת לקוח/ה */}
            <div className="relative">
              <label
                htmlFor="new-apt-client"
                className="text-xs font-medium text-charcoal mb-1 block"
              >
                לקוח/ה{" "}
                <span className="text-error" aria-hidden="true">
                  *
                </span>
              </label>

              {selectedClient ? (
                <div className="flex items-center justify-between p-2 rounded-md border border-gold-dark/40 bg-champagne/50">
                  <span className="text-sm text-charcoal">
                    {selectedClient.firstName} {selectedClient.lastName}
                    <span className="text-taupe text-xs ms-2" dir="ltr">
                      {selectedClient.phone}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClient(null);
                      setClientQuery("");
                    }}
                    className="text-xs text-taupe hover:text-gold-dark underline underline-offset-2"
                    aria-label="שנה לקוח/ה"
                  >
                    שנה
                  </button>
                </div>
              ) : (
                <>
                  <input
                    id="new-apt-client"
                    type="text"
                    value={clientQuery}
                    onChange={(e) => setClientQuery(e.target.value)}
                    placeholder="חיפוש לפי שם או טלפון..."
                    className={cn(
                      "w-full h-9 rounded-md border border-input px-3 text-sm",
                      "focus:outline-none focus:ring-2 focus:ring-gold-dark/40"
                    )}
                    autoComplete="off"
                    aria-label="חיפוש לקוח/ה לפי שם או טלפון"
                    aria-autocomplete="list"
                    aria-controls="client-search-results"
                    aria-expanded={showClientDropdown}
                  />

                  {clientSearchLoading && (
                    <span
                      className="text-xs text-taupe mt-1 block"
                      role="status"
                      aria-live="polite"
                    >
                      מחפש...
                    </span>
                  )}

                  {/* תוצאות חיפוש לקוח */}
                  {showClientDropdown && clientResults.length > 0 && (
                    <div
                      id="client-search-results"
                      role="listbox"
                      aria-label="תוצאות חיפוש לקוחות"
                      className={cn(
                        "absolute top-full end-0 start-0 mt-1 z-10",
                        "bg-white border border-border rounded-md shadow-lg",
                        "max-h-48 overflow-y-auto"
                      )}
                    >
                      {clientResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          role="option"
                          aria-selected={false}
                          className={cn(
                            "w-full text-right px-3 py-2 text-sm transition-colors",
                            "hover:bg-champagne/60 border-b border-border/30 last:border-b-0"
                          )}
                          onClick={() => {
                            setSelectedClient(c);
                            setClientQuery("");
                            setShowClientDropdown(false);
                          }}
                        >
                          <span className="font-medium text-charcoal">
                            {c.firstName} {c.lastName}
                          </span>
                          <span className="text-taupe text-xs ms-2" dir="ltr">
                            {c.phone}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* אין תוצאות */}
                  {showClientDropdown &&
                    clientResults.length === 0 &&
                    !clientSearchLoading &&
                    clientQuery.trim().length >= 2 && (
                      <div
                        className={cn(
                          "absolute top-full end-0 start-0 mt-1 z-10",
                          "bg-white border border-border rounded-md shadow-sm p-3 text-sm text-taupe"
                        )}
                        role="status"
                        aria-live="polite"
                      >
                        לא נמצאו לקוחות
                      </div>
                    )}
                </>
              )}

              {/* קישור ליצירת לקוח/ה חדש/ה */}
              <a
                href="/clients/new"
                className="text-xs text-gold-dark underline underline-offset-2 hover:text-gold mt-1 inline-block"
              >
                + צור לקוח/ה חדש/ה
              </a>
            </div>

            {/* טיפול */}
            <div>
              <label
                htmlFor="new-apt-treatment"
                className="text-xs font-medium text-charcoal mb-1 block"
              >
                טיפול
              </label>
              <select
                id="new-apt-treatment"
                value={treatmentId}
                onChange={(e) => {
                  setTreatmentId(e.target.value);
                  applyAutoEnd(startTime, e.target.value);
                }}
                className={cn(
                  "w-full h-9 rounded-md border border-input bg-white px-3 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-gold-dark/40"
                )}
              >
                <option value="">-- ללא טיפול ספציפי --</option>
                {treatments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.durationMinutes} דק&apos;)
                  </option>
                ))}
              </select>
            </div>

            {/* מטפל/ת */}
            <div>
              <label
                htmlFor="new-apt-therapist"
                className="text-xs font-medium text-charcoal mb-1 block"
              >
                מטפל/ת{" "}
                <span className="text-error" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="new-apt-therapist"
                type="text"
                value={therapist}
                onChange={(e) => setTherapist(e.target.value)}
                placeholder="שם המטפל/ת"
                className={cn(
                  "w-full h-9 rounded-md border border-input px-3 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-gold-dark/40"
                )}
              />
            </div>

            {/* חדר */}
            <div>
              <label
                htmlFor="new-apt-room"
                className="text-xs font-medium text-charcoal mb-1 block"
              >
                חדר (אופציונלי)
              </label>
              <input
                id="new-apt-room"
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="מספר או שם חדר"
                className={cn(
                  "w-full h-9 rounded-md border border-input px-3 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-gold-dark/40"
                )}
              />
            </div>

            {/* תאריך */}
            <div>
              <label
                htmlFor="new-apt-date"
                className="text-xs font-medium text-charcoal mb-1 block"
              >
                תאריך{" "}
                <span className="text-error" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="new-apt-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={cn(
                  "w-full h-9 rounded-md border border-input px-3 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-gold-dark/40"
                )}
              />
            </div>

            {/* שעות התחלה וסיום */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label
                  htmlFor="new-apt-start"
                  className="text-xs font-medium text-charcoal mb-1 block"
                >
                  שעת התחלה{" "}
                  <span className="text-error" aria-hidden="true">
                    *
                  </span>
                </label>
                <input
                  id="new-apt-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    applyAutoEnd(e.target.value, treatmentId);
                  }}
                  step="1800"
                  dir="ltr"
                  className={cn(
                    "w-full h-9 rounded-md border border-input px-3 text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-gold-dark/40"
                  )}
                />
              </div>
              <div className="flex-1">
                <label
                  htmlFor="new-apt-end"
                  className="text-xs font-medium text-charcoal mb-1 block"
                >
                  שעת סיום{" "}
                  <span className="text-error" aria-hidden="true">
                    *
                  </span>
                </label>
                <input
                  id="new-apt-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  step="1800"
                  dir="ltr"
                  className={cn(
                    "w-full h-9 rounded-md border border-input px-3 text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-gold-dark/40"
                  )}
                />
              </div>
            </div>

            {/* הערות */}
            <div>
              <label
                htmlFor="new-apt-notes"
                className="text-xs font-medium text-charcoal mb-1 block"
              >
                הערות (אופציונלי)
              </label>
              <textarea
                id="new-apt-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="הערות לתור..."
                className={cn(
                  "w-full rounded-md border border-input px-3 py-2 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-gold-dark/40 resize-none"
                )}
              />
            </div>

            {/* הודעת שגיאה */}
            {formError && (
              <p className="text-xs text-error" role="alert">
                {formError}
              </p>
            )}

            {/* כפתורי פעולה */}
            <div className="flex gap-2 justify-start mt-1">
              <Button
                size="sm"
                disabled={submitting}
                onClick={() => void handleSubmit()}
                className="min-w-[88px]"
              >
                {submitting ? "שומר..." : "שמור תור"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={submitting}
              >
                ביטול
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// קומפוננטה ראשית
// ---------------------------------------------------------------------------

export function WeeklyCalendar({
  initialAppointments,
  initialWeekStart,
  openHour,
  closeHour,
  treatments = [],
}: WeeklyCalendarProps) {
  // ---- שעות פעילות מ-ClinicSettings (עם ברירות מחדל) ----
  const calStart = openHour ?? CAL_START_HOUR;
  const calEnd = closeHour ?? CAL_END_HOUR;
  const totalGridHeight = (calEnd - calStart) * HOUR_HEIGHT_PX;
  const totalSlots = (calEnd - calStart) * 2;
  // ---- מצב ----
  const [weekStart, setWeekStart] = useState<Date>(
    () => getWeekStart(new Date(initialWeekStart))
  );
  const [appointments, setAppointments] =
    useState<SerializedAppointment[]>(initialAppointments);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [therapistFilter, setTherapistFilter] = useState<string>("");
  const [roomFilter, setRoomFilter] = useState<string>("");

  /** מצב תצוגה: שבוע, יום או חודש */
  const [viewMode, setViewMode] = useState<ViewMode>("week");

  /**
   * היום הנבחר בתצוגת יום.
   * מאוחסן ב-midnight (00:00:00) כדי להבטיח השוואות עקביות.
   */
  const [selectedDay, setSelectedDay] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  /** החודש המוצג בתצוגת חודש — תאריך ה-1 בחודש ב-midnight (משימה 11.11) */
  const [monthStart, setMonthStart] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  /** סוג תצוגת היום: גריד או רשימת סדר יום (משימה 11.11) */
  const [dayLayout, setDayLayout] = useState<DayLayout>("grid");

  // ---- מצב Drag & Drop ----
  /** מזהה התור הנגרר כרגע (null = אין גרירה) */
  const [draggingId, setDraggingId] = useState<string | null>(null);
  /** ה-slot שמעליו סמן הגרירה (לאינדיקטור חזותי) */
  const [dragOverSlot, setDragOverSlot] = useState<DragOverSlot | null>(null);
  /** הודעת שגיאה מגרירה (מוצגת בראש היומן) */
  const [dragError, setDragError] = useState<string | null>(null);

  // ---- מצב דיאלוג שינוי מועד (נגישות ממקלדת) ----
  const [rescheduleApt, setRescheduleApt] =
    useState<SerializedAppointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // ---- מצב שגיאת שינוי סטטוס ----
  const [statusChangeError, setStatusChangeError] = useState<string | null>(null);

  // ---- מצב דיאלוג תור חדש (משימה 5.9, FR-AP-02) ----
  const [showNewApt, setShowNewApt] = useState(false);

  // ---- מצב דיאלוג מחיקה לצמיתות של תור (משימה 12.4) ----
  const [deleteApt, setDeleteApt] = useState<SerializedAppointment | null>(null);

  /** הסרת תור שנמחק לצמיתות מהתצוגה (ללא שליפה מחדש — הנתונים מקומיים ליומן). */
  const handleAppointmentDeleted = useCallback((appointmentId: string) => {
    setAppointments((prev) => prev.filter((a) => a.id !== appointmentId));
  }, []);

  /**
   * מפתח הטווח שנטען אחרון (`w:<שבוע>` או `m:<חודש>`).
   * הנתונים הראשונים כבר הגיעו מה-SSR לשבוע הנוכחי — לכן המפתח ההתחלתי הוא השבוע.
   * ה-effect למטה שולף רק כשהטווח הפעיל משתנה (לא בטעינה הראשונה).
   */
  const loadedRangeKey = useRef<string>(`w:${toIsoDate(weekStart)}`);

  // ---- שליפת תורים ----
  /** שליפת תורים לטווח תאריכים (YYYY-MM-DD, כולל) — מקור הנתונים היחיד ליומן */
  const fetchRange = useCallback(async (startIso: string, endIso: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(
        `/api/appointments?start=${startIso}&end=${endIso}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { appointments: SerializedAppointment[] };
      setAppointments(json.appointments);
    } catch {
      setFetchError("שגיאה בטעינת התורים — נסה שוב");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWeek = useCallback(
    (start: Date) => {
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return fetchRange(toIsoDate(start), toIsoDate(end));
    },
    [fetchRange]
  );

  /**
   * שליפת חודש (משימה 11.11): טווח רחב ביום אחד מכל צד כדי לא לפספס תורים בגבולות
   * אזור הזמן; הסינון המדויק לפי תאריך מקומי נעשה בצד הלקוח (monthCounts).
   */
  const fetchMonth = useCallback(
    (start: Date) => {
      const first = new Date(start.getFullYear(), start.getMonth(), 0); // יום אחרון של החודש הקודם
      const last = new Date(start.getFullYear(), start.getMonth() + 1, 1); // היום שאחרי סוף החודש
      return fetchRange(toLocalIsoDate(first), toLocalIsoDate(last));
    },
    [fetchRange]
  );

  // שליפה מחדש כשהטווח הפעיל משתנה (שבוע/יום/חודש) — פעם אחת לכל טווח
  useEffect(() => {
    const key =
      viewMode === "month"
        ? `m:${toLocalIsoDate(monthStart)}`
        : `w:${toIsoDate(weekStart)}`;
    if (loadedRangeKey.current === key) return;
    loadedRangeKey.current = key;
    if (viewMode === "month") {
      void fetchMonth(monthStart);
    } else {
      void fetchWeek(weekStart);
    }
  }, [viewMode, weekStart, monthStart, fetchWeek, fetchMonth]);

  /** מעבר לתצוגת מסך מובייל: רשימת סדר יום כברירת מחדל (משימה 11.11) */
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    if (window.matchMedia("(max-width: 767px)").matches) {
      setDayLayout("agenda");
    }
  }, []);

  /**
   * בתצוגת יום: סינכרון weekStart ל-selectedDay אם עבר לשבוע שונה.
   * מאפשר ניווט ימי חוצה-שבוע עם שליפת נתונים אוטומטית.
   */
  useEffect(() => {
    if (viewMode !== "day") return;
    const newWeekStart = getWeekStart(selectedDay);
    if (toIsoDate(newWeekStart) !== toIsoDate(weekStart)) {
      setWeekStart(newWeekStart);
    }
  }, [selectedDay, viewMode, weekStart]);

  // ---- ניווט שבוע ----
  const goToPrevWeek = useCallback(() => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
    setTherapistFilter("");
    setRoomFilter("");
  }, []);

  const goToNextWeek = useCallback(() => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
    setTherapistFilter("");
    setRoomFilter("");
  }, []);

  const goToToday = useCallback(() => {
    if (viewMode === "week") {
      setWeekStart(getWeekStart(new Date()));
      setTherapistFilter("");
      setRoomFilter("");
    } else if (viewMode === "month") {
      const today = new Date();
      setMonthStart(new Date(today.getFullYear(), today.getMonth(), 1));
      setTherapistFilter("");
      setRoomFilter("");
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setSelectedDay(today);
    }
  }, [viewMode]);

  // ---- ניווט חודש (משימה 11.11) ----
  const goToPrevMonth = useCallback(() => {
    setMonthStart((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setTherapistFilter("");
    setRoomFilter("");
  }, []);

  const goToNextMonth = useCallback(() => {
    setMonthStart((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setTherapistFilter("");
    setRoomFilter("");
  }, []);

  /**
   * החלפת מצב תצוגה (שבוע/יום/חודש) מהמתג.
   * מיישר את השבוע ליום הנבחר/לשבוע הנוכחי, כך שהשליפה תתבצע פעם אחת לטווח הנכון.
   */
  const changeViewMode = useCallback(
    (mode: ViewMode) => {
      if (mode === viewMode) return;
      if (mode === "month") {
        const anchor = viewMode === "day" ? selectedDay : weekStart;
        setMonthStart(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
      } else {
        setWeekStart(getWeekStart(selectedDay));
      }
      setViewMode(mode);
    },
    [viewMode, selectedDay, weekStart]
  );

  // ---- ניווט יום ----
  const goToPrevDay = useCallback(() => {
    setSelectedDay((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  }, []);

  const goToNextDay = useCallback(() => {
    setSelectedDay((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  }, []);

  /**
   * מעבר לתצוגת יום עבור יום ספציפי.
   * נקרא בעת לחיצה על כותרת יום בתצוגת השבוע.
   */
  const switchToDayView = useCallback((day: Date) => {
    const d = new Date(day);
    d.setHours(0, 0, 0, 0);
    setSelectedDay(d);
    // שבוע היום יסונכרן מיד (נדרש גם מתצוגת חודש) — שליפה אחת לשבוע הנכון
    setWeekStart(getWeekStart(d));
    setViewMode("day");
  }, []);

  // ---- Drag & Drop callbacks ----

  /**
   * שמירת מזהה התור ומשך הטיפול ב-dataTransfer, וסימון מצב גרירה.
   */
  const handleDragStart = useCallback(
    (e: React.DragEvent, apt: SerializedAppointment) => {
      const durationMs =
        new Date(apt.endTime).getTime() - new Date(apt.startTime).getTime();
      e.dataTransfer.setData("appointmentId", apt.id);
      e.dataTransfer.setData("durationMs", String(durationMs));
      e.dataTransfer.effectAllowed = "move";
      setDraggingId(apt.id);
      setDragError(null);
    },
    []
  );

  /** ניקוי מצב גרירה בסיום (drop או ביטול) */
  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverSlot(null);
  }, []);

  /**
   * עדכון מועד תור — Optimistic UI + PATCH לשרת.
   * מחזיר true בהצלחה, false בשגיאה (עם rollback).
   */
  const rescheduleAppointment = useCallback(
    async (
      id: string,
      newStartTime: Date,
      newEndTime: Date
    ): Promise<boolean> => {
      const original = appointments.find((a) => a.id === id);
      if (!original) return false;

      // עדכון אופטימיסטי מיידי
      const updated: SerializedAppointment = {
        ...original,
        startTime: newStartTime.toISOString(),
        endTime: newEndTime.toISOString(),
      };
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? updated : a))
      );

      try {
        const res = await fetch(`/api/appointments/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startTime: newStartTime.toISOString(),
            endTime: newEndTime.toISOString(),
          }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        return true;
      } catch (err) {
        // Rollback
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? original : a))
        );
        const msg =
          err instanceof Error ? err.message : "שגיאה בעדכון מועד התור";
        setDragError(msg);
        return false;
      }
    },
    [appointments]
  );

  /**
   * בניית newStart ו-newEnd מתוך dayDate + slotIdx + durationMs.
   */
  function computeNewTimes(
    dayDate: Date,
    slotIdx: number,
    durationMs: number
  ): { newStart: Date; newEnd: Date } {
    const slotMins = calStart * 60 + slotIdx * 30;
    const newStart = new Date(dayDate);
    newStart.setHours(Math.floor(slotMins / 60), slotMins % 60, 0, 0);
    const newEnd = new Date(newStart.getTime() + durationMs);
    return { newStart, newEnd };
  }

  /**
   * Drop handler לתצוגת שבוע — מקבל dayIdx + slotIdx.
   */
  const handleWeekDrop = useCallback(
    (dayIdx: number, slotIdx: number, e: React.DragEvent, weekDays: Date[]) => {
      const id = e.dataTransfer.getData("appointmentId");
      const durationMs = parseInt(e.dataTransfer.getData("durationMs"), 10);
      if (!id || isNaN(durationMs) || durationMs <= 0) return;

      const { newStart, newEnd } = computeNewTimes(weekDays[dayIdx], slotIdx, durationMs);

      setDraggingId(null);
      setDragOverSlot(null);
      void rescheduleAppointment(id, newStart, newEnd);
    },
    [rescheduleAppointment]
  );

  /**
   * Drop handler לתצוגת יום.
   */
  const handleDayViewDrop = useCallback(
    (slotIdx: number, e: React.DragEvent, selectedDay: Date) => {
      const id = e.dataTransfer.getData("appointmentId");
      const durationMs = parseInt(e.dataTransfer.getData("durationMs"), 10);
      if (!id || isNaN(durationMs) || durationMs <= 0) return;

      const { newStart, newEnd } = computeNewTimes(selectedDay, slotIdx, durationMs);

      setDraggingId(null);
      setDragOverSlot(null);
      void rescheduleAppointment(id, newStart, newEnd);
    },
    [rescheduleAppointment]
  );

  /**
   * פתיחת דיאלוג שינוי מועד (נגישות ממקלדת).
   * מאכלס את שדות התאריך/שעה מתוך startTime הנוכחי.
   */
  const handleOpenReschedule = useCallback((apt: SerializedAppointment) => {
    const start = new Date(apt.startTime);
    setRescheduleDate(toIsoDate(start));
    setRescheduleTime(toTimeStr(start));
    setRescheduleApt(apt);
    setRescheduleError(null);
  }, []);

  /**
   * שינוי סטטוס תור (משימה 5.8, FR-AP-04) — Optimistic UI + PATCH.
   * בעת הצלחה: מעדכן את הרשומה המקומית כולל statusHistory מהתגובה.
   * בעת שגיאה: מחזיר לסטטוס הקודם ומציג הודעת שגיאה.
   */
  const handleStatusChange = useCallback(
    async (apt: SerializedAppointment, newStatus: string) => {
      const previousStatus = apt.status;
      setStatusChangeError(null);

      // עדכון אופטימיסטי מיידי
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === apt.id ? { ...a, status: newStatus } : a
        )
      );

      try {
        const res = await fetch(`/api/appointments/${apt.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const json = (await res.json()) as {
          appointment: {
            status: string;
            statusHistory?: SerializedStatusHistoryEntry[];
          };
        };
        const updatedApt = json.appointment;
        // עדכון עם ההיסטוריה המעודכנת מהשרת
        setAppointments((prev) =>
          prev.map((a) => {
            if (a.id !== apt.id) return a;
            return {
              ...a,
              status: updatedApt.status,
              statusHistory: updatedApt.statusHistory ?? a.statusHistory,
            };
          })
        );
      } catch (err) {
        // Rollback
        setAppointments((prev) =>
          prev.map((a) =>
            a.id === apt.id ? { ...a, status: previousStatus } : a
          )
        );
        const msg =
          err instanceof Error ? err.message : "שגיאה בעדכון סטטוס התור";
        setStatusChangeError(msg);
      }
    },
    []
  );

  // ---- נגזרות ----
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [weekStart]
  );

  const therapists = useMemo(() => {
    const s = new Set(appointments.map((a) => a.therapist));
    return Array.from(s).sort();
  }, [appointments]);

  const rooms = useMemo(() => {
    const s = new Set(
      appointments.map((a) => a.room).filter((r): r is string => !!r)
    );
    return Array.from(s).sort();
  }, [appointments]);

  const filtered = useMemo(() => {
    return appointments.filter((apt) => {
      if (therapistFilter && apt.therapist !== therapistFilter) return false;
      if (roomFilter && apt.room !== roomFilter) return false;
      return true;
    });
  }, [appointments, therapistFilter, roomFilter]);

  /** מיון תורים לפי יום בשבוע (0=ראשון, 6=שבת) */
  const byDay = useMemo(() => {
    const groups: SerializedAppointment[][] = Array.from(
      { length: 7 },
      () => []
    );
    for (const apt of filtered) {
      const day = new Date(apt.startTime).getDay(); // 0=ראשון
      groups[day].push(apt);
    }
    // מיון כל יום לפי שעת התחלה
    for (const g of groups) {
      g.sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
    }
    return groups;
  }, [filtered]);

  /** תורים לתצוגת יום: מסוננים לפי selectedDay */
  const dayAppointments = useMemo(() => {
    return filtered
      .filter((apt) => isSameDay(new Date(apt.startTime), selectedDay))
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
  }, [filtered, selectedDay]);

  /**
   * מספר תורים לכל יום (מפתח YYYY-MM-DD מקומי) — לתצוגת חודש (משימה 11.11).
   * נגזר מ-filtered, כך שהפילטרים של מטפל/ת וחדר חלים גם על ספירת החודש.
   */
  const monthCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const apt of filtered) {
      const key = toLocalIsoDate(new Date(apt.startTime));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [filtered]);

  /**
   * תאי לוח החודש: null = משבצת ריקה לפני היום הראשון/אחרי האחרון (מילוי לשבוע מלא).
   * ראשון=0 — בפריסת RTL היום הראשון של השבוע הוא הימני ביותר.
   */
  const monthCells = useMemo(() => {
    const y = monthStart.getFullYear();
    const m = monthStart.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < monthStart.getDay(); i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [monthStart]);

  /** תוויות שעה: 09:00, 10:00, ... 19:00 — נגזרות מ-calStart/calEnd */
  const hourLabels = useMemo(() => {
    return Array.from(
      { length: calEnd - calStart + 1 },
      (_, i) => `${String(calStart + i).padStart(2, "0")}:00`
    );
  }, [calStart, calEnd]);

  const hasActiveFilter = therapistFilter || roomFilter;
  const weekRangeLabel = `${toDayMonth(weekDays[0])} – ${toDayMonth(weekDays[6])}`;
  const monthLabel = `${HEBREW_MONTHS[monthStart.getMonth()]} ${monthStart.getFullYear()}`;

  /** תאריך ברירת מחדל לדיאלוג תור חדש: היום אם בתוך השבוע, אחרת תחילת השבוע/יום הנבחר */
  const defaultAptDate = useMemo(() => {
    if (viewMode === "day") return toIsoDate(selectedDay);
    if (viewMode === "month") {
      // חודש: היום אם בחודש המוצג, אחרת היום הראשון של החודש (תאריך מקומי)
      const today = new Date();
      if (
        today.getFullYear() === monthStart.getFullYear() &&
        today.getMonth() === monthStart.getMonth()
      ) {
        return toLocalIsoDate(today);
      }
      return toLocalIsoDate(monthStart);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (today >= weekStart && today <= weekEnd) return toIsoDate(today);
    return toIsoDate(weekStart);
  }, [viewMode, selectedDay, weekStart, monthStart]);
  const selectedDayLabel = `${WEEK_DAYS[selectedDay.getDay()]} ${toDayMonth(selectedDay)}`;

  // ---- ניווט: prev/today/next — משמעות לפי viewMode ----
  const handlePrev =
    viewMode === "week" ? goToPrevWeek : viewMode === "month" ? goToPrevMonth : goToPrevDay;
  const handleNext =
    viewMode === "week" ? goToNextWeek : viewMode === "month" ? goToNextMonth : goToNextDay;
  const prevLabel =
    viewMode === "week" ? "שבוע קודם" : viewMode === "month" ? "חודש קודם" : "יום קודם";
  const nextLabel =
    viewMode === "week" ? "שבוע הבא" : viewMode === "month" ? "חודש הבא" : "יום הבא";
  const headerSubLabel =
    viewMode === "week"
      ? weekRangeLabel
      : viewMode === "month"
        ? monthLabel
        : selectedDayLabel;

  // ---- תצוגה ----
  return (
    <div dir="rtl" className="flex flex-col h-full bg-champagne">
      {/* ================================================================
          כותרת ופקדי ניווט + סינון
          ================================================================ */}
      <div className="bg-white border-b border-gold-antique/20 px-4 py-3 flex flex-col gap-3 sticky top-0 z-20 shadow-sm">
        {/* שורה 1: כותרת + תאריך + ניווט */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col leading-tight">
            <h1 className="font-heading text-xl font-medium text-charcoal">
              יומן תורים
            </h1>
            <span className="text-xs text-taupe">
              {headerSubLabel}
            </span>
          </div>

          {/* כפתורי ניווט — dir="ltr" לשמירת סדר זמן קונבנציונלי */}
          <div dir="ltr" className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrev}
              aria-label={prevLabel}
              className="h-8 w-8 text-charcoal hover:bg-champagne"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="h-8 px-2 text-xs text-gold-dark border-gold-dark/30 hover:bg-champagne"
            >
              היום
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              aria-label={nextLabel}
              className="h-8 w-8 text-charcoal hover:bg-champagne"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* שורה 2: כפתור הוספת תור + מיתוג תצוגה + פילטרים */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* כפתור הוספת תור חדש — FR-AP-02 */}
          <Button
            size="sm"
            onClick={() => setShowNewApt(true)}
            className={cn(
              "h-8 px-3 text-xs font-medium shrink-0",
              "bg-gold text-ink hover:bg-gold-dark border-0"
            )}
            aria-label="פתח דיאלוג הוספת תור חדש"
          >
            <Plus className="h-3.5 w-3.5 me-1" aria-hidden="true" />
            הוסף תור
          </Button>

          {/* מיתוג שבוע/יום/חודש (משימה 11.11 — הוספת חודש) */}
          <div
            className="flex rounded-md border border-gold-dark/30 overflow-hidden shrink-0"
            role="group"
            aria-label="בחירת תצוגה"
          >
            <button
              onClick={() => changeViewMode("week")}
              className={cn(
                "min-h-11 md:min-h-8 md:h-8 px-3 text-xs font-medium transition-colors",
                viewMode === "week"
                  ? "bg-gold text-ink"
                  : "bg-white text-charcoal hover:bg-champagne"
              )}
              aria-pressed={viewMode === "week"}
              aria-label="תצוגת שבוע"
            >
              שבוע
            </button>
            <div className="w-px bg-gold-dark/30" aria-hidden="true" />
            <button
              onClick={() => changeViewMode("day")}
              className={cn(
                "min-h-11 md:min-h-8 md:h-8 px-3 text-xs font-medium transition-colors",
                viewMode === "day"
                  ? "bg-gold text-ink"
                  : "bg-white text-charcoal hover:bg-champagne"
              )}
              aria-pressed={viewMode === "day"}
              aria-label="תצוגת יום"
            >
              יום
            </button>
            <div className="w-px bg-gold-dark/30" aria-hidden="true" />
            <button
              onClick={() => changeViewMode("month")}
              className={cn(
                "min-h-11 md:min-h-8 md:h-8 px-3 text-xs font-medium transition-colors",
                viewMode === "month"
                  ? "bg-gold text-ink"
                  : "bg-white text-charcoal hover:bg-champagne"
              )}
              aria-pressed={viewMode === "month"}
              aria-label="תצוגת חודש"
            >
              חודש
            </button>
          </div>

          {/* מיתוג גריד/רשימת יום — רק בתצוגת יום (משימה 11.11) */}
          {viewMode === "day" && (
            <div
              className="flex rounded-md border border-gold-dark/30 overflow-hidden shrink-0"
              role="group"
              aria-label="בחירת סוג תצוגת יום"
            >
              <button
                onClick={() => setDayLayout("grid")}
                className={cn(
                  "min-h-11 md:min-h-8 md:h-8 px-3 text-xs font-medium transition-colors",
                  dayLayout === "grid"
                    ? "bg-gold text-ink"
                    : "bg-white text-charcoal hover:bg-champagne"
                )}
                aria-pressed={dayLayout === "grid"}
                aria-label="גריד יום"
              >
                גריד יום
              </button>
              <div className="w-px bg-gold-dark/30" aria-hidden="true" />
              <button
                onClick={() => setDayLayout("agenda")}
                className={cn(
                  "min-h-11 md:min-h-8 md:h-8 px-3 text-xs font-medium transition-colors",
                  dayLayout === "agenda"
                    ? "bg-gold text-ink"
                    : "bg-white text-charcoal hover:bg-champagne"
                )}
                aria-pressed={dayLayout === "agenda"}
                aria-label="רשימת יום"
              >
                רשימת יום
              </button>
            </div>
          )}

          {/* פילטר מטפל/ת */}
          <label className="sr-only" htmlFor="therapist-filter">
            סינון לפי מטפל/ת
          </label>
          <select
            id="therapist-filter"
            value={therapistFilter}
            onChange={(e) => setTherapistFilter(e.target.value)}
            className={cn(
              "h-8 rounded-md border border-input bg-white px-3 py-0 text-sm text-charcoal",
              "min-w-[150px] focus:outline-none focus:ring-2 focus:ring-gold-dark/40",
              therapistFilter && "border-gold-dark text-gold-dark font-medium"
            )}
          >
            <option value="">כל המטפלים</option>
            {therapists.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* פילטר חדר (מוצג רק אם יש חדרים) */}
          {rooms.length > 0 && (
            <>
              <label className="sr-only" htmlFor="room-filter">
                סינון לפי חדר
              </label>
              <select
                id="room-filter"
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className={cn(
                  "h-8 rounded-md border border-input bg-white px-3 py-0 text-sm text-charcoal",
                  "min-w-[120px] focus:outline-none focus:ring-2 focus:ring-gold-dark/40",
                  roomFilter && "border-gold-dark text-gold-dark font-medium"
                )}
              >
                <option value="">כל החדרים</option>
                {rooms.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </>
          )}

          {/* כפתור ניקוי סינון */}
          {hasActiveFilter && (
            <button
              onClick={() => {
                setTherapistFilter("");
                setRoomFilter("");
              }}
              className="text-xs text-taupe underline underline-offset-2 hover:text-gold-dark"
            >
              נקה סינון
            </button>
          )}

          {/* אינדיקטור טעינה */}
          {loading && (
            <span
              className="text-xs text-taupe animate-pulse"
              role="status"
              aria-live="polite"
            >
              טוען...
            </span>
          )}

          {/* שגיאת טעינה */}
          {fetchError && (
            <span className="text-xs text-error" role="alert">
              {fetchError}
            </span>
          )}

          {/* שגיאת גרירה */}
          {dragError && (
            <span className="text-xs text-error flex items-center gap-1" role="alert">
              {dragError}
              <button
                onClick={() => setDragError(null)}
                className="text-taupe hover:text-charcoal underline underline-offset-1 text-[10px] ms-1"
                aria-label="סגור הודעת שגיאה"
              >
                סגור
              </button>
            </span>
          )}

          {/* שגיאת שינוי סטטוס */}
          {statusChangeError && (
            <span className="text-xs text-error flex items-center gap-1" role="alert">
              {statusChangeError}
              <button
                onClick={() => setStatusChangeError(null)}
                className="text-taupe hover:text-charcoal underline underline-offset-1 text-[10px] ms-1"
                aria-label="סגור הודעת שגיאה"
              >
                סגור
              </button>
            </span>
          )}

          {/* אינדיקטור גרירה פעילה */}
          {draggingId && (
            <span className="text-xs text-gold-dark animate-pulse" role="status" aria-live="polite">
              גרור לשעה הרצויה
            </span>
          )}
        </div>
      </div>

      {/* ================================================================
          תצוגת יום — מוצגת בכל גדלי מסך כשנבחרה תצוגת יום
          ================================================================ */}
      {viewMode === "day" && dayLayout === "grid" && (
        <div
          className="overflow-auto flex-1"
          role="region"
          aria-label={`תצוגת יום: ${selectedDayLabel}`}
        >
          <div dir="ltr" className="min-w-[320px]">
            {/* כותרת היום — sticky בתוך אזור הגלילה */}
            <div className="flex border-b border-border bg-white sticky top-0 z-10">
              {/* מרווח לעמודת הזמן */}
              <div
                className="shrink-0 border-e border-border bg-white"
                style={{ width: 56 }}
              />
              {/* כותרת היום הנבחר */}
              <div
                className={cn(
                  "flex-1 text-center py-2",
                  isToday(selectedDay) ? "bg-gold/10" : ""
                )}
              >
                <div
                  className={cn(
                    "text-sm font-heading font-medium",
                    isToday(selectedDay) ? "text-gold-dark" : "text-charcoal"
                  )}
                >
                  {WEEK_DAYS[selectedDay.getDay()]}
                </div>
                <div
                  className={cn(
                    "text-xs",
                    isToday(selectedDay)
                      ? "text-gold-dark font-semibold"
                      : "text-taupe"
                  )}
                >
                  {toDayMonth(selectedDay)}
                </div>
                {isToday(selectedDay) && (
                  <span className="inline-block text-[10px] bg-gold text-ink px-1.5 py-0.5 rounded-full font-medium mt-0.5">
                    היום
                  </span>
                )}
              </div>
            </div>

            {/* גוף תצוגת היום */}
            <div className="flex">
              {/* עמודת תוויות שעה */}
              <TimeLabelsColumn hourLabels={hourLabels} totalGridHeight={totalGridHeight} />

              {/* עמודת היום */}
              <div
                className={cn(
                  "flex-1 relative",
                  isToday(selectedDay) ? "bg-gold/5" : "bg-white"
                )}
                style={{ height: totalGridHeight }}
              >
                <GridLines numHours={calEnd - calStart} />

                {/* שכבת Drop Zones לתצוגת יום */}
                <DropZoneLayer
                  isDragging={!!draggingId}
                  activeDayIdx={dragOverSlot?.dayIdx ?? null}
                  dayIdx={-1}
                  activeSlotIdx={dragOverSlot?.slotIdx ?? null}
                  onDragOver={(slotIdx) =>
                    setDragOverSlot({ dayIdx: -1, slotIdx })
                  }
                  onDragLeave={() => setDragOverSlot(null)}
                  onDrop={(slotIdx, e) =>
                    handleDayViewDrop(slotIdx, e, selectedDay)
                  }
                  totalSlots={totalSlots}
                  calStartHour={calStart}
                />

                {/* תורים ביום הנבחר */}
                {dayAppointments.map((apt) => {
                  const pos = calcPosition(apt.startTime, apt.endTime, calStart, calEnd);
                  if (!pos) return null;
                  return (
                    <AppointmentCard
                      key={apt.id}
                      apt={apt}
                      pos={pos}
                      showExtended
                      isDragging={draggingId === apt.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onReschedule={handleOpenReschedule}
                      onStatusChange={handleStatusChange}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* מצב ריק ביום */}
          {dayAppointments.length === 0 && !loading && (
            <div
              className="flex items-center justify-center py-12"
              aria-live="polite"
            >
              <p className="text-taupe text-sm">
                {hasActiveFilter
                  ? "אין תורים התואמים את הסינון הנוכחי ביום זה"
                  : "אין תורים ליום זה"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ================================================================
          רשימת סדר יום — תצוגת יום כרשימה מסודרת לפי שעה (משימה 11.11)
          ברירת מחדל במובייל (ראה effect מעל); אותם תורים, פעולות סטטוס ושינוי מועד כמו בגריד
          ================================================================ */}
      {viewMode === "day" && dayLayout === "agenda" && (
        <div
          className="overflow-auto flex-1 p-4"
          role="region"
          aria-label={`רשימת סדר יום: ${selectedDayLabel}`}
        >
          <div className="flex items-center gap-2 mb-3 max-w-2xl mx-auto">
            <h2
              className={cn(
                "text-sm font-heading font-semibold",
                isToday(selectedDay) ? "text-gold-dark" : "text-charcoal"
              )}
            >
              {selectedDayLabel}
            </h2>
            {isToday(selectedDay) && (
              <span className="text-[10px] bg-gold text-ink px-1.5 py-0.5 rounded-full font-medium">
                היום
              </span>
            )}
          </div>

          {dayAppointments.length === 0 ? (
            <div className="flex items-center justify-center py-12" aria-live="polite">
              <p className="text-taupe text-sm">
                {hasActiveFilter
                  ? "אין תורים התואמים את הסינון הנוכחי ביום זה"
                  : "אין תורים ליום זה"}
              </p>
            </div>
          ) : (
            <ol className="flex flex-col gap-2 max-w-2xl mx-auto">
              {dayAppointments.map((apt) => {
                const bgColor = apt.treatment?.color ?? DEFAULT_APT_COLOR;
                const startStr = toTimeStr(apt.startTime);
                const endStr = toTimeStr(apt.endTime);
                const clientName = `${apt.client.firstName} ${apt.client.lastName}`;
                const nextSts = NEXT_STATUSES[apt.status] ?? [];
                const badge = STATUS_BADGE_STYLE[apt.status] ?? STATUS_BADGE_STYLE.SCHEDULED;
                return (
                  <li
                    key={apt.id}
                    className="flex flex-col rounded-md bg-white shadow-sm overflow-hidden"
                    aria-label={`תור: ${clientName}, ${startStr}, סטטוס: ${STATUS_HE[apt.status] ?? apt.status}`}
                  >
                    <div className="flex items-stretch">
                      {/* פס צבע הטיפול (בצד ההתחלה ב-RTL) */}
                      <div
                        className="w-1 shrink-0"
                        style={{ backgroundColor: bgColor }}
                        aria-hidden="true"
                      />
                      <div className="flex-1 px-3 py-2 min-w-0">
                        {/* שעה + סטטוס */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-charcoal tabular-nums" dir="ltr">
                            {startStr}–{endStr}
                          </span>
                          <span
                            className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-sm shrink-0"
                            style={{
                              backgroundColor: badge.bg,
                              color: badge.text === "inherit" ? "#1C1A17" : badge.text,
                            }}
                          >
                            {STATUS_HE[apt.status] ?? apt.status}
                          </span>
                        </div>
                        {/* לקוח/ה */}
                        <div className="text-base font-medium text-charcoal mt-0.5 truncate">
                          {clientName}
                        </div>
                        {/* טיפול, מטפל/ת, חדר */}
                        <dl className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-taupe">
                          <div className="flex gap-1">
                            <dt>טיפול:</dt>
                            <dd>{apt.treatment?.name ?? "טיפול"}</dd>
                          </div>
                          {apt.therapist && (
                            <div className="flex gap-1">
                              <dt>מטפל/ת:</dt>
                              <dd>{apt.therapist}</dd>
                            </div>
                          )}
                          {apt.room && (
                            <div className="flex gap-1">
                              <dt>חדר:</dt>
                              <dd>{apt.room}</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                      {/* שינוי מועד — נגישות ממקלדת/מובייל (כמו בגריד) */}
                      <button
                        className={cn(
                          "shrink-0 px-3 text-xs font-medium text-gold-dark min-h-[44px]",
                          "border-s border-border hover:bg-champagne/60",
                          "transition-colors min-w-[72px]",
                          "focus:outline-none focus:ring-2 focus:ring-gold-dark/40 focus:ring-inset"
                        )}
                        onClick={() => handleOpenReschedule(apt)}
                        aria-label={`שנה מועד עבור ${clientName}`}
                      >
                        שנה מועד
                      </button>
                      {/* מחיקה לצמיתות של התור (משימה 12.4) */}
                      <button
                        type="button"
                        className={cn(
                          "shrink-0 px-3 text-xs font-medium text-error min-h-[44px]",
                          "border-s border-border hover:bg-error/5",
                          "transition-colors min-w-[72px]",
                          "focus:outline-none focus:ring-2 focus:ring-error/40 focus:ring-inset"
                        )}
                        onClick={() => setDeleteApt(apt)}
                        aria-label={`מחיקה לצמיתות של התור של ${clientName}`}
                      >
                        מחיקה לצמיתות
                      </button>
                    </div>

                    {/* שינוי סטטוס — רק סטטוסים חוקיים (FR-AP-04, משימה 5.8) */}
                    {nextSts.length > 0 && (
                      <div
                        className="flex gap-1 px-3 pb-2 pt-0 border-t border-border/50 flex-wrap"
                        dir="rtl"
                      >
                        <span className="text-[10px] text-taupe self-center me-1">
                          עדכן סטטוס:
                        </span>
                        {nextSts.map((s) => {
                          const st = STATUS_BADGE_STYLE[s] ?? STATUS_BADGE_STYLE.SCHEDULED;
                          return (
                            <button
                              key={s}
                              className={cn(
                                "text-[10px] font-medium px-2 py-1 rounded-sm min-h-[44px]",
                                "border border-border/50 hover:border-gold-dark/50",
                                "transition-colors",
                                "focus:outline-none focus:ring-2 focus:ring-gold-dark/40"
                              )}
                              style={{
                                backgroundColor: st.bg,
                                color: st.text === "inherit" ? "#1C1A17" : st.text,
                              }}
                              onClick={() => handleStatusChange(apt, s)}
                              aria-label={`עדכן סטטוס ל: ${STATUS_HE[s] ?? s}`}
                            >
                              {STATUS_HE[s] ?? s}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {/* ================================================================
          תצוגת חודש — לוח חודשי עם מספר תורים לכל יום (משימה 11.11)
          לחיצה על יום מעבירה לתצוגת היום של אותו תאריך (switchToDayView)
          ================================================================ */}
      {viewMode === "month" && (
        <div
          className="overflow-auto flex-1 p-2 sm:p-4"
          role="region"
          aria-label={`תצוגת חודש: ${monthLabel}`}
        >
          {/* פריסת RTL: ראשון בימין, שבת בשמאל */}
          <div className="grid grid-cols-7 bg-white border-t border-s border-border rounded-md overflow-hidden max-w-4xl mx-auto">
            {WEEK_DAYS.map((name) => (
              <div
                key={name}
                className="bg-champagne text-center text-xs font-medium text-charcoal py-2 border-b border-e border-border"
              >
                {name}
              </div>
            ))}
            {monthCells.map((day, idx) => {
              if (!day) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="bg-champagne/40 border-b border-e border-border"
                    aria-hidden="true"
                  />
                );
              }
              const dayKey = toLocalIsoDate(day);
              const count = monthCounts.get(dayKey) ?? 0;
              return (
                <button
                  type="button"
                  key={dayKey}
                  onClick={() => switchToDayView(day)}
                  className={cn(
                    "flex flex-col items-center gap-1 min-h-[64px] p-1.5",
                    "border-b border-e border-border transition-colors hover:bg-champagne/60",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark/40 focus-visible:ring-inset",
                    isToday(day) ? "bg-gold/10" : "bg-white"
                  )}
                  aria-label={`${WEEK_DAYS[day.getDay()]} ${toDayMonth(day)}, ${
                    count === 0 ? "אין תורים" : `${count} תורים`
                  } — עבור לתצוגת יום`}
                >
                  <span
                    className={cn(
                      "text-sm",
                      isToday(day) ? "text-gold-dark font-semibold" : "text-charcoal font-medium"
                    )}
                  >
                    {day.getDate()}
                  </span>
                  {count > 0 && (
                    <span className="text-[11px] font-medium bg-gold text-ink rounded-full px-1.5 min-w-[1.5rem] text-center">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ================================================================
          גריד שבועי — מוצג בתצוגת שבוע, על מסכים בינוניים ומעלה (md+)
          ================================================================ */}
      {viewMode === "week" && (
        <div
          className="hidden md:block overflow-auto flex-1"
          role="region"
          aria-label="תצוגת יומן שבועי"
        >
          {/* dir="ltr": הגריד עצמו ב-LTR לשמירת זרימת זמן משמאל לימין */}
          <div dir="ltr" className="min-w-[640px]">
            {/* כותרות ימים — ניתנות ללחיצה למעבר לתצוגת יום */}
            <div className="flex border-b border-border bg-white sticky top-0 z-10">
              {/* מרווח לעמודת הזמן */}
              <div
                className="shrink-0 border-e border-border bg-white"
                style={{ width: 56 }}
              />
              {weekDays.map((day, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex-1 text-center py-2 border-e border-border last:border-e-0",
                    "cursor-pointer transition-colors hover:bg-champagne/60",
                    isToday(day) ? "bg-gold/10 hover:bg-gold/15" : ""
                  )}
                  onClick={() => switchToDayView(day)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      switchToDayView(day);
                    }
                  }}
                  aria-label={`עבור לתצוגת יום: ${WEEK_DAYS[idx]}, ${toDayMonth(day)}`}
                  title={`תצוגת יום — ${WEEK_DAYS[idx]} ${toDayMonth(day)}`}
                >
                  <div
                    className={cn(
                      "text-sm font-heading font-medium",
                      isToday(day) ? "text-gold-dark" : "text-charcoal"
                    )}
                  >
                    {WEEK_DAYS[idx]}
                  </div>
                  <div
                    className={cn(
                      "text-xs",
                      isToday(day)
                        ? "text-gold-dark font-semibold"
                        : "text-taupe"
                    )}
                  >
                    {toDayMonth(day)}
                  </div>
                </div>
              ))}
            </div>

            {/* גוף הגריד: עמודת זמן + 7 עמודות ימים */}
            <div className="flex">
              {/* עמודת תוויות שעה */}
              <TimeLabelsColumn hourLabels={hourLabels} totalGridHeight={totalGridHeight} />

              {/* עמודות ימים */}
              {weekDays.map((day, dayIdx) => {
                const dayApts = byDay[dayIdx] ?? [];
                return (
                  <div
                    key={dayIdx}
                    className={cn(
                      "flex-1 relative border-e border-border last:border-e-0",
                      isToday(day) ? "bg-gold/5" : "bg-white"
                    )}
                    style={{ height: totalGridHeight }}
                  >
                    <GridLines numHours={calEnd - calStart} />

                    {/* שכבת Drop Zones לתצוגת שבוע */}
                    <DropZoneLayer
                      isDragging={!!draggingId}
                      activeDayIdx={dragOverSlot?.dayIdx ?? null}
                      dayIdx={dayIdx}
                      activeSlotIdx={dragOverSlot?.slotIdx ?? null}
                      onDragOver={(slotIdx) =>
                        setDragOverSlot({ dayIdx, slotIdx })
                      }
                      onDragLeave={() => setDragOverSlot(null)}
                      onDrop={(slotIdx, e) =>
                        handleWeekDrop(dayIdx, slotIdx, e, weekDays)
                      }
                      totalSlots={totalSlots}
                      calStartHour={calStart}
                    />

                    {/* תורים */}
                    {dayApts.map((apt) => {
                      const pos = calcPosition(apt.startTime, apt.endTime, calStart, calEnd);
                      if (!pos) return null;
                      return (
                        <AppointmentCard
                          key={apt.id}
                          apt={apt}
                          pos={pos}
                          isDragging={draggingId === apt.id}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          onReschedule={handleOpenReschedule}
                          onStatusChange={handleStatusChange}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          תצוגת רשימה — מוצגת בתצוגת שבוע, רק בנייד (מוסתרת ב-md+)
          ================================================================ */}
      {viewMode === "week" && (
        <div
          className="md:hidden overflow-auto flex-1 p-4"
          role="region"
          aria-label="רשימת תורים שבועית"
        >
          {weekDays.map((day, dayIdx) => {
            const dayApts = byDay[dayIdx] ?? [];
            return (
              <section key={dayIdx} className="mb-6 last:mb-0">
                <h2
                  className={cn(
                    "text-sm font-heading font-semibold mb-2 pb-1",
                    "border-b flex items-center gap-2",
                    isToday(day)
                      ? "text-gold-dark border-gold-dark/30"
                      : "text-charcoal border-border"
                  )}
                >
                  {/* לחיצה על כותרת יום במובייל מעברת לתצוגת יום */}
                  <button
                    onClick={() => switchToDayView(day)}
                    className="flex items-center gap-2 hover:text-gold-dark transition-colors"
                    aria-label={`עבור לתצוגת יום: ${WEEK_DAYS[dayIdx]}, ${toDayMonth(day)}`}
                  >
                    {WEEK_DAYS[dayIdx]}
                    <span className="font-normal text-taupe text-xs">
                      {toDayMonth(day)}
                    </span>
                    {isToday(day) && (
                      <span className="text-[10px] bg-gold text-ink px-1.5 py-0.5 rounded-full font-medium">
                        היום
                      </span>
                    )}
                  </button>
                </h2>

                {dayApts.length === 0 ? (
                  <p className="text-xs text-taupe/60 py-1">אין תורים</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {dayApts.map((apt) => {
                      const bgColor =
                        apt.treatment?.color ?? DEFAULT_APT_COLOR;
                      const startStr = toTimeStr(apt.startTime);
                      const endStr = toTimeStr(apt.endTime);
                      const nextSts = NEXT_STATUSES[apt.status] ?? [];
                      const badge = STATUS_BADGE_STYLE[apt.status] ?? STATUS_BADGE_STYLE.SCHEDULED;
                      return (
                        <div
                          key={apt.id}
                          className="flex flex-col rounded-md bg-white shadow-sm overflow-hidden"
                          role="article"
                          aria-label={`תור: ${apt.client.firstName} ${apt.client.lastName}, ${startStr}, סטטוס: ${STATUS_HE[apt.status] ?? apt.status}`}
                        >
                          {/* שורה ראשית */}
                          <div className="flex items-stretch">
                            {/* פס צבע בצד ימין (start ב-RTL) */}
                            <div
                              className="w-1 shrink-0"
                              style={{ backgroundColor: bgColor }}
                              aria-hidden="true"
                            />
                            <div className="flex-1 px-3 py-2 min-w-0">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="text-sm font-medium text-charcoal truncate">
                                  {apt.client.firstName} {apt.client.lastName}
                                </span>
                                <span
                                  className="text-xs text-taupe shrink-0"
                                  dir="ltr"
                                >
                                  {startStr}–{endStr}
                                </span>
                              </div>
                              <div className="text-xs text-taupe mt-0.5 truncate">
                                {apt.treatment?.name ?? "טיפול"}
                                {apt.therapist && ` · ${apt.therapist}`}
                                {apt.room && ` · ${apt.room}`}
                              </div>
                              {/* Badge סטטוס */}
                              <div className="mt-1">
                                <span
                                  className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-sm"
                                  style={{ backgroundColor: badge.bg, color: badge.text === "inherit" ? "#1C1A17" : badge.text }}
                                  aria-label={`סטטוס: ${STATUS_HE[apt.status] ?? apt.status}`}
                                >
                                  {STATUS_HE[apt.status] ?? apt.status}
                                </span>
                              </div>
                            </div>
                            {/* כפתור שינוי מועד במובייל */}
                            <button
                              className={cn(
                                "shrink-0 px-3 text-xs font-medium text-gold-dark",
                                "border-s border-border hover:bg-champagne/60",
                                "transition-colors min-w-[72px]",
                                "focus:outline-none focus:ring-2 focus:ring-gold-dark/40 focus:ring-inset"
                              )}
                              onClick={() => handleOpenReschedule(apt)}
                              aria-label={`שנה מועד עבור ${apt.client.firstName} ${apt.client.lastName}`}
                            >
                              שנה מועד
                            </button>
                            {/* מחיקה לצמיתות של התור (משימה 12.4) */}
                            <button
                              type="button"
                              className={cn(
                                "shrink-0 px-3 text-xs font-medium text-error",
                                "border-s border-border hover:bg-error/5",
                                "transition-colors min-w-[72px]",
                                "focus:outline-none focus:ring-2 focus:ring-error/40 focus:ring-inset"
                              )}
                              onClick={() => setDeleteApt(apt)}
                              aria-label={`מחיקה לצמיתות של התור של ${apt.client.firstName} ${apt.client.lastName}`}
                            >
                              מחיקה לצמיתות
                            </button>
                          </div>

                          {/* שורת שינוי סטטוס — רק אם יש סטטוסים אפשריים */}
                          {nextSts.length > 0 && (
                            <div
                              className="flex gap-1 px-3 pb-2 pt-0 border-t border-border/50 mt-0 flex-wrap"
                              dir="rtl"
                            >
                              <span className="text-[10px] text-taupe self-center me-1">
                                עדכן סטטוס:
                              </span>
                              {nextSts.map((s) => {
                                const st = STATUS_BADGE_STYLE[s] ?? STATUS_BADGE_STYLE.SCHEDULED;
                                return (
                                  <button
                                    key={s}
                                    className={cn(
                                      "text-[10px] font-medium px-2 py-1 rounded-sm",
                                      "border border-border/50 hover:border-gold-dark/50",
                                      "transition-colors",
                                      "focus:outline-none focus:ring-2 focus:ring-gold-dark/40",
                                      "min-h-[36px]"
                                    )}
                                    style={{ backgroundColor: st.bg, color: st.text === "inherit" ? "#1C1A17" : st.text }}
                                    onClick={() => handleStatusChange(apt, s)}
                                    aria-label={`עדכן סטטוס ל: ${STATUS_HE[s] ?? s}`}
                                  >
                                    {STATUS_HE[s] ?? s}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* היסטוריית סטטוס — 2 אחרונות */}
                          {apt.statusHistory.length > 0 && (
                            <div className="px-3 pb-2 border-t border-border/30">
                              {apt.statusHistory.slice(0, 2).map((h) => (
                                <div key={h.id} className="text-[10px] text-taupe leading-tight mt-0.5">
                                  {STATUS_HE[h.fromStatus] ?? h.fromStatus} → {STATUS_HE[h.toStatus] ?? h.toStatus}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}

          {/* מצב ריק */}
          {filtered.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-taupe text-sm">
                {hasActiveFilter
                  ? "אין תורים התואמים את הסינון הנוכחי"
                  : "אין תורים לשבוע זה"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* מצב ריק לדסקטופ — תצוגת שבוע */}
      {viewMode === "week" && filtered.length === 0 && !loading && (
        <div
          className="hidden md:flex items-center justify-center py-8"
          aria-live="polite"
        >
          <p className="text-taupe text-sm">
            {hasActiveFilter
              ? "אין תורים התואמים את הסינון הנוכחי"
              : "אין תורים לשבוע זה"}
          </p>
        </div>
      )}

      {/* ================================================================
          דיאלוג שינוי מועד (נגישות ממקלדת — פולבק לגרירה)
          ================================================================ */}
      {rescheduleApt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reschedule-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          dir="rtl"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setRescheduleApt(null);
              setRescheduleError(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setRescheduleApt(null);
              setRescheduleError(null);
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-xl p-6 w-80 mx-4 max-w-full">
            <h2
              id="reschedule-dialog-title"
              className="text-base font-heading font-semibold text-charcoal mb-1"
            >
              שינוי מועד תור
            </h2>
            <p className="text-sm text-taupe mb-4">
              {rescheduleApt.client.firstName} {rescheduleApt.client.lastName}
              {rescheduleApt.treatment?.name &&
                ` — ${rescheduleApt.treatment.name}`}
            </p>

            <div className="flex flex-col gap-3">
              {/* תאריך */}
              <div>
                <label
                  htmlFor="reschedule-date"
                  className="text-xs font-medium text-charcoal mb-1 block"
                >
                  תאריך חדש
                </label>
                <input
                  id="reschedule-date"
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className={cn(
                    "w-full h-9 rounded-md border border-input px-3 text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-gold-dark/40"
                  )}
                />
              </div>

              {/* שעה */}
              <div>
                <label
                  htmlFor="reschedule-time"
                  className="text-xs font-medium text-charcoal mb-1 block"
                >
                  שעת התחלה חדשה
                </label>
                <input
                  id="reschedule-time"
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  step="1800"
                  dir="ltr"
                  className={cn(
                    "w-full h-9 rounded-md border border-input px-3 text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-gold-dark/40"
                  )}
                />
              </div>

              {/* שגיאה */}
              {rescheduleError && (
                <p className="text-xs text-error" role="alert">
                  {rescheduleError}
                </p>
              )}

              {/* כפתורי פעולה */}
              <div className="flex gap-2 justify-start mt-1">
                <Button
                  size="sm"
                  disabled={
                    !rescheduleDate || !rescheduleTime || rescheduleLoading
                  }
                  onClick={async () => {
                    if (!rescheduleDate || !rescheduleTime || !rescheduleApt)
                      return;
                    setRescheduleLoading(true);
                    setRescheduleError(null);

                    const durationMs =
                      new Date(rescheduleApt.endTime).getTime() -
                      new Date(rescheduleApt.startTime).getTime();
                    const newStart = new Date(
                      `${rescheduleDate}T${rescheduleTime}`
                    );

                    if (isNaN(newStart.getTime())) {
                      setRescheduleError("תאריך או שעה לא תקינים");
                      setRescheduleLoading(false);
                      return;
                    }

                    const newEnd = new Date(newStart.getTime() + durationMs);
                    const success = await rescheduleAppointment(
                      rescheduleApt.id,
                      newStart,
                      newEnd
                    );

                    setRescheduleLoading(false);
                    if (success) {
                      setRescheduleApt(null);
                      setRescheduleDate("");
                      setRescheduleTime("");
                      setRescheduleError(null);
                    } else {
                      setRescheduleError(dragError ?? "שגיאה בעדכון — נסה שוב");
                    }
                  }}
                >
                  {rescheduleLoading ? "שומר..." : "שמור"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRescheduleApt(null);
                    setRescheduleDate("");
                    setRescheduleTime("");
                    setRescheduleError(null);
                  }}
                >
                  ביטול
                </Button>
              </div>

              {/* מחיקה לצמיתות של התור (משימה 12.4) — גם מהגריד דרך כפתור "מועד" */}
              <div className="mt-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteApt(rescheduleApt);
                    setRescheduleApt(null);
                    setRescheduleDate("");
                    setRescheduleTime("");
                    setRescheduleError(null);
                  }}
                  className={cn(
                    "min-h-11 w-full rounded-md border border-error/50 bg-error/5 px-3 text-xs font-semibold text-error",
                    "transition-colors hover:bg-error/10",
                    "focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-1"
                  )}
                >
                  מחיקה לצמיתות
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          דיאלוג מחיקה לצמיתות של תור (משימה 12.4)
          ================================================================ */}
      <HardDeleteAppointmentDialog
        appointment={deleteApt}
        onClose={() => setDeleteApt(null)}
        onDeleted={handleAppointmentDeleted}
      />

      {/* ================================================================
          דיאלוג יצירת תור חדש (משימה 5.9, FR-AP-02)
          ================================================================ */}
      {showNewApt && (
        <NewAppointmentDialog
          treatments={treatments}
          defaultDate={defaultAptDate}
          onClose={() => setShowNewApt(false)}
          onSuccess={() =>
            void (viewMode === "month" ? fetchMonth(monthStart) : fetchWeek(weekStart))
          }
        />
      )}
    </div>
  );
}
