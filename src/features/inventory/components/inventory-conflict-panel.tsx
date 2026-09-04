"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import type { MessageKey } from "@/shared/i18n/messages";

export type InventoryConflictKind = "version" | "projection" | "idempotency" | "state" | "generic";

export type InventoryConflictDetails = {
  status: 409;
  code: string;
  kind: InventoryConflictKind;
  title: string;
  description: string;
  copySource?: "structured-error";
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

  return { status: 409, code, kind, ...copy, copySource: "structured-error" };
}

export type InventoryConflictPanelProps = {
  conflict: InventoryConflictDetails;
  onRecover: () => void | Promise<void>;
  pending?: boolean;
  preserveDraft?: boolean;
  privacyRedacted?: boolean;
  className?: string;
};

const conflictCopyKeys: Record<
  InventoryConflictKind,
  { title: MessageKey; description: MessageKey }
> = {
  version: {
    title: "inventory2b4.conflict.version.title",
    description: "inventory2b4.conflict.version.description",
  },
  projection: {
    title: "inventory2b4.conflict.projection.title",
    description: "inventory2b4.conflict.projection.description",
  },
  idempotency: {
    title: "inventory2b4.conflict.idempotency.title",
    description: "inventory2b4.conflict.idempotency.description",
  },
  state: {
    title: "inventory2b4.conflict.state.title",
    description: "inventory2b4.conflict.state.description",
  },
  generic: {
    title: "inventory2b4.conflict.generic.title",
    description: "inventory2b4.conflict.generic.description",
  },
};

export function InventoryConflictPanel({
  conflict,
  onRecover,
  pending = false,
  preserveDraft = false,
  privacyRedacted = false,
  className,
}: InventoryConflictPanelProps) {
  const { t } = useLocale();
  const stateCopy = conflictCopyKeys[conflict.kind];
  const title = conflict.copySource === "structured-error" ? t(stateCopy.title) : conflict.title;
  const description =
    conflict.copySource === "structured-error" ? t(stateCopy.description) : conflict.description;
  const [localError, setLocalError] = useState("");
  const recover = async () => {
    setLocalError("");
    try {
      await onRecover();
    } catch {
      setLocalError(t("inventory2b4.conflict.recoveryError"));
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
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-foreground">{description}</p>
        </div>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        {preserveDraft
          ? t("inventory2b4.conflict.preserveDraft")
          : t("inventory2b4.conflict.readOnlyRecovery")}
      </p>
      {privacyRedacted ? (
        <p className="text-xs leading-5 text-muted-foreground">
          {t("inventory2b4.common.privacyRedacted")}
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
        {pending
          ? t("inventory2b4.conflict.refreshing")
          : preserveDraft
            ? t("inventory2b4.conflict.refreshPreserve")
            : t("inventory2b4.conflict.refresh")}
      </Button>
      {pending ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {t("inventory2b4.conflict.pending")}
        </p>
      ) : null}
    </section>
  );
}
