"use client";

/**
 * מסך רשימת לקוחות עם חיפוש גלובלי וכל הפילטרים (משימות 3.5–3.11, FR-CL-03–09).
 *
 * כל הפילטרים מתבצעים בשרת (DB-level) — בכל שינוי פילטר נשלחת בקשת
 * `GET /api/clients?...` עם כלל הפרמטרים הפעילים.
 *
 * פילטרים בסיסיים (3.5–3.8): q (חיפוש טקסט), gender, treatments/treatmentOp.
 * פילטרים נוספים (3.9, FR-CL-07): lastVisitFrom, lastVisitTo, notVisitedDays,
 * ageMin, ageMax, source, tags, therapist, consentChannel — מוצגים בחלק
 * מתקפל "פילטרים נוספים" כדי לא לצופף את הממשק הבסיסי.
 *
 * סגמנטים שמורים (3.11, FR-CL-09): שמירת מצב הפילטרים כסגמנט עם שם ייחודי,
 * טעינה מחדש בלחיצה, מחיקה — מאוחסן ב-Segment table עם JSON של מצב הפילטרים.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";

export type ClientListItem = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  city: string | null;
  createdAt: string;
};

export type TreatmentOption = {
  id: string;
  name: string;
  durationMinutes: number;
};

export type TagOption = {
  id: string;
  name: string;
};

/** סגמנט שמור — תואם ל-model Segment ב-schema.prisma. */
export type SegmentItem = {
  id: string;
  name: string;
  filters: SerializedFilters;
  createdAt: string;
};

/**
 * ייצוג ה-JSON של מצב הפילטרים שנשמר ב-Segment.filters.
 * חייב להיות סריאלי לחלוטין (ללא פונקציות/תאריכים מיוחדים).
 */
export type SerializedFilters = {
  query: string;
  genderFilter: GenderFilter;
  selectedTreatmentIds: string[];
  treatmentOperator: "AND" | "OR";
  extra: ExtraFilters;
};

/** ערכי מין חוקיים לפילטר (תואם ל-enum Gender ב-schema.prisma). */
type GenderFilter = "female" | "male" | "other" | "";

const GENDER_OPTIONS: { value: GenderFilter; label: string }[] = [
  { value: "", label: "הכל" },
  { value: "female", label: "נקבה" },
  { value: "male", label: "זכר" },
  { value: "other", label: "אחר" },
];

/** ערכי ערוץ הסכמה לדיוור (תואם ל-enum MarketingConsentChannel ב-schema.prisma). */
const CONSENT_CHANNEL_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "הכל" },
  { value: "none", label: "ללא הסכמה" },
  { value: "landing_page", label: "דף נחיתה" },
  { value: "whatsapp", label: "וואטסאפ" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "אימייל" },
  { value: "in_person", label: "פנים אל פנים" },
];

/** פילטרים נוספים — משימה 3.9 (FR-CL-07). */
type ExtraFilters = {
  lastVisitFrom: string;
  lastVisitTo: string;
  notVisitedDays: string;
  ageMin: string;
  ageMax: string;
  source: string;
  tagIds: string[];
  therapist: string;
  consentChannel: string;
};

const EMPTY_EXTRA: ExtraFilters = {
  lastVisitFrom: "",
  lastVisitTo: "",
  notVisitedDays: "",
  ageMin: "",
  ageMax: "",
  source: "",
  tagIds: [],
  therapist: "",
  consentChannel: "",
};

function extraHasValue(extra: ExtraFilters): boolean {
  return (
    Boolean(extra.lastVisitFrom) ||
    Boolean(extra.lastVisitTo) ||
    Boolean(extra.notVisitedDays) ||
    Boolean(extra.ageMin) ||
    Boolean(extra.ageMax) ||
    Boolean(extra.source.trim()) ||
    extra.tagIds.length > 0 ||
    Boolean(extra.therapist.trim()) ||
    Boolean(extra.consentChannel)
  );
}

const SEARCH_DEBOUNCE_MS = 300;
const TEXT_DEBOUNCE_MS = 500;

