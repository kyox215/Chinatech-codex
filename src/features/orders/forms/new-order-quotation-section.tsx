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
import { FormItem, MoneyRow } from "@/features/orders/forms/new-order-fields";
import { warrantyOptions, type NewOrderFormState } from "@/features/orders/model/new-order-form";
import { repairOrderType, statusMeta } from "@/lib/mock/enums";
import { ORDER_STATUS_ALLOWED_FOR_CREATE, normalizeInitialOrderStatus } from "@/lib/mock/workflow";
import type { FaultPriceItem } from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";

export function NewOrderQuotationSection({
  form,
  setForm,
  total,
  balance,
  technicianOptions,
  onPatchFault,
  onAddCustomFault,
}: {
  form: NewOrderFormState;
  setForm: Dispatch<SetStateAction<NewOrderFormState>>;
  total: number;
  balance: number;
  technicianOptions: string[];
  onPatchFault: (index: number, patch: Partial<FaultPriceItem>) => void;
  onAddCustomFault: () => void;
}) {
  return (
    <Card className="h-fit min-w-0 border-border/70 p-2.5 shadow-sm sm:p-4">
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
          <FormItem label="技术员" required>
            <Select
              value={form.technician}
              onValueChange={(technician) => setForm({ ...form, technician })}
            >
              <SelectTrigger className="h-8 sm:h-9">
                <SelectValue placeholder="可选" />
              </SelectTrigger>
              <SelectContent>
                {technicianOptions.map((technician) => (
                  <SelectItem key={technician} value={technician}>
                    {technician}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
          <FormItem label="保修">
            <Select
              value={form.warrantyText}
              onValueChange={(warrantyText) => setForm({ ...form, warrantyText })}
            >
              <SelectTrigger className="h-8 sm:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {warrantyOptions.map((warranty) => (
                  <SelectItem key={warranty} value={warranty}>
                    {warranty}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        </div>

        <FormItem label="客户留存备注">
          <Input
            value={form.accessoryNotes}
            onChange={(event) => setForm({ ...form, accessoryNotes: event.target.value })}
            className="h-8 sm:h-9"
            placeholder="如：SIM卡托、手机壳、充电器"
          />
        </FormItem>

        <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
          <div className="grid gap-1.5">
            <div className="text-[11px] font-medium text-muted-foreground sm:text-xs">工单类型</div>
            <div className="grid grid-cols-2 gap-1.5">
              {repairOrderType.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm({ ...form, type })}
                  className={cn(
                    "h-8 rounded-md border px-2 text-xs font-medium transition-colors sm:h-9 sm:rounded-lg",
                    form.type === type
                      ? "border-primary bg-primary/10 text-primary"
                      : "bg-surface hover:bg-accent",
                  )}
                >
                  {type === "quick_repair" ? "快修" : "送修"}
                </button>
              ))}
            </div>
          </div>

          <FormItem label="初始状态">
            <Select
              value={form.status}
              onValueChange={(value) =>
                setForm({ ...form, status: normalizeInitialOrderStatus(value) })
              }
            >
              <SelectTrigger className="h-8 sm:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUS_ALLOWED_FOR_CREATE.map((status) => (
                  <SelectItem key={status} value={status}>
                    {statusMeta[status].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        </div>
      </div>
    </Card>
  );
}
