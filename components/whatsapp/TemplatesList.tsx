"use client";

/**
 * רכיב ניהול רשימת תבניות WhatsApp (משימה 6.8, FR-WA-05).
 *
 * Client Component: מנהל את מצב הרשימה, פתיחת/סגירת העורך,
 * ורענון הרשימה מה-API לאחר שמירה.
 *
 * RTL, עברית, mobile-responsive.
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { TemplateEditor, type WhatsAppTemplateData } from "./TemplateEditor";

interface TemplatesListProps {
  initialTemplates: WhatsAppTemplateData[];
}

/** פורמט תאריך לתצוגה בעברית */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** תרגום קטגוריה */
function categoryLabel(cat: string): string {
  return cat === "MARKETING" ? "שיווק" : "שירות";
}

/** תרגום שפה */
function languageLabel(lang: string): string {
  return lang === "ar" ? "ערבית" : "עברית";
}

export function TemplatesList({ initialTemplates }: TemplatesListProps) {
  const [templates, setTemplates] = useState<WhatsAppTemplateData[]>(
    initialTemplates.filter((t) => t.isActive)
  );
  const [editing, setEditing] = useState<WhatsAppTemplateData | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  /** רענון הרשימה מה-API */
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(
          (data.templates as WhatsAppTemplateData[]).filter((t) => t.isActive)
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /** סגירת עורך + רענון */
  const handleSave = useCallback(async () => {
    setEditing(null);
    setCreating(false);
    await refresh();
  }, [refresh]);

  const handleCancel = useCallback(() => {
    setEditing(null);
    setCreating(false);
  }, []);

  /** מחיקה רכה */
  async function handleDelete(id: string, name: string) {
    if (!confirm(`האם למחוק את תבנית "${name}"? (ניתן לשחזר מה-DB)`)) return;
    const res = await fetch(`/api/whatsapp/templates/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    }
  }

  // — מצב עורך (יצירה/עריכה) —
  if (creating) {
    return (
      <section aria-label="יצירת תבנית חדשה">
        <div className="mb-6">
          <h2 className="font-heading text-xl font-medium text-charcoal">
            תבנית חדשה
          </h2>
        </div>
        <TemplateEditor onSave={handleSave} onCancel={handleCancel} />
      </section>
    );
  }

  if (editing) {
    return (
      <section aria-label="עריכת תבנית">
        <div className="mb-6">
          <h2 className="font-heading text-xl font-medium text-charcoal">
            עריכת תבנית:{" "}
            <span className="font-mono text-gold-deep">{editing.name}</span>
          </h2>
        </div>
        <TemplateEditor
          template={editing}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </section>
    );
  }

  // — מצב רשימה —
  return (
    <section aria-label="רשימת תבניות WhatsApp">
      {/* כותרת + כפתור יצירה */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-medium text-charcoal">
            ניהול תבניות WhatsApp
          </h1>
          <p className="mt-1 text-sm text-taupe">
            ניסוח ועריכת תבניות הודעות — הגשה ל-Meta נדרשת ידנית
          </p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          aria-label="צור תבנית חדשה"
        >
          + צור תבנית חדשה
        </Button>
      </div>

      {/* הודעה כשהרשימה ריקה */}
      {templates.length === 0 && (
        <div className="rounded-lg border border-hairline-dark bg-white p-8 text-center">
          <p className="text-sm text-taupe mb-4">עדיין לא נוצרו תבניות</p>
          <Button variant="outline" onClick={() => setCreating(true)}>
            צור את התבנית הראשונה
          </Button>
        </div>
      )}

      {/* טבלה */}
      {templates.length > 0 && (
        <div
          className="overflow-x-auto rounded-lg border border-hairline-dark bg-white"
          aria-busy={loading}
        >
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="border-b border-hairline-dark bg-champagne text-charcoal">
                <th
                  scope="col"
                  className="px-4 py-3 text-start font-medium"
                >
                  שם
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-start font-medium hidden sm:table-cell"
                >
                  קטגוריה
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-start font-medium hidden md:table-cell"
                >
                  שפה
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-start font-medium hidden md:table-cell"
                >
                  מאושר ע״י Meta
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-start font-medium hidden lg:table-cell"
                >
                  עודכן
                </th>
                <th scope="col" className="px-4 py-3 text-end font-medium">
                  פעולות
                </th>
              </tr>
            </thead>
            <tbody>
              {templates.map((tmpl) => (
                <tr
                  key={tmpl.id}
                  className="border-b border-hairline-dark last:border-0 hover:bg-champagne/40 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-charcoal">
                      {tmpl.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-taupe">
                    {categoryLabel(tmpl.category)}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-taupe">
                    {languageLabel(tmpl.language)}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {tmpl.approvedByMeta ? (
                      <span
                        className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs text-green-700"
                        aria-label="מאושר"
                      >
                        מאושר
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700"
                        aria-label="ממתין לאישור"
                      >
                        ממתין
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-taupe text-xs">
                    {formatDate(tmpl.updatedAt)}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing(tmpl)}
                        aria-label={`ערוך תבנית ${tmpl.name}`}
                      >
                        ערוך
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(tmpl.id, tmpl.name)}
                        aria-label={`מחק תבנית ${tmpl.name}`}
                        className="border-red-200 text-red-600 hover:bg-red-50"
                      >
                        מחק
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* הערה על הגשה ל-Meta */}
      <div className="mt-6 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3">
        <p className="text-sm text-charcoal">
          <strong>שים לב:</strong> לאחר ניסוח תבנית, יש להגישה לאישור Meta ידנית דרך{" "}
          <strong>Meta Business Suite</strong>. לאחר קבלת אישור, עדכני את שדה
          &ldquo;מאושר ע״י Meta&rdquo; בעריכת התבנית.
        </p>
      </div>
    </section>
  );
}