export function ClientsListView({
  initialClients,
  treatments,
  tags,
  initialSegments = [],
}: {
  initialClients: ClientListItem[];
  treatments: TreatmentOption[];
  tags: TagOption[];
  initialSegments?: SegmentItem[];
}) {
  // ─── סטייט פילטרים בסיסיים ──────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("");
  const [selectedTreatmentIds, setSelectedTreatmentIds] = useState<string[]>([]);
  const [treatmentOperator, setTreatmentOperator] = useState<"AND" | "OR">("OR");

  // ─── סטייט פילטרים נוספים (3.9) ─────────────────────────────────────────
  const [showExtraFilters, setShowExtraFilters] = useState(false);
  const [extra, setExtra] = useState<ExtraFilters>(EMPTY_EXTRA);

  // ─── סטייט תוצאות ────────────────────────────────────────────────────────
  const [searchResults, setSearchResults] = useState<ClientListItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── סטייט סגמנטים שמורים (3.11) ────────────────────────────────────────
  const [segments, setSegments] = useState<SegmentItem[]>(initialSegments);
  const [showSaveSegment, setShowSaveSegment] = useState(false);
  const [segmentName, setSegmentName] = useState("");
  const [segmentSaving, setSegmentSaving] = useState(false);
  const [segmentError, setSegmentError] = useState<string | null>(null);
  const [segmentSuccess, setSegmentSuccess] = useState<string | null>(null);
  const segmentNameRef = useRef<HTMLInputElement>(null);

  // ─── סטייט פעולות קבוצתיות (3.12, FR-CL-10) ─────────────────────────────
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [showBulkTagPicker, setShowBulkTagPicker] = useState(false);
  const [bulkTagging, setBulkTagging] = useState(false);
  const [bulkTagError, setBulkTagError] = useState<string | null>(null);
  const [bulkTagSuccess, setBulkTagSuccess] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState("");

  const trimmedQuery = query.trim();
  const hasFilter =
    Boolean(trimmedQuery) ||
    Boolean(genderFilter) ||
    selectedTreatmentIds.length > 0 ||
    extraHasValue(extra);
  const clients = hasFilter ? (searchResults ?? []) : initialClients;

  // ─── נגזרות בחירה (3.12) ─────────────────────────────────────────────────
  const someSelected = selectedClientIds.length > 0;
  const allCurrentSelected =
    clients.length > 0 &&
    clients.every((c) => selectedClientIds.includes(c.id));

  /** בנית URL לפי מצב כל הפילטרים. */
  function buildUrl(
    q: string,
    gender: GenderFilter,
    treatmentIds: string[],
    treatmentOp: "AND" | "OR",
    ex: ExtraFilters
  ): string {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (gender) p.set("gender", gender);
    if (treatmentIds.length > 0) {
      p.set("treatments", treatmentIds.join(","));
      p.set("treatmentOp", treatmentOp);
    }
    if (ex.lastVisitFrom) p.set("lastVisitFrom", ex.lastVisitFrom);
    if (ex.lastVisitTo) p.set("lastVisitTo", ex.lastVisitTo);
    if (ex.notVisitedDays) p.set("notVisitedDays", ex.notVisitedDays);
    if (ex.ageMin) p.set("ageMin", ex.ageMin);
    if (ex.ageMax) p.set("ageMax", ex.ageMax);
    if (ex.source.trim()) p.set("source", ex.source.trim());
    if (ex.tagIds.length > 0) p.set("tags", ex.tagIds.join(","));
    if (ex.therapist.trim()) p.set("therapist", ex.therapist.trim());
    if (ex.consentChannel) p.set("consentChannel", ex.consentChannel);
    return `/api/clients?${p.toString()}`;
  }

  /** שליחת בקשה לשרת — משותפת לכל הפילטרים. */
  async function doFetch(
    q: string,
    gender: GenderFilter,
    treatmentIds: string[],
    treatmentOp: "AND" | "OR",
    ex: ExtraFilters,
    requestId: number
  ): Promise<void> {
    try {
      const response = await fetch(buildUrl(q, gender, treatmentIds, treatmentOp, ex));
      if (!response.ok) throw new Error("search failed");
      const body = await response.json();
      if (requestId !== requestIdRef.current) return;
      setSearchResults(body.clients as ClientListItem[]);
      setSelectedClientIds([]);
      setError(null);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setError("אירעה שגיאה בחיפוש — נא לנסות שוב");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }

  /**
   * הפעלת fetch עם ה-state הנוכחי.
   * debounceMs=0 → שליחה מיידית. debounceMs>0 → שליחה עם דיליי.
   */
  function triggerFetch(
    q: string,
    gender: GenderFilter,
    treatmentIds: string[],
    treatmentOp: "AND" | "OR",
    ex: ExtraFilters,
    debounceMs: number
  ): void {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    const noFilter =
      !q.trim() &&
      !gender &&
      treatmentIds.length === 0 &&
      !extraHasValue(ex);

    if (noFilter) {
      requestIdRef.current += 1;
      setLoading(false);
      setError(null);
      setSearchResults(null);
      setSelectedClientIds([]);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);

    if (debounceMs > 0) {
      debounceTimeoutRef.current = setTimeout(
        () => void doFetch(q.trim(), gender, treatmentIds, treatmentOp, ex, requestId),
        debounceMs
      );
    } else {
      void doFetch(q.trim(), gender, treatmentIds, treatmentOp, ex, requestId);
    }
  }

  // ─── handlers פילטרים בסיסיים ────────────────────────────────────────────

  function handleQueryChange(value: string): void {
    setQuery(value);
    triggerFetch(value, genderFilter, selectedTreatmentIds, treatmentOperator, extra, SEARCH_DEBOUNCE_MS);
  }

  function handleGenderChange(gender: GenderFilter): void {
    setGenderFilter(gender);
    triggerFetch(trimmedQuery, gender, selectedTreatmentIds, treatmentOperator, extra, 0);
  }

  function handleTreatmentToggle(treatmentId: string): void {
    const next = selectedTreatmentIds.includes(treatmentId)
      ? selectedTreatmentIds.filter((id) => id !== treatmentId)
      : [...selectedTreatmentIds, treatmentId];
    setSelectedTreatmentIds(next);
    triggerFetch(trimmedQuery, genderFilter, next, treatmentOperator, extra, 0);
  }

  function handleOperatorChange(op: "AND" | "OR"): void {
    setTreatmentOperator(op);
    if (selectedTreatmentIds.length > 0) {
      triggerFetch(trimmedQuery, genderFilter, selectedTreatmentIds, op, extra, 0);
    }
  }

  // ─── handlers פילטרים נוספים (3.9) ───────────────────────────────────────

  /** עדכון שדה אחד בתוך extra ושליחת fetch. */
  function handleExtraChange(
    updates: Partial<ExtraFilters>,
    debounceMs = 0
  ): void {
    const next = { ...extra, ...updates };
    setExtra(next);
    triggerFetch(trimmedQuery, genderFilter, selectedTreatmentIds, treatmentOperator, next, debounceMs);
  }

  function handleTagToggle(tagId: string): void {
    const next = extra.tagIds.includes(tagId)
      ? extra.tagIds.filter((id) => id !== tagId)
      : [...extra.tagIds, tagId];
    handleExtraChange({ tagIds: next }, 0);
  }

  function handleClearExtra(): void {
    setExtra(EMPTY_EXTRA);
    triggerFetch(trimmedQuery, genderFilter, selectedTreatmentIds, treatmentOperator, EMPTY_EXTRA, 0);
  }

  // ─── handlers פעולות קבוצתיות (3.12, FR-CL-10) ───────────────────────────

  /** בחירה/ביטול בחירה של לקוח בודד. */
  function toggleSelectClient(id: string): void {
    setSelectedClientIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  /** בחר הכל / בטל הכל עבור הרשימה הנוכחית. */
  function toggleSelectAll(): void {
    if (allCurrentSelected) {
      setSelectedClientIds([]);
    } else {
      setSelectedClientIds(clients.map((c) => c.id));
    }
  }

  /** הוספת תגית לכל הלקוחות שנבחרו. */
  async function handleBulkAddTag(): Promise<void> {
    if (!selectedTagId || selectedClientIds.length === 0) return;
    setBulkTagging(true);
    setBulkTagError(null);
    setBulkTagSuccess(null);
    try {
      const response = await fetch("/api/clients/bulk-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientIds: selectedClientIds,
          tagId: selectedTagId,
        }),
      });
      const data = (await response.json()) as { created?: number; error?: string };
      if (!response.ok) {
        setBulkTagError(data.error ?? "שגיאה בהוספת תגית");
        return;
      }
      const tagName = tags.find((t) => t.id === selectedTagId)?.name ?? "תגית";
      setBulkTagSuccess(
        `התגית "${tagName}" הוספה ל-${selectedClientIds.length} לקוחות (${data.created ?? 0} חדשות)`
      );
      setShowBulkTagPicker(false);
      setSelectedTagId("");
    } catch {
      setBulkTagError("שגיאת רשת — נא לנסות שוב");
    } finally {
      setBulkTagging(false);
    }
  }

  /**
   * ייצוא CSV של כלל התוצאות המסוננות.
   * // TODO: restrict to admin role — בדיקת תפקיד תמומש עם מימוש הרשאות מלא (SRS §11.1).
   */
  function handleExportCsv(): void {
    const filterUrl = buildUrl(
      trimmedQuery,
      genderFilter,
      selectedTreatmentIds,
      treatmentOperator,
      extra
    );
    // מחליף את בסיס הנתיב מ-/api/clients ל-/api/clients/export
    const qs = filterUrl.split("?")[1] ?? "";
    const exportUrl = `/api/clients/export${qs ? `?${qs}` : ""}`;
    // פתיחה בלשונית נוכחית — הדפדפן יטפל בהורדת הקובץ אוטומטית (Content-Disposition: attachment)
    window.location.href = exportUrl;
  }

  // ניקוי debounce בעת unmount.
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
  }, []);

  // ─── פונקציות סגמנטים (3.11) ─────────────────────────────────────────────

  /** מחזיר את מצב כל הפילטרים כ-object סריאלי ל-JSON. */
  const serializeFilters = useCallback((): SerializedFilters => ({
    query,
    genderFilter,
    selectedTreatmentIds,
    treatmentOperator,
    extra,
  }), [query, genderFilter, selectedTreatmentIds, treatmentOperator, extra]);

  /** טוען סגמנט שמור — משחזר את כל הפילטרים ומפעיל fetch. */
  function loadSegment(seg: SegmentItem): void {
    const f = seg.filters;
    setQuery(f.query ?? "");
    setGenderFilter(f.genderFilter ?? "");
    setSelectedTreatmentIds(f.selectedTreatmentIds ?? []);
    setTreatmentOperator(f.treatmentOperator ?? "OR");
    const nextExtra = { ...EMPTY_EXTRA, ...(f.extra ?? {}) };
    setExtra(nextExtra);
    // סגור את פאנל הפילטרים הנוספים אם הסגמנט לא מכיל אף פילטר נוסף
    setShowExtraFilters(extraHasValue(nextExtra));
    // שגר fetch עם הפילטרים שנטענו
    triggerFetch(
      f.query ?? "",
      f.genderFilter ?? "",
      f.selectedTreatmentIds ?? [],
      f.treatmentOperator ?? "OR",
      nextExtra,
      0
    );
  }

  /** שומר את מצב הפילטרים הנוכחי כסגמנט חדש. */
  async function handleSaveSegment(): Promise<void> {
    const trimmed = segmentName.trim();
    if (!trimmed) {
      setSegmentError("יש להזין שם לסגמנט");
      segmentNameRef.current?.focus();
      return;
    }
    setSegmentSaving(true);
    setSegmentError(null);
    setSegmentSuccess(null);
    try {
      const response = await fetch("/api/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, filters: serializeFilters() }),
      });
      const data = (await response.json()) as { segment?: SegmentItem; error?: string };
      if (!response.ok) {
        setSegmentError(data.error ?? "שגיאה בשמירת הסגמנט");
        return;
      }
      if (data.segment) {
        setSegments((prev) => [data.segment!, ...prev]);
      }
      setSegmentSuccess(`הסגמנט "${trimmed}" נשמר בהצלחה`);
      setSegmentName("");
      setShowSaveSegment(false);
    } catch {
      setSegmentError("שגיאת רשת — נא לנסות שוב");
    } finally {
      setSegmentSaving(false);
    }
  }

  /** מוחק סגמנט שמור. */
  async function handleDeleteSegment(id: string, name: string): Promise<void> {
    if (!confirm(`למחוק את הסגמנט "${name}"?`)) return;
    try {
      const response = await fetch(`/api/segments/${id}`, { method: "DELETE" });
      if (response.ok) {
        setSegments((prev) => prev.filter((s) => s.id !== id));
      } else {
        const data = (await response.json()) as { error?: string };
        alert(data.error ?? "שגיאה במחיקת הסגמנט");
      }
    } catch {
      alert("שגיאת רשת — נא לנסות שוב");
    }
  }

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* שורה עליונה: שדה חיפוש + קישור כפילויות */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex flex-col gap-1.5 sm:max-w-sm sm:flex-1">
          <span className="text-sm font-medium text-charcoal">
            חיפוש לפי שם, טלפון, הערה או תגית
          </span>
          <Input
            type="search"
            inputMode="search"
            placeholder="לדוגמה: שרה, 050123, טיפול, VIP"
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            className="h-11 bg-porcelain text-base"
            aria-label="חיפוש לקוחות לפי שם, טלפון, הערה או תגית"
          />
        </label>

        <Link
          href="/clients/duplicates"
          className="text-sm font-medium text-gold-dark underline-offset-2 hover:underline"
        >
          איתור כפילויות
        </Link>
      </div>

      {/* ═══ סגמנטים שמורים — משימה 3.11 (FR-CL-09) ═══════════════════════ */}
      {segments.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-gold-antique/30 bg-porcelain/50 p-3">
          <span className="text-sm font-medium text-charcoal">סגמנטים שמורים</span>
          <div
            role="list"
            aria-label="סגמנטים שמורים לשימוש חוזר"
            className="flex flex-wrap gap-2"
          >
            {segments.map((seg) => (
              <div
                key={seg.id}
                role="listitem"
                className="flex items-center gap-1 rounded-lg border border-gold-antique/40 bg-champagne"
              >
                <button
                  type="button"
                  onClick={() => loadSegment(seg)}
                  className={cn(
                    "min-h-11 rounded-s-lg px-3 py-2 text-sm font-medium text-charcoal",
                    "transition-colors hover:bg-gold-dark/10",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1"
                  )}
                  title={`טען סגמנט: ${seg.name}`}
                >
                  {seg.name}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteSegment(seg.id, seg.name)}
                  aria-label={`מחק סגמנט: ${seg.name}`}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-e-lg text-taupe",
                    "transition-colors hover:bg-red-50 hover:text-red-600",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1",
                    "border-s border-gold-antique/30"
                  )}
                >
                  <span aria-hidden="true" className="text-base leading-none">×</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* כפתור "שמור כסגמנט" — מוצג רק כשיש לפחות פילטר אחד פעיל */}
      {hasFilter && (
        <div className="flex flex-col gap-2">
          {!showSaveSegment ? (
            <button
              type="button"
              onClick={() => {
                setShowSaveSegment(true);
                setSegmentError(null);
                setSegmentSuccess(null);
                setTimeout(() => segmentNameRef.current?.focus(), 50);
              }}
              className={cn(
                "self-start rounded-lg border border-gold-dark/60 bg-porcelain px-4 text-sm font-medium text-gold-dark",
                "min-h-11 transition-colors hover:bg-champagne",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1"
              )}
            >
              שמור כסגמנט
            </button>
          ) : (
            <div
              role="region"
              aria-label="שמירת סגמנט חדש"
              className="flex flex-col gap-2 rounded-lg border border-gold-dark/40 bg-champagne/60 p-3"
            >
              <span className="text-sm font-medium text-charcoal">שמור את הפילטר הנוכחי כסגמנט</span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-xs text-taupe">שם הסגמנט</span>
                  <input
                    ref={segmentNameRef}
                    type="text"
                    value={segmentName}
                    onChange={(e) => {
                      setSegmentName(e.target.value);
                      setSegmentError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleSaveSegment();
                      if (e.key === "Escape") {
                        setShowSaveSegment(false);
                        setSegmentName("");
                        setSegmentError(null);
                      }
                    }}
                    placeholder='לדוגמה: לקוחות שלא חזרו 60+ יום'
                    maxLength={100}
                    className={cn(
                      "h-11 rounded-lg border bg-porcelain px-3 text-sm text-charcoal",
                      segmentError
                        ? "border-red-400 focus:ring-red-400"
                        : "border-gold-antique/40 focus:ring-gold-dark",
                      "focus:outline-none focus:ring-2 focus:ring-offset-1"
                    )}
                    aria-label="שם הסגמנט החדש"
                    aria-describedby={segmentError ? "segment-error" : undefined}
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveSegment()}
                    disabled={segmentSaving}
                    className={cn(
                      "min-h-11 rounded-lg bg-gold-dark px-4 text-sm font-medium text-champagne",
                      "transition-colors hover:bg-gold-deep disabled:opacity-60",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1"
                    )}
                  >
                    {segmentSaving ? "שומר…" : "שמור"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSaveSegment(false);
                      setSegmentName("");
                      setSegmentError(null);
                    }}
                    className={cn(
                      "min-h-11 rounded-lg border border-gold-antique/40 bg-porcelain px-4 text-sm font-medium text-charcoal",
                      "transition-colors hover:bg-champagne",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1"
                    )}
                  >
                    ביטול
                  </button>
                </div>
              </div>
              {segmentError && (
                <p id="segment-error" role="alert" className="text-xs text-red-600">
                  {segmentError}
                </p>
              )}
            </div>
          )}
          {segmentSuccess && !showSaveSegment && (
            <p role="status" className="text-xs text-success">
              {segmentSuccess}
            </p>
          )}
        </div>
      )}

      {/* סינון לפי מין (FR-CL-05, משימה 3.7) */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-charcoal">סינון לפי מין</span>
        <div
          role="group"
          aria-label="סינון לפי מין"
          className="flex flex-wrap gap-1.5"
        >
          {GENDER_OPTIONS.map(({ value, label }) => (
            <button
              key={value || "all"}
              type="button"
              aria-pressed={genderFilter === value}
              onClick={() => handleGenderChange(value)}
              className={cn(
                "min-h-11 rounded-lg border px-4 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1",
                genderFilter === value
                  ? "border-gold-dark bg-gold-dark text-champagne"
                  : "border-gold-antique/40 bg-porcelain text-charcoal hover:border-gold-dark/60 hover:bg-champagne"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* סינון לפי טיפולים שבוצעו (FR-CL-04, משימה 3.6) */}
      {treatments.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-gold-antique/30 bg-porcelain p-3">
          <span className="text-sm font-medium text-charcoal">
            סינון לפי טיפול שבוצע
          </span>

          <div
            role="group"
            aria-label="סינון לפי טיפולים שבוצעו"
            className="flex flex-wrap gap-1.5"
          >
            {treatments.map((t) => {
              const checked = selectedTreatmentIds.includes(t.id);
              return (
                <label
                  key={t.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                    "focus-within:ring-2 focus-within:ring-gold-dark focus-within:ring-offset-1",
                    "min-h-11",
                    checked
                      ? "border-gold-dark bg-gold-dark/10 text-charcoal"
                      : "border-gold-antique/30 bg-champagne text-charcoal hover:border-gold-dark/60"
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-gold-dark"
                    checked={checked}
                    onChange={() => handleTreatmentToggle(t.id)}
                    aria-label={`סנן לפי טיפול: ${t.name}`}
                  />
                  <span>{t.name}</span>
                </label>
              );
            })}
          </div>

          {selectedTreatmentIds.length >= 2 && (
            <div
              role="group"
              aria-label="אופרטור חיפוש טיפולים"
              className="flex items-center gap-4 pt-1"
            >
              <span className="text-xs text-taupe">הצג לקוחות שביצעו:</span>
              <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="treatmentOp"
                  value="OR"
                  checked={treatmentOperator === "OR"}
                  onChange={() => handleOperatorChange("OR")}
                  className="accent-gold-dark"
                />
                <span>לפחות אחד מהטיפולים</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="treatmentOp"
                  value="AND"
                  checked={treatmentOperator === "AND"}
                  onChange={() => handleOperatorChange("AND")}
                  className="accent-gold-dark"
                />
                <span>את כולם</span>
              </label>
            </div>
          )}

          {selectedTreatmentIds.length > 0 && (
            <p className="text-xs text-taupe">
              {selectedTreatmentIds.length === 1
                ? "מציג לקוחות שביצעו את הטיפול הנבחר."
                : treatmentOperator === "AND"
                  ? "מציג לקוחות שביצעו את כל הטיפולים שנבחרו."
                  : "מציג לקוחות שביצעו לפחות אחד מהטיפולים שנבחרו."}
              {" "}
              <button
                type="button"
                onClick={() => {
                  setSelectedTreatmentIds([]);
                  triggerFetch(trimmedQuery, genderFilter, [], treatmentOperator, extra, 0);
                }}
                className="text-gold-dark underline-offset-2 hover:underline"
              >
                נקה בחירה
              </button>
            </p>
          )}
        </div>
      )}

      {/* ═══ פילטרים נוספים — משימה 3.9 (FR-CL-07) ═══════════════════════ */}
      <div className="rounded-lg border border-gold-antique/30">
        {/* כותרת/כפתור פתיחה */}
        <button
          type="button"
          aria-expanded={showExtraFilters}
          aria-controls="extra-filters-panel"
          onClick={() => setShowExtraFilters((v) => !v)}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm font-medium text-charcoal",
            "transition-colors hover:bg-champagne/60",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1",
            showExtraFilters ? "rounded-b-none" : ""
          )}
        >
          <span className="flex items-center gap-2">
            פילטרים נוספים
            {extraHasValue(extra) && (
              <span className="rounded-full bg-gold-dark px-2 py-0.5 text-xs font-semibold text-champagne">
                פעיל
              </span>
            )}
          </span>
          {/* חץ — מתהפך עם RTL */}
          <span
            aria-hidden="true"
            className={cn(
              "text-taupe transition-transform duration-200",
              showExtraFilters ? "rotate-180" : ""
            )}
          >
            ▼
          </span>
        </button>

        {/* תוכן הפאנל */}
        {showExtraFilters && (
          <div
            id="extra-filters-panel"
            className="flex flex-col gap-5 rounded-b-lg border-t border-gold-antique/30 bg-porcelain/60 p-4"
          >
            {/* ── שורה 1: טווח ביקור אחרון ── */}
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-charcoal">
                תאריך ביקור אחרון
              </legend>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-xs text-taupe">מתאריך</span>
                  <input
                    type="date"
                    value={extra.lastVisitFrom}
                    max={extra.lastVisitTo || undefined}
                    onChange={(e) =>
                      handleExtraChange({ lastVisitFrom: e.target.value }, 0)
                    }
                    className={cn(
                      "h-11 w-full rounded-lg border border-gold-antique/40 bg-porcelain px-3 text-sm text-charcoal",
                      "focus:outline-none focus:ring-2 focus:ring-gold-dark focus:ring-offset-1"
                    )}
                    aria-label="ביקור אחרון מתאריך"
                  />
                </label>
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-xs text-taupe">עד תאריך</span>
                  <input
                    type="date"
                    value={extra.lastVisitTo}
                    min={extra.lastVisitFrom || undefined}
                    onChange={(e) =>
                      handleExtraChange({ lastVisitTo: e.target.value }, 0)
                    }
                    className={cn(
                      "h-11 w-full rounded-lg border border-gold-antique/40 bg-porcelain px-3 text-sm text-charcoal",
                      "focus:outline-none focus:ring-2 focus:ring-gold-dark focus:ring-offset-1"
                    )}
                    aria-label="ביקור אחרון עד תאריך"
                  />
                </label>
              </div>
            </fieldset>

            {/* ── שורה 2: "לא ביקר מעל X ימים" ── */}
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-charcoal">
                לא ביקר/ה מעל X ימים
              </span>
              <span className="text-xs text-taupe">
                כולל לקוחות שלא ביקרו כלל — השאר ריק לביטול פילטר זה
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={extra.notVisitedDays}
                  onChange={(e) =>
                    handleExtraChange({ notVisitedDays: e.target.value }, TEXT_DEBOUNCE_MS)
                  }
                  placeholder="לדוגמה: 60"
                  className={cn(
                    "h-11 w-32 rounded-lg border border-gold-antique/40 bg-porcelain px-3 text-sm text-charcoal",
                    "focus:outline-none focus:ring-2 focus:ring-gold-dark focus:ring-offset-1"
                  )}
                  aria-label="לא ביקר/ה מעל כמה ימים"
                />
                <span className="text-sm text-taupe">ימים</span>
              </div>
            </label>

            {/* ── שורה 3: טווח גילאים ── */}
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-charcoal">
                טווח גילאים
              </legend>
              <p className="text-xs text-taupe">
                מחושב מתאריך לידה — לקוחות ללא תאריך לידה לא ייכללו בפילטר זה
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-xs text-taupe">גיל מינימלי</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={120}
                    value={extra.ageMin}
                    onChange={(e) =>
                      handleExtraChange({ ageMin: e.target.value }, TEXT_DEBOUNCE_MS)
                    }
                    placeholder="למשל: 18"
                    className={cn(
                      "h-11 w-full rounded-lg border border-gold-antique/40 bg-porcelain px-3 text-sm text-charcoal",
                      "focus:outline-none focus:ring-2 focus:ring-gold-dark focus:ring-offset-1"
                    )}
                    aria-label="גיל מינימלי"
                  />
                </label>
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-xs text-taupe">גיל מקסימלי</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={120}
                    value={extra.ageMax}
                    onChange={(e) =>
                      handleExtraChange({ ageMax: e.target.value }, TEXT_DEBOUNCE_MS)
                    }
                    placeholder="למשל: 65"
                    className={cn(
                      "h-11 w-full rounded-lg border border-gold-antique/40 bg-porcelain px-3 text-sm text-charcoal",
                      "focus:outline-none focus:ring-2 focus:ring-gold-dark focus:ring-offset-1"
                    )}
                    aria-label="גיל מקסימלי"
                  />
                </label>
              </div>
            </fieldset>

            {/* ── שורה 4: מקור הגעה ── */}
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-charcoal">
                מקור הגעה
              </span>
              <Input
                type="text"
                value={extra.source}
                onChange={(e) =>
                  handleExtraChange({ source: e.target.value }, TEXT_DEBOUNCE_MS)
                }
                placeholder='לדוגמה: instagram, landing_page, direct'
                className="h-11 bg-porcelain text-base"
                aria-label="סינון לפי מקור הגעה"
              />
            </label>

            {/* ── שורה 5: תגיות ── */}
            {tags.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-charcoal">
                  סינון לפי תגית
                </span>
                <p className="text-xs text-taupe">
                  מציג לקוחות שיש להם את כל התגיות שנבחרו
                </p>
                <div
                  role="group"
                  aria-label="סינון לפי תגיות"
                  className="flex flex-wrap gap-1.5"
                >
                  {tags.map((tag) => {
                    const checked = extra.tagIds.includes(tag.id);
                    return (
                      <label
                        key={tag.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                          "focus-within:ring-2 focus-within:ring-gold-dark focus-within:ring-offset-1",
                          "min-h-11",
                          checked
                            ? "border-gold-dark bg-gold-dark/10 text-charcoal"
                            : "border-gold-antique/30 bg-champagne text-charcoal hover:border-gold-dark/60"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-gold-dark"
                          checked={checked}
                          onChange={() => handleTagToggle(tag.id)}
                          aria-label={`סנן לפי תגית: ${tag.name}`}
                        />
                        <span>{tag.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── שורה 6: מטפל/ת ── */}
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-charcoal">
                מטפל/ת
              </span>
              <Input
                type="text"
                value={extra.therapist}
                onChange={(e) =>
                  handleExtraChange({ therapist: e.target.value }, TEXT_DEBOUNCE_MS)
                }
                placeholder="שם המטפל/ת (חיפוש חלקי)"
                className="h-11 bg-porcelain text-base"
                aria-label="סינון לפי שם מטפל/ת"
              />
            </label>

            {/* ── שורה 7: סטטוס הסכמה לדיוור ── */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-charcoal">
                סטטוס הסכמה לדיוור
              </span>
              <div
                role="group"
                aria-label="סינון לפי סטטוס הסכמה לדיוור"
                className="flex flex-wrap gap-1.5"
              >
                {CONSENT_CHANNEL_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value || "all-consent"}
                    type="button"
                    aria-pressed={extra.consentChannel === value}
                    onClick={() =>
                      handleExtraChange({ consentChannel: value }, 0)
                    }
                    className={cn(
                      "min-h-11 rounded-lg border px-4 text-sm font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1",
                      extra.consentChannel === value
                        ? "border-gold-dark bg-gold-dark text-champagne"
                        : "border-gold-antique/40 bg-porcelain text-charcoal hover:border-gold-dark/60 hover:bg-champagne"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* כפתור ניקוי כל הפילטרים הנוספים */}
            {extraHasValue(extra) && (
              <div className="border-t border-gold-antique/20 pt-3">
                <button
                  type="button"
                  onClick={handleClearExtra}
                  className="text-sm text-gold-dark underline-offset-2 hover:underline"
                >
                  נקה את כל הפילטרים הנוספים
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* הודעת שגיאה */}
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      {/* מונה תוצאות */}
      <p className="text-sm text-taupe" aria-live="polite">
        {loading
          ? "מחפש…"
          : `נמצאו ${clients.length} לקוחות${hasFilter ? " התואמים לפילטר" : ""}${someSelected ? ` — ${selectedClientIds.length} נבחרו` : ""}`}
      </p>

      {/* ═══ פעולות קבוצתיות — משימה 3.12 (FR-CL-10) ══════════════════════ */}
      {someSelected && (
        <div
          role="region"
          aria-label="פעולות קבוצתיות על הלקוחות שנבחרו"
          className="flex flex-col gap-3 rounded-lg border border-gold-dark/40 bg-champagne/70 p-3"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-charcoal">
              פעולות קבוצתיות ({selectedClientIds.length} לקוחות נבחרו)
            </span>

            {/* כפתור "הוסף תגית" */}
            <button
              type="button"
              onClick={() => {
                setShowBulkTagPicker((v) => !v);
                setBulkTagError(null);
              }}
              className={cn(
                "min-h-11 rounded-lg border px-4 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1",
                showBulkTagPicker
                  ? "border-gold-dark bg-gold-dark text-champagne"
                  : "border-gold-dark/60 bg-porcelain text-charcoal hover:bg-champagne"
              )}
              aria-expanded={showBulkTagPicker}
            >
              + הוסף תגית
            </button>

            {/* כפתור "ייצוא CSV" — אדמין בלבד (placeholder) */}
            {/* TODO: restrict to admin role — בדיקת תפקיד תמומש בתחום הרשאות נפרד */}
            <button
              type="button"
              onClick={handleExportCsv}
              className={cn(
                "min-h-11 rounded-lg border border-gold-antique/40 bg-porcelain px-4 text-sm font-medium text-charcoal",
                "transition-colors hover:bg-champagne",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1"
              )}
              title="ייצוא כל התוצאות המסוננות ל-CSV"
            >
              ייצוא CSV
              <span className="me-1 ms-2 rounded bg-gold-dark/15 px-1.5 py-0.5 text-xs text-gold-dark">
                אדמין בלבד
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedClientIds([])}
              className="text-sm text-taupe underline-offset-2 hover:underline"
            >
              בטל בחירה
            </button>
          </div>

          {/* בחירת תגית */}
          {showBulkTagPicker && (
            <div className="flex flex-col gap-2 rounded-lg border border-gold-antique/30 bg-porcelain p-3">
              <span className="text-sm font-medium text-charcoal">
                בחר תגית להוסיף ל-{selectedClientIds.length} לקוחות:
              </span>
              {tags.length === 0 ? (
                <p className="text-sm text-taupe">אין תגיות מוגדרות במערכת.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <label
                      key={tag.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                        "focus-within:ring-2 focus-within:ring-gold-dark focus-within:ring-offset-1",
                        "min-h-11",
                        selectedTagId === tag.id
                          ? "border-gold-dark bg-gold-dark/10 text-charcoal"
                          : "border-gold-antique/30 bg-champagne text-charcoal hover:border-gold-dark/60"
                      )}
                    >
                      <input
                        type="radio"
                        name="bulk-tag-select"
                        value={tag.id}
                        checked={selectedTagId === tag.id}
                        onChange={() => setSelectedTagId(tag.id)}
                        className="h-4 w-4 accent-gold-dark"
                        aria-label={`בחר תגית: ${tag.name}`}
                      />
                      <span>{tag.name}</span>
                    </label>
                  ))}
                </div>
              )}
              {bulkTagError && (
                <p role="alert" className="text-xs text-error">
                  {bulkTagError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleBulkAddTag()}
                  disabled={!selectedTagId || bulkTagging}
                  className={cn(
                    "min-h-11 rounded-lg bg-gold-dark px-4 text-sm font-medium text-champagne",
                    "transition-colors hover:bg-gold-deep disabled:opacity-60",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1"
                  )}
                >
                  {bulkTagging ? "מוסיף…" : "הוסף תגית"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkTagPicker(false);
                    setSelectedTagId("");
                    setBulkTagError(null);
                  }}
                  className={cn(
                    "min-h-11 rounded-lg border border-gold-antique/40 bg-porcelain px-4 text-sm font-medium text-charcoal",
                    "transition-colors hover:bg-champagne",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1"
                  )}
                >
                  ביטול
                </button>
              </div>
            </div>
          )}

          {/* הודעת הצלחה לאחר הוספת תגית */}
          {bulkTagSuccess && (
            <p role="status" className="text-xs text-success">
              {bulkTagSuccess}
            </p>
          )}
        </div>
      )}

      {/* טבלת לקוחות */}
      <div className="overflow-hidden rounded-lg border border-gold-antique/30 bg-porcelain">
        <Table>
          <TableHeader>
            <TableRow className="border-gold-antique/30">
              {/* עמודת בחירה — checkbox "בחר הכל" */}
              <TableHead className="w-12 text-charcoal">
                <label className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-gold-dark"
                    checked={allCurrentSelected}
                    onChange={toggleSelectAll}
                    disabled={clients.length === 0}
                    aria-label={
                      allCurrentSelected ? "בטל בחירת כולם" : "בחר את כל הלקוחות"
                    }
                    title={
                      allCurrentSelected ? "בטל בחירת כולם" : "בחר הכל"
                    }
                  />
                </label>
              </TableHead>
              <TableHead className="text-charcoal">שם</TableHead>
              <TableHead className="text-charcoal">טלפון</TableHead>
              <TableHead className="hidden text-charcoal sm:table-cell">
                עיר
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-6 text-center text-sm text-taupe"
                >
                  {hasFilter
                    ? "לא נמצאו לקוחות התואמים לפילטר."
                    : "אין לקוחות פעילים במערכת עדיין."}
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client) => {
                const isSelected = selectedClientIds.includes(client.id);
                return (
                  <TableRow
                    key={client.id}
                    className={cn(
                      "border-gold-antique/20",
                      isSelected && "bg-gold-dark/5"
                    )}
                  >
                    {/* תא checkbox לבחירה */}
                    <TableCell className="w-12">
                      <label className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-gold-dark"
                          checked={isSelected}
                          onChange={() => toggleSelectClient(client.id)}
                          aria-label={`בחר לקוח/ה: ${client.firstName} ${client.lastName}`}
                        />
                      </label>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-charcoal">
                      <Link
                        href={`/clients/${client.id}`}
                        className="hover:underline"
                      >
                        {client.firstName} {client.lastName}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-charcoal">
                      <bdi>{client.phone}</bdi>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-taupe sm:table-cell">
                      {client.city || "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
