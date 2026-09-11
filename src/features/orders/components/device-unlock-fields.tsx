"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Check, Delete, Eye, EyeOff, Grid3X3, LockKeyhole, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VirtualKeyboardDock } from "@/components/ui/virtual-keyboard-dock";
import { useVirtualKeyboardSurface } from "@/hooks/use-virtual-keyboard-surface";
import {
  DEVICE_UNLOCK_PATTERN_MAX_STEPS,
  DEVICE_UNLOCK_PATTERN_MIN_STEPS,
  deviceUnlockInputFromOrder,
  normalizeUnlockPattern,
} from "@/features/orders/model/device-unlock";
import { localizeDeviceUnlockMethod } from "@/features/orders/model/order-i18n";
import type { DeviceUnlockInput, DeviceUnlockMethod, RepairOrder } from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

const patternPoints = Array.from({ length: 9 }, (_, index) => index + 1);
const pinKeypadDigits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;

const patternGeometry = {
  input: { size: 156, pointSize: 44, gap: 12, hitRadius: 26, strokeWidth: 3 },
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

function patternPointPosition(point: number, variant: PatternGeometryVariant) {
  const center = patternPointCenter(point, variant);
  const size = patternGeometry[variant].size;
  return { left: `${(center.x / size) * 100}%`, top: `${(center.y / size) * 100}%` };
}

function sanitizePatternDraft(pattern: readonly number[]) {
  const seen = new Set<number>();
  const points: number[] = [];

  for (const rawPoint of pattern) {
    const point = Number(rawPoint);
    if (!Number.isInteger(point) || point < 1 || point > 9 || seen.has(point)) continue;
    points.push(point);
    seen.add(point);
    if (points.length >= DEVICE_UNLOCK_PATTERN_MAX_STEPS) break;
  }

  return points;
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
  const { t } = useLocale();
  const method = value?.method ?? "none";

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
            ["none", t("orders2b1.unlock.none")],
            ["text", t("orders2b1.unlock.text")],
            ["pin", t("orders2b1.unlock.pin")],
            ["pattern", t("orders2b1.unlock.pattern")],
          ] as const
        ).map(([item, label]) => (
          <button
            key={item}
            type="button"
            data-device-unlock-method={item}
            className={cn(
              "min-h-11 min-w-0 rounded-lg border border-[var(--border-panel)] px-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring lg:min-h-8 lg:text-xs lg:leading-4",
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

      {method === "text" ? (
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
            {t("orders2b1.unlock.textLabel")}
          </Label>
          <Input
            type="text"
            value={value?.method === "text" ? value.value : ""}
            inputMode="text"
            maxLength={80}
            autoComplete="off"
            className="h-[38px] rounded-lg bg-card text-base md:text-sm lg:h-9"
            placeholder={t("orders2b1.unlock.textPlaceholder")}
            onChange={(event) => {
              onChange({ method: "text", value: event.target.value });
            }}
          />
          <p className="text-[9px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
            {t("orders2b1.unlock.textHelp")}
          </p>
        </div>
      ) : null}

      {method === "pin" ? (
        <PinKeypadInput
          value={value?.method === "pin" ? value.value : ""}
          onChange={(pin) => onChange({ method: "pin", value: pin })}
        />
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
  const { t } = useLocale();
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
        <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium text-muted-foreground lg:text-xs lg:leading-4">
          <LockKeyhole className="size-3.5 shrink-0" />
          <span className="truncate">{t("orders2b1.unlock.notProvided")}</span>
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
          <span className="truncate text-[10px] font-semibold leading-3 text-foreground lg:text-xs lg:leading-4">
            {localizeDeviceUnlockMethod(method, t)}
          </span>
        </div>
        <Button
          type="button"
          data-device-unlock-reveal="true"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1 rounded-md px-2 text-[10px] lg:h-6 lg:px-1.5 lg:text-xs lg:leading-4"
          onClick={() => setRevealed((value) => !value)}
        >
          {revealed ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
          {revealed ? t("orders2b1.unlock.hide") : t("orders2b1.unlock.view")}
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
        <p className="mt-1 truncate text-[9px] leading-3 text-muted-foreground lg:text-xs lg:leading-4">
          {t("orders2b1.unlock.hiddenHelp")}
        </p>
      )}
    </div>
  );
}

export function DeviceUnlockListBadge({
  method,
  label,
  className,
}: {
  method?: DeviceUnlockMethod;
  label?: string;
  className?: string;
}) {
  const { t } = useLocale();
  if (!method) return null;
  return (
    <span
      data-device-unlock-list-badge="true"
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold leading-3 text-primary lg:text-xs lg:leading-4",
        className,
      )}
    >
      <LockKeyhole className="size-3 shrink-0" />
      <span className="truncate">{label ?? localizeDeviceUnlockMethod(method, t)}</span>
    </span>
  );
}

function PinKeypadInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useLocale();
  const pin = value.replace(/\D/g, "").slice(0, 16);
  const pinRef = useRef(pin);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const nativeInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const keyboardSurface = useVirtualKeyboardSurface();

  useEffect(() => {
    pinRef.current = pin;
  }, [pin]);

  useEffect(() => {
    if (pin !== value) {
      pinRef.current = pin;
      onChange(pin);
    }
  }, [onChange, pin, value]);

  useEffect(() => {
    if (keyboardSurface !== "native" || !open) return;
    setOpen(false);
    queueMicrotask(() => nativeInputRef.current?.focus());
  }, [keyboardSurface, open]);

  const appendDigit = (digit: string) => {
    const current = pinRef.current;
    if (current.length >= 16) return;
    const next = `${current}${digit}`;
    pinRef.current = next;
    onChange(next);
  };

  const removeLastDigit = () => {
    const current = pinRef.current;
    if (!current) return;
    const next = current.slice(0, -1);
    pinRef.current = next;
    onChange(next);
  };

  const clearPin = () => {
    if (!pinRef.current) return;
    pinRef.current = "";
    onChange("");
  };

  const handleDisplayKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      appendDigit(event.key);
      return;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      removeLastDigit();
      return;
    }
    if (event.key === "Delete" || event.key === "Escape") {
      event.preventDefault();
      clearPin();
    }
  };

  return (
    <div className="space-y-1" data-device-unlock-pin-keypad="true">
      <Label
        htmlFor={keyboardSurface === "native" ? "device-unlock-pin" : undefined}
        className="text-[10px] font-semibold leading-3 text-muted-foreground lg:text-xs lg:leading-4"
      >
        {t("orders2b1.unlock.pinTitle")}
      </Label>
      {keyboardSurface === "native" ? (
        <Input
          ref={nativeInputRef}
          id="device-unlock-pin"
          data-device-unlock-pin-native-input="true"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={16}
          value={pin}
          className="h-[38px] rounded-lg bg-card text-base font-mono tracking-wide md:text-sm lg:h-9"
          placeholder={t("orders2b1.unlock.pinPlaceholder")}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, "").slice(0, 16);
            pinRef.current = next;
            onChange(next);
          }}
        />
      ) : (
        <>
          <button
            ref={triggerRef}
            type="button"
            aria-label={t("orders2b1.unlock.pinAria")}
            aria-expanded={open}
            className="flex h-[38px] w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-left text-base outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring md:text-sm lg:h-9"
            onClick={() => setOpen(true)}
            onKeyDown={handleDisplayKeyDown}
          >
            <span
              className={cn(
                "min-w-0 flex-1 truncate font-mono font-semibold tabular-nums tracking-wide",
                pin ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {pin || t("orders2b1.unlock.pinPrompt")}
            </span>
            <span className="shrink-0 text-[10px] font-medium leading-3 text-muted-foreground lg:text-xs lg:leading-4">
              {pin.length}/16
            </span>
          </button>

          <VirtualKeyboardDock
            open={open}
            onOpenChange={setOpen}
            label={t("orders2b1.unlock.pinKeypad")}
            triggerRef={triggerRef}
          >
            <div data-device-unlock-pin-keypad-panel="true">
              <div className="mb-2 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5">
                <span
                  className={cn(
                    "min-w-0 truncate font-mono text-sm font-semibold tabular-nums",
                    pin ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {pin || "0"}
                </span>
                <span className="shrink-0 text-[10px] font-medium leading-3 text-muted-foreground lg:text-xs lg:leading-4">
                  {pin.length}/16
                </span>
              </div>
              <div
                className="grid grid-cols-3 gap-1.5"
                role="group"
                aria-label={t("orders2b1.unlock.pinKeypad")}
              >
                {pinKeypadDigits.slice(0, 9).map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    data-device-unlock-pin-digit={digit}
                    className="h-11 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] text-base font-semibold tabular-nums transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-45 lg:h-10"
                    disabled={pin.length >= 16}
                    onClick={() => appendDigit(digit)}
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  data-device-unlock-pin-clear="true"
                  className="h-11 rounded-lg border border-[var(--border-panel)] bg-card text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-45 lg:h-10 lg:text-xs lg:leading-4"
                  disabled={!pin}
                  onClick={clearPin}
                >
                  {t("orders2b1.keypad.clear")}
                </button>
                <button
                  type="button"
                  data-device-unlock-pin-digit="0"
                  className="h-11 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] text-base font-semibold tabular-nums transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-45 lg:h-10"
                  disabled={pin.length >= 16}
                  onClick={() => appendDigit("0")}
                >
                  0
                </button>
                <button
                  type="button"
                  data-device-unlock-pin-backspace="true"
                  aria-label={t("orders2b1.unlock.backspace")}
                  className="grid h-11 place-items-center rounded-lg border border-[var(--border-panel)] bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-45 lg:h-10"
                  disabled={!pin}
                  onClick={removeLastDigit}
                >
                  <Delete className="size-4" />
                </button>
              </div>
              <Button
                type="button"
                size="sm"
                className="mt-1.5 h-11 w-full rounded-lg text-xs font-semibold lg:h-10"
                onClick={() => setOpen(false)}
                data-device-unlock-pin-done="true"
              >
                <Check className="mr-1 size-3.5" />
                {t("orders2b1.keypad.done")}
              </Button>
            </div>
          </VirtualKeyboardDock>
          <p className="text-[9px] leading-3 text-muted-foreground lg:text-xs lg:leading-4">
            {t("orders2b1.unlock.pinHelp")}
          </p>
        </>
      )}
    </div>
  );
}

function PatternLockInput({
  value,
  onChange,
}: {
  value: number[];
  onChange: (pattern: number[]) => void;
}) {
  const { t } = useLocale();
  const drawingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const previousPointerRef = useRef<{ x: number; y: number } | null>(null);
  const [ignoredPoint, setIgnoredPoint] = useState<number | null>(null);
  const draftPattern = useMemo(() => sanitizePatternDraft(value), [value]);
  const draftPatternRef = useRef<number[]>(draftPattern);

  useEffect(() => {
    draftPatternRef.current = draftPattern;
  }, [draftPattern]);

  useEffect(() => {
    if (!ignoredPoint) return;
    const timeout = window.setTimeout(() => setIgnoredPoint(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [ignoredPoint]);

  useEffect(() => {
    if (draftPattern.length === value.length) return;
    onChange(draftPattern);
  }, [draftPattern, onChange, value.length]);

  useEffect(() => {
    const stopDrawing = () => {
      drawingRef.current = false;
      activePointerIdRef.current = null;
      previousPointerRef.current = null;
    };
    window.addEventListener("pointerup", stopDrawing);
    window.addEventListener("pointercancel", stopDrawing);
    return () => {
      window.removeEventListener("pointerup", stopDrawing);
      window.removeEventListener("pointercancel", stopDrawing);
    };
  }, []);

  const appendPoint = (point: number) => {
    const current = draftPatternRef.current;
    if (current.includes(point)) {
      setIgnoredPoint(point);
      return;
    }
    if (current.length >= DEVICE_UNLOCK_PATTERN_MAX_STEPS) return;
    const next = [...current, point];
    draftPatternRef.current = next;
    setIgnoredPoint(null);
    onChange(next);
  };

  const coordinateFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const geometry = patternGeometry.input;
    if (!rect.width || !rect.height) return null;
    // Share the SVG coordinate space at every responsive size and scroll position.
    return {
      x: ((event.clientX - rect.left) / rect.width) * geometry.size,
      y: ((event.clientY - rect.top) / rect.height) * geometry.size,
    };
  };

  const pointsAlongSegment = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const geometry = patternGeometry.input;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;

    return patternPoints
      .map((point) => {
        const center = patternPointCenter(point, "input");
        const rawProgress =
          lengthSquared === 0
            ? 0
            : ((center.x - start.x) * dx + (center.y - start.y) * dy) / lengthSquared;
        const progress = Math.max(0, Math.min(1, rawProgress));
        const nearestX = start.x + progress * dx;
        const nearestY = start.y + progress * dy;
        return {
          point,
          progress,
          distance: Math.hypot(center.x - nearestX, center.y - nearestY),
        };
      })
      .filter(({ distance }) => distance <= geometry.hitRadius)
      .sort((left, right) => left.progress - right.progress)
      .map(({ point }) => point);
  };

  const pointFromCoordinate = (coordinate: { x: number; y: number }) => {
    const geometry = patternGeometry.input;
    const { x, y } = coordinate;

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
    const coordinate = coordinateFromPointer(event);
    if (!coordinate) return;
    const point = pointFromCoordinate(coordinate);
    if (!point) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Safari can reject capture during a gesture; the window fallback still ends it.
    }
    drawingRef.current = true;
    activePointerIdRef.current = event.pointerId;
    previousPointerRef.current = coordinate;
    appendPoint(point);
  };

  const continueDrawing = (event: PointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current || activePointerIdRef.current !== event.pointerId) return;
    const coordinate = coordinateFromPointer(event);
    const previous = previousPointerRef.current;
    if (!coordinate || !previous) return;
    event.preventDefault();
    for (const point of pointsAlongSegment(previous, coordinate)) {
      if (!draftPatternRef.current.includes(point)) appendPoint(point);
    }
    previousPointerRef.current = coordinate;
  };

  const stopDrawing = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Capture may already have been released by Safari.
    }
    drawingRef.current = false;
    activePointerIdRef.current = null;
    previousPointerRef.current = null;
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
          <span className="truncate text-[10px] font-semibold leading-3 text-foreground lg:text-xs lg:leading-4">
            {t("orders2b1.unlock.patternDraw")}
          </span>
        </div>
        <button
          type="button"
          className="inline-flex h-11 shrink-0 items-center gap-1 rounded-md px-2 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground lg:h-6 lg:px-1.5 lg:text-xs lg:leading-4"
          onClick={clearPattern}
        >
          <X className="size-3" />
          {t("orders2b1.keypad.clear")}
        </button>
      </div>
      <div
        data-device-unlock-pattern-grid="true"
        role="group"
        aria-label={t("orders2b1.unlock.patternDraw")}
        className="relative mx-auto size-[156px] touch-none lg:size-[132px]"
        onPointerDown={startDrawing}
        onPointerMove={continueDrawing}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        onLostPointerCapture={stopDrawing}
      >
        <PatternLines pattern={draftPattern} variant="input" />
        {patternPoints.map((point) => {
          const index = draftPattern.indexOf(point);
          const selected = index >= 0;
          const stepNumber = index + 1;
          const isStart = selected && stepNumber === 1;
          const isEnd = selected && stepNumber === draftPattern.length;
          return (
            <button
              key={point}
              type="button"
              data-device-unlock-pattern-point={point}
              aria-pressed={selected}
              style={patternPointPosition(point, "input")}
              className={cn(
                "absolute z-10 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring lg:size-9",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-[var(--border-panel)] bg-[var(--surface-panel-muted)] text-muted-foreground hover:bg-accent",
                isStart && "ring-2 ring-primary/30 ring-offset-2 ring-offset-card",
                "lg:text-xs lg:leading-4",
              )}
              aria-label={
                selected
                  ? t("orders2b1.unlock.patternStep", {
                      point,
                      step: stepNumber,
                      position: `${isStart ? t("orders2b1.unlock.patternStart") : ""}${isEnd ? t("orders2b1.unlock.patternEnd") : ""}`,
                    })
                  : t("orders2b1.unlock.patternPoint", { point })
              }
              onKeyDown={(event) => addPointWithKeyboard(event, point)}
            >
              {selected ? stepNumber : null}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[9px] leading-3 text-muted-foreground lg:text-xs lg:leading-4">
        {draftPattern.length > 0
          ? t("orders2b1.unlock.patternSummary", {
              count: draftPattern.length,
              max: DEVICE_UNLOCK_PATTERN_MAX_STEPS,
            })
          : t("orders2b1.unlock.patternEmpty", {
              min: DEVICE_UNLOCK_PATTERN_MIN_STEPS,
            })}
        {draftPattern.length >= DEVICE_UNLOCK_PATTERN_MAX_STEPS
          ? t("orders2b1.unlock.patternMax", { max: DEVICE_UNLOCK_PATTERN_MAX_STEPS })
          : null}
      </p>
      <p
        className={cn(
          "mt-1 min-h-3 text-center text-[9px] leading-3 lg:text-xs lg:leading-4",
          ignoredPoint ? "text-primary" : "text-muted-foreground",
        )}
        aria-live="polite"
      >
        {ignoredPoint
          ? t("orders2b1.unlock.patternDuplicate", {
              point: ignoredPoint,
              step: draftPattern.indexOf(ignoredPoint) + 1,
            })
          : t("orders2b1.unlock.patternUnique")}
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
      className={cn("relative touch-none", compact ? "size-[72px]" : "mx-auto size-[108px]")}
    >
      <PatternLines pattern={normalized} variant={compact ? "compact" : "preview"} />
      {patternPoints.map((point) => {
        const index = normalized.indexOf(point);
        const selected = index >= 0;
        const stepNumber = index + 1;
        return (
          <span
            key={point}
            data-device-unlock-preview-point={point}
            style={patternPointPosition(point, compact ? "compact" : "preview")}
            className={cn(
              "absolute z-10 grid -translate-x-1/2 -translate-y-1/2 rounded-full border text-[9px] font-semibold tabular-nums lg:text-[11px] lg:leading-4",
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
    <svg
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      viewBox={`0 0 ${geometry.size} ${geometry.size}`}
      aria-hidden
    >
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
