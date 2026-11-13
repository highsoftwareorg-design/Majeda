"use client";

/**
 * כפתור + דיאלוג "מחיקה לצמיתות" לטיפול בקטלוג — משימה 12.3 (§12).
 *
 * עוטף את `HardDeleteDialog` המשותף (12.1) ומבצע `DELETE /api/treatments/:id`.
 * התורים ובקשות הטיפול מנותקים (לא נמחקים); כללי המעקב ופריטי הטיפול בביקורים נמחקים.
 * לאחר הצלחה מנווטים לקטלוג ומרעננים.
 *
 * לאחר הצלחה מוצגת הודעת toast "הטיפול … נמחק לצמיתות" (`useToast`, Provider ב-AdminShell).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { HardDeleteDialog } from "@/components/common/HardDeleteDialog";
import { useToast } from "@/components/common/Toast";
import { cn } from "@/lib/utils";

export function HardDeleteTreatmentDialog({
  treatment,
}: {
  treatment: { id: string; name: string };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleHardDelete(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/treatments/${treatment.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "אירעה שגיאה במחיקה לצמיתות — נא לנסות שוב");
        return;
      }
      setOpen(false);
      toast(`הטיפול "${treatment.name}" נמחק לצמיתות מהקטלוג`);
      router.push("/treatments");
      router.refresh();
    } catch {
      setError("שגיאת רשת — נא לנסות שוב");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`מחיקה לצמיתות של ${treatment.name}`}
        className={cn(
          "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-error/50 bg-error/5 px-4 text-sm font-semibold text-error",
          "transition-colors hover:bg-error/10",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-1"
        )}
      >
        <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        מחיקה לצמיתות
      </button>

      <HardDeleteDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
        warningBody={
          <>
            <p className="font-semibold">
              הטיפול <bdi>{treatment.name}</bdi> יימחק לצמיתות מהקטלוג, יחד עם:
            </p>
            <ul className="list-disc ps-5 space-y-0.5">
              <li>
                התורים/בקשות הטיפול ינותקו (לא יימחקו) — התורים יישארו ללא טיפול
              </li>
              <li>כללי המעקב של הטיפול יימחקו</li>
              <li>פריטי הטיפול בביקורים היסטוריים יימחקו (הביקורים עצמם יישארו)</li>
            </ul>
          </>
        }
        confirmPhrase={treatment.name}
        onConfirm={handleHardDelete}
        submitting={submitting}
        error={error}
      />
    </>
  );
}
