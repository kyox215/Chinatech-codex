"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { ChevronDown, Plus, ReceiptText, ShieldCheck, Trash2 } from "lucide-react";

import { MoneyKeypadInput } from "@/components/orders/money-keypad-input";
import { FaultDiagnosisPicker } from "@/components/orders/fault-diagnosis-picker";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  OrderWorkspaceEmptyBlock,
  OrderWorkspaceMoneyStrip,
  OrderWorkspaceQuoteRow,
  OrderWorkspaceQuoteDisclosure,
  OrderWorkspaceQuoteTextField,
  OrderWorkspaceSectionHeader,
} from "@/features/orders/components/order-workspace-primitives";
import { WarrantyPicker } from "@/features/orders/components/warranty-picker";
import { FormItem } from "@/features/orders/forms/new-order-fields";
import type { NewOrderFormState } from "@/features/orders/model/new-order-form";
import { deviceCustodyAllowsStatus } from "@/features/orders/model/device-custody";
import {
  localizeOrderWorkflowStatusLabel,
  localizeRepairServiceItemName,
} from "@/features/orders/model/order-i18n";
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
  createStatuses,
  defaultWarrantyMonths = 6,
  surface = "page",
  layout = "professional",
  part = "all",
  mobileOverview = false,
  expanded = false,
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
  layout?: "professional" | "guided";
  part?: "all" | "quote" | "settings";
  mobileOverview?: boolean;
  expanded?: boolean;
}) {
  const { locale, t } = useLocale();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const shellClass = mobileOverview
    ? "min-w-0"
    : cn(
        "h-fit min-w-0 sm:p-3",
        surface === "dialog"
          ? cn(detailWorkspace.flatPanel, "p-1.5")
          : cn(
              repairOs.mobileInfoCard,
              "p-2.5",
              "md:rounded-[var(--radius-lg)] md:bg-[var(--surface-panel)] md:shadow-none",
            ),
      );
  const Shell = "section";
  const controlClass =
    "h-9 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)]/60 text-base leading-none shadow-none focus-visible:ring-1 md:text-base lg:text-sm";
  const serviceSelectTriggerClass =
    "h-[38px] rounded-lg border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2.5 text-xs font-medium shadow-none focus:ring-1 focus:ring-ring focus-visible:ring-1 lg:h-10";
  const serviceDropdownContentClass = "z-[90] rounded-xl shadow-[var(--shadow-overlay)]";
  const balance = Math.max(0, total - form.deposit);
  const roleLabel = getOperatorRoleLabel(operatorRole, t);
  const availableCreateStatuses = createStatuses;

  return (
    <Shell className={cn(layout === "professional" ? "contents" : "min-w-0 space-y-2")}>
      {part !== "settings" ? (
        <div
          data-new-order-section="quotation"
          data-new-order-field="quotation"
          className={cn(shellClass, layout === "professional" && "md:col-start-2 md:row-start-1")}
        >
          <OrderWorkspaceSectionHeader
            icon={ReceiptText}
            title={t("orders2b1.new.quoteTitle")}
            className="mb-2 [&_h3]:overflow-visible [&_h3]:whitespace-normal [&_h3]:text-sm [&_h3]:leading-5 [&_p]:mt-0.5 [&_p]:whitespace-normal [&_p]:text-[11px] [&_p]:leading-4 [&_svg]:size-3.5"
            action={
              <span className="rounded-lg bg-primary/5 px-2 py-1 text-xs font-semibold leading-4 text-primary">
                {t("orders2b1.new.itemsCount", { count: form.faults.length })}
              </span>
            }
          />

          <div data-new-order-quote-draft="true" className="min-w-0">
            <fieldset className="min-w-0 space-y-2">
              <div className="min-w-0 space-y-2">
                <FaultDiagnosisPicker
                  selected={form.faults}
                  onChange={(faults) => setForm({ ...form, faults })}
                  className="gap-1"
                  density="compact"
                  appearance="quiet"
                  compactColumns={4}
                />
              </div>
              <div className="min-w-0 space-y-2">
                {form.faults.length === 0 ? (
                  <OrderWorkspaceEmptyBlock>
                    {t("orders2b1.new.quoteOptional")}
                  </OrderWorkspaceEmptyBlock>
                ) : (
                  <div className="min-w-0 space-y-0">
                    {form.faults.map((item, index) => (
                      <OrderWorkspaceQuoteRow
                        key={item.key}
                        priceFullWidth={false}
                        appearance="quote-editor"
                        note={item.note || undefined}
                        price={
                          <MoneyKeypadInput
                            ariaLabel={t("orders2b1.new.quoteAria", { index: index + 1 })}
                            value={moneyDraftValue(Number(item.price) || 0)}
                            onChange={(value) =>
                              onPatchFault(index, { price: parseMoneyDraft(value) })
                            }
                            triggerClassName={cn(controlClass, "h-auto min-h-9 px-1 font-mono")}
                            valueClassName="overflow-visible whitespace-nowrap text-clip leading-6"
                            placeholder="0"
                            layout="quote-editor"
                          />
                        }
                        action={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 rounded-lg"
                            onClick={() =>
                              setForm({
                                ...form,
                                faults: form.faults.filter((_, faultIndex) => faultIndex !== index),
                              })
                            }
                            aria-label={t("orders2b1.new.deleteQuote")}
                          >
                            <Trash2 className="size-4 text-muted-foreground" />
                          </Button>
                        }
                      >
                        {item.categoryKey === "custom" ? (
                          <OrderWorkspaceQuoteTextField
                            value={item.name}
                            onValueChange={(name) => onPatchFault(index, { name })}
                            className="border-[var(--border-panel)] bg-[var(--surface-panel-muted)]/60 px-2 focus-visible:ring-1"
                            placeholder={t("orders2b1.new.customItem")}
                            ariaLabel={t("orders2b1.new.customItem")}
                          />
                        ) : (
                          <div
                            className={cn(
                              "flex min-h-9 min-w-0 items-center",
                              mobileOverview && "min-h-[35px]",
                            )}
                          >
                            <OrderWorkspaceQuoteDisclosure className="w-full text-sm font-semibold leading-5">
                              {localizeRepairServiceItemName(item, locale)}
                            </OrderWorkspaceQuoteDisclosure>
                          </div>
                        )}
                      </OrderWorkspaceQuoteRow>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-9 w-full justify-center gap-1.5 rounded-lg border-dashed border-[var(--border-panel)] bg-card text-xs font-semibold text-muted-foreground shadow-none",
                    mobileOverview && "h-6 justify-start border-0 bg-transparent px-0 text-primary",
                  )}
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
                appearance="quote-editor"
                className={cn(
                  "mt-2",
                  mobileOverview &&
                    "gap-0 rounded-xl border border-border bg-card py-1 [&>div]:rounded-none [&>div]:bg-transparent [&>div+div]:border-l [&>div+div]:border-border",
                )}
                depositControl={
                  <MoneyKeypadInput
                    ariaLabel={t("orders2b1.money.deposit")}
                    value={moneyDraftValue(form.deposit)}
                    onChange={(value) => setForm({ ...form, deposit: parseMoneyDraft(value) })}
                    triggerClassName={cn(controlClass, "bg-card px-2")}
                    placeholder="0"
                    layout="quote-editor"
                  />
                }
              />
            </fieldset>
          </div>
        </div>
      ) : null}

      {part !== "quote" ? (
        <div data-new-order-section="settings" className={cn(shellClass, "space-y-2")}>
          {!expanded ? (
            <>
              <Button
                type="button"
                variant="ghost"
                className="h-9 w-full justify-between px-0 text-xs font-semibold"
                aria-expanded={settingsOpen}
                aria-controls="new-order-service-fields"
                onClick={() => setSettingsOpen((open) => !open)}
              >
                <span>{t("orders2b1.new.settings")}</span>
                <ChevronDown className={cn("size-3.5", settingsOpen && "rotate-180")} />
              </Button>
              <p className="text-[11px] leading-4 text-muted-foreground">
                {form.warrantyText} ·{" "}
                {t(
                  form.type === "quick_repair"
                    ? "orders2b1.new.quickRepair"
                    : "orders2b1.new.dropoffRepair",
                )}{" "}
                ·{" "}
                {availableCreateStatuses.find((status) => status.code === form.status)
                  ? localizeOrderWorkflowStatusLabel(
                      availableCreateStatuses.find((status) => status.code === form.status)!,
                      t,
                    )
                  : form.status}
              </p>
              <p className="text-[11px] leading-4 text-muted-foreground">
                {t("orders2b1.new.operator")}: {operatorName} / {roleLabel}
              </p>
            </>
          ) : null}
          <div
            id="new-order-service-fields"
            hidden={!settingsOpen && !expanded}
            className="space-y-2"
          >
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
                  className={cn(
                    serviceSelectTriggerClass,
                    "flex min-w-0 items-center gap-1.5 border",
                  )}
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
        </div>
      ) : null}
    </Shell>
  );
}

function getOperatorRoleLabel(role: string | undefined, t: ReturnType<typeof useLocale>["t"]) {
  if (role === "owner") return t("orders2b1.new.role.owner");
  if (role === "manager") return t("orders2b1.new.role.manager");
  if (role === "technician") return t("orders2b1.new.role.technician");
  if (role === "sales") return t("orders2b1.new.role.sales");
  if (role === "viewer") return t("orders2b1.new.role.viewer");
  return t("orders2b1.new.role.account");
}
