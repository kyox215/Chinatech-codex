"use client";

import type { Dispatch, SetStateAction } from "react";
import { Plus, ReceiptText, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AccessoryNotesPicker } from "@/features/orders/components/accessory-notes-picker";
import {
  OrderWorkspaceEmptyBlock,
  OrderWorkspaceMoneyStrip,
  OrderWorkspaceQuoteRow,
  OrderWorkspaceSectionHeader,
} from "@/features/orders/components/order-workspace-primitives";
import { WarrantyPicker } from "@/features/orders/components/warranty-picker";
import { FormItem } from "@/features/orders/forms/new-order-fields";
import type { NewOrderFormState } from "@/features/orders/model/new-order-form";
import { repairOrderType, type RepairOrderType } from "@/lib/mock/enums";
import type { FaultPriceItem, OrderWorkflowStatus } from "@/lib/repairdesk/api";
import { detailWorkspace, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

export function NewOrderQuotationSection({
  form,
  setForm,
  total,
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
  operatorName: string;
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
  const controlClass =
    "h-8 rounded-lg border-0 bg-[var(--surface-panel-muted)] text-base leading-none shadow-none focus-visible:ring-1 md:text-[13px]";
  const moneyInputValue = (value: number) => (value === 0 ? "" : String(value));
  const parseMoneyDraft = (value: string) => (value.trim() === "" ? 0 : Number(value));
  const balance = Math.max(0, total - form.deposit);

  return (
    <Shell data-new-order-section="quotation" className={cn(shellClass, "space-y-2")}>
      <OrderWorkspaceSectionHeader
        icon={ReceiptText}
        title="报价处理"
        description="维修项目、定金、质保与初始状态"
        className="mb-1"
        action={
          <span className="rounded-full bg-primary/5 px-1.5 py-0.5 text-[9px] font-semibold leading-3 text-primary">
            {form.faults.length} 项
          </span>
        }
      />

      <div className="rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)]/70 p-1.5">
        <div className="mb-1 flex min-w-0 items-center justify-between gap-2 px-0.5">
          <span className="truncate text-[10px] font-medium leading-3 text-muted-foreground">
            报价项目
          </span>
          <span className="shrink-0 rounded-md bg-card px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-primary">
            € {total.toFixed(2)}
          </span>
        </div>
        <div className="min-w-0 space-y-1.5">
          {form.faults.length === 0 ? (
            <OrderWorkspaceEmptyBlock>
              从左侧故障与诊断选择项目后，可在这里输入价格
            </OrderWorkspaceEmptyBlock>
          ) : (
            form.faults.map((item, index) => (
              <OrderWorkspaceQuoteRow
                key={item.key}
                price={
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
                }
                action={
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
                }
              >
                {item.categoryKey === "custom" ? (
                  <Input
                    value={item.name}
                    onChange={(event) => onPatchFault(index, { name: event.target.value })}
                    className={cn(controlClass, "px-2")}
                    placeholder="自定义项目"
                  />
                ) : (
                  <>
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
                  </>
                )}
              </OrderWorkspaceQuoteRow>
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
        <OrderWorkspaceMoneyStrip
          total={total}
          deposit={form.deposit}
          balance={balance}
          className="mt-1.5"
        />
      </div>

      <div className="min-w-0 space-y-1.5 rounded-xl border border-[var(--border-panel)] bg-card p-1.5">
        <div className="px-0.5 text-[10px] font-semibold leading-3 text-muted-foreground">
          服务设置
        </div>
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
                className={cn(controlClass, "pl-5 font-mono sm:pl-8")}
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

        <div className="grid min-w-0 gap-1.5">
          <FormItem label="录入账号" mobileLabel="sr-only">
            <div
              className="flex h-8 min-w-0 items-center rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2 text-[11px] font-medium"
              title={operatorName || "当前登录账号"}
            >
              <span className="truncate">{operatorName || "当前登录账号"}</span>
            </div>
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
          <div className="grid gap-1.5">
            <div className="text-[10px] font-medium leading-3 text-muted-foreground">工单类型</div>
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

          <FormItem label="初始状态" mobileLabel="sr-only">
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
    </Shell>
  );
}
