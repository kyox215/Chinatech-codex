"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runInventoryLifecycleCommand } from "@/lib/repairdesk/api";
import type { InventoryLifecycleListSummary } from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

import { inventoryLifecycleKeys } from "../api/query-keys";

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
}: {
  summary: InventoryLifecycleListSummary;
  brand: string;
  category: "phone" | "tablet" | "computer" | "game_console" | "other";
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
  const idempotencyKey = useRef(crypto.randomUUID());
  const mutation = useMutation({
    mutationFn: runInventoryLifecycleCommand,
    onSuccess: () => {
      idempotencyKey.current = crypto.randomUUID();
      return queryClient.invalidateQueries({ queryKey: inventoryLifecycleKeys.all });
    },
  });
  if (!summary.allowed_actions.includes("inspection.save") || !summary.unit_version) return null;
  const deviceKind = category === "game_console" ? "game_console" : category;
  return (
    <section className={cn(repairOs.mobileInfoCard, "grid gap-3 p-3 sm:p-4")}>
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
          <div className="grid gap-1.5">
            <Label className="text-xs">电池健康度</Label>
            <Input
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              placeholder="未知"
              value={battery}
              onChange={(event) => setBattery(event.target.value)}
              className="h-11"
            />
          </div>
        ) : null}
        {(isApple
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
            ]
        ).map(([key, label]) => (
          <div key={key} className="grid gap-1.5">
            <Label className="text-xs">{label}</Label>
            <select
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
          </div>
        ))}
      </div>
      {mutation.isError ? (
        <p className="text-xs text-destructive" role="alert">
          {mutation.error instanceof Error ? mutation.error.message : "检测保存失败"}
        </p>
      ) : null}
      {mutation.isSuccess ? (
        <p className="text-xs text-status-success-foreground" role="status">
          检测版本已追加。
        </p>
      ) : null}
      <Button
        className="min-h-11"
        disabled={
          mutation.isPending || (battery !== "" && (Number(battery) < 0 || Number(battery) > 100))
        }
        onClick={() =>
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
          })
        }
      >
        保存检测版本
      </Button>
    </section>
  );
}
