"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { runInventoryLifecycleCommand } from "@/lib/repairdesk/api";
import type { InventoryLifecycleListSummary } from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

import { inventoryLifecycleKeys } from "../api/query-keys";
import {
  InventoryLifecycleField,
  InventoryLifecycleValidationSummary,
  type InventoryLifecycleValidationIssue,
} from "../components/inventory-lifecycle-field-feedback";
import { InventoryOperationErrorPanel } from "../../components/inventory-operation-error-panel";
import {
  getInventoryConflictDetails,
  InventoryConflictPanel,
  type InventoryConflictDetails,
} from "../../components/inventory-conflict-panel";
import { InventoryOperationReceiptPanel } from "../../components/inventory-operation-receipt-panel";
import {
  InventorySyncStatusPanel,
  type InventorySyncStatus,
} from "../../components/inventory-sync-status-panel";
import {
  classifyInventoryOperationError,
  type InventoryOperationErrorDetails,
} from "../../model/inventory-operation-error";
import {
  resolveInventoryOperationReceipt,
  type InventoryOperationReceipt,
} from "../../model/inventory-operation-receipt";

const checkOptions = [
  ["not_tested", "未检测"],
  ["normal", "正常"],
  ["abnormal", "异常"],
  ["not_applicable", "不适用"],
] as const;

