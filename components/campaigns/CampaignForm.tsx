"use client";

/**
 * טופס יצירת קמפיין WhatsApp — 3 שלבים (משימה 9.2, FR-MK-01, FR-MK-07).
 *
 * שלב 1: שם קמפיין + בחירת סגמנט (GET /api/segments)
 * שלב 2: תבנית שיווקית (GET /api/whatsapp/templates?category=MARKETING), מדיה, כפתור קישור,
 *        הערכת עלות (recipientCount × תעריף)
 * שלב 3: מועד שליחה (מיידי / מתוזמן), סיכום והערכת עלות, שמירה כטיוטה (POST /api/campaigns)
 *
 * ניווט בין שלבים ע"י רינדור מותנה בלבד (ללא ספריית wizard).
 * הטופס שומר תמיד כטיוטה (DRAFT) — השליחה בפועל מתבצעת במשימה 9.5.
 *
 * הערה (פרטיות — §11): הטופס אינו מציג נתוני לקוחות; אין להדפיס תוכן לוג.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export interface SegmentOption {
  id: string;
  name: string;
}

export interface TemplateOption {
  id: string;
  name: string;
  body: string;
}

interface CampaignFormProps {
  /** תעריף פר הודעה בש"ח (מ-WHATSAPP_COST_PER_MESSAGE_ILS, נקרא בשרת) */
  costPerMessageIls: number;
  /**
   * מספר הנמענים לחישוב העלות. עד למימוש ספירת הנמענים (משימה 9.4) — null,
   * ואז מוצגת הודעה במקום הערכת עלות מספרית.
   */
  recipientCount?: number | null;
}

type Step = 1 | 2 | 3;
const TOTAL_STEPS = 3;
const LINK_BUTTON_TEXT_MAX = 25;

const inputClass =
  "w-full rounded-lg border border-hairline-dark bg-white px-3 py-2 text-sm text-charcoal placeholder:text-taupe focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold min-h-[44px]";
const labelClass = "block text-sm font-medium text-charcoal mb-1";
const errorClass = "mt-1 text-sm text-red-700";

const currencyFormatter = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 2,
});

/** בודק כתובת http/https תקינה */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** הערכת עלות בש"ח; null אם מספר הנמענים עדיין לא ידוע */
export function estimateCostIls(
  recipientCount: number | null | undefined,
  costPerMessageIls: number
): number | null {
  if (recipientCount === null || recipientCount === undefined) return null;
  return Math.round(recipientCount * costPerMessageIls * 100) / 100;
}

