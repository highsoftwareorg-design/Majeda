"use client";

/**
 * כפתור "שלח קמפיין" + מודאל אישור (השלמת wiring — משימה 11.9, FR-MK-04).
 *
 * שולח POST /api/campaigns/:id/send (הקיים, ללא שינוי חוזה) רק לאחר אישור מפורש במודאל.
 * המודאל מציג את ספירת הנמענים התקינים (`recipientCount` — מ-getSegmentRecipients בשרת,
 * אותו מקור כמו "ספירת נמענים" בעמוד).
 *
 * הערה (פרטיות — §11): אין הדפסת שמות/טלפונים ללוג או לממשק — רק הספירה.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { campaignStatusClasses, campaignStatusLabel } from "@/lib/campaigns/status";

/** סטטוסים שממנו מותר להפעיל שליחה — זהה ל-SENDABLE_STATUSES ב-API */
const SENDABLE_STATUSES = ["DRAFT", "SCHEDULED"];

export interface CampaignSendButtonProps {
  campaignId: string;
  /** סטטוס הקמפיין הנוכחי (מהשרת) */
  status: string;
  /** מספר הנמענים התקינים לשליחה (מ-9.4) */
  recipientCount: number;
}

type SendState =
  | { phase: "idle" }
  | { phase: "sending" }
  | { phase: "error"; message: string }
  | { phase: "success"; status: string };

export function CampaignSendButton({ campaignId, status, recipientCount }: CampaignSendButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sendState, setSendState] = useState<SendState>({ phase: "idle" });
  const [currentStatus, setCurrentStatus] = useState(status);

  const sending = sendState.phase === "sending";
  const canSend = SENDABLE_STATUSES.includes(currentStatus);
  const hasRecipients = recipientCount > 0;

  function handleOpenChange(next: boolean) {
    // אי אפשר לסגור את המודאל בזמן שליחה פעילה
    if (sending) return;
    setOpen(next);
    if (!next && sendState.phase === "error") setSendState({ phase: "idle" });
  }

  async function confirmSend() {
    setSendState({ phase: "sending" });
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/send`, { method: "POST" });
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { campaign?: { status?: string } }
          | null;
        const newStatus = data?.campaign?.status ?? "SENDING";
        setCurrentStatus(newStatus);
        setSendState({ phase: "success", status: newStatus });
        setOpen(false);
        // רענון השרת — מעדכן את תג הסטטוס בכותרת העמוד
        router.refresh();
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setSendState({
          phase: "error",
          message: data?.error ?? "שליחת הקמפיין נכשלה. נסו שוב.",
        });
      }
    } catch {
      setSendState({ phase: "error", message: "שגיאת רשת בשליחת הקמפיין. נסו שוב." });
    }
  }

  // לאחר שליחה מוצלחת — מציגים אישור במקום הכפתור
  if (sendState.phase === "success") {
    return (
      <p role="status" className="text-sm text-green-800">
        הקמפיין הועבר לשליחה (סטטוס: {campaignStatusLabel(sendState.status)}). ההודעות יישלחו בסבב השליחה הבא.
      </p>
    );
  }

  if (!canSend) {
    return (
      <p className="text-sm text-taupe">
        סטטוס הקמפיין:{" "}
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${campaignStatusClasses(currentStatus)}`}>
          {campaignStatusLabel(currentStatus)}
        </span>
      </p>
    );
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 w-full gap-2 sm:w-fit"
      >
        <Megaphone aria-hidden="true" className="size-4" />
        שלח קמפיין
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>לשלוח את הקמפיין?</DialogTitle>
            <DialogDescription>
              {hasRecipients
                ? `ההודעה תישלח ל-${recipientCount} נמענים תקינים (לקוחות פעילים עם הסכמה לדיוור).`
                : "אין כרגע נמענים תקינים לקמפיין זה, ולכן אין מה לשלוח."}
            </DialogDescription>
          </DialogHeader>

          {sendState.phase === "error" && (
            <p role="alert" className="text-sm text-red-800">
              {sendState.message}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={sending}
              className="min-h-11 w-full sm:w-auto"
            >
              ביטול
            </Button>
            <Button
              type="button"
              onClick={confirmSend}
              disabled={sending || !hasRecipients}
              className="min-h-11 w-full sm:w-auto"
            >
              {sending ? "שולח…" : "אישור ושליחה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CampaignSendButton;
