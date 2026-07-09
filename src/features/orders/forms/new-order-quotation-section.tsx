"use client";

import type { Dispatch, SetStateAction } from "react";
import { Plus, ReceiptText, ShieldCheck, Trash2 } from "lucide-react";

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
import { decimalKeyboardProps, moneyDraftValue, parseMoneyDraft } from "@/shared/lib/mobile-input";

export function NewOrderQuotationSection({
  form,
  setForm,
  total,
  operatorName,
  operatorRole,
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
  operatorRole?: string;
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
  const serviceSelectTriggerClass =
    "h-10 rounded-xl border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2.5 text-xs font-medium shadow-none focus:ring-1 focus:ring-ring focus-visible:ring-1";
  const serviceDropdownContentClass = "z-[90] rounded-xl shadow-[var(--shadow-overlay)]";
  const balance = Math.max(0, total - form.deposit);
  const roleLabel = getOperatorRoleLabel(operatorRole);

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
                      {...decimalKeyboardProps}
                      value={moneyDraftValue(Number(item.price) || 0)}
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
          variant="finance"
          className="mt-1.5"
        />
      </div>

      <div className="min-w-0 space-y-2 rounded-xl border border-[var(--border-panel)] bg-card p-2">
        <div className="flex min-w-0 items-center justify-between gap-1.5 px-0.5">
          <div className="min-w-0">
            <div className="truncate text-[10px] font-semibold leading-3 text-foreground">
              定金与服务
            </div>
            <div className="truncate text-[9px] leading-3 text-muted-foreground">
              定金、质保、录入人员与工单属性
            </div>
          </div>
          <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-1.5 text-[9px] font-medium leading-none text-muted-foreground">
            <ShieldCheck className="size-3 text-primary" />
            {roleLabel}
          </span>
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] gap-2">
          <FormItem label="定金">
            <div className="relative">
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                €
              </span>
              <Input
                {...decimalKeyboardProps}
                value={moneyDraftValue(form.deposit)}
                onChange={(event) =>
                  setForm({ ...form, deposit: parseMoneyDraft(event.target.value) })
                }
                className={cn(controlClass, "h-9 pl-5 font-mono sm:pl-8")}
                placeholder="0"
              />
            </div>
          </FormItem>
          <FormItem label="保修">
            <WarrantyPicker
              valueMonths={form.warrantyMonths}
              valueText={form.warrantyText}
              reason={form.warrantyChangeReason}
              defaultMonths={defaultWarrantyMonths}
              compact
              triggerClassName={serviceSelectTriggerClass}
              contentClassName={serviceDropdownContentClass}
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

        <div className="grid min-w-0 grid-cols-2 gap-2">
          <div
            className="grid min-h-10 min-w-0 content-center rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2 py-1.5"
            title={operatorName || "当前登录账号"}
          >
            <div className="truncate text-[9.5px] font-medium leading-3 text-muted-foreground">
              录入人员
            </div>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
              <ShieldCheck className="size-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-xs font-semibold leading-4 text-foreground">
                {operatorName || "当前登录账号"}
              </span>
              <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium leading-none text-primary">
                {roleLabel}
              </span>
            </div>
          </div>
          <div className="grid min-w-0 gap-0.5">
            <div className="truncate text-[9.5px] font-medium leading-3 text-muted-foreground">
              留存
            </div>
            <AccessoryNotesPicker
              value={form.accessoryNotes}
              onChange={(accessoryNotes) => setForm({ ...form, accessoryNotes })}
              compact
              triggerClassName={serviceSelectTriggerClass}
              contentClassName={serviceDropdownContentClass}
            />
          </div>
          <div className="grid min-w-0 gap-0.5">
            <div className="text-[9.5px] font-medium leading-3 text-muted-foreground">类型</div>
            <Select
              value={form.type}
              onValueChange={(type) => setForm({ ...form, type: type as RepairOrderType })}
            >
              <SelectTrigger className={serviceSelectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={serviceDropdownContentClass}>
                {repairOrderType.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type === "quick_repair" ? "快修" : "送修"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid min-w-0 gap-0.5">
            <div className="text-[9.5px] font-medium leading-3 text-muted-foreground">状态</div>
            <Select
              value={form.status}
              onValueChange={(value) => setForm({ ...form, status: value })}
            >
              <SelectTrigger className={serviceSelectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={serviceDropdownContentClass}>
                {createStatuses.map((status) => (
                  <SelectItem key={status.code} value={status.code}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function getOperatorRoleLabel(role?: string) {
  if (role === "owner") return "最高管理员";
  if (role === "manager") return "管理员";
  if (role === "technician") return "技师";
  if (role === "sales") return "前台";
  if (role === "viewer") return "只读";
  return "账号";
}
