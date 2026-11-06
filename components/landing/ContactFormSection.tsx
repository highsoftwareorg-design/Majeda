"use client";

import { useId, useState, type FormEvent } from "react";
import { ChevronDown, CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  validateContactForm,
  isContactFormValid,
  type ContactFormErrors,
  type ContactFormValues,
} from "@/lib/validations/contact";
import { submitContactForm } from "@/lib/actions/contact";

export type ContactFormTreatmentOption = {
  id: string;
  name: string;
};

type ContactFormSectionProps = {
  treatments: ContactFormTreatmentOption[];
};

const INITIAL_VALUES: ContactFormValues = {
  name: "",
  phone: "",
  treatmentId: "",
  note: "",
  marketingConsent: false,
};

/*
 * משימה 2.15 — סגנון שדות משותף ("אטלייה נואר ושמפניה", 2.11).
 * ניגודיות (WCAG, חושבה ידנית; משטח הטופס ink-raised, מילוי השדה ink-elevated):
 * - ערך מוקלד champagne על ink-elevated 14.68:1; placeholder champagne-muted על ink-elevated 7.30:1.
 * - גבול השדה gold-antique מלא (2.17; היה /70 = 3.05:1 — על הסף): מול מילוי השדה ink-elevated 4.76:1,
 *   מול ink-raised 5.58:1 (WCAG 1.4.11 ≥3:1 עם מרווח). הפוקוס (gold-light) עדיין בולט מעליו: 10.83:1.
 * - פוקוס: גבול gold-light (מול ink-elevated 10.83:1, מול ink-raised 12.7:1) + טבעת gold-light/50 (3.98:1 מול ink-raised).
 * - שגיאה: גבול error-light (5.72:1 מול ink-elevated) + טבעת error-light/30.
 * גודל גופן text-(length:--type-body) = 17px גם ב-md (≥16px — אין זום אוטומטי ב-iOS);
 * נכתב כ-text-(length:…) כדי ש-cn יזהה אותו כגודל ולא כצבע (הערת 2.12).
 */
const FIELD_CLASS =
  "rounded-lg border-gold-antique bg-ink-elevated px-4 text-(length:--type-body) md:text-(length:--type-body) text-champagne placeholder:text-champagne-muted duration-(--duration-quick) ease-luxe focus-visible:border-gold-light focus-visible:ring-3 focus-visible:ring-gold-light/50 aria-invalid:border-error-light aria-invalid:ring-3 aria-invalid:ring-error-light/30";

// תוויות: 15px (סולם eyebrow) במשקל 500, gold-pale על ink-raised 15.46:1. ללא אותיות רישיות/מתיחה.
const LABEL_CLASS =
  "text-(length:--type-eyebrow) leading-(--type-eyebrow-leading) font-medium text-gold-pale";

// טקסט שגיאת שדה: 14px (caption), error-light על ink-raised 6.72:1.
const FIELD_ERROR_CLASS = "text-caption text-error-light";

/**
 * סקשן "טופס השארת פרטים" בדף הנחיתה (משימה 2.6+2.7).
 * ולידציה בצד לקוח כקו הגנה ראשון: שם וטלפון חובה, טלפון בפורמט ישראלי.
 * תיבת ההסכמה לדיוור אינה מסומנת מראש כברירת מחדל.
 *
 * השליחה מתבצעת ל-Server Action (`submitContactForm`) שיוצר/מעדכן רשומת
 * `Client` במסד הנתונים לפי מספר טלפון (upsert), עם `source="landing_page"`.
 * הולידציה חוזרת גם בצד השרת — אין לסמוך על ולידציית הלקוח בלבד.
 *
 * משימה 2.15 — יישום כיוון העיצוב "אטלייה נואר ושמפניה" (2.11):
 * - רצועת ink בין "אודות" (ink-raised) ל"פרטי קשר" (ink + קו שיער עליון).
 * - דסקטופ (lg): קומפוזיציה א-סימטרית כמו ב"אודות" — כותרת ופתיח בצד ההתחלה (ימין ב-RTL),
 *   הטופס בצד הסיום. נייד: עמודה אחת, כותרת מיושרת ל-start כמו שאר הסקשנים.
 * - הטופס עצמו הוא "כרטיס תור" אחד שקט: משטח ink-raised, קו שיער, פינות radius-frame (4px) —
 *   שונה בכוונה מה-8px של השדות/הכפתור (היררכיית רדיוסים, 2.11), ללא צל/גרדיאנט.
 * - שם+טלפון זה לצד זה מ-sm (שדות קצרים), הערה והסכמה ברוחב מלא.
 * - כפתור השליחה: וריאנט `brand` + גודל `xl` (48px) ב-buttonVariants — אותה שפה כמו ה-CTA ב-Hero.
 * - הודעות הצלחה/שגיאה: קו logical בצד ההתחלה (border-s) + אייקון, טקסט success-light/error-light.
 * - מאפייני data-contact-form* הם עוגנים יציבים לאנימציה ב-2.16 (אין אנימציה כאן).
 */
