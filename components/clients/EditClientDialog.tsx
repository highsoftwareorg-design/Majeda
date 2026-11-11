"use client";

/**
 * דיאלוג "עריכת פרטי לקוח/ה" — משימה 11.5 (FR-CL-01, עריכה).
 *
 * שולח `PATCH /api/clients/:id` הקיים (ללא שינוי ב-API) עם השדות ששונו בלבד,
 * כך ששמירה של שדה אחד לא מאפסת שדות אחרים ולא מאפסת את תאריך הסכמה לדיוור
 * כשהערוץ לא השתנה (השרת מעדכן `marketingConsentAt` בכל שינוי ערוץ).
 *
 * תגיות: ה-PATCH הקיים אינו מטפל ב-`tagIds`, ואין endpoint להסרת תגית מלקוח.
 * לכן הוספת תגיות חדשות נעשית דרך `POST /api/clients/bulk-tag` הקיים (לקוח אחד),
 * ותגיות קיימות מסומנות כנעולות בטופס (לא ניתן להסירן עד שיתווסף endpoint).
 *
 * שדות רפואיים אינם כאן — הם מנוהלים ב-`MedicalAlertsForm`.
 * טיפול ב-409 (טלפון כפול): זהה ליצירה (11.4), דרך `ClientFormFields`.
 *
 * הערה (פרטיות — §11): אין להדפיס ללוג פרטי לקוח.
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
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
  normalizeIsraeliPhone,
  type ClientGenderInput,
  type ClientMarketingConsentChannelInput,
  type ClientValidationErrors,
  type UpdateClientInput,
} from "@/lib/validations/clients";
import {
  ClientFormFields,
  findExistingClientByPhone,
  type ClientFormTagOption,
  type ClientFormValues,
  type ExistingClientRef,
} from "@/components/clients/ClientFormFields";

/** נתוני הלקוח/ה הנדרשים לטופס העריכה (תאריך לידה כמחרוזת YYYY-MM-DD). */
export type EditableClient = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  gender: ClientGenderInput | null;
  birthDate: string | null;
  email: string | null;
  city: string | null;
  source: string;
  note: string | null;
  marketingConsentChannel: ClientMarketingConsentChannelInput;
  tags: { tag: ClientFormTagOption }[];
};

/** השדות שנשלחים ל-PATCH — מנורמלים (trim, ערכים ריקים → null). */
type EditablePayload = {
  firstName: string;
  lastName: string;
  phone: string;
  gender: ClientGenderInput | null;
  birthDate: string | null;
  email: string | null;
  city: string | null;
  source: string;
  note: string | null;
  marketingConsentChannel: ClientMarketingConsentChannelInput;
};

function toEditablePayload(values: ClientFormValues): EditablePayload {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    phone: values.phone.trim(),
    gender: values.gender || null,
    birthDate: values.birthDate || null,
    email: values.email.trim() || null,
    city: values.city.trim() || null,
    // מקור הגעה הוא שדה חובה ב-DB (ברירת מחדל "direct") — ריק משמע "direct"
    source: values.source.trim() || "direct",
    note: values.note.trim() || null,
    marketingConsentChannel: values.marketingConsentChannel,
  };
}

function toFormValues(client: EditableClient): ClientFormValues {
  return {
    firstName: client.firstName,
    lastName: client.lastName,
    phone: client.phone,
    gender: client.gender ?? "",
    birthDate: client.birthDate ?? "",
    email: client.email ?? "",
    city: client.city ?? "",
    source: client.source,
    tagIds: client.tags.map((t) => t.tag.id),
    marketingConsentChannel: client.marketingConsentChannel,
    note: client.note ?? "",
  };
}

/** מחזיר רק את השדות שהשתנו (לצורך PATCH חלקי). */
function changedFields(next: EditablePayload, initial: EditablePayload): UpdateClientInput {
  const patch: UpdateClientInput = {};
  if (next.firstName !== initial.firstName) patch.firstName = next.firstName;
  if (next.lastName !== initial.lastName) patch.lastName = next.lastName;
  if (normalizeIsraeliPhone(next.phone) !== normalizeIsraeliPhone(initial.phone)) {
    patch.phone = next.phone;
  }
  if (next.gender !== initial.gender) patch.gender = next.gender;
  if (next.birthDate !== initial.birthDate) patch.birthDate = next.birthDate;
  if (next.email !== initial.email) patch.email = next.email;
  if (next.city !== initial.city) patch.city = next.city;
  if (next.source !== initial.source) patch.source = next.source;
  if (next.note !== initial.note) patch.note = next.note;
  if (next.marketingConsentChannel !== initial.marketingConsentChannel) {
    patch.marketingConsentChannel = next.marketingConsentChannel;
  }
  return patch;
}

