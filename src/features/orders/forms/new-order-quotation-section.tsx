"use client";

import type { Dispatch, SetStateAction } from "react";
import { Plus, ReceiptText, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AccessoryNotesPicker } from "@/features/orders/components/accessory-notes-picker";
import { WarrantyPicker } from "@/features/orders/components/warranty-picker";
import { FormItem, MoneyRow } from "@/features/orders/forms/new-order-fields";
import type { NewOrderFormState } from "@/features/orders/model/new-order-form";
import { repairOrderType, type RepairOrderType } from "@/lib/mock/enums";
import type { FaultPriceItem, OrderWorkflowStatus } from "@/lib/repairdesk/api";
import { detailWorkspace } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

export function NewOrderQuotationSection({
  form,
  setForm,
  total,
  balance,
  operatorName,
  onPatchFault,
  onAddCustomFault,
  createStatuses,
  defaultWarrantyMonths = 6,
  surface = "page",
}: {
  form: NewOrderFormState;
  setForm: Dispatch<SetStateAction<NewOrderFormState>>;
  total: number;
  balance: number;
  operatorName: string;
  onPatchFault: (index: number, patch: Partial<FaultPriceItem>) => void;
  onAddCustomFault: () => void;
  createStatuses: OrderWorkflowStatus[];
  defaultWarrantyMonths?: number;
  surface?: "page" | "dialog";
}) {
  const shellClass = cn(
    "h-fit min-w-0",
    surface === "dialog"
      ? detailWorkspace.flatPanel
      : cn(detailWorkspace.densePanel, "bg-card shadow-[var(--shadow-card)] sm:p-3"),
  );
  const Shell = surface === "dialog" ? "section" : Card;

  return (
    <Shell className={shellClass}>
      <div className="mb-2 flex min-w-0 items-center gap-2 sm:mb-3">
        <ReceiptText className="size-3.5 text-muted-foreground sm:size-4" />
        <h2 className="text-sm font-semibold sm:text-base">报价 & 服务</h2>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-medium text-muted-foreground sm:mb-2 sm:text-xs">
          按项报价
        </div>
        <div className="min-w-0 space-y-1.5 sm:space-y-2">
          {form.faults.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/70 bg-surface-muted/40 p-2.5 text-xs text-muted-foreground sm:rounded-lg sm:p-3">
              从左侧故障诊断选择项目后，可在这里输入价格。
            </div>
          ) : (
            form.faults.map((item, index) => (
              <div
                key={item.key}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_84px_28px] items-center gap-1.5 rounded-md border border-border/70 bg-surface-muted/20 p-1.5 sm:grid-cols-[minmax(0,1fr)_96px_32px] sm:rounded-lg sm:p-2"
              >
                {item.categoryKey === "custom" ? (
                  <Input
                    value={item.name}
                    onChange={(event) => onPatchFault(index, { name: event.target.value })}
                    className="h-8 text-[13px] sm:h-9 sm:text-sm"
                    placeholder="自定义项目"
                  />
                ) : (
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium leading-4" title={item.name}>
                      {item.name}
                    </div>
                    <div
                      className="truncate text-[11px] leading-4 text-muted-foreground"
                      title={item.note}
                    >
                      {item.note}
                    </div>
                  </div>
                )}
                <div className="relative min-w-0">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    €
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.price}
                    onChange={(event) => onPatchFault(index, { price: Number(event.target.value) })}
                    className="h-8 pl-7 font-mono text-[13px] sm:h-9 sm:pl-8 sm:text-sm"
                    placeholder="0"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 sm:size-8"
                  onClick={() =>
                    setForm({
                      ...form,
                      faults: form.faults.filter((_, faultIndex) => faultIndex !== index),
                    })
                  }
                  aria-label="删除报价项目"
                >
                  <Trash2 className="size-3.5 text-muted-foreground sm:size-4" />
                </Button>
              </div>
            ))
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs sm:h-8"
            onClick={onAddCustomFault}
          >
            <Plus className="size-3.5" /> 添加自定义项目
          </Button>
        </div>
      </div>

      <div className="my-3 border-t border-border/70 sm:my-4" />

      <div className="min-w-0 space-y-2 sm:space-y-3">
        <div className="grid min-w-0 grid-cols-3 gap-1.5 sm:gap-2">
          <MoneyRow label="总金额" value={total} strong />
          <FormItem label="定金">
            <div className="relative">
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                €
              </span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.deposit}
                onChange={(event) => setForm({ ...form, deposit: Number(event.target.value) })}
                className="h-8 pl-6 font-mono text-[13px] sm:h-9 sm:pl-8 sm:text-sm"
              />
            </div>
          </FormItem>
          <MoneyRow label="应收" value={balance} strong />
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">
          保存时由服务端按总金额与定金自动写入余额。
        </p>

        <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
          <FormItem label="录入账号">
            <div
              className="flex h-8 min-w-0 items-center rounded-md border border-border/70 bg-surface-muted/25 px-2 text-[13px] font-medium sm:h-9 sm:px-3 sm:text-sm"
              title={operatorName || "当前登录账号"}
            >
              <span className="truncate">{operatorName || "当前登录账号"}</span>
            </div>
          </FormItem>
          <FormItem label="保修">
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

        <FormItem label="客户留存备注">
          <AccessoryNotesPicker
            value={form.accessoryNotes}
            onChange={(accessoryNotes) => setForm({ ...form, accessoryNotes })}
            compact
          />
        </FormItem>

        <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
          <div className="grid gap-1.5">
            <div className="text-[11px] font-medium text-muted-foreground sm:text-xs">工单类型</div>
            <Select
              value={form.type}
              onValueChange={(type) => setForm({ ...form, type: type as RepairOrderType })}
            >
              <SelectTrigger className="h-8 text-xs sm:h-9">
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
              <SelectTrigger className="h-8 sm:h-9">
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
    </Shell>
  );
}
