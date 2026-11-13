"use client";

/**
 * דיאלוג "מחיקה לצמיתות" משותף — משימה 12.1 (§12, היקף מאושר ע"י הבעלים).
 *
 * בסיס משותף ל-12.2–12.5 (לקוחות, טיפולים, תורים, תבניות הסכמה).
 * - הדיאלוג **אינו** קורא ל-API בעצמו: הקורא מספק `onConfirm` (fetch + redirect/refresh שלו).
 * - כפתור המחיקה מנוטרל עד שהמשתמש/ת מקליד/ה בדיוק את `confirmPhrase` (שם האובייקט או "מחק") —
 *   הגנה מפני מחיקה בשוגג; חמור יותר מדיאלוג הארכוב (`ArchiveClientDialog`).
 * - `onConfirm` נקרא רק לאחר שהמחרוזת תואמת. בזמן `submitting` אי אפשר לסגור את הדיאלוג.
 *
 * **אבטחה (§11) — חובה לכל נתיב מחיקה:** כל נתיב `/api/*` שמבצע מחיקה לצמיתות חייב לבדוק session
 * (כמו שאר נתיבי הניהול). אין RBAC — לפי החלטת הבעלים מספיק אימות כניסה בלבד.
 * המחיקה כולה ב-`prisma.$transaction` יחיד (אטומיות). לא מדפיסים PII ללוג.
 *
 * הערה: הדיאלוג אינו מציג מפתחות R2 או פרטי לקוח/ה מעבר למה שהקורא מעביר ב-`warningBody`.
 */

import { useEffect, useId, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface HardDeleteDialogProps {
  /** שליטה חיצונית על פתיחת הדיאלוג (הקורא מחזיק את ה-state ואת הטריגר). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** כותרת הדיאלוג. ברירת מחדל: "מחיקה לצמיתות". */
  title?: string;
  /** פירוט דינמי של מה יימחק בנוסף (cascade) — מועבר מהקורא. */
  warningBody: ReactNode;
  /** מחרוזת שחייבת להיות מוקלדת לפני שכפתור המחיקה נפתח (שם האובייקט או "מחק"). */
  confirmPhrase: string;
  /** נקרא רק לאחר אישור מלא. הקורא אחראי על ה-fetch וה-redirect/refresh. */
  onConfirm: () => void | Promise<void>;
  /** האם הפעולה בתהליך — מנטרל את הכפתורים ומונע סגירה. */
  submitting?: boolean;
  /** הודעת שגיאה מהקורא (למשל כשל רשת או תשובת שרת). */
  error?: string | null;
}

export function HardDeleteDialog({
  open,
  onOpenChange,
  title = "מחיקה לצמיתות",
  warningBody,
  confirmPhrase,
  onConfirm,
  submitting = false,
  error = null,
}: HardDeleteDialogProps) {
  const [typed, setTyped] = useState("");
  const inputId = useId();
  const hintId = useId();

  const expected = confirmPhrase.trim();
  // מחרוזת ריקה לא תאפשר מחיקה (הגנה: confirmPhrase חסר ⇒ הכפתור נשאר נעול).
  const matches = expected !== "" && typed.trim() === expected;

  // איפוס שדה האישור בכל סגירה, כדי שפתיחה חוזרת תדרוש הקלדה מחדש.
  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  function handleOpenChange(next: boolean): void {
    if (submitting) return;
    onOpenChange(next);
  }

  async function handleConfirm(): Promise<void> {
    if (!matches || submitting) return;
    await onConfirm();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent role="alertdialog">
        <DialogHeader>
          <DialogTitle className="text-error">{title}</DialogTitle>
          <DialogDescription className="font-semibold text-error">
            פעולה בלתי הפיכה — לא ניתן לשחזר
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 rounded-lg border border-error/40 bg-error/5 p-3 text-sm text-charcoal">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-error"
          />
          <div className="flex min-w-0 flex-col gap-1">{warningBody}</div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={inputId} className="text-sm text-charcoal">
            להמשך, הקלידו{" "}
            <bdi className="font-semibold">{expected || "—"}</bdi> בשדה למטה
          </label>
          <input
            id={inputId}
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            disabled={submitting}
            aria-describedby={hintId}
            className={cn(
              "min-h-11 w-full rounded-lg border border-gold-antique/40 bg-porcelain px-3 text-base text-charcoal",
              "placeholder:text-taupe disabled:opacity-60",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-1"
            )}
          />
          <p id={hintId} className="text-xs text-taupe">
            הכפתור &quot;מחק לצמיתות&quot; יופעל רק לאחר הקלדה מדויקת של המחרוזת.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <button
              type="button"
              disabled={submitting}
              className={cn(
                "min-h-11 w-full rounded-lg border border-gold-antique/40 bg-porcelain px-4 text-sm font-medium text-charcoal sm:w-auto",
                "transition-colors hover:bg-champagne disabled:opacity-60",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1"
              )}
            >
              ביטול
            </button>
          </DialogClose>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!matches || submitting}
            className={cn(
              "min-h-11 w-full rounded-lg bg-error px-4 text-sm font-semibold text-white sm:w-auto",
              "transition-colors hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-1"
            )}
          >
            {submitting ? "מוחק לצמיתות…" : "מחק לצמיתות"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
