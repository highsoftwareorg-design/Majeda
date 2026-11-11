"use client";

/**
 * ConsentSigningPanel — יצירת קישור חתימה לטופס הסכמה מתוך פרופיל הלקוח/ה (משימה 11.12, FR-CF-02, FR-CF-06).
 *
 * - טוען את התבניות הפעילות מ-GET /api/consent-templates.
 * - לחיצה על "צור קישור חתימה" קוראת ל-POST /api/consent-tokens (משימה 7.4).
 * - מציג את הקישור עם העתקה ללוח, וקישור שליחה ידנית ב-WhatsApp (wa.me).
 *
 * הערה (פרטיות — §11): הקישור והטלפון אינם מודפסים ללוג. ה-API שולח בעצמו הודעת WhatsApp
 * כשללקוח/ה יש טלפון, לכן שליחה ידנית היא רק לשליחה חוזרת.
 *
 * RTL, עברית, mobile-responsive לפי הנחיית hebrew-ui.
 */

import { useEffect, useState } from "react";
import { Copy, Check, Link as LinkIcon, MessageCircle } from "lucide-react";

type Template = {
  id: string;
  name: string;
  version: number;
};

type Props = {
  clientId: string;
  clientPhone: string | null;
};

// המרת מספר ישראלי (05X...) לפורמט בינלאומי ל-wa.me (972XXXXXXXXX)
function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  return digits;
}

export function ConsentSigningPanel({ clientId, clientPhone }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingLink, setSigningLink] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadTemplates() {
      try {
        const res = await fetch("/api/consent-templates");
        if (!res.ok) throw new Error("load failed");
        const data = (await res.json()) as { templates: Template[] };
        if (cancelled) return;
        setTemplates(
          data.templates.map((t) => ({ id: t.id, name: t.name, version: t.version }))
        );
      } catch {
        if (!cancelled) setTemplatesError("שגיאה בטעינת תבניות הסכמה");
      } finally {
        if (!cancelled) setLoadingTemplates(false);
      }
    }
    loadTemplates();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate() {
    if (!selectedId) {
      setError("יש לבחור תבנית טופס");
      return;
    }
    setCreating(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/consent-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, templateId: selectedId }),
      });
      const data = (await res.json().catch(() => null)) as
        | { signingToken?: string; error?: string }
        | null;
      if (!res.ok || !data?.signingToken) {
        setError(data?.error ?? "שגיאה ביצירת קישור החתימה");
        setSigningLink(null);
        return;
      }
      const link = `${window.location.origin}/sign/${data.signingToken}`;
      setSigningLink(link);
      setSelectedName(templates.find((t) => t.id === selectedId)?.name ?? "");
    } catch {
      setError("שגיאת רשת — לא ניתן ליצור קישור חתימה");
      setSigningLink(null);
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy() {
    if (!signingLink) return;
    try {
      await navigator.clipboard.writeText(signingLink);
      setCopied(true);
    } catch {
      setError("לא ניתן להעתיק אוטומטית — ניתן להעתיק ידנית מהשדה");
    }
  }

  const whatsappHref =
    signingLink && clientPhone
      ? `https://wa.me/${toWhatsAppNumber(clientPhone)}?text=${encodeURIComponent(
          `לחתימה על טופס "${selectedName}" לחצ/י על הקישור: ${signingLink}`
        )}`
      : null;

  return (
    <div dir="rtl" className="mb-5 rounded-brand border border-gold/20 bg-champagne/20 p-4">
      <h3 className="mb-3 text-sm font-semibold text-charcoal">שליחת טופס לחתימה</h3>

      {templatesError && (
        <p role="alert" className="mb-3 text-sm text-red-700">
          {templatesError}
        </p>
      )}

      {!loadingTemplates && !templatesError && templates.length === 0 && (
        <p className="mb-3 text-sm text-taupe">
          אין תבניות הסכמה פעילות. ניתן ליצור תבנית בתפריט &quot;טפסי הסכמה&quot;.
        </p>
      )}

      {templates.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor="consent-template-select" className="text-xs font-medium text-taupe">
              בחירת תבנית
            </label>
            <select
              id="consent-template-select"
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setSigningLink(null);
                setError(null);
              }}
              className="min-h-11 w-full rounded-brand border border-gold/30 bg-white px-3 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-gold/40"
            >
              <option value="">בחר/י תבנית…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (v{t.version})
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !selectedId}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-brand bg-gold-dark px-4 text-sm font-medium text-white transition-colors hover:bg-gold-deep disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <LinkIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{creating ? "יוצר קישור…" : "צור קישור חתימה"}</span>
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {signingLink && (
        <div className="mt-4 space-y-3" aria-live="polite">
          <p className="text-xs text-taupe">
            הקישור תקף ל-72 שעות ולחתימה אחת בלבד.
            {clientPhone
              ? " אם ללקוח/ה יש מספר טלפון, ההודעה נשלחה אוטומטית ב-WhatsApp. ניתן לשלוח שוב ידנית."
              : " ללקוח/ה אין מספר טלפון — יש להעתיק את הקישור ולשלוח בעצמך."}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="consent-signing-link" className="sr-only">
              קישור חתימה
            </label>
            <input
              id="consent-signing-link"
              type="text"
              readOnly
              dir="ltr"
              value={signingLink}
              onFocus={(e) => e.currentTarget.select()}
              className="min-h-11 min-w-0 flex-1 rounded-brand border border-gold/30 bg-white px-3 text-xs text-charcoal"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-brand border border-gold/40 bg-white px-4 text-sm font-medium text-gold-dark hover:bg-champagne/40"
            >
              {copied ? (
                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span>{copied ? "הקישור הועתק" : "העתק קישור"}</span>
            </button>
          </div>
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-brand bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700"
            >
              <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>שלח שוב ב-WhatsApp</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
