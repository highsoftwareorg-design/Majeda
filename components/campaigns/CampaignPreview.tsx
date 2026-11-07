"use client";

/**
 * תצוגה מקדימה של הודעת הקמפיין + שליחת בדיקה לאדמין (משימה 9.3, FR-MK-02).
 *
 * מציג את גוף התבנית עם ערכי דוגמה (שרה לוי, התאריך של היום וכו'),
 * וכפתור "שלח בדיקה" שפונה ל-POST /api/campaigns/[id]/test.
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  buildSampleVariables,
  extractPlaceholders,
  renderTemplateBody,
} from "@/lib/campaigns/preview";

export interface CampaignPreviewProps {
  campaignId: string;
  /** גוף התבנית עם placeholder-ים בפורמט {שם_משתנה} */
  body: string;
}

type TestState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "success" }
  | { status: "error"; message: string };

export function CampaignPreview({ campaignId, body }: CampaignPreviewProps) {
  const [testState, setTestState] = useState<TestState>({ status: "idle" });

  const previewText = useMemo(
    () => renderTemplateBody(body, buildSampleVariables(extractPlaceholders(body))),
    [body]
  );

  async function sendTest() {
    setTestState({ status: "sending" });
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/test`, { method: "POST" });
      if (res.ok) {
        setTestState({ status: "success" });
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setTestState({
          status: "error",
          message: data?.error ?? "שליחת הבדיקה נכשלה",
        });
      }
    } catch {
      setTestState({ status: "error", message: "שגיאת רשת בשליחת הבדיקה" });
    }
  }

  const sending = testState.status === "sending";

  return (
    <section
      aria-labelledby="campaign-preview-title"
      className="flex flex-col gap-4 rounded-xl border border-hairline-dark bg-champagne p-4 sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="campaign-preview-title" className="font-heading text-lg text-charcoal">
          תצוגה מקדימה
        </h2>
        <p className="text-sm text-taupe">
          כך תיראה ההודעה לנמען לדוגמה (שרה לוי). השדות מתמלאים בערכים לדוגמה בלבד.
        </p>
      </div>

      <div
        dir="rtl"
        lang="he"
        className="max-w-full rounded-2xl rounded-se-sm bg-white p-4 text-start text-sm leading-7 whitespace-pre-line text-charcoal shadow-sm break-words"
      >
        {previewText}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-taupe">
          הבדיקה תישלח למספר האדמין בלבד ולא ללקוחות.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={sendTest}
          disabled={sending}
          className="min-h-11 w-full sm:w-auto"
        >
          {sending ? "שולח בדיקה…" : "שלח בדיקה"}
        </Button>
      </div>

      {testState.status === "success" && (
        <p role="status" className="text-sm text-green-800">
          הבדיקה נשלחה למספר האדמין.
        </p>
      )}
      {testState.status === "error" && (
        <p role="alert" className="text-sm text-red-800">
          {testState.message}
        </p>
      )}
    </section>
  );
}