export function ContactFormSection({ treatments }: ContactFormSectionProps) {
  const [values, setValues] = useState<ContactFormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<ContactFormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nameId = useId();
  const phoneId = useId();
  const treatmentId = useId();
  const noteId = useId();
  const consentId = useId();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateContactForm(values);
    setErrors(validationErrors);

    if (!isContactFormValid(validationErrors)) {
      setSubmitted(false);
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const result = await submitContactForm(values);

      if (!result.ok) {
        setSubmitted(false);
        setSubmitError(result.message);
        return;
      }

      setSubmitted(true);
      setValues(INITIAL_VALUES);
      setErrors({});
    } catch {
      setSubmitted(false);
      setSubmitError("אירעה שגיאה בשליחת הפרטים. נא לנסות שוב מאוחר יותר.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      id="contact-form"
      data-contact-form
      data-band="dark"
      data-band-tone="ink"
      className="w-full bg-ink px-gutter py-section"
      aria-labelledby="contact-form-heading"
    >
      {/*
        יעד ה-CTA ב-Hero (href="#booking", 2.17). ה-section כבר נושא id="contact-form" (לא שונה),
        ולכן היעד הוא מכל התוכן: הכותרת והטופס מגיעים יחד לראש המסך, עם scroll-margin-block-start
        (32→56px, טוקן stack) כדי שלא יוצמדו לקצה העליון של ה-viewport.
      */}
      <div
        id="booking"
        className="mx-auto grid w-full max-w-landing scroll-mbs-stack grid-cols-1 gap-stack lg:grid-cols-[5fr_7fr] lg:items-start lg:gap-grid"
      >
        <div data-contact-form-copy className="flex min-w-0 flex-col items-start gap-6">
          <header data-section-heading className="flex flex-col items-start gap-6">
            {/* gold-pale על ink 16.38:1 */}
            <h2
              id="contact-form-heading"
              className="measure-heading font-heading text-h2 font-medium text-gold-pale"
            >
              השאירו פרטים ונחזור אליכן
            </h2>
            <span aria-hidden="true" className="rule-gilded" />
          </header>
          {/* champagne-muted על ink 9.07:1 */}
          <p className="measure-prose text-lead text-champagne-muted">
            מלאו את הפרטים ונציגה מהצוות שלנו תיצור איתכן קשר בהקדם
          </p>
        </div>

        <form
          dir="rtl"
          noValidate
          onSubmit={handleSubmit}
          data-contact-form-panel
          className="grid w-full min-w-0 grid-cols-1 gap-x-5 gap-y-6 rounded-frame border border-hairline-dark bg-ink-raised p-6 sm:grid-cols-2 sm:p-10"
        >
          <div data-contact-form-field className="flex min-w-0 flex-col gap-2.5">
            <Label htmlFor={nameId} className={LABEL_CLASS}>
              שם מלא <span className="text-error-light">*</span>
            </Label>
            <Input
              id={nameId}
              name="name"
              type="text"
              autoComplete="name"
              value={values.name}
              aria-required="true"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? `${nameId}-error` : undefined}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, name: event.target.value }))
              }
              className={`h-12 ${FIELD_CLASS}`}
              placeholder="לדוגמה: דנה כהן"
            />
            {errors.name && (
              <p id={`${nameId}-error`} className={FIELD_ERROR_CLASS}>
                {errors.name}
              </p>
            )}
          </div>

          <div data-contact-form-field className="flex min-w-0 flex-col gap-2.5">
            <Label htmlFor={phoneId} className={LABEL_CLASS}>
              טלפון <span className="text-error-light">*</span>
            </Label>
            {/* המספר עצמו LTR (ספרות ומקפים), מיושר לקצה (ימין) כדי להתיישר עם שאר השדות ב-RTL */}
            <Input
              id={phoneId}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              value={values.phone}
              aria-required="true"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? `${phoneId}-error` : undefined}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, phone: event.target.value }))
              }
              className={`h-12 text-end tabular-nums ${FIELD_CLASS}`}
              placeholder="050-1234567"
            />
            {errors.phone && (
              <p id={`${phoneId}-error`} className={FIELD_ERROR_CLASS}>
                {errors.phone}
              </p>
            )}
          </div>

          <div data-contact-form-field className="flex min-w-0 flex-col gap-2.5 sm:col-span-2">
            <Label htmlFor={treatmentId} className={LABEL_CLASS}>
              טיפול מבוקש
            </Label>
            <div className="relative">
              <select
                id={treatmentId}
                name="treatmentId"
                value={values.treatmentId}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    treatmentId: event.target.value,
                  }))
                }
                className={`h-12 w-full min-w-0 appearance-none border pe-11 outline-none transition-colors [&>option]:bg-ink-elevated [&>option]:text-champagne ${FIELD_CLASS}`}
              >
                <option value="">בחרו טיפול (אופציונלי)</option>
                {treatments.map((treatment) => (
                  <option key={treatment.id} value={treatment.id}>
                    {treatment.name}
                  </option>
                ))}
              </select>
              {/* חץ זהב בצד הסיום (שמאל ב-RTL); gold על ink-elevated 7.25:1 */}
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 end-4 my-auto size-4 text-gold"
              />
            </div>
          </div>

          <div data-contact-form-field className="flex min-w-0 flex-col gap-2.5 sm:col-span-2">
            <Label htmlFor={noteId} className={LABEL_CLASS}>
              הערה
            </Label>
            <Textarea
              id={noteId}
              name="note"
              value={values.note}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, note: event.target.value }))
              }
              className={`min-h-28 py-3 leading-(--type-body-leading) ${FIELD_CLASS}`}
              placeholder="יש לנו משהו שחשוב שנדע? נשמח לשמוע"
              rows={3}
            />
          </div>

          {/*
            שורת ההסכמה (2.17): ה-label עוטף את התיבה ואת הטקסט, כך שכל השורה — כולל
            המרווח בין התיבה לטקסט — לחיצה, בגובה ≥44px (min-h-11 + py-2). htmlFor נשמר:
            לחיצה על התיבה עצמה לא מופעלת פעמיים (היעד כבר בתוך הפקד המקושר).
          */}
          <div
            data-contact-form-field
            className="border-t border-hairline-dark pt-4 sm:col-span-2"
          >
            {/* champagne-muted על ink-raised 8.56:1 */}
            <Label
              htmlFor={consentId}
              className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-(length:--type-caption) leading-(--type-caption-leading) font-normal text-champagne-muted"
            >
              {/* גבול התיבה gold-antique על ink-raised 5.58:1; מסומנת: ink על gold 9.00:1 */}
              <Checkbox
                id={consentId}
                checked={values.marketingConsent}
                onCheckedChange={(checked) =>
                  setValues((prev) => ({
                    ...prev,
                    marketingConsent: checked === true,
                  }))
                }
                className="mt-0.5 border-gold-antique focus-visible:border-gold-light focus-visible:ring-gold-light/50 data-[state=checked]:border-gold data-[state=checked]:bg-gold data-[state=checked]:text-ink"
              />
              <span>
                אני מאשרת קבלת עדכונים ומבצעים בדיוור (SMS/וואטסאפ/אימייל). ניתן
                להסיר הסכמה בכל עת.
              </span>
            </Label>
          </div>

          {submitted && (
            <p
              role="status"
              data-contact-form-status="success"
              className="flex items-start gap-3 rounded-lg border-s-2 border-success-light bg-success/10 px-4 py-3 text-body text-success-light sm:col-span-2"
            >
              {/* success-light על (success/10 מעל ink-raised) 9.84:1 */}
              <CircleCheck aria-hidden="true" className="mt-1 size-5 shrink-0" />
              <span>הפרטים נשלחו בהצלחה! ניצור איתך קשר בהקדם.</span>
            </p>
          )}

          {submitError && (
            <p
              role="alert"
              data-contact-form-status="error"
              className="flex items-start gap-3 rounded-lg border-s-2 border-error-light bg-error/10 px-4 py-3 text-body text-error-light sm:col-span-2"
            >
              {/* error-light על (error/10 מעל ink-raised) 6.38:1 */}
              <CircleAlert aria-hidden="true" className="mt-1 size-5 shrink-0" />
              <span>{submitError}</span>
            </p>
          )}

          {/* TODO: שילוב reCAPTCHA לפני שליחה בפועל (דורש מפתח חיצוני — מחוץ לתחום משימה 2.6). */}
          <Button
            type="submit"
            variant="brand"
            size="xl"
            disabled={isSubmitting}
            data-contact-form-submit
            className="w-full sm:col-span-2 sm:w-auto sm:min-w-52 sm:justify-self-start"
          >
            {isSubmitting && (
              <LoaderCircle
                aria-hidden="true"
                data-icon="inline-start"
                className="animate-spin motion-reduce:animate-none"
              />
            )}
            {isSubmitting ? "שולח..." : "שליחת פרטים"}
          </Button>
        </form>
      </div>
    </section>
  );
}

export default ContactFormSection;
