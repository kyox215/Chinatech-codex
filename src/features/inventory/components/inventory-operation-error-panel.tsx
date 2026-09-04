"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, Eye, Loader2, ShieldAlert, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import type { MessageKey } from "@/shared/i18n/messages";

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

const copy: Record<
  InventoryOperationErrorDetails["kind"],
  { title: MessageKey; description: MessageKey }
> = {
  rejected: {
    title: "inventory2b4.operationError.rejected.title",
    description: "inventory2b4.operationError.rejected.description",
  },
  authorization: {
    title: "inventory2b4.operationError.authorization.title",
    description: "inventory2b4.operationError.authorization.description",
  },
  "outcome-unknown": {
    title: "inventory2b4.operationError.unknown.title",
    description: "inventory2b4.operationError.unknown.description",
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
  const { t } = useLocale();
  const panelRef = useRef<HTMLElement>(null);
  const stateCopy = copy[error.kind];
  const unknownOutcome = error.kind === "outcome-unknown";
  const verifying = isVerifying(verificationStatus);
  const role = verificationStatus === "verified" ? "status" : "alert";
  const handleVerify = () => {
    try {
      void Promise.resolve(onVerify?.()).catch(() => undefined);
    } catch {
      // The caller owns the safe failed-state transition. This boundary only
      // prevents a rejected recovery attempt from escaping the user action.
    }
  };

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
            {verificationStatus === "verifying"
              ? t("inventory2b4.operationError.verifyingTitle")
              : t(stateCopy.title)}
          </h2>
          <p className="mt-1 text-xs leading-5 text-foreground">
            {verificationStatus === "verified"
              ? t("inventory2b4.operationError.verifiedDescription")
              : t(stateCopy.description)}
          </p>
        </div>
      </div>
      {privacyRedacted ? (
        <p className="text-xs leading-5 text-muted-foreground">
          {t("inventory2b4.common.privacyRedacted")}
        </p>
      ) : null}
      {verificationStatus === "failed" ? (
        <p className="text-xs leading-5 text-status-danger-foreground">
          {t("inventory2b4.operationError.verifyFailed")}
        </p>
      ) : null}
      {unknownOutcome && onVerify && verificationStatus !== "verified" ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full gap-2 sm:w-fit"
          disabled={verifying}
          onClick={handleVerify}
        >
          <Eye className="size-4" aria-hidden="true" />
          {verifying
            ? t("inventory2b4.operationError.verifying")
            : t("inventory2b4.operationError.verify")}
        </Button>
      ) : null}
      {unknownOutcome && verificationStatus === "verified" && !acknowledged && onAcknowledge ? (
        <Button
          type="button"
          variant="default"
          className="min-h-11 w-full sm:w-fit"
          onClick={onAcknowledge}
        >
          {t("inventory2b4.operationError.acknowledge")}
        </Button>
      ) : null}
      {unknownOutcome && verificationStatus === "verified" && acknowledged ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {t("inventory2b4.operationError.acknowledged")}
        </p>
      ) : null}
      {unknownOutcome && !onVerify ? (
        <p className="text-xs leading-5 text-muted-foreground">
          {t("inventory2b4.operationError.returnToVerify")}
        </p>
      ) : null}
      {verifying ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {t("inventory2b4.operationError.verifyingStatus")}
        </p>
      ) : null}
    </section>
  );
}
