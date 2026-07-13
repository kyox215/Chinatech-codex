"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { Eraser } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const SIGNATURE_BACKGROUND_COLOR = "#ffffff";
export const SIGNATURE_INK_COLOR = "#111827";

export interface SignatureCapture {
  dataUrl: string;
  file: File;
  width: number;
  height: number;
}

interface SignaturePadProps {
  ariaLabel: string;
  disabled?: boolean;
  required?: boolean;
  resetKey?: string;
  className?: string;
  onChange: (capture: SignatureCapture | null) => void;
}

export function SignaturePad({
  ariaLabel,
  disabled,
  required,
  resetKey,
  className,
  onChange,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const movedRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);
  const previousResetKeyRef = useRef(resetKey);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) initializeSignatureBitmap(context, canvas.width, canvas.height);
    drawingRef.current = false;
    movedRef.current = false;
    setHasSignature(false);
    onChange(null);
  }, [onChange]);

  useEffect(() => {
    if (previousResetKeyRef.current === resetKey) return;
    previousResetKeyRef.current = resetKey;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) initializeSignatureBitmap(context, canvas.width, canvas.height);
    drawingRef.current = false;
    movedRef.current = false;
    setHasSignature(false);
  }, [resetKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const previous = hasSignature ? canvas.toDataURL("image/png") : undefined;
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      const context = canvas.getContext("2d");
      if (context) initializeSignatureBitmap(context, canvas.width, canvas.height);
      if (!previous) return;
      const image = new Image();
      image.onload = () =>
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      image.src = previous;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [hasSignature]);

  const finish = useCallback(async () => {
    const canvas = canvasRef.current;
    drawingRef.current = false;
    if (!canvas || !movedRef.current) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const file = new File([blob], `buyback-signature-${Date.now()}.png`, {
      type: "image/png",
    });
    setHasSignature(true);
    onChange({
      dataUrl: canvas.toDataURL("image/png"),
      file,
      width: canvas.width,
      height: canvas.height,
    });
  }, [onChange]);

  function start(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    movedRef.current = false;
    const point = pointerPoint(event, canvas);
    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled || !drawingRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const point = pointerPoint(event, canvas);
    context.lineWidth = Math.max(3, canvas.width / 280);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = SIGNATURE_INK_COLOR;
    context.lineTo(point.x, point.y);
    context.stroke();
    movedRef.current = true;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">
          Firma del cliente{" "}
          {required ? <span className="text-status-danger-foreground">*</span> : null}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 gap-1.5"
          disabled={disabled || !hasSignature}
          onClick={clear}
        >
          <Eraser className="size-4" />
          Cancella
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={ariaLabel}
        aria-required={required}
        className={cn(
          "h-44 w-full touch-none rounded-xl border-2 border-dashed border-[var(--border-panel)] bg-white text-slate-900",
          disabled && "cursor-not-allowed opacity-60",
        )}
        onPointerDown={start}
        onPointerMove={draw}
        onPointerUp={() => void finish()}
        onPointerCancel={() => void finish()}
      />
      <p className="text-[11px] leading-4 text-muted-foreground">
        Firma dentro il riquadro. La firma viene collegata a dispositivo, importo, pagamento e
        dichiarazioni.
      </p>
    </div>
  );
}

export function initializeSignatureBitmap(
  context: Pick<CanvasRenderingContext2D, "save" | "restore" | "fillRect" | "fillStyle">,
  width: number,
  height: number,
) {
  context.save();
  context.fillStyle = SIGNATURE_BACKGROUND_COLOR;
  context.fillRect(0, 0, width, height);
  context.restore();
}

function pointerPoint(event: PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}
