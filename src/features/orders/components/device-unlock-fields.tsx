"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Eye, EyeOff, Grid3X3, LockKeyhole, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEVICE_UNLOCK_METHOD_LABELS,
  DEVICE_UNLOCK_PATTERN_MAX_STEPS,
  DEVICE_UNLOCK_PATTERN_MIN_STEPS,
  deviceUnlockInputFromOrder,
  getDeviceUnlockLabel,
  normalizeUnlockPattern,
} from "@/features/orders/model/device-unlock";
import type { DeviceUnlockInput, DeviceUnlockMethod, RepairOrder } from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";

const patternPoints = Array.from({ length: 9 }, (_, index) => index + 1);

const patternGeometry = {
  input: { size: 132, pointSize: 36, gap: 12, hitRadius: 24, strokeWidth: 3 },
  preview: { size: 108, pointSize: 28, gap: 10, hitRadius: 0, strokeWidth: 3 },
  compact: { size: 72, pointSize: 20, gap: 6, hitRadius: 0, strokeWidth: 2 },
} as const;

type PatternGeometryVariant = keyof typeof patternGeometry;

function patternPointCenter(point: number, variant: PatternGeometryVariant) {
  const geometry = patternGeometry[variant];
  const innerSize = geometry.pointSize * 3 + geometry.gap * 2;
  const offset = (geometry.size - innerSize) / 2;
  const column = (point - 1) % 3;
  const row = Math.floor((point - 1) / 3);
  return {
    x: offset + column * (geometry.pointSize + geometry.gap) + geometry.pointSize / 2,
    y: offset + row * (geometry.pointSize + geometry.gap) + geometry.pointSize / 2,
  };
}

function sanitizePatternDraft(pattern: readonly number[]) {
  return pattern
    .map((point) => Number(point))
    .filter((point) => Number.isInteger(point) && point >= 1 && point <= 9)
    .slice(0, DEVICE_UNLOCK_PATTERN_MAX_STEPS);
}