export function EditClientDialog({
  client,
  tags,
}: {
  client: EditableClient;
  tags: ClientFormTagOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-gold-antique/40 bg-porcelain px-4 text-sm font-medium text-charcoal",
            "transition-colors hover:bg-champagne",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-1"
          )}
        >
          <Pencil className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>עריכה</span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>עריכת פרטי לקוח/ה</DialogTitle>
          <DialogDescription>
            ניתן לעדכן את פרטי הלקוח/ה. שם פרטי, שם משפחה וטלפון הם שדות חובה.
          </DialogDescription>
        </DialogHeader>
        {/* הטופס נמצא בתוך התוכן, כך שנטען מחדש עם הערכים העדכניים בכל פתיחה */}
        <EditClientForm client={client} tags={tags} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function EditClientForm({
  client,
  tags,
  onSaved,
}: {
  client: EditableClient;
  tags: ClientFormTagOption[];
  onSaved: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ClientFormValues>(() => toFormValues(client));
  const [errors, setErrors] = useState<ClientValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [existing, setExisting] = useState<ExistingClientRef>(null);
  const [duplicatePhone, setDuplicatePhone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ערכי המקור נגזרים מהלקוח/ה הנוכחי/ת (מתעדכנים אחרי router.refresh)
  const initialPayload = toEditablePayload(toFormValues(client));
  const initialTagIds = client.tags.map((t) => t.tag.id);

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

    const nextPayload = toEditablePayload(values);
    const clientErrors = validateCreateClient(nextPayload);
    if (!isClientValid(clientErrors)) {
      setErrors(clientErrors);
      setFormError("נא לתקן את השדות המסומנים");
      return;
    }
    setErrors({});

    const patch = changedFields(nextPayload, initialPayload);
    const addedTagIds = values.tagIds.filter((id) => !initialTagIds.includes(id));
    const hasPatch = Object.keys(patch).length > 0;

    if (!hasPatch && addedTagIds.length === 0) {
      onSaved();
      return;
    }

    setSubmitting(true);
    try {
      if (hasPatch) {
        const response = await fetch(`/api/clients/${client.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = (await response.json().catch(() => ({}))) as {
          errors?: ClientValidationErrors;
          error?: string;
        };

        if (response.status === 409) {
          setErrors({ phone: "מספר הטלפון כבר קיים במערכת" });
          setDuplicatePhone(true);
          setExisting(await findExistingClientByPhone(nextPayload.phone));
          setSubmitting(false);
          return;
        }

        if (response.status === 400) {
          setErrors(data.errors ?? {});
          setFormError(data.error ?? "נא לתקן את השדות המסומנים");
          setSubmitting(false);
          return;
        }

        if (!response.ok) {
          setFormError(data.error ?? "אירעה שגיאה בשמירת הפרטים — נא לנסות שוב");
          setSubmitting(false);
          return;
        }
      }

      if (addedTagIds.length > 0) {
        const results = await Promise.all(
          addedTagIds.map((tagId) =>
            fetch("/api/clients/bulk-tag", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ clientIds: [client.id], tagId }),
            })
          )
        );
        if (results.some((r) => !r.ok)) {
          // הפרטים הנשמרים כבר נשמרו — מרעננים כדי שהניסיון הבא ישלח רק את החסר
          router.refresh();
          setFormError("הפרטים נשמרו, אך חלק מהתגיות לא נשמרו — נא לנסות שוב");
          setSubmitting(false);
          return;
        }
      }

      router.refresh();
      onSaved();
    } catch {
      setFormError("שגיאת רשת — נא לנסות שוב");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="טופס עריכת לקוח/ה"
      className="flex flex-col gap-5"
    >
      <ClientFormFields
        idPrefix="ec"
        values={values}
        errors={errors}
        tags={tags}
        duplicatePhone={duplicatePhone}
        existing={existing}
        onChange={update}
        onToggleTag={toggleTag}
        lockedTagIds={initialTagIds}
        tagHint="תגיות קיימות אינן ניתנות להסרה מכאן עדיין."
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
          {submitting ? "שומר…" : "שמירת שינויים"}
        </button>
      </DialogFooter>
    </form>
  );
}
