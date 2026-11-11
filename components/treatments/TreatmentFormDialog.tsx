"use client";

/**
 * דיאלוג יצירה/עריכה של טיפול בקטלוג — משימה 11.7 (FR-AP-02).
 *
 * `treatment = null` → יצירה (`POST /api/treatments`).
 * `treatment = {...}` → עריכה (`PATCH /api/treatments/:id`).
 *
 * הולידציה בצד לקוח משתמשת באותה פונקציה שבשרת (`parseTreatmentInput`),
 * כך שהכללים זהים. הטופס מאותחל מחדש בכל פתיחה כי תוכנו נמצא בתוך
 * `DialogContent` (Radix מפרק אותו בסגירה).
 *
 * שדות FR-AP-02 המוצגים: שם, משך, מחיר, צבע, מטפלים מורשים, טופס נדרש,
 * זמן חזרה מומלץ (טקסט + מספר ימים לחישוב אוטומטי), ותיאור קצר.
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { INPUT_CLASS, INPUT_ERROR_CLASS } from "@/components/clients/ClientFormFields";
import {
  DEFAULT_TREATMENT_COLOR,
  isTreatmentValid,
  parseTreatmentInput,
  type TreatmentValidationErrors,
} from "@/lib/validations/treatments";

/** צורת טיפול כפי שמועברת מהשרת לרכיבי הקטלוג (ללא שדות תאריך). */
export type TreatmentListItem = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  recommendedReturn: string | null;
  recommendedReturnDays: number | null;
  color: string | null;
  requiresConsentForm: boolean;
  authorizedTherapists: string | null;
};

type FormValues = {
  name: string;
  description: string;
  durationMinutes: string;
  price: string;
  recommendedReturn: string;
  recommendedReturnDays: string;
  color: string;
  requiresConsentForm: boolean;
  authorizedTherapists: string;
};

const BUTTON_PRIMARY_CLASS = cn(
  "min-h-11 rounded-lg bg-gold-dark px-4 text-sm font-medium text-champagne",
  "transition-colors hover:bg-gold-deep disabled:opacity-60",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1"
);

const BUTTON_SECONDARY_CLASS = cn(
  "min-h-11 rounded-lg border border-gold-antique/40 bg-porcelain px-4 text-sm font-medium text-charcoal",
  "transition-colors hover:bg-champagne",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1"
);

function toValues(treatment: TreatmentListItem | null): FormValues {
  if (!treatment) {
    return {
      name: "",
      description: "",
      durationMinutes: "",
      price: "",
      recommendedReturn: "",
      recommendedReturnDays: "",
      color: DEFAULT_TREATMENT_COLOR,
      requiresConsentForm: false,
      authorizedTherapists: "",
    };
  }
  return {
    name: treatment.name,
    description: treatment.description ?? "",
    durationMinutes: String(treatment.durationMinutes),
    price: String(treatment.price),
    recommendedReturn: treatment.recommendedReturn ?? "",
    recommendedReturnDays:
      treatment.recommendedReturnDays === null ? "" : String(treatment.recommendedReturnDays),
    color: treatment.color ?? DEFAULT_TREATMENT_COLOR,
    requiresConsentForm: treatment.requiresConsentForm,
    authorizedTherapists: treatment.authorizedTherapists ?? "",
  };
}

/** ממיר ערכי טופס (מחרוזות) לגוף הבקשה; שדות ריקים אופציונליים → null. */
function toPayload(values: FormValues): Record<string, unknown> {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    durationMinutes: values.durationMinutes.trim(),
    price: values.price.trim(),
    recommendedReturn: values.recommendedReturn.trim() || null,
    recommendedReturnDays: values.recommendedReturnDays.trim() || null,
    color: values.color || null,
    requiresConsentForm: values.requiresConsentForm,
    authorizedTherapists: values.authorizedTherapists.trim() || null,
  };
}

type TreatmentFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = טיפול חדש; אחרת עריכת הטיפול הנתון. */
  treatment: TreatmentListItem | null;
};

