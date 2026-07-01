"use client";

import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { Eye, EyeOff, Grid3X3, LockKeyhole, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEVICE_UNLOCK_METHOD_LABELS,
  deviceUnlockInputFromOrder,
  getDeviceUnlockLabel,
  normalizeUnlockPattern,
} from "@/features/orders/model/device-unlock";
import type { DeviceUnlockInput, DeviceUnlockMethod, RepairOrder } from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";

const patternPoints = Array.from({ length: 9 }, (_, index) => index + 1);
const pointPositions = patternPoints.map((point) => ({
  point,
  x: ((point - 1) % 3) * 50 + 10,
  y: Math.floor((point - 1) / 3) * 50 + 10,
}));

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
    onChange({
      method: next,
      value: value?.method === "text" || value?.method === "pin" ? value.value : "",
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
            value={value?.method === method ? value.value : ""}
            inputMode={method === "pin" ? "numeric" : "text"}
            maxLength={method === "pin" ? 16 : 80}
            autoComplete="off"
            className="h-9 rounded-lg bg-card text-base md:text-sm"
            placeholder={method === "pin" ? "例如 001258" : "例如 password / 客户提示"}
            onChange={(event) => onChange({ method, value: event.target.value })}
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
  const [drawing, setDrawing] = useState(false);
  const normalized = useMemo(() => {
    try {
      return value.length ? normalizeUnlockPattern(value) : [];
    } catch {
      return value.filter((point) => Number.isInteger(point) && point >= 1 && point <= 9);
    }
  }, [value]);
  const addPoint = (point: number) => {
    if (normalized.includes(point)) return;
    onChange([...normalized, point]);
  };

  const start = (event: PointerEvent<HTMLButtonElement>, point: number) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrawing(true);
    addPoint(point);
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
          onClick={() => onChange([])}
        >
          <X className="size-3" />
          清除
        </button>
      </div>
      <div
        className="relative mx-auto grid size-[132px] touch-none grid-cols-3 gap-3"
        onPointerUp={() => setDrawing(false)}
        onPointerLeave={() => setDrawing(false)}
      >
        <PatternLines pattern={normalized} />
        {patternPoints.map((point) => {
          const index = normalized.indexOf(point);
          const selected = index >= 0;
          return (
            <button
              key={point}
              type="button"
              data-device-unlock-pattern-point={point}
              className={cn(
                "relative z-10 grid size-9 place-items-center rounded-full border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-[var(--border-panel)] bg-[var(--surface-panel-muted)] text-muted-foreground hover:bg-accent",
              )}
              aria-label={`图案点 ${point}`}
              onPointerDown={(event) => start(event, point)}
              onPointerEnter={() => {
                if (drawing) addPoint(point);
              }}
            >
              {selected ? index + 1 : point}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[9px] leading-3 text-muted-foreground">
        已连接 {normalized.length}/9 个点，保存时需要至少 4 个点。
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
        "relative grid touch-none grid-cols-3",
        compact ? "size-[72px] gap-1.5" : "mx-auto size-[108px] gap-2.5",
      )}
    >
      <PatternLines pattern={normalized} compact={compact} />
      {patternPoints.map((point) => {
        const index = normalized.indexOf(point);
        const selected = index >= 0;
        return (
          <span
            key={point}
            className={cn(
              "relative z-10 grid rounded-full border text-[9px] font-semibold",
              compact ? "size-5 place-items-center" : "size-7 place-items-center",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-[var(--border-panel)] bg-card text-muted-foreground",
            )}
          >
            {selected ? index + 1 : ""}
          </span>
        );
      })}
    </div>
  );
}

function PatternLines({ pattern, compact = false }: { pattern: number[]; compact?: boolean }) {
  const scale = compact ? 0.545 : 0.818;
  const points = pattern
    .map((point) => pointPositions.find((item) => item.point === point))
    .filter((point): point is (typeof pointPositions)[number] => Boolean(point))
    .map((point) => ({ x: point.x * scale, y: point.y * scale }));

  if (points.length < 2) return null;

  return (
    <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full" aria-hidden>
      <polyline
        points={points.map((point) => `${point.x},${point.y}`).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={compact ? 2 : 3}
        className="text-primary/60"
      />
    </svg>
  );
}
