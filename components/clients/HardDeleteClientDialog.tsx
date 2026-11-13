"use client";

/**
 * כפתור + דיאלוג "מחיקה לצמיתות" ללקוח/ה — משימה 12.2 (§12).
 *
 * עוטף את `HardDeleteDialog` המשותף (12.1) ומבצע `DELETE /api/clients/:id/hard-delete`.
 * הכפתור נבדל מ"העברה לארכיון" (אדום, עם מסגרת) — מחיקה לצמיתות אינה הפיכה.
 * לאחר הצלחה מנווטים לרשימת הלקוחות ומרעננים.
 *
 * הערה (פרטיות — §11): אין להדפיס ללוג פרטי לקוח.
 * לאחר הצלחה מוצגת הודעת toast "הלקוח/ה … נמחק/ה לצמיתות" (`useToast`, Provider ב-AdminShell).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { HardDeleteDialog } from "@/components/common/HardDeleteDialog";
import { useToast } from "@/components/common/Toast";
import { cn } from "@/lib/utils";

export function HardDeleteClientDialog({
  client,
}: {
  client: { id: string; firstName: string; lastName: string };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullName = `${client.firstName} ${client.lastName}`;

  async function handleHardDelete(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/clients/${client.id}/hard-delete`, {
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
      toast(`הלקוח/ה ${fullName} נמחק/ה לצמיתות`);
      router.push("/clients");
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
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-lg border border-error/50 bg-error/5 px-4 text-sm font-semibold text-error",
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
              הלקוח/ה {fullName} יימחק/תימחק לצמיתות, יחד עם כל הרשומות הקשורות:
            </p>
            <ul className="list-disc ps-5 space-y-0.5">
              <li>כל התורים של הלקוח/ה</li>
              <li>כל הביקורים, כולל פירוט הטיפולים שתועדו בהם</li>
              <li>
                הטפסים החתומים — הרשומות יימחקו, וקובצי ה-PDF יישארו באחסון
                לניקוי ידני
              </li>
              <li>כל ההודעות, המעקבים והמשימות של הלקוח/ה</li>
            </ul>
            <p className="text-xs text-taupe">
              מומלץ להעביר לארכיון במקום מחיקה, אם ייתכן שתידרש ההיסטוריה בעתיד.
            </p>
          </>
        }
        confirmPhrase={fullName}
        onConfirm={handleHardDelete}
        submitting={submitting}
        error={error}
      />
    </>
  );
}
