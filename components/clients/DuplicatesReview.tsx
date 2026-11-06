"use client";

/**
 * דיאלוג/מסך סקירת כפילויות ומיזוג (משימה 3.4, FR-CL-02).
 *
 * מציג כל קבוצת כפילויות (לקוחות עם טלפון זהה/דומה מאוד) כשתי כרטיסיות
 * זה-לצד-זה (בדסקטופ) או זו-מתחת-לזו (בנייד), ומאפשר לבחור, לכל שדה,
 * מאיזה משני הלקוחות ייקח הערך הסופי. בשליחה, הלקוח שנבחר כ"שורד" מתעדכן
 * עם הערכים הנבחרים, והלקוח השני מועבר לארכיון (לא נמחק) — ראו
 * `lib/db/merge-clients.ts`.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";

type DuplicateClientView = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  gender: "female" | "male" | "other" | null;
  birthDate: string | null;
  email: string | null;
  city: string | null;
  source: string;
  note: string | null;
  marketingConsentChannel:
    | "none"
    | "landing_page"
    | "whatsapp"
    | "sms"
    | "email"
    | "in_person";
  createdAt: string;
  tags: { id: string; name: string }[];
};

export type DuplicateGroupView = {
  key: string;
  clients: DuplicateClientView[];
};

const GENDER_LABELS: Record<string, string> = {
  female: "נקבה",
  male: "זכר",
  other: "אחר",
};

const CONSENT_LABELS: Record<string, string> = {
  none: "אין הסכמה",
  landing_page: "דף נחיתה",
  whatsapp: "וואטסאפ",
  sms: "SMS",
  email: "אימייל",
  in_person: "בקליניקה",
};

function formatDate(value: string | null): string {
  if (!value) return "לא צוין";
  return new Date(value).toLocaleDateString("he-IL");
}

type TextFieldKey =
  | "firstName"
  | "lastName"
  | "phone"
  | "email"
  | "city"
  | "note"
  | "source";

const TEXT_FIELDS: { key: TextFieldKey; label: string }[] = [
  { key: "firstName", label: "שם פרטי" },
  { key: "lastName", label: "שם משפחה" },
  { key: "phone", label: "טלפון" },
  { key: "email", label: "אימייל" },
  { key: "city", label: "עיר" },
  { key: "note", label: "הערה" },
  { key: "source", label: "מקור הגעה" },
];

function displayValue(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "— לא צוין —";
}

type Side = "left" | "right";

function MergeForm({
  group,
  onMerged,
}: {
  group: DuplicateGroupView;
  onMerged: (key: string) => void;
}) {
  const [left, right] = group.clients;

  const [survivorSide, setSurvivorSide] = useState<Side>("left");
  const [textChoices, setTextChoices] = useState<Record<TextFieldKey, Side>>(
    () => {
      const initial: Record<TextFieldKey, Side> = {} as Record<
        TextFieldKey,
        Side
      >;
      for (const { key } of TEXT_FIELDS) {
        const leftValue = left[key as keyof DuplicateClientView];
        const rightValue = right[key as keyof DuplicateClientView];
        const leftFilled = typeof leftValue === "string" && leftValue.trim();
        const rightFilled =
          typeof rightValue === "string" && rightValue.trim();
        initial[key] = !leftFilled && rightFilled ? "right" : "left";
      }
      return initial;
    }
  );
  const [genderSide, setGenderSide] = useState<Side>(
    !left.gender && right.gender ? "right" : "left"
  );
  const [birthDateSide, setBirthDateSide] = useState<Side>(
    !left.birthDate && right.birthDate ? "right" : "left"
  );
  const [consentSide, setConsentSide] = useState<Side>(
    left.marketingConsentChannel === "none" &&
      right.marketingConsentChannel !== "none"
      ? "right"
      : "left"
  );
  const allTagNames = new Map<string, string>();
  for (const tag of [...left.tags, ...right.tags]) {
    allTagNames.set(tag.id, tag.name);
  }
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    () => new Set(allTagNames.keys())
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(side: Side, field: TextFieldKey): string {
    const client = side === "left" ? left : right;
    return (client[field] as string | null) ?? "";
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const survivor = survivorSide === "left" ? left : right;
    const duplicate = survivorSide === "left" ? right : left;

    const resolved = {
      firstName: pick(textChoices.firstName, "firstName"),
      lastName: pick(textChoices.lastName, "lastName"),
      phone: pick(textChoices.phone, "phone"),
      email: pick(textChoices.email, "email") || null,
      city: pick(textChoices.city, "city") || null,
      note: pick(textChoices.note, "note") || null,
      source: pick(textChoices.source, "source") || undefined,
      gender: (genderSide === "left" ? left.gender : right.gender) ?? null,
      birthDate:
        (birthDateSide === "left" ? left.birthDate : right.birthDate) ?? null,
      marketingConsentChannel:
        consentSide === "left"
          ? left.marketingConsentChannel
          : right.marketingConsentChannel,
      tagIds: Array.from(selectedTagIds),
    };

    try {
      const response = await fetch("/api/clients/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          survivorId: survivor.id,
          duplicateId: duplicate.id,
          resolved,
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        const message =
          body?.errors &&
          Object.values(body.errors as Record<string, string>)[0];
        setError(message || body?.error || "אירעה שגיאה במיזוג הלקוחות");
        setSubmitting(false);
        return;
      }

      onMerged(group.key);
    } catch {
      setError("אירעה שגיאת תקשורת — נא לנסות שוב");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gold-antique/30 bg-porcelain p-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="font-heading text-sm text-charcoal">
          איזו רשומה תישרד (תישאר ב-ID הקיים שלה)?
        </legend>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
          <label className="flex min-h-11 items-center gap-2 text-sm text-charcoal">
            <input
              type="radio"
              name={`survivor-${group.key}`}
              checked={survivorSide === "left"}
              onChange={() => setSurvivorSide("left")}
              className="size-5"
            />
            לקוח א׳ ({left.firstName} {left.lastName})
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-charcoal">
            <input
              type="radio"
              name={`survivor-${group.key}`}
              checked={survivorSide === "right"}
              onChange={() => setSurvivorSide("right")}
              className="size-5"
            />
            לקוח ב׳ ({right.firstName} {right.lastName})
          </label>
        </div>
      </fieldset>

      <div className="h-px bg-gold-antique/30" />

      <p className="text-sm text-taupe">
        לכל שדה — בחרו מאיזו רשומה לקחת את הערך הסופי:
      </p>

      <div className="flex flex-col gap-3">
        {TEXT_FIELDS.map(({ key, label }) => (
          <fieldset key={key} className="flex flex-col gap-1.5">
            <legend className="text-sm font-medium text-charcoal">
              {label}
            </legend>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
              <label className="flex min-h-11 flex-1 items-center gap-2 rounded-md border border-gold-antique/30 bg-champagne px-3 text-sm text-charcoal">
                <input
                  type="radio"
                  name={`${key}-${group.key}`}
                  checked={textChoices[key] === "left"}
                  onChange={() =>
                    setTextChoices((prev) => ({ ...prev, [key]: "left" }))
                  }
                  className="size-5"
                />
                {displayValue(left[key])}
              </label>
              <label className="flex min-h-11 flex-1 items-center gap-2 rounded-md border border-gold-antique/30 bg-champagne px-3 text-sm text-charcoal">
                <input
                  type="radio"
                  name={`${key}-${group.key}`}
                  checked={textChoices[key] === "right"}
                  onChange={() =>
                    setTextChoices((prev) => ({ ...prev, [key]: "right" }))
                  }
                  className="size-5"
                />
                {displayValue(right[key])}
              </label>
            </div>
          </fieldset>
        ))}

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium text-charcoal">מין</legend>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
            {(["left", "right"] as Side[]).map((side) => {
              const client = side === "left" ? left : right;
              return (
                <label
                  key={side}
                  className="flex min-h-11 flex-1 items-center gap-2 rounded-md border border-gold-antique/30 bg-champagne px-3 text-sm text-charcoal"
                >
                  <input
                    type="radio"
                    name={`gender-${group.key}`}
                    checked={genderSide === side}
                    onChange={() => setGenderSide(side)}
                    className="size-5"
                  />
                  {client.gender ? GENDER_LABELS[client.gender] : "לא צוין"}
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium text-charcoal">
            תאריך לידה
          </legend>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
            {(["left", "right"] as Side[]).map((side) => {
              const client = side === "left" ? left : right;
              return (
                <label
                  key={side}
                  className="flex min-h-11 flex-1 items-center gap-2 rounded-md border border-gold-antique/30 bg-champagne px-3 text-sm text-charcoal"
                >
                  <input
                    type="radio"
                    name={`birthDate-${group.key}`}
                    checked={birthDateSide === side}
                    onChange={() => setBirthDateSide(side)}
                    className="size-5"
                  />
                  {formatDate(client.birthDate)}
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium text-charcoal">
            ערוץ הסכמה לדיוור
          </legend>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
            {(["left", "right"] as Side[]).map((side) => {
              const client = side === "left" ? left : right;
              return (
                <label
                  key={side}
                  className="flex min-h-11 flex-1 items-center gap-2 rounded-md border border-gold-antique/30 bg-champagne px-3 text-sm text-charcoal"
                >
                  <input
                    type="radio"
                    name={`consent-${group.key}`}
                    checked={consentSide === side}
                    onChange={() => setConsentSide(side)}
                    className="size-5"
                  />
                  {CONSENT_LABELS[client.marketingConsentChannel]}
                </label>
              );
            })}
          </div>
        </fieldset>

        {allTagNames.size > 0 && (
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-sm font-medium text-charcoal">
              תגיות (איחוד — ניתן להסיר תגיות שלא רלוונטיות)
            </legend>
            <div className="flex flex-wrap gap-3">
              {Array.from(allTagNames.entries()).map(([id, name]) => (
                <label
                  key={id}
                  className="flex min-h-11 items-center gap-2 rounded-md border border-gold-antique/30 bg-champagne px-3 text-sm text-charcoal"
                >
                  <input
                    type="checkbox"
                    checked={selectedTagIds.has(id)}
                    onChange={() =>
                      setSelectedTagIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      })
                    }
                    className="size-5"
                  />
                  {name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="brand"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "ממזג…" : "מזג את שני הלקוחות"}
        </Button>
      </div>
    </div>
  );
}

function GroupCard({
  group,
  onMerged,
}: {
  group: DuplicateGroupView;
  onMerged: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [left, right] = group.clients;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gold-antique/40 bg-champagne p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-error">
          נמצאה כפילות אפשרית — מספרי טלפון תואמים (8 ספרות אחרונות)
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "סגירת מיזוג" : "סקירה ומיזוג"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[left, right].map((client, index) => (
          <div
            key={client.id}
            className="flex flex-col gap-1 rounded-md border border-gold-antique/30 bg-porcelain p-3 text-sm text-charcoal"
          >
            <p className="font-heading text-base">
              לקוח {index === 0 ? "א׳" : "ב׳"}: {client.firstName}{" "}
              {client.lastName}
            </p>
            <p className="text-taupe">טלפון: {client.phone}</p>
            {client.email && <p className="text-taupe">{client.email}</p>}
            {client.city && <p className="text-taupe">עיר: {client.city}</p>}
            <p className="text-taupe">
              נוצר בתאריך: {formatDate(client.createdAt)}
            </p>
          </div>
        ))}
      </div>

      {open && <MergeForm group={group} onMerged={onMerged} />}
    </div>
  );
}

export function DuplicatesReview({
  groups,
}: {
  groups: DuplicateGroupView[];
}) {
  const [remainingGroups, setRemainingGroups] = useState(groups);
  const [justMergedCount, setJustMergedCount] = useState(0);

  function handleMerged(key: string) {
    setRemainingGroups((prev) => prev.filter((group) => group.key !== key));
    setJustMergedCount((count) => count + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      {justMergedCount > 0 && (
        <p role="status" className="rounded-md bg-success/10 p-3 text-success">
          מוזגו {justMergedCount} כפילויות בהצלחה.
        </p>
      )}
      {remainingGroups.length === 0 ? (
        <p className="rounded-lg border border-gold-antique/30 bg-porcelain p-4 text-taupe">
          לא נותרו כפילויות פעילות לטיפול.
        </p>
      ) : (
        remainingGroups.map((group) => (
          <GroupCard key={group.key} group={group} onMerged={handleMerged} />
        ))
      )}
    </div>
  );
}
