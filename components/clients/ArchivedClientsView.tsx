"use client";

/**
 * תצוגת ארכיון לקוחות — משימה 11.6 (FR-CL-01).
 *
 * טוענת `GET /api/clients?status=archived` (רק מאורכבים) ומציגה כל לקוח/ה
 * עם כפתור "שחזור" שקורא ל-`POST /api/clients/:id/restore`. לאחר שחזור מוצלח
 * הלקוח/ה יוצא/ת מהתצוגה, מתרענן מידע השרת (רשימה פעילה), והפרנט מסונכרן
 * דרך `onRestored`.
 *
 * מרונדר רק כשתצוגת הארכיון פעילה ב-`ClientsListView`, לכן `useRouter` לא
 * נטען בתצוגת הרשימה הפעילה הרגילה.
 *
 * הערה (פרטיות — §11): אין להדפיס ללוג פרטי לקוח.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ClientListItem } from "@/components/clients/ClientsListView";

export function ArchivedClientsView({
  onRestored,
}: {
  /** נקרא לאחר שחזור מוצלח — לסנכרון תוצאות הפילטר הפעיל בפרנט. */
  onRestored?: () => void;
}) {
  const router = useRouter();
  const [clients, setClients] = useState<ClientListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);

  const loadArchived = useCallback(async (): Promise<void> => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/clients?status=archived");
      if (!response.ok) throw new Error("archived fetch failed");
      const body = (await response.json()) as { clients: ClientListItem[] };
      setClients(body.clients);
    } catch {
      setLoadError("אירעה שגיאה בטעינת הארכיון — נא לנסות שוב");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadArchived();
  }, [loadArchived]);

  /** שחזור לקוח/ה מהארכיון לרשימה הפעילה. */
  async function handleRestore(client: ClientListItem): Promise<void> {
    setRestoringId(client.id);
    setRestoreError(null);
    setRestoreSuccess(null);
    try {
      const response = await fetch(`/api/clients/${client.id}/restore`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setRestoreError(data.error ?? "אירעה שגיאה בשחזור — נא לנסות שוב");
        return;
      }
      setClients((prev) => prev?.filter((c) => c.id !== client.id) ?? null);
      setRestoreSuccess(`${client.firstName} ${client.lastName} שוחזר/ה לרשימה הפעילה`);
      onRestored?.();
      router.refresh();
    } catch {
      setRestoreError("שגיאת רשת — נא לנסות שוב");
    } finally {
      setRestoringId(null);
    }
  }

  const count = clients?.length ?? 0;

  return (
    <div className="flex flex-col gap-4" dir="rtl">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-xl text-charcoal">ארכיון לקוחות</h2>
        <p className="text-sm text-taupe">
          לקוחות שהועברו לארכיון אינם מופיעים ברשימה הפעילה. ניתן לשחזר לקוח/ה
          לרשימה הפעילה בלחיצה על &quot;שחזור&quot;.
        </p>
      </div>

      {loadError && (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-sm text-error">
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => void loadArchived()}
            className={cn(
              "min-h-11 rounded-lg border border-gold-antique/40 bg-porcelain px-4 text-sm font-medium text-charcoal",
              "transition-colors hover:bg-champagne",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1"
            )}
          >
            נסה שוב
          </button>
        </div>
      )}

      {restoreError && (
        <p role="alert" className="text-sm text-error">
          {restoreError}
        </p>
      )}

      {restoreSuccess && (
        <p role="status" className="text-sm text-success">
          {restoreSuccess}
        </p>
      )}

      <p className="text-sm text-taupe" aria-live="polite">
        {loading ? "טוען את הארכיון…" : `${count} לקוחות בארכיון`}
      </p>

      <div className="overflow-hidden rounded-lg border border-gold-antique/30 bg-porcelain">
        <Table>
          <TableHeader>
            <TableRow className="border-gold-antique/30">
              <TableHead className="text-charcoal">שם</TableHead>
              <TableHead className="text-charcoal">טלפון</TableHead>
              <TableHead className="hidden text-charcoal sm:table-cell">עיר</TableHead>
              <TableHead className="text-charcoal">
                <span className="sr-only">פעולות</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && !loadError && count === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-sm text-taupe">
                  אין לקוחות בארכיון.
                </TableCell>
              </TableRow>
            ) : (
              clients?.map((client) => {
                const isRestoring = restoringId === client.id;
                const fullName = `${client.firstName} ${client.lastName}`;
                return (
                  <TableRow key={client.id} className="border-gold-antique/20">
                    <TableCell className="whitespace-nowrap text-charcoal">
                      {fullName}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-charcoal">
                      <bdi>{client.phone}</bdi>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-taupe sm:table-cell">
                      {client.city || "—"}
                    </TableCell>
                    <TableCell className="text-end">
                      <button
                        type="button"
                        onClick={() => void handleRestore(client)}
                        disabled={isRestoring}
                        aria-label={`שחזור ${fullName} מהארכיון`}
                        className={cn(
                          "inline-flex min-h-11 items-center gap-2 rounded-lg border border-gold-dark/60 bg-porcelain px-3 text-sm font-medium text-gold-dark",
                          "transition-colors hover:bg-champagne disabled:opacity-60",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1"
                        )}
                      >
                        <ArchiveRestore className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {isRestoring ? "משחזר…" : "שחזור"}
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
