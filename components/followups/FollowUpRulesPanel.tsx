"use client";

/**
 * רשימת כללי מעקב לטיפול עם מחיקה והוספה (משימה 8.2, FR-FU-01).
 *
 * מציג את הכללים הפעילים, מאפשר מחיקה רכה (DELETE — isActive=false),
 * ו"הוסף כלל" שחושף את FollowUpRuleEditor.
 *
 * RTL, עברית, mobile-responsive.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  FollowUpRuleEditor,
  type FollowUpRuleData,
} from "@/components/followups/FollowUpRuleEditor";

interface FollowUpRulesPanelProps {
  treatmentId: string;
  initialRules: FollowUpRuleData[];
}

const RECIPIENT_LABELS: Record<string, string> = {
  client: "לקוח/ה",
  admin: "אדמין",
  both: "שניהם",
};

export function FollowUpRulesPanel({
  treatmentId,
  initialRules,
}: FollowUpRulesPanelProps) {
  const [rules, setRules] = useState<FollowUpRuleData[]>(initialRules);
  const [showEditor, setShowEditor] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(ruleId: string) {
    setError(null);
    setDeletingId(ruleId);
    try {
      const res = await fetch(
        `/api/treatments/${treatmentId}/follow-up-rules/${ruleId}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "שגיאה במחיקת כלל המעקב — נסה שוב");
        return;
      }
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch {
      setError("שגיאת רשת — נסה שוב");
    } finally {
      setDeletingId(null);
    }
  }

  function handleSaved(rule: FollowUpRuleData) {
    setRules((prev) => [...prev, rule]);
    setShowEditor(false);
  }

  return (
    <section aria-labelledby="fu-rules-heading" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2
          id="fu-rules-heading"
          className="font-heading text-xl text-charcoal"
        >
          כללי מעקב
        </h2>
        {!showEditor && (
          <Button
            type="button"
            onClick={() => setShowEditor(true)}
            className="min-h-11 w-full sm:w-auto"
          >
            הוסף כלל
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {rules.length === 0 ? (
        <p className="text-sm text-taupe">אין כללי מעקב לטיפול זה.</p>
      ) : (
        <ul className="space-y-3">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex flex-col gap-3 rounded-lg border border-hairline-dark bg-white p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-charcoal break-words">{rule.name}</p>
                <p className="text-sm text-taupe">
                  לאחר {rule.offsetDays} ימים מתאריך הביקור · נמען:{" "}
                  {RECIPIENT_LABELS[rule.recipientType] ?? rule.recipientType}
                </p>
                {rule.adminNote && (
                  <p className="text-sm text-taupe break-words">
                    הנחיה לאדמין: {rule.adminNote}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDelete(rule.id)}
                disabled={deletingId === rule.id}
                aria-label={`מחיקת הכלל ${rule.name}`}
                className="min-h-11 w-full shrink-0 sm:w-auto"
              >
                {deletingId === rule.id ? "מוחק..." : "מחיקה"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {showEditor && (
        <FollowUpRuleEditor
          treatmentId={treatmentId}
          onSave={handleSaved}
          onCancel={() => setShowEditor(false)}
        />
      )}
    </section>
  );
}
