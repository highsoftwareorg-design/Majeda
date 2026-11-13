"use client";

/**
 * רשימת קטלוג הטיפולים — משימה 11.7 (FR-AP-02, מקשר ל-FR-FU-01).
 *
 * מציג את כל הטיפולים (שם, משך, מחיר, צבע, טופס נדרש, זמן חזרה מומלץ).
 * שם הטיפול הוא קישור ל-`/treatments/[id]` (כללי המעקב של הטיפול).
 * "טיפול חדש" ו"עריכה" פותחים את `TreatmentFormDialog`; לאחר שמירה
 * מתבצע `router.refresh()` כדי לטעון מחדש את הרשימה מהשרת.
 *
 * פריסה: כרטיס לכל טיפול במובייל, ורשת של 4 עמודות החל מ-sm.
 */

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  TreatmentFormDialog,
  type TreatmentListItem,
} from "@/components/treatments/TreatmentFormDialog";
import { HardDeleteTreatmentDialog } from "@/components/treatments/HardDeleteTreatmentDialog";

const PRICE_FORMATTER = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

type TreatmentsCatalogProps = {
  initialTreatments: TreatmentListItem[];
};

export function TreatmentsCatalog({ initialTreatments }: TreatmentsCatalogProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TreatmentListItem | null>(null);

  function openCreate(): void {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(treatment: TreatmentListItem): void {
    setEditing(treatment);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl text-charcoal">קטלוג טיפולים</h1>
          <p className="mt-1 text-sm text-taupe">
            כל הטיפולים במרפאה — משך, מחיר, צבע ביומן וכללי מעקב.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className={cn(
            "min-h-11 rounded-lg bg-gold-dark px-4 text-sm font-medium text-champagne",
            "transition-colors hover:bg-gold-deep",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1"
          )}
        >
          + טיפול חדש
        </button>
      </div>

      {initialTreatments.length === 0 ? (
        <p className="rounded-xl border border-gold-antique/40 bg-porcelain p-6 text-center text-sm text-taupe">
          עדיין אין טיפולים בקטלוג. לחצי על &quot;טיפול חדש&quot; כדי להוסיף את הראשון.
        </p>
      ) : (
        <ul className="space-y-3" aria-label="רשימת טיפולים">
          {initialTreatments.map((treatment) => (
            <li
              key={treatment.id}
              className="rounded-xl border border-gold-antique/40 bg-porcelain p-4 shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <Link
                    href={`/treatments/${treatment.id}`}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-2 break-words font-medium text-charcoal underline-offset-2 hover:text-gold-dark hover:underline",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1"
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="size-4 shrink-0 rounded-full border border-charcoal/20"
                      style={{ backgroundColor: treatment.color ?? undefined }}
                    />
                    {treatment.name}
                  </Link>
                  {treatment.description && (
                    <p className="text-sm text-taupe">{treatment.description}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(treatment)}
                    aria-label={`עריכת ${treatment.name}`}
                    className={cn(
                      "min-h-11 shrink-0 rounded-lg border border-gold-antique/40 bg-porcelain px-4 text-sm font-medium text-charcoal",
                      "transition-colors hover:bg-champagne",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1"
                    )}
                  >
                    עריכה
                  </button>
                  <HardDeleteTreatmentDialog
                    treatment={{ id: treatment.id, name: treatment.name }}
                  />
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-taupe">משך</dt>
                  <dd className="font-medium text-charcoal">
                    {treatment.durationMinutes} דק׳
                  </dd>
                </div>
                <div>
                  <dt className="text-taupe">מחיר</dt>
                  <dd className="font-medium text-charcoal">
                    {PRICE_FORMATTER.format(treatment.price)}
                  </dd>
                </div>
                <div>
                  <dt className="text-taupe">צבע</dt>
                  <dd className="font-mono text-charcoal" dir="ltr">
                    {treatment.color ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-taupe">טופס נדרש</dt>
                  <dd className="font-medium text-charcoal">
                    {treatment.requiresConsentForm ? "כן" : "לא"}
                  </dd>
                </div>
                <div className="col-span-2 sm:col-span-4">
                  <dt className="text-taupe">זמן חזרה מומלץ</dt>
                  <dd className="font-medium text-charcoal">
                    {treatment.recommendedReturn ?? "—"}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}

      <TreatmentFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        treatment={editing}
      />
    </div>
  );
}
