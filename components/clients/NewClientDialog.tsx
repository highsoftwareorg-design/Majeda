"use client";

/**
 * דיאלוג "לקוח/ה חדש/ה" — משימה 11.4 (FR-CL-01, יצירה).
 *
 * שולח ל-`POST /api/clients` הקיים (ללא שינוי ב-API). ולידציה בצד לקוח עם
 * אותן פונקציות שבשרת (`lib/validations/clients`), כולל טלפון ישראלי.
 * שדות הטופס המשותפים (והודעת הכפילות) נמצאים ב-`ClientFormFields` ומשותפים
 * עם דיאלוג העריכה (11.5).
 *
 * טיפול ב-409 (טלפון כפול): ה-API מחזיר רק הודעה על שדה הטלפון, ללא מזהה.
 * לכן, כדי לקשר לכרטיס הקיים, מבצעים `GET /api/clients?q=<טלפון מנורמל>`
 * (אותו API קיים) ומתאימים לפי טלפון מנורמל.
 *
 * הערה (פרטיות — §11): אין להדפיס ללוג פרטי לקוח.
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  validateCreateClient,
  isClientValid,
  type ClientValidationErrors,
  type CreateClientInput,
} from "@/lib/validations/clients";
import {
  ClientFormFields,
  findExistingClientByPhone,
  type ClientFormTagOption,
  type ClientFormValues,
  type ExistingClientRef,
} from "@/components/clients/ClientFormFields";

export type NewClientTagOption = ClientFormTagOption;

const EMPTY_VALUES: ClientFormValues = {
  firstName: "",
  lastName: "",
  phone: "",
  gender: "",
  birthDate: "",
  email: "",
  city: "",
  source: "",
  tagIds: [],
  marketingConsentChannel: "none",
  note: "",
};

function toPayload(values: ClientFormValues): CreateClientInput {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    phone: values.phone.trim(),
    gender: values.gender || null,
    birthDate: values.birthDate || null,
    email: values.email.trim() || null,
    city: values.city.trim() || null,
    source: values.source.trim() || undefined,
    note: values.note.trim() || null,
    marketingConsentChannel: values.marketingConsentChannel,
    tagIds: values.tagIds,
  };
}

export function NewClientDialog({ tags }: { tags: NewClientTagOption[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "min-h-11 rounded-lg bg-gold-dark px-4 text-sm font-medium text-champagne",
            "transition-colors hover:bg-gold-deep",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1"
          )}
        >
          + לקוח/ה חדש/ה
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>לקוח/ה חדש/ה</DialogTitle>
          <DialogDescription>
            נא למלא שם פרטי, שם משפחה וטלפון. שאר הפרטים אופציונליים.
          </DialogDescription>
        </DialogHeader>
        {/* הטופס נמצא בתוך התוכן, כך שנסגר/מתאפס בכל פתיחה מחדש */}
        <NewClientForm tags={tags} />
      </DialogContent>
    </Dialog>
  );
}

function NewClientForm({ tags }: { tags: NewClientTagOption[] }) {
  const router = useRouter();
  const [values, setValues] = useState<ClientFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<ClientValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [existing, setExisting] = useState<ExistingClientRef>(null);
  const [duplicatePhone, setDuplicatePhone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]): void {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (key === "phone") {
      setDuplicatePhone(false);
      setExisting(null);
    }
    if (key in errors) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key as keyof ClientValidationErrors];
        return next;
      });
    }
  }

  function toggleTag(tagId: string): void {
    setValues((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId)
        ? prev.tagIds.filter((id) => id !== tagId)
        : [...prev.tagIds, tagId],
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;

    setFormError(null);
    setExisting(null);
    setDuplicatePhone(false);

    const payload = toPayload(values);
    const clientErrors = validateCreateClient(payload);
    if (!isClientValid(clientErrors)) {
      setErrors(clientErrors);
      setFormError("נא לתקן את השדות המסומנים");
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as {
        client?: { id: string };
        errors?: ClientValidationErrors;
        error?: string;
      };

      if (response.status === 201 && data.client?.id) {
        router.push(`/clients/${data.client.id}`);
        return;
      }

      if (response.status === 409) {
        setErrors({ phone: "מספר הטלפון כבר קיים במערכת" });
        setDuplicatePhone(true);
        setExisting(await findExistingClientByPhone(payload.phone));
        setSubmitting(false);
        return;
      }

      if (response.status === 400) {
        setErrors(data.errors ?? {});
        setFormError(data.error ?? "נא לתקן את השדות המסומנים");
        setSubmitting(false);
        return;
      }

      setFormError(data.error ?? "אירעה שגיאה ביצירת הלקוח — נא לנסות שוב");
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
      aria-label="טופס לקוח/ה חדש/ה"
      className="flex flex-col gap-5"
    >
      <ClientFormFields
        idPrefix="nc"
        values={values}
        errors={errors}
        tags={tags}
        duplicatePhone={duplicatePhone}
        existing={existing}
        onChange={update}
        onToggleTag={toggleTag}
      />

      {formError && (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <button
            type="button"
            className={cn(
              "min-h-11 rounded-lg border border-gold-antique/40 bg-porcelain px-4 text-sm font-medium text-charcoal",
              "transition-colors hover:bg-champagne",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1"
            )}
          >
            ביטול
          </button>
        </DialogClose>
        <button
          type="submit"
          disabled={submitting}
          className={cn(
            "min-h-11 rounded-lg bg-gold-dark px-4 text-sm font-medium text-champagne",
            "transition-colors hover:bg-gold-deep disabled:opacity-60",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1"
          )}
        >
          {submitting ? "שומר…" : "שמירת לקוח/ה"}
        </button>
      </DialogFooter>
    </form>
  );
}
