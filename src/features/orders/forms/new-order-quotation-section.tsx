"use client";

import type { Dispatch, SetStateAction } from "react";
import { Plus, ReceiptText, ShieldCheck, Trash2 } from "lucide-react";

import { MoneyKeypadInput } from "@/components/orders/money-keypad-input";
import { FaultDiagnosisPicker } from "@/components/orders/fault-diagnosis-picker";
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
import {
  isNewOrderCostInputDisabled,
  parseOrderCostDraftAmount,
  type NewOrderCostDraft,
} from "@/features/orders/model/order-cost-draft";
import {
  DEVICE_CUSTODY_WITH_CUSTOMER,
  deviceCustodyBlocksStatus,
} from "@/features/orders/model/device-custody";
import { repairOrderType, type RepairOrderType } from "@/lib/mock/enums";
import type { FaultPriceItem, OrderWorkflowStatus } from "@/lib/repairdesk/api";
import { detailWorkspace, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { moneyDraftValue, parseMoneyDraft } from "@/shared/lib/mobile-input";

export function NewOrderQuotationSection({
  form,
  setForm,
  total,
  operatorName,
  operatorRole,
  onPatchFault,
  onAddCustomFault,
  canManageOrderCosts = false,
  costDrafts = {},
  costDefaultsPending = false,
  costDefaultsError = false,
  isOnline = true,
  onCostDraftChange,
  onRetryCostDefaults,
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
  canManageOrderCosts?: boolean;
  costDrafts?: Record<string, NewOrderCostDraft>;
  costDefaultsPending?: boolean;
  costDefaultsError?: boolean;
  isOnline?: boolean;
  onCostDraftChange?: (lineId: string, text: string) => void;
  onRetryCostDefaults?: () => void;
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
  const availableCreateStatuses =
    form.deviceCustodyStatus === DEVICE_CUSTODY_WITH_CUSTOMER
      ? createStatuses.filter((status) => !deviceCustodyBlocksStatus(status.code, status.bucket))
      : createStatuses;
  const quoteModeNote =
    form.issueCaptureMode === "unknown"
      ? "待检测模式：报价草稿会保留，但本次创建不会提交报价项目或定金。"
      : "可在接单时先报价，也可以保留为空，检测后再发布正式报价。";
  const hasCatalogCostLines = form.faults.some((item) => Boolean(item.catalog_key));

  return (
    <Shell
      data-new-order-section="quotation"
      data-new-order-field="quotation"
      className={cn(shellClass, "space-y-2")}
    >
      <OrderWorkspaceSectionHeader
        icon={ReceiptText}
        title="报价处理"
        description="维修项目、定金、质保与初始状态"
        className="mb-1"
        action={
          <span className="rounded-full bg-primary/5 px-1.5 py-0.5 text-[9px] font-semibold leading-3 text-primary">
            {form.issueCaptureMode === "unknown" ? "报价暂停" : `${form.faults.length} 项`}
          </span>
        }
      />

      <div
        data-new-order-quote-draft="true"
        className="rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)]/70 p-1.5"
      >
        <div
          id="new-order-quote-mode-note"
          className={cn(
            "mb-1.5 flex h-9 min-w-0 items-center overflow-hidden rounded-lg border px-2 py-1 text-[10px] leading-4",
            form.issueCaptureMode === "unknown"
              ? "border-primary/20 bg-primary/5 text-foreground"
              : "border-[var(--border-panel)] bg-card text-muted-foreground",
          )}
          role="status"
          aria-live="polite"
        >
          <span className="min-w-0 truncate" title={quoteModeNote}>
            {quoteModeNote}
          </span>
        </div>

        <fieldset
          disabled={form.issueCaptureMode === "unknown"}
          className="min-w-0 space-y-1.5 disabled:opacity-60"
          aria-describedby="new-order-quote-mode-note"
        >
          <div className="mb-2 rounded-xl border border-[var(--border-panel)] bg-card p-1">
            <div className="px-1 pb-1 text-[10px] font-medium leading-3 text-muted-foreground">
              常见维修项目（可选）
            </div>
            <FaultDiagnosisPicker
              selected={form.faults}
              onChange={(faults) => setForm({ ...form, faults })}
              className="gap-1 sm:gap-1.5"
              density="compact"
              appearance="quiet"
              compactColumns={3}
            />
          </div>
          <div className="mb-1 flex min-w-0 items-center justify-between gap-2 px-0.5">
            <span className="truncate text-[10px] font-medium leading-3 text-muted-foreground">
              报价项目
            </span>
          </div>
          {canManageOrderCosts && hasCatalogCostLines && costDefaultsError ? (
            <div
              role="alert"
              className="mb-1.5 flex items-center justify-between gap-2 rounded-lg border border-status-danger-foreground/20 bg-status-danger/10 px-2 py-1.5 text-[10px] leading-4 text-status-danger-foreground"
            >
              <span>默认成本读取失败，暂不能创建含目录项目的工单。</span>
              <Button type="button" variant="outline" size="sm" onClick={onRetryCostDefaults}>
                重试
              </Button>
            </div>
          ) : null}
          <div className="min-w-0 space-y-1.5">
            {form.faults.length === 0 ? (
              <OrderWorkspaceEmptyBlock>
                接单时可以暂不报价；检测后再从工单详情发布正式报价
              </OrderWorkspaceEmptyBlock>
            ) : (
              <div className="max-h-60 min-w-0 space-y-1.5 overflow-y-auto pr-0.5">
                {form.faults.map((item, index) => (
                  <OrderWorkspaceQuoteRow
                    key={item.key}
                    priceFullWidth={canManageOrderCosts && Boolean(item.line_id)}
                    price={
                      canManageOrderCosts && item.line_id ? (
                        <div className="grid min-w-0 grid-cols-2 gap-1.5">
                          <label className="min-w-0">
                            <span className="mb-0.5 block truncate text-[8px] font-semibold text-muted-foreground">
                              内部成本
                            </span>
                            <Input
                              value={costDrafts[item.line_id]?.text ?? ""}
                              inputMode="decimal"
                              autoComplete="off"
                              placeholder={
                                costDefaultsPending
                                  ? "读取中"
                                  : costDefaultsError
                                    ? "读取失败"
                                    : "留空"
                              }
                              disabled={isNewOrderCostInputDisabled({
                                catalogKey: item.catalog_key,
                                isOnline,
                                defaultsPending: costDefaultsPending,
                                defaultsError: costDefaultsError,
                              })}
                              aria-label={`维修项目 ${index + 1} 内部成本`}
                              className={cn(controlClass, "px-2 font-mono")}
                              onChange={(event) =>
                                onCostDraftChange?.(item.line_id!, event.target.value)
                              }
                            />
                          </label>
                          <label className="min-w-0">
                            <span className="mb-0.5 block truncate text-[8px] font-semibold text-muted-foreground">
                              客户报价
                            </span>
                            <MoneyKeypadInput
                              ariaLabel={`报价项目 ${index + 1} 金额`}
                              value={moneyDraftValue(Number(item.price) || 0)}
                              onChange={(value) =>
                                onPatchFault(index, { price: parseMoneyDraft(value) })
                              }
                              triggerClassName={cn(controlClass, "px-2 font-mono")}
                              placeholder="0"
                            />
                          </label>
                          {costExceedsQuote(
                            costDrafts[item.line_id]?.text ?? "",
                            Number(item.price),
                          ) ? (
                            <span className="col-span-2 text-[8px] font-medium leading-3 text-status-warn-foreground">
                              成本高于报价，请确认
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <MoneyKeypadInput
                          ariaLabel={`报价项目 ${index + 1} 金额`}
                          value={moneyDraftValue(Number(item.price) || 0)}
                          onChange={(value) =>
                            onPatchFault(index, { price: parseMoneyDraft(value) })
                          }
                          triggerClassName={cn(controlClass, "px-2 font-mono")}
                          placeholder="0"
                        />
                      )
                    }
                    action={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
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
                ))}
              </div>
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
        </fieldset>
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
          <div data-new-order-field="deposit">
            <FormItem label="定金">
              <MoneyKeypadInput
                ariaLabel="定金"
                value={moneyDraftValue(form.deposit)}
                onChange={(value) => setForm({ ...form, deposit: parseMoneyDraft(value) })}
                triggerClassName={cn(controlClass, "h-9 px-2 font-mono")}
                placeholder="0"
                disabled={form.issueCaptureMode === "unknown"}
              />
            </FormItem>
          </div>
          <FormItem label="保修">
            <WarrantyPicker
              valueMonths={form.warrantyMonths}
              valueText={form.warrantyText}
              reason={form.warrantyChangeReason}
              defaultMonths={defaultWarrantyMonths}
              compact
              triggerClassName={serviceSelectTriggerClass}
              contentClassName={serviceDropdownContentClass}
              reasonFieldTarget="warranty-reason"
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
              随附物品
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
              <SelectTrigger
                data-new-order-field="create-status"
                className={serviceSelectTriggerClass}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={serviceDropdownContentClass}>
                {availableCreateStatuses.map((status) => (
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

function costExceedsQuote(costText: string, quote: number) {
  const cost = parseOrderCostDraftAmount(costText);
  return cost !== null && Number.isFinite(quote) && cost > quote;
}

function getOperatorRoleLabel(role?: string) {
  if (role === "owner") return "最高管理员";
  if (role === "manager") return "管理员";
  if (role === "technician") return "技师";
  if (role === "sales") return "前台";
  if (role === "viewer") return "只读";
  return "账号";
}
