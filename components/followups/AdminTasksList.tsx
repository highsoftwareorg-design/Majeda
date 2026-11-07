"use client";

/**
 * רשימת משימות "להתקשר היום" לאדמין (משימה 8.6, FR-FU-04/06).
 *
 * כל משימה מציגה: שם לקוחה, טלפון, תאריך מעקב ונוסח ההנחיה לאדמין.
 * פעולות (PATCH /api/admin-tasks/:id):
 *   - נקבע תור        → action "booked"
 *   - לא ענה/תה       → action "no_answer" (נדחה ב-48 שעות)
 *   - לא מעוניין/ת    → action "not_interested"
 * לאחר הצלחה המשימה מוסרת מהרשימה.
 *
 * RTL, עברית, mobile-responsive (כפתורים ≥44px, עמודה אחת במובייל).
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";

export interface AdminTaskItem {
  id: string;
  clientName: string;
  phone: string;
  /** תאריך המעקב, מעוצב מראש בשרת (DD/MM/YYYY) */
  followUpDate: string;
  adminNote: string | null;
}

type AdminTaskAction = "booked" | "no_answer" | "not_interested";

const ACTION_BUTTONS: { action: AdminTaskAction; label: string; variant: "default" | "outline" }[] = [
  { action: "booked", label: "נקבע תור", variant: "default" },
  { action: "no_answer", label: "לא ענה/תה", variant: "outline" },
  { action: "not_interested", label: "לא מעוניין/ת", variant: "outline" },
];

interface AdminTasksListProps {
  initialTasks: AdminTaskItem[];
}

export function AdminTasksList({ initialTasks }: AdminTasksListProps) {
  const [tasks, setTasks] = useState<AdminTaskItem[]>(initialTasks);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(taskId: string, action: AdminTaskAction) {
    setError(null);
    setBusyId(taskId);
    try {
      const res = await fetch(`/api/admin-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "שגיאה בעדכון המשימה — נסה שוב");
        return;
      }
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch {
      setError("שגיאת רשת — נסה שוב");
    } finally {
      setBusyId(null);
    }
  }

  if (tasks.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-taupe/40 p-6 text-center text-taupe">
        אין משימות פתוחות להיום.
      </p>
    );
  }

  return (
    <section aria-label="רשימת משימות" className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-4">
        {tasks.map((task) => {
          const isBusy = busyId === task.id;
          return (
            <li
              key={task.id}
              className="flex flex-col gap-4 rounded-xl border border-taupe/20 bg-porcelain p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-col gap-1">
                <h2 className="font-heading text-lg text-charcoal">{task.clientName}</h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-taupe">
                  <span>
                    טלפון:{" "}
                    <bdi dir="ltr" className="font-medium text-charcoal">
                      {task.phone}
                    </bdi>
                  </span>
                  <span>
                    תאריך מעקב:{" "}
                    <span className="font-medium text-charcoal">{task.followUpDate}</span>
                  </span>
                </div>
              </div>

              <p className="text-sm text-charcoal">
                <span className="font-medium">הנחיה לאדמין: </span>
                {task.adminNote ?? "אין הנחיה מיוחדת"}
              </p>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {ACTION_BUTTONS.map(({ action, label, variant }) => (
                  <Button
                    key={action}
                    type="button"
                    variant={variant}
                    disabled={isBusy}
                    onClick={() => handleAction(task.id, action)}
                    className="min-h-11 w-full sm:w-auto"
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
