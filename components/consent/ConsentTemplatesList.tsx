"use client";

/**
 * רשימת תבניות הסכמה (משימה 7.2, FR-CF-01).
 *
 * Client Component: מנהל את מצב "יצירה/עריכה" ורשימת התבניות.
 * מאפשר יצירת תבנית חדשה, עריכת תבנית קיימת, מחיקה רכה ומחיקה לצמיתות (12.5).
 * הרשימה כוללת גם תבניות לא-פעילות (מחיקה רכה) — עבורן זמינה רק מחיקה לצמיתות.
 * הודעות הצלחה מוצגות ב-toast (`useToast`, Provider ב-AdminShell).
 *
 * RTL, עברית, mobile-responsive.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HardDeleteDialog } from "@/components/common/HardDeleteDialog";
import { useToast } from "@/components/common/Toast";
import {
  ConsentTemplateEditor,
  type ConsentTemplateData,
} from "@/components/consent/ConsentTemplateEditor";

interface ConsentTemplatesListProps {
  initialTemplates: ConsentTemplateData[];
}

/** כינויים עבריים לשפות */
const LANGUAGE_LABELS: Record<string, string> = {
  he: "עברית",
  ar: "ערבית",
};

export function ConsentTemplatesList({
  initialTemplates,
}: ConsentTemplatesListProps) {
  const { toast } = useToast();
  const [templates, setTemplates] =
    useState<ConsentTemplateData[]>(initialTemplates);
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingTemplate, setEditingTemplate] =
    useState<ConsentTemplateData | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // מחיקה לצמיתות (12.5): התבנית שנבחרה לדיאלוג, מצב שליחה ושגיאה
  const [hardDeleteTarget, setHardDeleteTarget] =
    useState<ConsentTemplateData | null>(null);
  const [hardDeleting, setHardDeleting] = useState(false);
  const [hardDeleteError, setHardDeleteError] = useState<string | null>(null);

  /** טעינה מחודשת של הרשימה מהשרת — כולל תבניות לא-פעילות (למחיקה לצמיתות) */
  async function reloadTemplates() {
    try {
      const res = await fetch("/api/consent-templates?includeInactive=1");
      if (!res.ok) return;
      const data = (await res.json()) as { templates: ConsentTemplateData[] };
      setTemplates(data.templates);
    } catch {
      // שגיאת רשת — ממשיך עם הרשימה הקיימת
    }
  }

  /** לאחר שמירה מוצלחת */
  async function handleSave() {
    setView("list");
    setEditingTemplate(null);
    await reloadTemplates();
  }

  /** מחיקה רכה */
  async function handleDelete(id: string, name: string) {
    if (!confirm(`למחוק את תבנית "${name}"? הפעולה תסמן את התבנית כלא פעילה.`)) {
      return;
    }
    setDeletingId(id);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/consent-templates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(
          (data as Record<string, string>).error ?? "שגיאה במחיקת התבנית"
        );
        return;
      }
      toast(`התבנית "${name}" סומנה כלא פעילה`, { variant: "info" });
      await reloadTemplates();
    } catch {
      setErrorMsg("שגיאת רשת — נסי שוב");
    } finally {
      setDeletingId(null);
    }
  }

  /** מחיקה לצמיתות (12.5) — נקראת רק לאחר אישור מלא בדיאלוג */
  async function handleHardDelete(): Promise<void> {
    if (!hardDeleteTarget) return;
    setHardDeleting(true);
    setHardDeleteError(null);
    try {
      const res = await fetch(
        `/api/consent-templates/${hardDeleteTarget.id}/hard-delete`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setHardDeleteError(
          data.error ?? "אירעה שגיאה במחיקה לצמיתות — נא לנסות שוב"
        );
        return;
      }
      const deletedName = hardDeleteTarget.name;
      setHardDeleteTarget(null);
      toast(`התבנית "${deletedName}" נמחקה לצמיתות`);
      await reloadTemplates();
    } catch {
      setHardDeleteError("שגיאת רשת — נא לנסות שוב");
    } finally {
      setHardDeleting(false);
    }
  }

  /** תצוגת עורך (יצירה / עריכה) */
  if (view === "create" || view === "edit") {
    return (
      <div>
        <h2 className="font-heading text-xl text-charcoal mb-6">
          {view === "create" ? "יצירת תבנית הסכמה חדשה" : "עריכת תבנית הסכמה"}
        </h2>
        <ConsentTemplateEditor
          template={editingTemplate ?? undefined}
          onSave={handleSave}
          onCancel={() => {
            setView("list");
            setEditingTemplate(null);
          }}
        />
      </div>
    );
  }

  /** תצוגת רשימה */
  return (
    <div className="space-y-6">
      {/* כותרת + כפתור יצירה */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl text-charcoal">
            ניהול טפסי הסכמה
          </h1>
          <p className="mt-1 text-sm text-taupe">
            תבניות טפסי ההסכמה במערכת. תבניות לא-פעילות מוצגות לצורך מחיקה
            לצמיתות בלבד.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingTemplate(null);
            setView("create");
          }}
          className="min-h-[44px] bg-gold text-ink hover:bg-gold-dark shrink-0"
        >
          + צור תבנית חדשה
        </Button>
      </div>

      {/* הודעת שגיאה */}
      {errorMsg && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {errorMsg}
        </p>
      )}

      {/* רשימה ריקה */}
      {templates.length === 0 && (
        <div className="rounded-xl border border-hairline-dark bg-white px-6 py-12 text-center">
          <p className="text-taupe">אין תבניות הסכמה במערכת.</p>
          <p className="mt-1 text-sm text-taupe">
            לחצי על &quot;צור תבנית חדשה&quot; כדי להתחיל.
          </p>
        </div>
      )}

      {/* טבלת תבניות — גלילה אופקית בנייד */}
      {templates.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-hairline-dark">
          <table
            className="w-full border-collapse text-sm"
            aria-label="רשימת תבניות הסכמה"
          >
            <thead>
              <tr className="bg-champagne text-start">
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 text-start text-xs font-semibold text-charcoal"
                >
                  שם
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 text-start text-xs font-semibold text-charcoal"
                >
                  שפה
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 text-start text-xs font-semibold text-charcoal"
                >
                  טופס כללי
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 text-start text-xs font-semibold text-charcoal"
                >
                  תוקף (ימים)
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 text-start text-xs font-semibold text-charcoal"
                >
                  גרסה
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 text-start text-xs font-semibold text-charcoal"
                >
                  פעיל
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 text-start text-xs font-semibold text-charcoal"
                >
                  פעולות
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline-dark bg-white">
              {templates.map((tpl) => (
                <tr
                  key={tpl.id}
                  data-inactive={tpl.isActive ? undefined : "true"}
                  className={
                    tpl.isActive
                      ? "hover:bg-champagne/40 transition-colors"
                      : "bg-champagne/30 hover:bg-champagne/50 transition-colors"
                  }
                >
                  <td className="px-4 py-3 font-medium text-charcoal">
                    {tpl.name}
                  </td>
                  <td className="px-4 py-3 text-taupe">
                    {LANGUAGE_LABELS[tpl.language] ?? tpl.language}
                  </td>
                  <td className="px-4 py-3 text-taupe">
                    {tpl.isGeneral ? "כן" : "לא"}
                  </td>
                  <td className="px-4 py-3 text-taupe">
                    {tpl.validityDays != null ? tpl.validityDays : "ללא הגבלה"}
                  </td>
                  <td className="px-4 py-3 text-taupe">{tpl.version}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        tpl.isActive
                          ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                          : "rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                      }
                    >
                      {tpl.isActive ? "פעיל" : "לא פעיל"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* עריכה ומחיקה רכה — רק לתבניות פעילות; לא-פעילות: מחיקה לצמיתות בלבד */}
                      {tpl.isActive && (
                        <>
                          <button
                            onClick={() => {
                              setEditingTemplate(tpl);
                              setView("edit");
                            }}
                            className="rounded-md px-3 py-1.5 text-xs text-gold-dark border border-gold-dark hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold min-h-[36px]"
                            aria-label={`ערוך תבנית ${tpl.name}`}
                          >
                            ערוך
                          </button>
                          <button
                            onClick={() => handleDelete(tpl.id, tpl.name)}
                            disabled={deletingId === tpl.id}
                            className="rounded-md px-3 py-1.5 text-xs text-red-600 border border-red-200 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50 min-h-[36px]"
                            aria-label={`מחק תבנית ${tpl.name}`}
                          >
                            {deletingId === tpl.id ? "מוחק..." : "מחק"}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setHardDeleteError(null);
                          setHardDeleteTarget(tpl);
                        }}
                        className="inline-flex min-h-11 items-center rounded-md border border-error/50 bg-error/5 px-3 text-xs font-semibold text-error transition-colors hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-1"
                        aria-label={`מחיקה לצמיתות של תבנית ${tpl.name}`}
                      >
                        מחיקה לצמיתות
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* דיאלוג מחיקה לצמיתות (12.5) — אישור חזק: הקלדת שם התבנית */}
      <HardDeleteDialog
        open={hardDeleteTarget !== null}
        onOpenChange={(next) => {
          if (!next) {
            setHardDeleteTarget(null);
            setHardDeleteError(null);
          }
        }}
        warningBody={
          <>
            <p className="font-semibold">
              התבנית &quot;{hardDeleteTarget?.name ?? ""}&quot; תימחק לצמיתות,
              יחד עם הרשומות הקשורות:
            </p>
            <ul className="list-disc ps-5 space-y-0.5">
              <li className="font-bold text-error">
                כל הטפסים החתומים המבוססים על תבנית זו יימחקו לצמיתות
              </li>
              <li>
                קובצי ה-PDF של הטפסים החתומים יישארו באחסון לניקוי ידני
              </li>
              <li>
                גרסאות אחרות של התבנית שנוצרו ממנה יישארו, אך ינותקו מהקשר
                לגרסה זו
              </li>
            </ul>
          </>
        }
        confirmPhrase={hardDeleteTarget?.name ?? ""}
        onConfirm={handleHardDelete}
        submitting={hardDeleting}
        error={hardDeleteError}
      />
    </div>
  );
}