export function TreatmentFormDialog({
  open,
  onOpenChange,
  treatment,
}: TreatmentFormDialogProps) {
  const isEdit = treatment !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "עריכת טיפול" : "טיפול חדש"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "עדכון פרטי הטיפול בקטלוג."
              : "נא למלא שם, משך ומחיר. שאר הפרטים אופציונליים."}
          </DialogDescription>
        </DialogHeader>
        <TreatmentForm
          treatment={treatment}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function TreatmentForm({
  treatment,
  onDone,
}: {
  treatment: TreatmentListItem | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const isEdit = treatment !== null;
  const idPrefix = isEdit ? "et" : "nt";
  const id = (name: string) => `${idPrefix}-${name}`;
  const errId = (name: string) => `${idPrefix}-${name}-error`;

  const [values, setValues] = useState<FormValues>(() => toValues(treatment));
  const [errors, setErrors] = useState<TreatmentValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]): void {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (key in errors) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key as keyof TreatmentValidationErrors];
        return next;
      });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;

    setFormError(null);
    const payload = toPayload(values);
    const clientCheck = parseTreatmentInput(payload, isEdit ? "update" : "create");
    if (!isTreatmentValid(clientCheck.errors)) {
      setErrors(clientCheck.errors);
      setFormError("נא לתקן את השדות המסומנים");
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      const response = await fetch(
        isEdit ? `/api/treatments/${treatment.id}` : "/api/treatments",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = (await response.json().catch(() => ({}))) as {
        errors?: TreatmentValidationErrors;
        error?: string;
      };

      if (response.ok) {
        onDone();
        router.refresh();
        return;
      }

      if (response.status === 400 || response.status === 409) {
        setErrors(data.errors ?? {});
        setFormError(
          data.errors?.name ?? data.error ?? "נא לתקן את השדות המסומנים"
        );
      } else {
        setFormError(data.error ?? "אירעה שגיאה בשמירת הטיפול — נא לנסות שוב");
      }
      setSubmitting(false);
    } catch {
      setFormError("שגיאת רשת — נא לנסות שוב");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label={isEdit ? "טופס עריכת טיפול" : "טופס טיפול חדש"}
      className="flex flex-col gap-5"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={id("name")} className="text-sm font-medium text-charcoal">
            שם הטיפול <span aria-hidden="true" className="text-red-600">*</span>
          </Label>
          <input
            id={id("name")}
            type="text"
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            maxLength={100}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? errId("name") : undefined}
            className={cn(INPUT_CLASS, errors.name && INPUT_ERROR_CLASS)}
          />
          {errors.name && (
            <p id={errId("name")} role="alert" className="text-xs text-red-600">
              {errors.name}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("duration")} className="text-sm font-medium text-charcoal">
            משך (דקות) <span aria-hidden="true" className="text-red-600">*</span>
          </Label>
          <input
            id={id("duration")}
            type="number"
            inputMode="numeric"
            min={1}
            max={600}
            value={values.durationMinutes}
            onChange={(e) => update("durationMinutes", e.target.value)}
            aria-invalid={Boolean(errors.durationMinutes)}
            aria-describedby={errors.durationMinutes ? errId("duration") : undefined}
            className={cn(INPUT_CLASS, errors.durationMinutes && INPUT_ERROR_CLASS)}
          />
          {errors.durationMinutes && (
            <p id={errId("duration")} role="alert" className="text-xs text-red-600">
              {errors.durationMinutes}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("price")} className="text-sm font-medium text-charcoal">
            מחיר (₪) <span aria-hidden="true" className="text-red-600">*</span>
          </Label>
          <input
            id={id("price")}
            type="number"
            inputMode="numeric"
            min={0}
            max={100000}
            value={values.price}
            onChange={(e) => update("price", e.target.value)}
            aria-invalid={Boolean(errors.price)}
            aria-describedby={errors.price ? errId("price") : undefined}
            className={cn(INPUT_CLASS, errors.price && INPUT_ERROR_CLASS)}
          />
          {errors.price && (
            <p id={errId("price")} role="alert" className="text-xs text-red-600">
              {errors.price}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("color")} className="text-sm font-medium text-charcoal">
            צבע ביומן
          </Label>
          <div className="flex items-center gap-3">
            <input
              id={id("color")}
              type="color"
              value={values.color}
              onChange={(e) => update("color", e.target.value)}
              aria-invalid={Boolean(errors.color)}
              className="h-11 w-16 min-w-11 cursor-pointer rounded-lg border border-gold-antique/40 bg-porcelain p-1"
            />
            <span dir="ltr" className="font-mono text-sm text-taupe">
              {values.color}
            </span>
          </div>
          {errors.color && (
            <p role="alert" className="text-xs text-red-600">
              {errors.color}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("return")} className="text-sm font-medium text-charcoal">
            זמן חזרה מומלץ
          </Label>
          <input
            id={id("return")}
            type="text"
            value={values.recommendedReturn}
            onChange={(e) => update("recommendedReturn", e.target.value)}
            placeholder="לדוגמה: 4 שבועות"
            maxLength={100}
            aria-invalid={Boolean(errors.recommendedReturn)}
            className={cn(INPUT_CLASS, errors.recommendedReturn && INPUT_ERROR_CLASS)}
          />
          {errors.recommendedReturn && (
            <p role="alert" className="text-xs text-red-600">
              {errors.recommendedReturn}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("return-days")} className="text-sm font-medium text-charcoal">
            זמן חזרה בימים (לחישוב אוטומטי)
          </Label>
          <input
            id={id("return-days")}
            type="number"
            inputMode="numeric"
            min={1}
            max={3650}
            value={values.recommendedReturnDays}
            onChange={(e) => update("recommendedReturnDays", e.target.value)}
            aria-invalid={Boolean(errors.recommendedReturnDays)}
            aria-describedby={errors.recommendedReturnDays ? errId("return-days") : undefined}
            className={cn(INPUT_CLASS, errors.recommendedReturnDays && INPUT_ERROR_CLASS)}
          />
          {errors.recommendedReturnDays && (
            <p id={errId("return-days")} role="alert" className="text-xs text-red-600">
              {errors.recommendedReturnDays}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={id("therapists")} className="text-sm font-medium text-charcoal">
            מטפלים מורשים
          </Label>
          <input
            id={id("therapists")}
            type="text"
            value={values.authorizedTherapists}
            onChange={(e) => update("authorizedTherapists", e.target.value)}
            placeholder="שמות מופרדים בפסיק, למשל: שרה,נועה"
            aria-invalid={Boolean(errors.authorizedTherapists)}
            className={cn(INPUT_CLASS, errors.authorizedTherapists && INPUT_ERROR_CLASS)}
          />
          {errors.authorizedTherapists && (
            <p role="alert" className="text-xs text-red-600">
              {errors.authorizedTherapists}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 sm:col-span-2">
          <input
            id={id("consent")}
            type="checkbox"
            checked={values.requiresConsentForm}
            onChange={(e) => update("requiresConsentForm", e.target.checked)}
            className="size-5 cursor-pointer accent-gold-dark"
          />
          <Label htmlFor={id("consent")} className="cursor-pointer text-sm font-medium text-charcoal">
            נדרש טופס הסכמה לטיפול זה
          </Label>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={id("description")} className="text-sm font-medium text-charcoal">
            תיאור קצר
          </Label>
          <textarea
            id={id("description")}
            rows={3}
            value={values.description}
            onChange={(e) => update("description", e.target.value)}
            maxLength={500}
            aria-invalid={Boolean(errors.description)}
            className={cn(INPUT_CLASS, "h-auto min-h-24 py-2", errors.description && INPUT_ERROR_CLASS)}
          />
          {errors.description && (
            <p role="alert" className="text-xs text-red-600">
              {errors.description}
            </p>
          )}
        </div>
      </div>

      {formError && (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <button type="button" className={BUTTON_SECONDARY_CLASS}>
            ביטול
          </button>
        </DialogClose>
        <button type="submit" disabled={submitting} className={BUTTON_PRIMARY_CLASS}>
          {submitting ? "שומר…" : "שמירת טיפול"}
        </button>
      </DialogFooter>
    </form>
  );
}
