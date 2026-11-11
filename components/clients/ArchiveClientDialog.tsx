"use client";

/**
 * דיאלוג "העברה לארכיון" — משימה 11.6 (FR-CL-01, §11.2).
 *
 * שולח `DELETE /api/clients/:id` הקיים — מחיקה רכה בלבד (`status="archived"`
 * + `archivedAt`), הרשומה לא נמחקת פיזית. לאחר הצלחה הלקוח/ה נעלם/ת מהרשימה
 * הפעילה, ולכן מנווטים לרשימת הלקוחות (פרופיל מאורכב מחזיר 404).
 * שחזור מתבצע מתצוגת הארכיון ברשימת הלקוחות (`POST /api/clients/:id/restore`).
 *
 * הערה (פרטיות — §11): אין להדפיס ללוג פרטי לקוח.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function ArchiveClientDialog({
  client,
}: {
  client: { id: string; firstName: string; lastName: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleArchive(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/clients/${client.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "אירעה שגיאה בהעברה לארכיון — נא לנסות שוב");
        return;
      }
      setOpen(false);
      router.push("/clients");
      router.refresh();
    } catch {
      setError("שגיאת רשת — נא לנסות שוב");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return;
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-lg border border-gold-antique/40 bg-porcelain px-4 text-sm font-medium text-charcoal",
            "transition-colors hover:bg-champagne",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1"
          )}
        >
          <Archive className="h-4 w-4 shrink-0" aria-hidden="true" />
          העברה לארכיון
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>העברה לארכיון</DialogTitle>
          <DialogDescription>
            {client.firstName} {client.lastName} יוסר/תוסר מרשימת הלקוחות
            הפעילה. הפרטים והיסטוריית הטיפולים נשמרים, וניתן לשחזר את הלקוח/ה
            מהארכיון בכל עת. זו אינה מחיקה לצמיתות.
          </DialogDescription>
        </DialogHeader>

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
                "min-h-11 rounded-lg border border-gold-antique/40 bg-porcelain px-4 text-sm font-medium text-charcoal",
                "transition-colors hover:bg-champagne disabled:opacity-60",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1"
              )}
            >
              ביטול
            </button>
          </DialogClose>
          <button
            type="button"
            onClick={() => void handleArchive()}
            disabled={submitting}
            className={cn(
              "min-h-11 rounded-lg bg-gold-dark px-4 text-sm font-medium text-champagne",
              "transition-colors hover:bg-gold-deep disabled:opacity-60",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1"
            )}
          >
            {submitting ? "מעביר לארכיון…" : "העבר לארכיון"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
