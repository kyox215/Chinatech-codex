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
import { deviceCustodyAllowsStatus } from "@/features/orders/model/device-custody";
import { localizeOrderWorkflowStatusLabel } from "@/features/orders/model/order-i18n";
import { repairOrderType, type RepairOrderType } from "@/lib/mock/enums";
import type { FaultPriceItem, OrderWorkflowStatus } from "@/lib/repairdesk/api";
import { detailWorkspace, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
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
  layout = "professional",
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
  layout?: "professional" | "guided";
}) {
  const { t } = useLocale();
  const shellClass = cn(
    "h-fit min-w-0 sm:p-3",
    surface === "dialog"
      ? cn(detailWorkspace.flatPanel, "p-1.5")
      : cn(
          repairOs.mobileInfoCard,
          "p-2",
          "md:rounded-[var(--radius-lg)] md:bg-[var(--surface-panel)] md:shadow-none",
        ),
  );
  const Shell = "section";
  const controlClass =
    "h-[38px] rounded-lg border-0 bg-[var(--surface-panel-muted)] text-base leading-none shadow-none focus-visible:ring-1 md:text-[13px] lg:h-8";
  const serviceSelectTriggerClass =
    "h-[38px] rounded-lg border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2.5 text-xs font-medium shadow-none focus:ring-1 focus:ring-ring focus-visible:ring-1 lg:h-10";
  const serviceDropdownContentClass = "z-[90] rounded-xl shadow-[var(--shadow-overlay)]";
  const balance = Math.max(0, total - form.deposit);
  const roleLabel = getOperatorRoleLabel(operatorRole, t);
  const availableCreateStatuses = createStatuses;
  const hasCatalogCostLines = form.faults.some((item) => Boolean(item.catalog_key));

  return (
    <Shell className={cn(shellClass, "space-y-2", layout === "professional" && "lg:contents")}>
      <div
        data-new-order-section="quotation"
        data-new-order-field="quotation"
        className={cn(
          "min-w-0",
          layout === "professional" &&
            "lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:rounded-[var(--radius-lg)] lg:border lg:border-[var(--border-panel)] lg:bg-[var(--surface-panel)] lg:p-3",
        )}
      >
        <OrderWorkspaceSectionHeader
          icon={ReceiptText}
          title={t("orders2b1.new.quoteTitle")}
          description={t("orders2b1.new.quoteHelp")}
          className="mb-1.5"
          action={
            <span className="rounded-full bg-primary/5 px-1.5 py-0.5 text-[9px] font-semibold leading-3 text-primary lg:text-[11px] lg:leading-4">
              {t("orders2b1.new.itemsCount", { count: form.faults.length })}
            </span>
          }
        />

        <div
          data-new-order-quote-draft="true"
          className="rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)]/70 p-1"
        >
          <fieldset className="min-w-0 space-y-1.5">
            <div className="mb-1.5 rounded-xl border border-[var(--border-panel)] bg-card p-1">
              <div className="px-1 pb-1 text-[10px] font-medium leading-3 text-muted-foreground lg:text-xs lg:leading-4">
                {t("orders2b1.new.commonRepairs")}
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
              <span className="truncate text-[10px] font-medium leading-3 text-muted-foreground lg:text-xs lg:leading-4">
                {t("orders2b1.new.quoteItems")}
              </span>
            </div>
            {canManageOrderCosts && hasCatalogCostLines && costDefaultsError ? (
              <div
                role="alert"
                className="mb-1.5 flex items-center justify-between gap-2 rounded-lg border border-status-danger-foreground/20 bg-status-danger/10 px-2 py-1.5 text-[10px] leading-4 text-status-danger-foreground lg:text-xs lg:leading-[18px]"
              >
                <span>{t("orders2b1.new.costLoadFailed")}</span>
                <Button type="button" variant="outline" size="sm" onClick={onRetryCostDefaults}>
                  {t("common.retry")}
                </Button>
              </div>
            ) : null}
            <div className="min-w-0 space-y-1.5">
              {form.faults.length === 0 ? (
                <OrderWorkspaceEmptyBlock>
                  {t("orders2b1.new.quoteOptional")}
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
                              <span className="mb-0.5 block truncate text-[8px] font-semibold text-muted-foreground lg:text-xs lg:leading-4">
                                {t("orders2b1.new.internalCost")}
                              </span>
                              <Input
                                value={costDrafts[item.line_id]?.text ?? ""}
                                inputMode="decimal"
                                autoComplete="off"
                                placeholder={
                                  costDefaultsPending
                                    ? t("orders2b1.new.loading")
                                    : costDefaultsError
                                      ? t("orders2b1.new.readFailed")
                                      : t("orders2b1.new.leaveEmpty")
                                }
                                disabled={isNewOrderCostInputDisabled({
                                  catalogKey: item.catalog_key,
                                  isOnline,
                                  defaultsPending: costDefaultsPending,
                                  defaultsError: costDefaultsError,
                                })}
                                aria-label={t("orders2b1.new.costAria", { index: index + 1 })}
                                className={cn(controlClass, "px-2 font-mono")}
                                onChange={(event) =>
                                  onCostDraftChange?.(item.line_id!, event.target.value)
                                }
                              />
                            </label>
                            <label className="min-w-0">
                              <span className="mb-0.5 block truncate text-[8px] font-semibold text-muted-foreground lg:text-xs lg:leading-4">
                                {t("orders2b1.new.customerQuote")}
                              </span>
                              <MoneyKeypadInput
                                ariaLabel={t("orders2b1.new.quoteAria", { index: index + 1 })}
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
                              <span className="col-span-2 text-[8px] font-medium leading-3 text-status-warn-foreground lg:text-xs lg:leading-[18px]">
                                {t("orders2b1.new.costAboveQuote")}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <MoneyKeypadInput
                            ariaLabel={t("orders2b1.new.quoteAria", { index: index + 1 })}
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
                          className="size-9 shrink-0 lg:size-8"
                          onClick={() =>
                            setForm({
                              ...form,
                              faults: form.faults.filter((_, faultIndex) => faultIndex !== index),
                            })
                          }
                          aria-label={t("orders2b1.new.deleteQuote")}
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
                          placeholder={t("orders2b1.new.customItem")}
                        />
                      ) : (
                        <>
                          <div
                            className="truncate text-[10px] font-medium leading-4 sm:text-[11px] lg:text-[13px] lg:leading-5"
                            title={item.name}
                          >
                            {item.name}
                          </div>
                          <div
                            className="truncate text-[9px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4"
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
                className="h-9 w-full justify-center gap-1.5 rounded-lg border-[var(--border-panel)] bg-card text-[11px] font-semibold shadow-none lg:h-8 lg:text-xs"
                onClick={onAddCustomFault}
              >
                <Plus className="size-3.5" /> {t("orders2b1.new.addCustomItem")}
              </Button>
            </div>
            <OrderWorkspaceMoneyStrip
              total={total}
              deposit={form.deposit}
              balance={balance}
              variant="finance"
              className="mt-1.5"
              depositControl={
                <MoneyKeypadInput
                  ariaLabel={t("orders2b1.money.deposit")}
                  value={moneyDraftValue(form.deposit)}
                  onChange={(value) => setForm({ ...form, deposit: parseMoneyDraft(value) })}
                  triggerClassName="h-5 min-h-0 border-0 bg-transparent px-0 py-0 font-mono text-[11px] font-semibold leading-4 shadow-none hover:bg-transparent focus-visible:ring-1 lg:text-xs"
                  placeholder="0"
                />
              }
            />
          </fieldset>
        </div>
      </div>

      <div
        data-new-order-section="settings"
        className="min-w-0 space-y-1.5 rounded-xl border border-[var(--border-panel)] bg-card p-2 lg:col-start-3 lg:row-start-2 lg:h-fit lg:space-y-2 lg:p-3"
      >
        <div className="flex min-w-0 items-center justify-between gap-1.5 px-0.5">
          <div className="min-w-0">
            <div className="truncate text-[10px] font-semibold leading-3 text-foreground lg:text-xs lg:leading-4">
              {t("orders2b1.new.settings")}
            </div>
          </div>
        </div>

        <div className="min-w-0" data-new-order-setting="warranty">
          <FormItem
            label={t("orders2b1.new.warranty")}
            className="[&>label]:text-[9.5px] [&>label]:font-medium [&>label]:leading-3 lg:[&>label]:text-xs lg:[&>label]:leading-4"
          >
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

        <div
          className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-x-1.5 gap-y-1.5 sm:gap-x-2"
          data-new-order-settings-grid="true"
        >
          <div className="grid min-w-0 gap-0.5" data-new-order-setting="operator">
            <div
              className="truncate text-[9.5px] font-medium leading-3 text-muted-foreground lg:text-xs lg:leading-4"
              data-new-order-setting-label="true"
            >
              {t("orders2b1.new.operator")}
            </div>
            <div
              className={cn(serviceSelectTriggerClass, "flex min-w-0 items-center gap-1.5 border")}
              data-new-order-setting-control="true"
              title={operatorName || t("orders2b1.new.currentAccount")}
            >
              <ShieldCheck className="size-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-xs font-semibold leading-4 text-foreground">
                {operatorName || t("orders2b1.new.currentAccount")}
              </span>
              <span className="max-w-[4.75rem] shrink-0 truncate rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium leading-none text-primary lg:text-[11px] lg:leading-4">
                {roleLabel}
              </span>
            </div>
          </div>
          <div className="grid min-w-0 gap-0.5" data-new-order-setting="accessories">
            <div
              className="truncate text-[9.5px] font-medium leading-3 text-muted-foreground lg:text-xs lg:leading-4"
              data-new-order-setting-label="true"
            >
              {t("orders2b1.new.accessories")}
            </div>
            <AccessoryNotesPicker
              value={form.accessoryNotes}
              onChange={(accessoryNotes) => setForm({ ...form, accessoryNotes })}
              compact
              triggerClassName={serviceSelectTriggerClass}
              contentClassName={serviceDropdownContentClass}
            />
          </div>
          <div className="grid min-w-0 gap-0.5" data-new-order-setting="type">
            <div
              className="text-[9.5px] font-medium leading-3 text-muted-foreground lg:text-xs lg:leading-4"
              data-new-order-setting-label="true"
            >
              {t("orders2b1.new.type")}
            </div>
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
                    {t(
                      type === "quick_repair"
                        ? "orders2b1.new.quickRepair"
                        : "orders2b1.new.dropoffRepair",
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid min-w-0 gap-0.5" data-new-order-setting="status">
            <div
              className="text-[9.5px] font-medium leading-3 text-muted-foreground lg:text-xs lg:leading-4"
              data-new-order-setting-label="true"
            >
              {t("orders2b1.new.status")}
            </div>
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
                  <SelectItem
                    key={status.code}
                    value={status.code}
                    disabled={
                      !deviceCustodyAllowsStatus(
                        form.deviceCustodyStatus,
                        status.code,
                        status.bucket,
                      )
                    }
                  >
                    {localizeOrderWorkflowStatusLabel(status, t)}
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

function getOperatorRoleLabel(role: string | undefined, t: ReturnType<typeof useLocale>["t"]) {
  if (role === "owner") return t("orders2b1.new.role.owner");
  if (role === "manager") return t("orders2b1.new.role.manager");
  if (role === "technician") return t("orders2b1.new.role.technician");
  if (role === "sales") return t("orders2b1.new.role.sales");
  if (role === "viewer") return t("orders2b1.new.role.viewer");
  return t("orders2b1.new.role.account");
}
