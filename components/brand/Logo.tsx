import Image from "next/image";
import { cn } from "@/lib/utils";

export type LogoVariant = "full" | "transparent";

const LOGO_SOURCES: Record<LogoVariant, string> = {
  full: "/brand/majida_logo.svg",
  transparent: "/brand/majida_logo_transparent.svg",
};

/** גודל מינימלי ללוגו מלא לפי כללי השימוש במותג (נספח א.8). */
const MIN_FULL_SIZE = 120;
/** גודל מינימלי לסמל/אייקון לפי כללי השימוש במותג (נספח א.8). */
const MIN_ICON_SIZE = 32;

export interface LogoProps {
  /** גרסת הלוגו: מלא (רקע שחור) או שקוף (transparent). */
  variant?: LogoVariant;
  /**
   * גודל התצוגה (פיקסלים, צד הרוחב/גובה הגדול של הריבוע התוחם).
   * הערך נאכף למינימום הנדרש: 120px לגרסה המלאה, 32px כאשר `asIcon` מסומן.
   */
  size?: number;
  /** האם מדובר בשימוש כסמל/אייקון קטן (למשל פאביקון/ניווט) — מאפשר מינימום 32px. */
  asIcon?: boolean;
  /** טקסט חלופי לנגישות. */
  alt?: string;
  /**
   * משימה 2.12: מצב "נוזלי" — הלוגו ממלא את רוחב המכל שלו (למשל מסגרת הקשת ב-Hero)
   * במקום רוחב קבוע בפיקסלים, כך שהוא גדל יחד עם הקומפוזיציה בין נייד לדסקטופ.
   * הגודל המינימלי לפי נספח א.8 נשמר דרך min-inline-size, ו-`size` משמש כרוחב המקורי
   * (width/height ל-next/image) וכתקרת רוחב.
   */
  fluid?: boolean;
  /**
   * משימה 2.20: טעינה מוקדמת (next/image `priority`). ברירת המחדל — כמו קודם: כן ללוגו מלא,
   * לא לאייקון. רכיב שבו הלוגו אינו אלמנט ה-LCP (למשל ה-Hero עם תמונת רקע) מעביר `false`.
   */
  priority?: boolean;
  className?: string;
}

/**
 * רכיב הלוגו המשותף של המותג MAJIDA Beauté Center.
 * שומר על יחס רוחב-גובה מקורי, גודל מינימלי לפי כללי המותג (נספח א.8),
 * ומרווח נקי (clear space) סביב הלוגו בגובה האות M.
 */
export function Logo({
  variant = "full",
  size,
  asIcon = false,
  alt = "MAJIDA Beauté Center",
  fluid = false,
  priority,
  className,
}: LogoProps) {
  const minSize = asIcon ? MIN_ICON_SIZE : MIN_FULL_SIZE;
  const resolvedSize = Math.max(size ?? minSize, minSize);
  const src = LOGO_SOURCES[variant];

  return (
    <span
      // נקודת עיגון יציבה לאנימציה עתידית (משימה 2.16) ולבדיקות
      data-slot="logo"
      data-variant={variant}
      className={cn(
        // מרווח נקי סביב הלוגו (clear space) בגובה כ-M, כנדרש בכללי השימוש
        "inline-flex items-center justify-center p-2",
        fluid && "w-full",
        className
      )}
    >
      <Image
        src={src}
        alt={alt}
        width={resolvedSize}
        height={resolvedSize}
        style={
          fluid
            ? {
                inlineSize: "100%",
                maxInlineSize: resolvedSize,
                minInlineSize: minSize,
                height: "auto",
              }
            : { width: resolvedSize, height: "auto" }
        }
        sizes={fluid ? `${resolvedSize}px` : undefined}
        priority={priority ?? !asIcon}
      />
    </span>
  );
}

export default Logo;
