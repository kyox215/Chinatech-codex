"use client";

import type { Dispatch, SetStateAction } from "react";
import { Plus, ReceiptText, Trash2, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FaultDiagnosisPicker } from "@/components/orders/fault-diagnosis-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AccessoryNotesPicker } from "@/features/orders/components/accessory-notes-picker";
import { WarrantyPicker } from "@/features/orders/components/warranty-picker";
import { FormItem, SectionHeading } from "@/features/orders/forms/new-order-fields";
import type { NewOrderFormState } from "@/features/orders/model/new-order-form";
import { repairOrderType, type RepairOrderType } from "@/lib/mock/enums";
import type { FaultPriceItem, OrderWorkflowStatus } from "@/lib/repairdesk/api";
import { detailWorkspace, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

export function NewOrderFaultDiagnosisSection({
  form,
  setForm,
  total,
  onPatchFault,
  onAddCustomFault,
  createStatuses,
  defaultWarrantyMonths = 6,
  surface = "page",
}: {
  form: NewOrderFormState;
  setForm: Dispatch<SetStateAction<NewOrderFormState>>;
  total: number;
  onPatchFault: (index: number, patch: Partial<FaultPriceItem>) => void;
  onAddCustomFault: () => void;
  createStatuses: OrderWorkflowStatus[];
  defaultWarrantyMonths?: number;
  surface?: "page" | "dialog";
}) {
  const shellClass = cn(
    "h-fit min-w-0 p-2 sm:p-3",
    surface === "dialog"
      ? detailWorkspace.flatPanel
      : cn(
          repairOs.mobileInfoCard,
          "md:rounded-[var(--radius-lg)] md:bg-[var(--surface-panel)] md:shadow-none",
        ),
  );
  const Shell = "section";
  const issueLength = form.issue.length;
  const controlClass =
    "h-8 rounded-lg border-0 bg-[var(--surface-panel-muted)] text-[13px] leading-none shadow-none focus-visible:ring-1";
  const moneyInputValue = (value: number) => (value === 0 ? "" : String(value));
  const parseMoneyDraft = (value: string) => (value.trim() === "" ? 0 : Number(value));

  return (
    <Shell data-new-order-section="fault-diagnosis" className={cn(shellClass, "space-y-2")}>
      <SectionHeading
        icon={Wrench}
        title="故障诊断与报价"
        className="mb-1"
        action={
          <span className="rounded-full bg-primary/5 px-1.5 py-0.5 text-[9px] font-semibold leading-3 text-primary">
            {form.faults.length} 项
          </span>
        }
      />
      <div className="mb-1 flex min-w-0 items-center justify-between gap-2 px-0.5">
        <span className="truncate text-[10px] font-medium leading-3 text-muted-foreground">
          常见部件
        </span>
        <span className="shrink-0 text-[10px] font-medium leading-3 text-primary">自定义问题</span>
      </div>
      <div className="rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)]/70 p-1">
        <FaultDiagnosisPicker
          selected={form.faults}
          onChange={(faults) => setForm({ ...form, faults })}
          className="gap-1 sm:gap-1.5"
          density="compact"
          appearance="quiet"
          compactColumns={3}
        />
      </div>
      <div className="mt-1.5">
        <FormItem label="故障备注 / 其他问题" className="space-y-1">
          <div className="relative">
            <Textarea
              value={form.issue}
              onChange={(event) => setForm({ ...form, issue: event.target.value })}
              rows={2}
              maxLength={200}
              className="min-h-[60px] resize-none rounded-xl border-0 bg-[var(--surface-panel-muted)] px-2.5 pb-5 pt-2 text-base leading-5 shadow-none placeholder:text-[13px] placeholder:text-muted-foreground/45 focus-visible:ring-1 md:text-[13px]"
              placeholder="补充故障现象、客户备注..."
            />
            <span className="pointer-events-none absolute bottom-1.5 right-2 text-[9px] leading-3 text-muted-foreground">
              {issueLength}/200
            </span>
          </div>
        </FormItem>
      </div>

      <div
        data-new-order-section="quotation"
        className="rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)]/70 p-1.5"
      >
        <div className="mb-1 flex min-w-0 items-center justify-between gap-2 px-0.5">
          <span className="inline-flex min-w-0 items-center gap-1 text-[10px] font-semibold leading-3">
            <ReceiptText className="size-3.5 text-primary" />
            <span className="truncate">已选项目报价</span>
          </span>
          <span className="shrink-0 rounded-md bg-card px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-primary">
            € {total.toFixed(2)}
          </span>
        </div>
        <div className="min-w-0 space-y-1.5">
          {form.faults.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border-panel)] bg-background/60 px-2 py-2 text-center text-[10px] leading-4 text-muted-foreground">
              先从上方选择故障类型，价格会在这里填写
            </div>
          ) : (
            form.faults.map((item, index) => (
              <div
                key={item.key}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_78px_24px] items-center gap-1 rounded-lg border border-[var(--border-panel)] bg-card px-2 py-1 sm:grid-cols-[minmax(0,1fr)_96px_32px] sm:gap-1.5 sm:p-2"
              >
                {item.categoryKey === "custom" ? (
                  <Input
                    value={item.name}
                    onChange={(event) => onPatchFault(index, { name: event.target.value })}
                    className={cn(controlClass, "px-2")}
                    placeholder="自定义项目"
                  />
                ) : (
                  <div className="min-w-0">
                    <div
                      className="truncate text-[10px] font-medium leading-4 sm:text-[11px]"
                      title={item.name}
                    >
                      {item.name}
                    </div>
                    <div
                      className="truncate text-[9px] leading-3 text-muted-foreground"
                      title={item.note}
                    >
                      {item.note}
                    </div>
                  </div>
                )}
                <div className="relative min-w-0">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    €
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={moneyInputValue(Number(item.price) || 0)}
                    onChange={(event) =>
                      onPatchFault(index, { price: parseMoneyDraft(event.target.value) })
                    }
                    className={cn(controlClass, "pl-5 font-mono sm:pl-8")}
                    placeholder="0"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 sm:size-8"
                  onClick={() =>
                    setForm({
                      ...form,
                      faults: form.faults.filter((_, faultIndex) => faultIndex !== index),
                    })
                  }
                  aria-label="删除报价项目"
                >
                  <Trash2 className="size-3 text-muted-foreground sm:size-4" />
                </Button>
              </div>
            ))
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full justify-center gap-1.5 rounded-lg border-[var(--border-panel)] bg-card text-[11px] font-semibold shadow-none"
            onClick={onAddCustomFault}
          >
            <Plus className="size-3.5" /> 添加自定义项目
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-panel)] bg-card p-1.5">
        <div className="mb-1 px-0.5 text-[10px] font-semibold leading-3 text-muted-foreground">
          服务设置
        </div>
        <div className="grid min-w-0 gap-1.5">
          <div className="grid min-w-0 grid-cols-2 gap-1.5">
            <FormItem label="定金" mobileLabel="sr-only">
              <div className="relative">
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  €
                </span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={moneyInputValue(form.deposit)}
                  onChange={(event) =>
                    setForm({ ...form, deposit: parseMoneyDraft(event.target.value) })
                  }
                  className={cn(controlClass, "pl-5 font-mono")}
                  placeholder="0"
                />
              </div>
            </FormItem>
            <FormItem label="保修" mobileLabel="sr-only">
              <WarrantyPicker
                valueMonths={form.warrantyMonths}
                valueText={form.warrantyText}
                reason={form.warrantyChangeReason}
                defaultMonths={defaultWarrantyMonths}
                compact
                onChange={(warranty) =>
                  setForm({
                    ...form,
                    warrantyMonths: warranty.warranty_months,
                    warrantyText: warranty.warranty_text,
                    warrantyChangeReason: warranty.warranty_change_reason ?? "",
                  })
                }
              />
            </FormItem>
          </div>

          <FormItem label="客户留存备注" mobileLabel="sr-only">
            <AccessoryNotesPicker
              value={form.accessoryNotes}
              onChange={(accessoryNotes) => setForm({ ...form, accessoryNotes })}
              compact
            />
          </FormItem>

          <div className="grid min-w-0 grid-cols-2 gap-1.5">
            <div className="grid gap-1">
              <div className="text-[10px] font-medium leading-3 text-muted-foreground">
                工单类型
              </div>
              <Select
                value={form.type}
                onValueChange={(type) => setForm({ ...form, type: type as RepairOrderType })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {repairOrderType.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type === "quick_repair" ? "快修" : "送修"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <FormItem label="初始状态">
              <Select
                value={form.status}
                onValueChange={(value) => setForm({ ...form, status: value })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {createStatuses.map((status) => (
                    <SelectItem key={status.code} value={status.code}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          </div>
        </div>
      </div>
    </Shell>
  );
}
