"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type InventoryConflictKind = "version" | "projection" | "idempotency" | "state" | "generic";

export type InventoryConflictDetails = {
  status: 409;
  code: string;
  kind: InventoryConflictKind;
  title: string;
  description: string;
};

type ConflictLike = {
  status?: unknown;
  code?: unknown;
  message?: unknown;
};

const conflictCodes = new Set([
  "conflict",
  "stale_version",
  "version_conflict",
  "projection_conflict",
  "projection_mismatch",
  "invalid_state",
  "invalid_state_transition",
  "v2_state_conflict",
  "idempotency_conflict",
  "idempotency_actor_conflict",
]);

/**
 * Converts API errors into a safe, structured UI contract. The client API
 * normally returns RepairDeskApiError, while a few legacy server adapters
 * attach the same status/code fields to Error; both are intentionally handled
 * without inspecting localized message text.
 */
export function getInventoryConflictDetails(error: unknown): InventoryConflictDetails | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as ConflictLike;
  if (candidate.status !== 409) return null;
  const code = typeof candidate.code === "string" ? candidate.code : "conflict";

  const kind: InventoryConflictKind = !conflictCodes.has(code)
    ? "generic"
    : code.startsWith("idempotency")
      ? "idempotency"
      : code.includes("projection") || code === "v2_state_conflict"
        ? "projection"
        : code === "invalid_state" || code === "invalid_state_transition"
          ? "state"
          : code === "stale_version" || code === "version_conflict"
            ? "version"
            : "generic";

  const copy = {
    version: {
      title: "资料版本已变化",
      description: "服务端发现这份资料已有新版本。当前写入没有自动重试，请刷新后重新核对。",
    },
    projection: {
      title: "库存状态需要重新核对",
      description: "商品状态投影与当前写入不一致。当前写入没有自动重试，请刷新后再确认。",
    },
    idempotency: {
      title: "保存标识需要更新",
      description:
        "本次保存标识已被占用或属于其他请求。当前写入没有自动重试，刷新后会使用新的标识。",
    },
    state: {
      title: "当前状态不允许此操作",
      description: "服务端状态已经变化，当前写入没有自动重试。刷新后请重新查看可用动作。",
    },
    generic: {
      title: "操作发生冲突",
      description: "服务端拒绝了这次写入。当前写入没有自动重试，请刷新后重新确认。",
    },
  }[kind];

  return { status: 409, code, kind, ...copy };
}

export type InventoryConflictPanelProps = {
  conflict: InventoryConflictDetails;
  onRecover: () => void | Promise<void>;
  pending?: boolean;
  preserveDraft?: boolean;
  privacyRedacted?: boolean;
  className?: string;
};

export function InventoryConflictPanel({
  conflict,
  onRecover,
  pending = false,
  preserveDraft = false,
  privacyRedacted = false,
  className,
}: InventoryConflictPanelProps) {
  const [localError, setLocalError] = useState("");
  const recover = async () => {
    setLocalError("");
    try {
      await onRecover();
    } catch {
      setLocalError("刷新失败，当前内容没有自动提交；请稍后再次刷新。");
    }
  };

  return (
    <section
      data-ui="inventory-conflict-panel"
      data-conflict-kind={conflict.kind}
      role="alert"
      aria-live="assertive"
      className={cn(
        "grid min-w-0 gap-2 rounded-xl border border-status-warn/40 bg-status-warn/10 p-3 text-foreground sm:p-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-status-warn text-status-warn-foreground"
        >
          <RefreshCw className={cn("size-4", pending && "animate-spin")} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{conflict.title}</h2>
          <p className="mt-1 text-xs leading-5 text-foreground">{conflict.description}</p>
        </div>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        {preserveDraft
          ? "刷新后会保留当前未保存的改动供你检查；不会自动保存或重放刚才的写入。"
          : "恢复动作只读取服务端最新状态，不会自动重放刚才的写入。"}
      </p>
      {privacyRedacted ? (
        <p className="text-xs leading-5 text-muted-foreground">
          为保护隐私，此状态不显示商品、金额或设备标识。
        </p>
      ) : null}
      {localError ? (
        <p role="alert" aria-live="assertive" className="text-xs text-destructive">
          {localError}
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full sm:w-fit"
        disabled={pending}
        onClick={() => void recover()}
      >
        {pending ? "正在刷新…" : preserveDraft ? "刷新并保留我的改动" : "刷新最新状态"}
      </Button>
      {pending ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          正在读取最新状态；不会提交任何写入。
        </p>
      ) : null}
    </section>
  );
}
