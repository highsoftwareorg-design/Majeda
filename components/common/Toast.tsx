"use client";

/**
 * מערכת הודעות toast קלה — ללא תלות חיצונית (סעיף 12, מעקב "אין toast בפרויקט").
 *
 * - `ToastProvider` מורכב פעם אחת ב-`AdminShell` (layout של כל מסכי הניהול), ולכן
 *   ההודעה שורדת ניווט בין עמודים (למשל מחיקת לקוח/ה → `/clients`).
 * - `useToast()` בטוח גם ללא Provider (no-op) — רכיבים ובדיקות קיימות אינם נשברים.
 * - נגישות: אזור `role="status"` + `aria-live="polite"`; כפתור סגירה ≥44px;
 *   אנימציית כניסה רק תחת `motion-safe`.
 * - RTL/נייד: בנייד ההודעה נצמדת לתחתית ברוחב מלא (עם safe-area); בדסקטופ
 *   בפינה ההתחלתית (`start`) של המסך.
 *
 * הערה (פרטיות — §11): אין להעביר להודעות מידע רפואי/רגיש מעבר לשם האובייקט.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "info";

export interface ToastOptions {
  /** ברירת מחדל: success */
  variant?: ToastVariant;
  /** משך הצגה במילישניות; 0 = ללא סגירה אוטומטית. ברירת מחדל: 5000 */
  durationMs?: number;
}

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

export interface ToastContextValue {
  toast: (message: string, options?: ToastOptions) => void;
  dismiss: (id: number) => void;
}

export const TOAST_DEFAULT_DURATION_MS = 5000;
/** מספר הודעות מרבי המוצג בו-זמנית — הישנות ביותר נדחקות החוצה. */
const MAX_VISIBLE = 3;

const NOOP_CONTEXT: ToastContextValue = {
  toast: () => {},
  dismiss: () => {},
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** מחזיר `{ toast, dismiss }`. ללא Provider — פונקציות ריקות (לא זורק). */
export function useToast(): ToastContextValue {
  return useContext(ToastContext) ?? NOOP_CONTEXT;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, options?: ToastOptions) => {
      const id = ++nextId.current;
      const variant = options?.variant ?? "success";
      const durationMs = options?.durationMs ?? TOAST_DEFAULT_DURATION_MS;

      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { id, message, variant }]);

      if (durationMs > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), durationMs)
        );
      }
    },
    [dismiss]
  );

  // ניקוי טיימרים בעת פירוק ה-Provider
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const VARIANT_STYLES: Record<
  ToastVariant,
  { border: string; icon: typeof CheckCircle2; iconColor: string; label: string }
> = {
  success: {
    border: "border-success/50",
    icon: CheckCircle2,
    iconColor: "text-success",
    label: "הצלחה",
  },
  error: {
    border: "border-error/50",
    icon: AlertCircle,
    iconColor: "text-error",
    label: "שגיאה",
  },
  info: {
    border: "border-gold-antique/60",
    icon: Info,
    iconColor: "text-gold-dark",
    label: "מידע",
  },
};

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      data-testid="toast-viewport"
      className={cn(
        "pointer-events-none fixed bottom-0 start-0 end-0 z-50 flex flex-col items-center gap-2 px-4",
        "pb-[max(1rem,env(safe-area-inset-bottom))]",
        "sm:start-6 sm:end-auto sm:items-start sm:px-0"
      )}
    >
      {toasts.map((t) => {
        const style = VARIANT_STYLES[t.variant];
        const Icon = style.icon;
        return (
          <div
            key={t.id}
            data-variant={t.variant}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-white ps-4 pe-1 py-2 text-sm text-charcoal shadow-lg",
              "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2",
              style.border
            )}
          >
            <Icon
              className={cn("mt-2.5 h-5 w-5 shrink-0", style.iconColor)}
              aria-hidden="true"
            />
            <p className="flex-1 py-2.5 leading-relaxed">
              <span className="sr-only">{style.label}: </span>
              {t.message}
            </p>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="סגירת ההודעה"
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-taupe transition-colors hover:bg-champagne hover:text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
