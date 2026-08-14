"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, Eye, Loader2, ShieldAlert, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type {
  InventoryOperationErrorDetails,
  InventoryOperationVerificationStatus,
} from "../model/inventory-operation-error";

export type InventoryOperationErrorPanelProps = {
  error: InventoryOperationErrorDetails;
  verificationStatus?: InventoryOperationVerificationStatus;
  onVerify?: () => void | Promise<void>;
  acknowledged?: boolean;
  onAcknowledge?: () => void;
  privacyRedacted?: boolean;
  className?: string;
};

const copy = {
  rejected: {
    title: "操作未被接受",
    description: "服务端拒绝了这次操作。请按当前字段提示修正后再试；不会自动重放写入。",
  },
  authorization: {
    title: "当前账号无法执行此操作",
    description: "当前门店或账号没有这项写入权限。没有自动重试，也不会改变服务端权限。",
  },
  "outcome-unknown": {
    title: "暂时无法确认写入结果",
    description: "请求中断或服务暂时不可用，写入可能已经完成。请先核对最新状态，不要重复提交。",
  },
} as const;

function toneClasses(kind: InventoryOperationErrorDetails["kind"]) {
  if (kind === "authorization") return "border-status-warn/40 bg-status-warn/10";
  if (kind === "rejected") return "border-destructive/30 bg-destructive/5";
  return "border-status-warn/40 bg-status-warn/10";
}

function isVerifying(status: InventoryOperationVerificationStatus) {
  return status === "verifying";
}

export function InventoryOperationErrorPanel({
  error,
  verificationStatus = "idle",
  onVerify,
  acknowledged = false,
  onAcknowledge,
  privacyRedacted = false,
  className,
}: InventoryOperationErrorPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const stateCopy = copy[error.kind];
  const unknownOutcome = error.kind === "outcome-unknown";
  const verifying = isVerifying(verificationStatus);
  const role = verificationStatus === "verified" ? "status" : "alert";

  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, [error.kind, error.subtype, verificationStatus]);

  return (
    <section
      ref={panelRef}
      data-ui="inventory-operation-error-panel"
      data-operation-error-kind={error.kind}
      data-operation-error-subtype={error.subtype}
      role={role}
      aria-live={role === "alert" ? "assertive" : "polite"}
      aria-busy={verifying}
      tabIndex={-1}
      className={cn(
        "grid min-w-0 gap-2 rounded-xl border p-3 text-foreground sm:p-4",
        toneClasses(error.kind),
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-background/80"
        >
          {verificationStatus === "verified" ? (
            <CheckCircle2 className="size-4 text-status-success-foreground" />
          ) : verifying ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : error.kind === "authorization" ? (
            <ShieldAlert className="size-4 text-status-warn-foreground" />
          ) : (
            <TriangleAlert className="size-4 text-destructive" />
          )}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">
            {verificationStatus === "verifying" ? "正在读取最新状态" : stateCopy.title}
          </h2>
          <p className="mt-1 text-xs leading-5 text-foreground">
            {verificationStatus === "verified"
              ? "已读取最新状态；没有自动重放刚才的写入。请根据最新业务账继续操作。"
              : stateCopy.description}
          </p>
        </div>
      </div>
      {privacyRedacted ? (
        <p className="text-xs leading-5 text-muted-foreground">
          为保护隐私，此状态不显示商品、金额或设备标识。
        </p>
      ) : null}
      {verificationStatus === "failed" ? (
        <p className="text-xs leading-5 text-status-danger-foreground">
          读取最新状态失败；仍不要重复提交，请稍后再次读取。
        </p>
      ) : null}
      {unknownOutcome && onVerify && verificationStatus !== "verified" ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full gap-2 sm:w-fit"
          disabled={verifying}
          onClick={() => void onVerify()}
        >
          <Eye className="size-4" aria-hidden="true" />
          {verifying ? "正在读取最新状态…" : "读取最新状态（不会写入）"}
        </Button>
      ) : null}
      {unknownOutcome && verificationStatus === "verified" && !acknowledged && onAcknowledge ? (
        <Button
          type="button"
          variant="default"
          className="min-h-11 w-full sm:w-fit"
          onClick={onAcknowledge}
        >
          我已核对最新状态
        </Button>
      ) : null}
      {unknownOutcome && verificationStatus === "verified" && acknowledged ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          已确认你已核对最新状态；如需再次写入，请使用当前业务账中的明确动作。
        </p>
      ) : null}
      {unknownOutcome && !onVerify ? (
        <p className="text-xs leading-5 text-muted-foreground">
          请返回库存或重新打开当前记录核对最新状态；在核对前不要重复提交。
        </p>
      ) : null}
      {verifying ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          正在只读核对；不会调用写入操作。
        </p>
      ) : null}
    </section>
  );
}
