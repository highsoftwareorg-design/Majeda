"use client";

/**
 * SignaturePad — לוח חתימה דיגיטלית (משימה 7.6, FR-CF-04, FR-CF-05).
 *
 * רכיב Canvas לאיסוף חתימה דיגיטלית עם תמיכה במגע (touch) ועכבר (mouse).
 * חושף ref עם isEmpty() ו-exportDataURL() דרך useImperativeHandle.
 *
 * RTL-safe, עברית, mobile-friendly.
 */

import {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import { Button } from "@/components/ui/button";

/** ממשק ה-ref שחושף SignaturePad לרכיב האב */
export interface SignaturePadRef {
  /** האם לוח החתימה ריק (לא נצייר עליו) */
  isEmpty: () => boolean;
  /** ייצוא תוכן הלוח כ-data URL (PNG) */
  exportDataURL: () => string;
  /** ניקוי הלוח */
  clear: () => void;
}

interface SignaturePadProps {
  /** callback שנקרא כאשר מצב "ריק/לא ריק" משתנה */
  onChange?: (isEmpty: boolean) => void;
  className?: string;
}

export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  function SignaturePad({ onChange, className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawingRef = useRef(false);
    const isEmptyRef = useRef(true);

    const getCanvas = () => canvasRef.current;

    const getCtx = (): CanvasRenderingContext2D | null =>
      canvasRef.current?.getContext("2d") ?? null;

    const initCtx = useCallback((ctx: CanvasRenderingContext2D) => {
      ctx.strokeStyle = "#1C1A17"; // פחם — צבע חתימה כהה על רקע לבן
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }, []);

    // כיוון ממדי ה-canvas בעת טעינה ובשינוי גודל
    useEffect(() => {
      const canvas = getCanvas();
      if (!canvas) return;

      const setSize = () => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.floor(rect.width);
        canvas.height = Math.floor(rect.height);
        const ctx = getCtx();
        if (ctx) initCtx(ctx);
        // ריסט מצב "ריק" עם שינוי גודל — הציור נמחק
        isEmptyRef.current = true;
      };

      setSize();

      const observer = new ResizeObserver(setSize);
      observer.observe(canvas);
      return () => observer.disconnect();
    }, [initCtx]);

    /** חישוב מיקום בתוך ה-canvas מאירוע עכבר או מגע */
    const getPos = (
      e:
        | React.MouseEvent<HTMLCanvasElement>
        | React.TouchEvent<HTMLCanvasElement>,
      canvas: HTMLCanvasElement
    ): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      if ("touches" in e) {
        const touch = e.touches[0];
        return {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        };
      }
      return {
        x: (e as React.MouseEvent<HTMLCanvasElement>).clientX - rect.left,
        y: (e as React.MouseEvent<HTMLCanvasElement>).clientY - rect.top,
      };
    };

    const startDrawing = useCallback(
      (
        e:
          | React.MouseEvent<HTMLCanvasElement>
          | React.TouchEvent<HTMLCanvasElement>
      ) => {
        e.preventDefault();
        const canvas = getCanvas();
        const ctx = getCtx();
        if (!canvas || !ctx) return;

        isDrawingRef.current = true;
        const { x, y } = getPos(e, canvas);
        ctx.beginPath();
        ctx.moveTo(x, y);
      },
      []
    );

    const draw = useCallback(
      (
        e:
          | React.MouseEvent<HTMLCanvasElement>
          | React.TouchEvent<HTMLCanvasElement>
      ) => {
        e.preventDefault();
        if (!isDrawingRef.current) return;

        const canvas = getCanvas();
        const ctx = getCtx();
        if (!canvas || !ctx) return;

        const { x, y } = getPos(e, canvas);
        ctx.lineTo(x, y);
        ctx.stroke();

        if (isEmptyRef.current) {
          isEmptyRef.current = false;
          onChange?.(false);
        }
      },
      [onChange]
    );

    const stopDrawing = useCallback(() => {
      isDrawingRef.current = false;
    }, []);

    const clear = useCallback(() => {
      const canvas = getCanvas();
      const ctx = getCtx();
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      isEmptyRef.current = true;
      onChange?.(true);
    }, [onChange]);

    useImperativeHandle(ref, () => ({
      isEmpty: () => isEmptyRef.current,
      exportDataURL: () => getCanvas()?.toDataURL("image/png") ?? "",
      clear,
    }));

    return (
      <div className={`flex flex-col gap-2 ${className ?? ""}`}>
        <div
          className="relative w-full rounded-xl border-2 border-dashed border-gray-300 bg-white overflow-hidden"
          style={{ height: "180px" }}
          aria-label="אזור חתימה"
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            aria-label="לוח לרישום חתימה דיגיטלית"
            role="img"
          />
          {/* הוראה שנמחקת ברגע שמתחילים לצייר */}
          <span
            className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 pointer-events-none select-none"
            aria-hidden="true"
          >
            חתמו כאן
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clear}
          className="self-start text-sm"
        >
          נקה
        </Button>
      </div>
    );
  }
);
