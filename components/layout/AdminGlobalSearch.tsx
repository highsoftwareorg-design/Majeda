"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** השהיית הקלדה לפני קריאה ל-API (אותו ערך כמו בחיפוש רשימת הלקוחות). */
const SEARCH_DEBOUNCE_MS = 300;
/** מספר תווים מינימלי לחיפוש — מונע הצפת תוצאות בהקלדת תו בודד. */
const MIN_QUERY_LENGTH = 2;
/** מספר התוצאות המקסימלי שמוצג ב-dropdown; השאר זמין בעמוד הלקוחות. */
const MAX_RESULTS = 8;

type SearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
};

type SearchState = {
  status: "idle" | "loading" | "ready" | "error";
  items: SearchResult[];
  total: number;
};

const INITIAL_STATE: SearchState = { status: "idle", items: [], total: 0 };

function liveMessage(state: SearchState): string {
  if (state.status === "loading") return "מחפש…";
  if (state.status === "error") return "אירעה שגיאה בחיפוש";
  if (state.status !== "ready") return "";
  if (state.total === 0) return "לא נמצאו לקוחות תואמים";
  if (state.total === 1) return "נמצאה תוצאה אחת";
  return `נמצאו ${state.total} תוצאות`;
}

/**
 * חיפוש גלובלי לפי שם/טלפון מ-Header של ממשק הניהול (משימה 11.3, FR-CL-03).
 * הקלדה (debounce) → `GET /api/clients?q=` → dropdown עם שם + טלפון, כל פריט
 * מקשר לפרופיל `/clients/[id]`. Enter → ניווט ל-`/clients?q=...`.
 * נגיש במקלדת (Escape סוגר את ה-dropdown), עם aria-label עברי ו-live region.
 */
export function AdminGlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState<SearchState>(INITIAL_STATE);

  const term = value.trim();
  const isSearchable = term.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!isSearchable) {
      setSearch(INITIAL_STATE);
      return;
    }

    setSearch((prev) => ({ ...prev, status: "loading" }));
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/clients?q=${encodeURIComponent(term)}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error("search failed");
        const body = (await response.json()) as { clients: SearchResult[] };
        setSearch({
          status: "ready",
          items: body.clients.slice(0, MAX_RESULTS),
          total: body.clients.length,
        });
      } catch {
        if (controller.signal.aborted) return;
        setSearch({ status: "error", items: [], total: 0 });
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, isSearchable]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!term) return;
    setOpen(false);
    router.push(`/clients?q=${encodeURIComponent(term)}`);
  }

  const showPanel = open && isSearchable;

  return (
    <div
      className={cn("relative w-full", className)}
      onBlur={(event) => {
        // סגירה כשהפוקוס יוצא מהרכיב כולו (כולל הפריטים ב-dropdown).
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <form role="search" aria-label="חיפוש לקוחות" onSubmit={handleSubmit} className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-taupe"
        />
        <Input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          name="q"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder="חיפוש לקוח/ה לפי שם או טלפון"
          aria-label="חיפוש מהיר של לקוח/ה לפי שם או טלפון"
          className="h-11 bg-porcelain ps-10 text-base"
        />
      </form>

      {/* הודעה ל-screen readers על מספר התוצאות */}
      <p role="status" aria-live="polite" className="sr-only">
        {showPanel ? liveMessage(search) : ""}
      </p>

      {showPanel && (
        <div
          // מניעת איבוד פוקוס בלחיצה על פריט, כדי שהקישור יספיק להתנווט בכל דפדפן.
          onMouseDown={(event) => event.preventDefault()}
          className="absolute inset-inline-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-xl border border-hairline-light bg-porcelain p-1 shadow-lift"
        >
          {search.status === "loading" && search.items.length === 0 && (
            <p className="px-3 py-2 text-sm text-taupe">מחפש…</p>
          )}

          {search.status === "error" && (
            <p className="px-3 py-2 text-sm text-taupe">
              אירעה שגיאה בחיפוש — נא לנסות שוב
            </p>
          )}

          {search.status === "ready" && search.total === 0 && (
            <p className="px-3 py-2 text-sm text-taupe">לא נמצאו לקוחות תואמים</p>
          )}

          {search.items.length > 0 && (
            <ul className="flex flex-col">
              {search.items.map((client) => (
                <li key={client.id}>
                  <Link
                    href={`/clients/${client.id}`}
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 flex-col justify-center rounded-lg px-3 py-1.5 outline-none transition-colors hover:bg-champagne focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="text-sm font-medium text-charcoal">
                      {client.firstName} {client.lastName}
                    </span>
                    <span dir="ltr" className="text-xs tabular-nums text-taupe">
                      {client.phone}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {search.status === "ready" && search.total > 0 && (
            <Link
              href={`/clients?q=${encodeURIComponent(term)}`}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center justify-center rounded-lg text-sm font-medium text-gold-dark outline-none transition-colors hover:bg-champagne hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              לכל התוצאות בעמוד הלקוחות
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminGlobalSearch;