export function DeviceUnlockEditor({
  value,
  onChange,
  className,
  compact = false,
}: {
  value?: DeviceUnlockInput;
  onChange: (value: DeviceUnlockInput) => void;
  className?: string;
  compact?: boolean;
}) {
  const method = value?.method ?? "none";
  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (method !== "pin") return;
    const frame = window.requestAnimationFrame(() => {
      pinInputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [method]);

  const setMethod = (next: "none" | DeviceUnlockMethod) => {
    if (next === "none") {
      onChange({ method: "none" });
      return;
    }
    if (next === "pattern") {
      onChange({
        method: "pattern",
        pattern: value?.method === "pattern" ? value.pattern : [],
      });
      return;
    }
    const currentValue = value?.method === "text" || value?.method === "pin" ? value.value : "";
    onChange({
      method: next,
      value: next === "pin" ? currentValue.replace(/\D/g, "").slice(0, 16) : currentValue,
    });
  };

  return (
    <div className={cn("min-w-0 space-y-2", className)} data-device-unlock-editor="true">
      <div
        className={cn(
          "grid min-w-0 gap-1",
          compact ? "grid-cols-4" : "grid-cols-2 min-[420px]:grid-cols-4",
        )}
      >
        {(
          [
            ["none", "无"],
            ["text", "文字"],
            ["pin", "PIN"],
            ["pattern", "图案"],
          ] as const
        ).map(([item, label]) => (
          <button
            key={item}
            type="button"
            data-device-unlock-method={item}
            className={cn(
              "h-8 min-w-0 rounded-lg border border-[var(--border-panel)] px-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              method === item
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
            onClick={() => setMethod(item)}
          >
            <span className="block truncate">{label}</span>
          </button>
        ))}
      </div>

      {method === "text" || method === "pin" ? (
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold leading-3 text-muted-foreground">
            {method === "pin" ? "数字 PIN" : "文字 / 字母密码"}
          </Label>
          <Input
            ref={pinInputRef}
            type={method === "pin" ? "tel" : "text"}
            value={value?.method === method ? value.value : ""}
            inputMode={method === "pin" ? "numeric" : "text"}
            pattern={method === "pin" ? "[0-9]*" : undefined}
            enterKeyHint={method === "pin" ? "done" : undefined}
            maxLength={method === "pin" ? 16 : 80}
            autoComplete="off"
            autoFocus={method === "pin"}
            className="h-9 rounded-lg bg-card text-base md:text-sm"
            placeholder={method === "pin" ? "例如 001258" : "例如 password / 客户提示"}
            onChange={(event) => {
              const nextValue =
                method === "pin"
                  ? event.target.value.replace(/\D/g, "").slice(0, 16)
                  : event.target.value;
              onChange({ method, value: nextValue });
            }}
          />
          <p className="text-[9px] leading-3 text-muted-foreground">
            {method === "pin" ? "PIN 会按文本保存，保留前导 0。" : "最多 80 个字符。"}
          </p>
        </div>
      ) : null}

      {method === "pattern" ? (
        <PatternLockInput
          value={value?.method === "pattern" ? value.pattern : []}
          onChange={(pattern) => onChange({ method: "pattern", pattern })}
        />
      ) : null}
    </div>
  );
}

export function DeviceUnlockViewer({
  order,
  className,
  compact = false,
}: {
  order: RepairOrder;
  className?: string;
  compact?: boolean;
}) {
  const unlock = deviceUnlockInputFromOrder(order);
  const [revealed, setRevealed] = useState(false);
  const method = order.device_unlock_method;

  useEffect(() => {
    setRevealed(false);
  }, [method, order.id, order.device_unlock_value, order.device_unlock_pattern]);

  useEffect(() => {
    if (!revealed) return;
    const timeout = window.setTimeout(() => setRevealed(false), 15_000);
    return () => window.clearTimeout(timeout);
  }, [revealed]);

  if (!method) {
    return (
      <div
        className={cn("rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5", className)}
        data-device-unlock-viewer="true"
      >
        <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
          <LockKeyhole className="size-3.5 shrink-0" />
          <span className="truncate">未留手机密码</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("min-w-0 rounded-lg bg-[var(--surface-panel-muted)] p-1.5", className)}
      data-device-unlock-viewer="true"
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <LockKeyhole className="size-3.5 shrink-0 text-primary" />
          <span className="truncate text-[10px] font-semibold leading-3 text-foreground">
            {getDeviceUnlockLabel(method)}
          </span>
        </div>
        <Button
          type="button"
          data-device-unlock-reveal="true"
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 gap-1 rounded-md px-1.5 text-[10px]"
          onClick={() => setRevealed((value) => !value)}
        >
          {revealed ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
          {revealed ? "隐藏" : "查看"}
        </Button>
      </div>
      {revealed ? (
        <div className="mt-1.5">
          {unlock.method === "pattern" ? (
            <PatternPreview pattern={unlock.pattern} compact={compact} />
          ) : unlock.method === "text" || unlock.method === "pin" ? (
            <div className="rounded-md bg-card px-2 py-1.5 font-mono text-xs font-semibold leading-4 text-foreground">
              {unlock.value}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-1 truncate text-[9px] leading-3 text-muted-foreground">
          默认隐藏，查看后 15 秒自动遮挡。
        </p>
      )}
    </div>
  );
}

export function DeviceUnlockListBadge({
  method,
  className,
}: {
  method?: DeviceUnlockMethod;
  className?: string;
}) {
  if (!method) return null;
  return (
    <span
      data-device-unlock-list-badge="true"
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold leading-3 text-primary",
        className,
      )}
    >
      <LockKeyhole className="size-3 shrink-0" />
      <span className="truncate">{getDeviceUnlockLabel(method)}</span>
    </span>
  );
}

function PatternLockInput({
  value,
  onChange,
}: {
  value: number[];
  onChange: (pattern: number[]) => void;
}) {
  const drawingRef = useRef(false);
  const draftPattern = useMemo(() => sanitizePatternDraft(value), [value]);
  const draftPatternRef = useRef<number[]>(draftPattern);

  useEffect(() => {
    draftPatternRef.current = draftPattern;
  }, [draftPattern]);

  const appendPoint = (point: number) => {
    const current = draftPatternRef.current;
    if (current.length >= DEVICE_UNLOCK_PATTERN_MAX_STEPS) return;
    if (current.at(-1) === point) return;
    const next = [...current, point];
    draftPatternRef.current = next;
    onChange(next);
  };

  const pointFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const geometry = patternGeometry.input;

    let matchedPoint: number | null = null;
    let matchedDistance = Number.POSITIVE_INFINITY;

    for (const point of patternPoints) {
      const center = patternPointCenter(point, "input");
      const distance = Math.hypot(center.x - x, center.y - y);
      if (distance <= geometry.hitRadius && distance < matchedDistance) {
        matchedPoint = point;
        matchedDistance = distance;
      }
    }

    return matchedPoint;
  };

  const startDrawing = (event: PointerEvent<HTMLDivElement>) => {
    const point = pointFromPointer(event);
    if (!point) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    appendPoint(point);
  };

  const continueDrawing = (event: PointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current) return;
    const point = pointFromPointer(event);
    if (!point) return;
    event.preventDefault();
    appendPoint(point);
  };

  const stopDrawing = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drawingRef.current = false;
  };

  const clearPattern = () => {
    draftPatternRef.current = [];
    onChange([]);
  };

  const addPointWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>, point: number) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    appendPoint(point);
  };

  return (
    <div
      className="rounded-xl border border-[var(--border-panel)] bg-card p-2"
      data-device-unlock-pattern-input="true"
    >
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Grid3X3 className="size-3.5 shrink-0 text-primary" />
          <span className="truncate text-[10px] font-semibold leading-3 text-foreground">
            绘制图案
          </span>
        </div>
        <button
          type="button"
          className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={clearPattern}
        >
          <X className="size-3" />
          清除
        </button>
      </div>
      <div
        className="relative mx-auto grid size-[132px] touch-none grid-cols-3 place-content-center gap-3"
        onPointerDown={startDrawing}
        onPointerMove={continueDrawing}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        onPointerLeave={stopDrawing}
      >
        <PatternLines pattern={draftPattern} variant="input" />
        {patternPoints.map((point) => {
          const index = draftPattern.lastIndexOf(point);
          const selected = index >= 0;
          const stepNumber = index + 1;
          return (
            <button
              key={point}
              type="button"
              data-device-unlock-pattern-point={point}
              className={cn(
                "relative z-10 grid size-9 place-items-center rounded-full border font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                selected && stepNumber >= 100 ? "text-[9px]" : "text-xs",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-[var(--border-panel)] bg-[var(--surface-panel-muted)] text-muted-foreground hover:bg-accent",
              )}
              aria-label={
                selected ? `图案点 ${point}，最后为第 ${stepNumber} 步` : `图案点 ${point}`
              }
              onKeyDown={(event) => addPointWithKeyboard(event, point)}
            >
              {selected ? stepNumber : point}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[9px] leading-3 text-muted-foreground">
        已连接 {draftPattern.length} 个点，保存时需要至少 {DEVICE_UNLOCK_PATTERN_MIN_STEPS} 个点。
        {draftPattern.length >= DEVICE_UNLOCK_PATTERN_MAX_STEPS
          ? ` 已到 ${DEVICE_UNLOCK_PATTERN_MAX_STEPS} 步上限。`
          : null}
      </p>
    </div>
  );
}

function PatternPreview({ pattern, compact = false }: { pattern: number[]; compact?: boolean }) {
  const normalized = useMemo(() => {
    try {
      return normalizeUnlockPattern(pattern);
    } catch {
      return [];
    }
  }, [pattern]);

  return (
    <div
      data-device-unlock-pattern-preview="true"
      className={cn(
        "relative grid touch-none grid-cols-3 place-content-center",
        compact ? "size-[72px] gap-1.5" : "mx-auto size-[108px] gap-2.5",
      )}
    >
      <PatternLines pattern={normalized} variant={compact ? "compact" : "preview"} />
      {patternPoints.map((point) => {
        const index = normalized.lastIndexOf(point);
        const selected = index >= 0;
        const stepNumber = index + 1;
        return (
          <span
            key={point}
            className={cn(
              "relative z-10 grid rounded-full border text-[9px] font-semibold tabular-nums",
              compact ? "size-5 place-items-center" : "size-7 place-items-center",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-[var(--border-panel)] bg-card text-muted-foreground",
            )}
          >
            {selected ? stepNumber : ""}
          </span>
        );
      })}
    </div>
  );
}

function PatternLines({
  pattern,
  variant,
}: {
  pattern: number[];
  variant: PatternGeometryVariant;
}) {
  const geometry = patternGeometry[variant];
  const points = pattern
    .filter((point) => Number.isInteger(point) && point >= 1 && point <= 9)
    .map((point) => patternPointCenter(point, variant));

  if (points.length < 2) return null;

  return (
    <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full" aria-hidden>
      <polyline
        points={points.map((point) => `${point.x},${point.y}`).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={geometry.strokeWidth}
        className="text-primary/60"
      />
    </svg>
  );
}