export function CampaignForm({
  costPerMessageIls,
  recipientCount = null,
}: CampaignFormProps) {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);

  // נתוני הטופס
  const [name, setName] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [linkButtonUrl, setLinkButtonUrl] = useState("");
  const [linkButtonText, setLinkButtonText] = useState("");
  const [sendMode, setSendMode] = useState<"now" | "scheduled">("now");
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");

  // נתוני בחירה מה-API
  const [segments, setSegments] = useState<SegmentOption[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(true);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // שגיאות ושמירה
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSegments() {
      try {
        const res = await fetch("/api/segments");
        if (!res.ok) throw new Error("segments");
        const data = (await res.json()) as { segments: SegmentOption[] };
        if (!cancelled) setSegments(data.segments);
      } catch {
        if (!cancelled) setLoadError("טעינת הסגמנטים נכשלה — נסי לרענן את הדף");
      } finally {
        if (!cancelled) setSegmentsLoading(false);
      }
    }

    async function loadTemplates() {
      try {
        const res = await fetch("/api/whatsapp/templates?category=MARKETING");
        if (!res.ok) throw new Error("templates");
        const data = (await res.json()) as { templates: TemplateOption[] };
        if (!cancelled) setTemplates(data.templates);
      } catch {
        if (!cancelled) setLoadError("טעינת התבניות נכשלה — נסי לרענן את הדף");
      } finally {
        if (!cancelled) setTemplatesLoading(false);
      }
    }

    loadSegments();
    loadTemplates();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedSegment = segments.find((s) => s.id === segmentId);
  const selectedTemplate = templates.find((t) => t.id === templateId);
  const estimatedCost = estimateCostIls(recipientCount, costPerMessageIls);

  /** ולידציה לשלב הנוכחי; מחזיר true אם תקין */
  function validateStep(current: Step): boolean {
    const next: Record<string, string> = {};

    if (current === 1) {
      if (!name.trim()) next.name = "נא להזין שם לקמפיין";
      else if (name.trim().length > 100) next.name = "שם הקמפיין לא יכול לעלות על 100 תווים";
      if (!segmentId) next.segmentId = "נא לבחור סגמנט";
    }

    if (current === 2) {
      if (!templateId) next.templateId = "נא לבחור תבנית שיווקית";
      if (mediaUrl.trim() && !isHttpUrl(mediaUrl.trim())) {
        next.mediaUrl = "כתובת המדיה אינה תקינה (נדרש קישור שמתחיל ב-https://)";
      }
      const hasBtnUrl = linkButtonUrl.trim() !== "";
      const hasBtnText = linkButtonText.trim() !== "";
      if (hasBtnUrl !== hasBtnText) {
        next.linkButton = "כפתור קישור דורש גם כתובת וגם טקסט — או להשאיר את שניהם ריקים";
      } else if (hasBtnUrl && !isHttpUrl(linkButtonUrl.trim())) {
        next.linkButtonUrl = "כתובת הכפתור אינה תקינה (נדרש קישור שמתחיל ב-https://)";
      }
      if (hasBtnText && linkButtonText.trim().length > LINK_BUTTON_TEXT_MAX) {
        next.linkButtonText = `טקסט הכפתור לא יכול לעלות על ${LINK_BUTTON_TEXT_MAX} תווים`;
      }
    }

    if (current === 3 && sendMode === "scheduled") {
      if (!scheduledAtLocal) {
        next.scheduledAt = "נא לבחור תאריך ושעה לשליחה";
      } else {
        const when = new Date(scheduledAtLocal);
        if (isNaN(when.getTime()) || when.getTime() <= Date.now()) {
          next.scheduledAt = "מועד השליחה חייב להיות בעתיד";
        }
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setSubmitError(null);
    if (step < TOTAL_STEPS) setStep((step + 1) as Step);
  }

  function goBack() {
    setErrors({});
    setSubmitError(null);
    if (step > 1) setStep((step - 1) as Step);
  }

  /** שמירה כטיוטה — POST /api/campaigns */
  async function handleSaveDraft() {
    if (!validateStep(3)) return;
    setSaving(true);
    setSubmitError(null);

    const payload = {
      name: name.trim(),
      segmentId,
      templateId,
      mediaUrl: mediaUrl.trim() || null,
      linkButtonUrl: linkButtonUrl.trim() || null,
      linkButtonText: linkButtonText.trim() || null,
      scheduledAt:
        sendMode === "scheduled" && scheduledAtLocal
          ? new Date(scheduledAtLocal).toISOString()
          : null,
    };

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSubmitError(data.error ?? "שמירת הקמפיין נכשלה — נסי שוב");
        return;
      }
      router.push("/campaigns");
      router.refresh();
    } catch {
      setSubmitError("שגיאת רשת — נסי שוב");
    } finally {
      setSaving(false);
    }
  }

  /** הודעות שגיאה לשדה — עם role=alert לקוראי מסך */
  function fieldError(id: string) {
    if (!errors[id]) return null;
    return (
      <p id={`campaign-${id}-error`} role="alert" className={errorClass}>
        {errors[id]}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* מחוון שלבים */}
      <nav aria-label="שלבי יצירת הקמפיין">
        <ol className="flex flex-wrap gap-2 text-sm">
          {[
            { n: 1, label: "שם וסגמנט" },
            { n: 2, label: "תבנית ומדיה" },
            { n: 3, label: "תזמון וסיכום" },
          ].map(({ n, label }) => {
            const active = n === step;
            const done = n < step;
            return (
              <li
                key={n}
                aria-current={active ? "step" : undefined}
                className={`rounded-full px-3 py-1 ring-1 ring-inset ${
                  active
                    ? "bg-gold text-ink ring-gold"
                    : done
                      ? "bg-sand text-charcoal ring-hairline-dark"
                      : "bg-white text-taupe ring-hairline-dark"
                }`}
              >
                {n}. {label}
              </li>
            );
          })}
        </ol>
      </nav>

      {loadError && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </p>
      )}

      {/* שלב 1: שם + סגמנט */}
      {step === 1 && (
        <section aria-labelledby="campaign-step-1" className="space-y-4">
          <h2 id="campaign-step-1" className="font-heading text-xl text-charcoal">
            שלב 1: שם וסגמנט
          </h2>

          <div>
            <label htmlFor="campaign-name" className={labelClass}>
              שם הקמפיין <span aria-hidden="true" className="text-red-600">*</span>
            </label>
            <input
              id="campaign-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="למשל: מבצע חורף ללקוחות ותיקות"
              maxLength={100}
              required
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "campaign-name-error" : undefined}
              className={inputClass}
            />
            {fieldError("name")}
          </div>

          <div>
            <label htmlFor="campaign-segment" className={labelClass}>
              סגמנט (קהל יעד) <span aria-hidden="true" className="text-red-600">*</span>
            </label>
            <select
              id="campaign-segment"
              value={segmentId}
              onChange={(e) => setSegmentId(e.target.value)}
              disabled={segmentsLoading}
              required
              aria-invalid={Boolean(errors.segmentId)}
              aria-describedby={errors.segmentId ? "campaign-segmentId-error" : undefined}
              className={inputClass}
            >
              <option value="">
                {segmentsLoading ? "טוען סגמנטים…" : "בחרי סגמנט"}
              </option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {!segmentsLoading && segments.length === 0 && (
              <p className="mt-1 text-sm text-taupe">
                אין סגמנטים שמורים. ניתן לשמור פילטר כסגמנט מרשימת הלקוחות.
              </p>
            )}
            {fieldError("segmentId")}
          </div>
        </section>
      )}

      {/* שלב 2: תבנית + מדיה + הערכת עלות */}
      {step === 2 && (
        <section aria-labelledby="campaign-step-2" className="space-y-4">
          <h2 id="campaign-step-2" className="font-heading text-xl text-charcoal">
            שלב 2: תבנית ומדיה
          </h2>

          <div>
            <label htmlFor="campaign-template" className={labelClass}>
              תבנית שיווקית <span aria-hidden="true" className="text-red-600">*</span>
            </label>
            <select
              id="campaign-template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={templatesLoading}
              required
              aria-invalid={Boolean(errors.templateId)}
              aria-describedby={errors.templateId ? "campaign-templateId-error" : undefined}
              className={inputClass}
            >
              <option value="">
                {templatesLoading ? "טוען תבניות…" : "בחרי תבנית"}
              </option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {!templatesLoading && templates.length === 0 && (
              <p className="mt-1 text-sm text-taupe">
                אין תבניות שיווקיות במערכת. יש ליצור תבנית מסוג שיווק בהגדרות התבניות.
              </p>
            )}
            {fieldError("templateId")}
            {selectedTemplate && (
              <p className="mt-2 rounded-lg bg-sand px-3 py-2 text-sm text-charcoal whitespace-pre-line">
                {selectedTemplate.body}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="campaign-media" className={labelClass}>
              כתובת תמונה או וידאו (אופציונלי)
            </label>
            <input
              id="campaign-media"
              type="url"
              dir="ltr"
              inputMode="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://"
              aria-invalid={Boolean(errors.mediaUrl)}
              aria-describedby={errors.mediaUrl ? "campaign-mediaUrl-error" : undefined}
              className={inputClass}
            />
            {fieldError("mediaUrl")}
          </div>

          <fieldset className="space-y-3 rounded-lg border border-hairline-dark p-4">
            <legend className="px-2 text-sm font-medium text-charcoal">
              כפתור קישור (אופציונלי)
            </legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="campaign-link-text" className={labelClass}>
                  טקסט הכפתור
                </label>
                <input
                  id="campaign-link-text"
                  type="text"
                  value={linkButtonText}
                  onChange={(e) => setLinkButtonText(e.target.value)}
                  maxLength={LINK_BUTTON_TEXT_MAX}
                  placeholder="למשל: לקביעת תור"
                  aria-invalid={Boolean(errors.linkButtonText)}
                  className={inputClass}
                />
                {fieldError("linkButtonText")}
              </div>
              <div>
                <label htmlFor="campaign-link-url" className={labelClass}>
                  כתובת הקישור
                </label>
                <input
                  id="campaign-link-url"
                  type="url"
                  dir="ltr"
                  inputMode="url"
                  value={linkButtonUrl}
                  onChange={(e) => setLinkButtonUrl(e.target.value)}
                  placeholder="https://"
                  aria-invalid={Boolean(errors.linkButtonUrl)}
                  className={inputClass}
                />
                {fieldError("linkButtonUrl")}
              </div>
            </div>
            {fieldError("linkButton")}
          </fieldset>

          <div className="rounded-lg border border-hairline-dark bg-white px-4 py-3">
            <p className="text-sm font-medium text-charcoal">הערכת עלות</p>
            <p className="mt-1 text-sm text-taupe">
              תעריף: {currencyFormatter.format(costPerMessageIls)} להודעה
            </p>
            <p className="mt-1 text-sm text-charcoal">
              {estimatedCost === null
                ? "הערכת העלות תוצג לאחר חישוב מספר הנמענים."
                : `סה״כ משוער: ${currencyFormatter.format(estimatedCost)} (${recipientCount} נמענים)`}
            </p>
          </div>
        </section>
      )}

      {/* שלב 3: תזמון + סיכום */}
      {step === 3 && (
        <section aria-labelledby="campaign-step-3" className="space-y-4">
          <h2 id="campaign-step-3" className="font-heading text-xl text-charcoal">
            שלב 3: תזמון וסיכום
          </h2>

          <fieldset className="space-y-3">
            <legend className={labelClass}>מועד שליחה</legend>
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
              <label className="flex min-h-[44px] items-center gap-2 text-sm text-charcoal">
                <input
                  type="radio"
                  name="send-mode"
                  value="now"
                  checked={sendMode === "now"}
                  onChange={() => setSendMode("now")}
                  className="h-5 w-5 accent-gold"
                />
                שלח עכשיו
              </label>
              <label className="flex min-h-[44px] items-center gap-2 text-sm text-charcoal">
                <input
                  type="radio"
                  name="send-mode"
                  value="scheduled"
                  checked={sendMode === "scheduled"}
                  onChange={() => setSendMode("scheduled")}
                  className="h-5 w-5 accent-gold"
                />
                שלח בתאריך
              </label>
            </div>
          </fieldset>

          {sendMode === "scheduled" && (
            <div>
              <label htmlFor="campaign-scheduled-at" className={labelClass}>
                תאריך ושעה לשליחה
              </label>
              <input
                id="campaign-scheduled-at"
                type="datetime-local"
                value={scheduledAtLocal}
                onChange={(e) => setScheduledAtLocal(e.target.value)}
                aria-invalid={Boolean(errors.scheduledAt)}
                aria-describedby={errors.scheduledAt ? "campaign-scheduledAt-error" : undefined}
                className={`${inputClass} sm:w-72`}
              />
              {fieldError("scheduledAt")}
            </div>
          )}

          {/* סיכום */}
          <dl className="grid grid-cols-1 gap-3 rounded-lg border border-hairline-dark bg-white p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-taupe">שם הקמפיין</dt>
              <dd className="font-medium text-charcoal">{name.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-taupe">סגמנט</dt>
              <dd className="font-medium text-charcoal">{selectedSegment?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-taupe">תבנית</dt>
              <dd className="font-medium text-charcoal">{selectedTemplate?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-taupe">הערכת עלות</dt>
              <dd className="font-medium text-charcoal">
                {estimatedCost === null
                  ? "ממתין לחישוב נמענים"
                  : currencyFormatter.format(estimatedCost)}
              </dd>
            </div>
          </dl>

          {submitError && (
            <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </p>
          )}
        </section>
      )}

      {/* ניווט בין שלבים */}
      <div className="flex flex-col-reverse gap-3 border-t border-hairline-dark pt-4 sm:flex-row sm:justify-between">
        {step > 1 ? (
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={saving}
            className="min-h-[44px] border-hairline-dark text-charcoal"
          >
            הקודם
          </Button>
        ) : (
          <span className="hidden sm:block" />
        )}

        {step < TOTAL_STEPS ? (
          <Button
            type="button"
            onClick={goNext}
            className="min-h-[44px] bg-gold text-ink hover:bg-gold-dark"
          >
            הבא
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving}
            className="min-h-[44px] bg-gold text-ink hover:bg-gold-dark"
          >
            {saving ? "שומר…" : "שמור כטיוטה"}
          </Button>
        )}
      </div>
    </div>
  );
}
