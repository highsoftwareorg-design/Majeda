"use client";

/**
 * דיאלוג "מחיקה לצמיתות" לתור ביומן — משימה 12.4 (§12).
 *
 * עוטף את `HardDeleteDialog` המשותף (12.1) ומבצע `DELETE /api/appointments/:id`.
 * הטופסים החתומים ינותקו (יישארו אצל הלקוח/ה), היסטוריית הסטטוס ודריסות ההסכמה יימחקו.
 * לאחר הצלחה נקראת `onDeleted` (היומן מסיר את התור מהתצוגה) ומוצגת הודעת toast.
 *
 * הרכיב מבוקר מבחוץ: `appointment` = null ⇒ הדיאלוג סגור.
 *
 * הערה (פרטיות — §11): אין להדפיס ללוג PII.
 */

import { useState } from "react";
import { HardDeleteDialog } from "@/components/common/HardDeleteDialog";
import { useToast } from "@/components/common/Toast";

/** מבנה מינימלי של תור הנדרש לדיאלוג (תואם ל-SerializedAppointment של היומן). */
export type HardDeleteAppointmentTarget = {
  id: string;
  client: { firstName: string; lastName: string };
  treatment: { name: string } | null;
  startTime: string; // ISO 8601
};

/** מילת האישור שחייבת להיקלד — לתור אין שם ייחודי, לכן משתמשים במילה "מחק". */
export const HARD_DELETE_APPOINTMENT_CONFIRM_PHRASE = "מחק";

interface HardDeleteAppointmentDialogProps {
  appointment: HardDeleteAppointmentTarget | null;
  onClose: () => void;
  onDeleted: (appointmentId: string) => void;
}

export function HardDeleteAppointmentDialog({
  appointment,
  onClose,
  onDeleted,
}: HardDeleteAppointmentDialogProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleHardDelete(): Promise<void> {
    if (!appointment) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "אירעה שגיאה במחיקה לצמיתות — נא לנסות שוב");
        return;
      }
      setError(null);
      onDeleted(appointment.id);
      onClose();
      toast("התור נמחק לצמיתות מהיומן");
    } catch {
      setError("שגיאת רשת — נא לנסות שוב");
    } finally {
      setSubmitting(false);
    }
  }

  const clientName = appointment
    ? `${appointment.client.firstName} ${appointment.client.lastName}`.trim()
    : "";
  const whenLabel = appointment
    ? new Date(appointment.startTime).toLocaleString("he-IL", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <HardDeleteDialog
      open={appointment !== null}
      onOpenChange={(next) => {
        if (!next) {
          setError(null);
          onClose();
        }
      }}
      warningBody={
        <>
          <p className="font-semibold">
            התור של <bdi>{clientName}</bdi>
            {appointment?.treatment?.name && (
              <>
                {" "}— <bdi>{appointment.treatment.name}</bdi>
              </>
            )}{" "}
            ב-<bdi>{whenLabel}</bdi> יימחק לצמיתות מהיומן, יחד עם:
          </p>
          <ul className="list-disc ps-5 space-y-0.5">
            <li>
              היסטוריית הסטטוס ודריסות ההסכמה של התור יימחקו; טפסים חתומים
              ינותקו ויישמרו
            </li>
          </ul>
        </>
      }
      confirmPhrase={HARD_DELETE_APPOINTMENT_CONFIRM_PHRASE}
      onConfirm={handleHardDelete}
      submitting={submitting}
      error={error}
    />
  );
}