export function InventoryInspectionEditor({
  summary,
  brand,
  category,
  onVerifyConflict,
  onSyncCommitted,
}: {
  summary: InventoryLifecycleListSummary;
  brand: string;
  category: "phone" | "tablet" | "computer" | "game_console" | "other";
  onVerifyConflict?: () => Promise<boolean>;
  onSyncCommitted?: () => Promise<boolean>;
}) {
  const queryClient = useQueryClient();
  const isApple = brand.trim().toLowerCase() === "apple";
  const [battery, setBattery] = useState(
    summary.inspection?.battery_health === null || summary.inspection?.battery_health === undefined
      ? ""
      : String(summary.inspection.battery_health),
  );
  const [checks, setChecks] = useState({
    face_id_status: summary.inspection?.face_id_status ?? "not_tested",
    touch_id_status: summary.inspection?.touch_id_status ?? "not_tested",
    true_tone_status: summary.inspection?.true_tone_status ?? "not_tested",
    activation_lock_status: summary.inspection?.activation_lock_status ?? "not_tested",
    data_wipe_status: summary.inspection?.data_wipe_status ?? "not_tested",
    imei_status: summary.inspection?.imei_status ?? "not_tested",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [operationError, setOperationError] = useState<InventoryOperationErrorDetails | null>(null);
  const [conflict, setConflict] = useState<InventoryConflictDetails | null>(null);
  const [conflictVerification, setConflictVerification] = useState<"idle" | "verifying" | "failed">(
    "idle",
  );
  const [operationReceipt, setOperationReceipt] = useState<InventoryOperationReceipt | null>(null);
  const [operationReceiptKey, setOperationReceiptKey] = useState(0);
  const [syncStatus, setSyncStatus] = useState<InventorySyncStatus>();
  const idempotencyKey = useRef(crypto.randomUUID());
  const syncCommittedInspection = async () => {
    setSyncStatus("committed-refreshing");
    try {
      await queryClient.invalidateQueries({ queryKey: inventoryLifecycleKeys.all });
      if (onSyncCommitted) {
        const verified = await onSyncCommitted();
        if (!verified) throw new Error("inspection-readback-unavailable");
      }
      setSyncStatus("recovered");
    } catch {
      setSyncStatus("committed-refresh-failed");
    }
  };
  const mutation = useMutation({
    mutationFn: runInventoryLifecycleCommand,
    onSuccess: (result) => {
      idempotencyKey.current = crypto.randomUUID();
      setConflict(null);
      setConflictVerification("idle");
      setOperationError(null);
      setOperationReceipt(resolveInventoryOperationReceipt("inspection.save", result));
      setOperationReceiptKey((current) => current + 1);
      void syncCommittedInspection();
    },
    onError: (error) => {
      setOperationReceipt(null);
      const nextConflict = getInventoryConflictDetails(error);
      setConflict(nextConflict);
      setConflictVerification("idle");
      setOperationError(nextConflict ? null : classifyInventoryOperationError(error));
      setSyncStatus(undefined);
    },
  });
  const recoverConflict = async () => {
    if (!onVerifyConflict || conflictVerification === "verifying")
      throw new Error("inspection-readback-unavailable");
    setConflictVerification("verifying");
    try {
      const verified = await onVerifyConflict();
      if (!verified) throw new Error("inspection-readback-unavailable");
      mutation.reset();
      idempotencyKey.current = crypto.randomUUID();
      setConflict(null);
      setConflictVerification("idle");
      setOperationError(null);
    } catch (error) {
      setConflictVerification("failed");
      throw error;
    }
  };
  const allowedActions =
    summary.projection?.mode === "exact"
      ? summary.projection.allowed_actions
      : summary.allowed_actions;
  if (!allowedActions.includes("inspection.save") || !summary.unit_version) return null;
  const deviceKind = category === "game_console" ? "game_console" : category;
  const checkFields = isApple
    ? [
        ["face_id_status", "Face ID"],
        ["touch_id_status", "Touch ID"],
        ["true_tone_status", "原彩显示"],
        ["activation_lock_status", "激活锁"],
        ["data_wipe_status", "数据抹除"],
        ["imei_status", "IMEI 状态"],
      ]
    : [
        ["activation_lock_status", "设备锁"],
        ["data_wipe_status", "数据抹除"],
        ["imei_status", "设备标识"],
      ];
  const validationIssues: InventoryLifecycleValidationIssue[] = Object.entries(fieldErrors).map(
    ([fieldId, message]) => ({
      fieldId,
      label:
        fieldId === "inventory-inspection-battery-health"
          ? "电池健康度"
          : (checkFields.find(([key]) => `inventory-inspection-${key}` === fieldId)?.[1] ??
            fieldId),
      message,
    }),
  );
  const focusField = (fieldId: string) => document.getElementById(fieldId)?.focus();
  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (battery.trim()) {
      const batteryValue = Number(battery);
      if (!Number.isInteger(batteryValue) || batteryValue < 0 || batteryValue > 100) {
        nextErrors["inventory-inspection-battery-health"] = "请输入 0 到 100 的整数，未知可留空。";
      }
    }
    if (Object.keys(nextErrors).length > 0) setValidationAttempt((current) => current + 1);
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };
  return (
    <section
      id="inventory-inspection-editor"
      data-ui="inventory-inspection-editor"
      tabIndex={-1}
      className={cn(
        repairOs.mobileInfoCard,
        "grid gap-3 p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4",
      )}
    >
      <div className="flex items-start gap-2">
        <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <ClipboardCheck className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">录入设备检测</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            每次保存都会追加新版本；未检测不会记成 0。
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {isApple ? (
          <InventoryLifecycleField
            id="inventory-inspection-battery-health"
            label="电池健康度"
            hint="未知可留空；填写时必须是 0–100 的整数。"
            error={fieldErrors["inventory-inspection-battery-health"]}
          >
            <Input
              id="inventory-inspection-battery-health"
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              placeholder="未知"
              value={battery}
              onChange={(event) => {
                setBattery(event.target.value);
                if (fieldErrors["inventory-inspection-battery-health"])
                  setFieldErrors((current) => ({
                    ...current,
                    "inventory-inspection-battery-health": "",
                  }));
              }}
              aria-invalid={
                Boolean(fieldErrors["inventory-inspection-battery-health"]) || undefined
              }
              aria-describedby={`inventory-inspection-battery-health-hint${
                fieldErrors["inventory-inspection-battery-health"]
                  ? " inventory-inspection-battery-health-error"
                  : ""
              }`}
              className="h-11"
            />
          </InventoryLifecycleField>
        ) : null}
        {checkFields.map(([key, label]) => {
          const id = `inventory-inspection-${key}`;
          return (
            <InventoryLifecycleField key={key} id={id} label={label}>
              <select
                id={id}
                className="h-11 rounded-md border bg-background px-2 text-sm"
                value={checks[key as keyof typeof checks]}
                onChange={(event) =>
                  setChecks((current) => ({ ...current, [key]: event.target.value }))
                }
              >
                {checkOptions.map(([value, optionLabel]) => (
                  <option key={value} value={value}>
                    {optionLabel}
                  </option>
                ))}
              </select>
            </InventoryLifecycleField>
          );
        })}
      </div>
      <InventoryLifecycleValidationSummary
        issues={validationIssues.filter((issue) => issue.message)}
        focusRequestKey={validationAttempt}
        onFocusField={focusField}
      />
      {conflict ? (
        <InventoryConflictPanel
          conflict={conflict}
          onRecover={recoverConflict}
          pending={conflictVerification === "verifying"}
        />
      ) : null}
      {operationError ? <InventoryOperationErrorPanel error={operationError} /> : null}
      {operationReceipt ? (
        <InventoryOperationReceiptPanel
          receipt={operationReceipt}
          receiptKey={operationReceiptKey}
        />
      ) : null}
      {syncStatus ? (
        <InventorySyncStatusPanel
          status={syncStatus}
          pending={syncStatus === "committed-refreshing"}
          onRetry={syncStatus === "committed-refresh-failed" ? syncCommittedInspection : undefined}
        />
      ) : null}
      <Button
        className="min-h-11"
        disabled={
          mutation.isPending ||
          Boolean(syncStatus && syncStatus !== "recovered") ||
          Boolean(conflict) ||
          conflictVerification === "verifying" ||
          (operationError?.kind === "outcome-unknown" && operationError !== null)
        }
        onClick={() => {
          if (!validate()) return;
          setOperationReceipt(null);
          mutation.mutate({
            command: "inspection.save",
            idempotency_key: idempotencyKey.current,
            payload: {
              stock_unit_id: summary.stock_unit_id,
              expected_unit_version: summary.unit_version,
              device_kind: deviceKind,
              battery_health: battery === "" ? null : Number(battery),
              ...checks,
            },
          });
        }}
      >
        {mutation.isPending ? "正在保存…" : "保存检测版本"}
      </Button>
      {mutation.isPending ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          正在保存检测版本，完成前不可重复提交。
        </p>
      ) : null}
    </section>
  );
}
