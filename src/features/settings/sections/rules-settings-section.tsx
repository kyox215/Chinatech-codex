"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Settings2, ShieldCheck } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STORE_INVENTORY_WARRANTY_RANGE,
  STORE_RULE_DEFAULTS,
} from "@/entities/store/model/store-setting-defaults";
import { ORDER_WARRANTY_OPTIONS, formatWarrantyText } from "@/features/orders/model/order-warranty";
import { CostBackfillCard } from "@/features/settings/components/cost-backfill-card";
import { CostCurrencySettingsCard } from "@/features/settings/components/cost-currency-settings-card";
import { RepairCostDefaultsCard } from "@/features/settings/components/repair-cost-defaults-card";
import { PartsProcurementCard } from "@/features/settings/components/parts-procurement-card";
import { SettingsField } from "@/features/settings/components/settings-field";
import type { SettingsFieldErrors } from "@/features/settings/model/settings-field-errors";
import {
  getSettingsFieldError,
  getSettingsFieldErrorId,
} from "@/features/settings/model/settings-field-errors";
import type { StoreSettingsDraftValues } from "@/features/settings/model/store-settings-draft";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { RepairOsSectionHeader } from "@/shared/ui";

export interface RulesSettingsSectionProps {
  draft: StoreSettingsDraftValues["rules"];
  isDraftDirty: boolean;
  canUpdateSettings: boolean;
  activeStoreId?: string;
  canManageOrderCosts?: boolean;
  canAllocatePartsCosts?: boolean;
  canReadCostCurrencies?: boolean;
  canManageCostCurrencies?: boolean;
  canPreviewCostBackfill?: boolean;
  canApplyCostBackfill?: boolean;
  fieldErrors: SettingsFieldErrors;
  onDraftChange: (patch: Partial<StoreSettingsDraftValues["rules"]>) => void;
}

export function RulesSettingsSection({
  draft,
  isDraftDirty,
  canUpdateSettings,
  activeStoreId,
  canManageOrderCosts = false,
  canAllocatePartsCosts = false,
  canReadCostCurrencies = false,
  canManageCostCurrencies = false,
  canPreviewCostBackfill = false,
  canApplyCostBackfill = false,
  fieldErrors,
  onDraftChange,
}: RulesSettingsSectionProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restoredToDraft, setRestoredToDraft] = useState(false);
  useEffect(() => {
    if (!isDraftDirty) setRestoredToDraft(false);
  }, [isDraftDirty]);
  const [inventoryWarrantyInput, setInventoryWarrantyInput] = useState(() =>
    String(draft.default_inventory_warranty_months),
  );
  useEffect(() => {
    if (!Number.isFinite(draft.default_inventory_warranty_months)) return;
    setInventoryWarrantyInput(String(draft.default_inventory_warranty_months));
  }, [draft.default_inventory_warranty_months]);

  const inventoryWarrantyNumber = Number(inventoryWarrantyInput);
  const inventoryWarrantyLocalError =
    inventoryWarrantyInput.trim() === ""
      ? "请输入库存默认保修月数"
      : !Number.isFinite(inventoryWarrantyNumber) || !Number.isInteger(inventoryWarrantyNumber)
        ? "库存默认保修必须是整数"
        : inventoryWarrantyNumber < STORE_INVENTORY_WARRANTY_RANGE.min ||
            inventoryWarrantyNumber > STORE_INVENTORY_WARRANTY_RANGE.max
          ? "库存默认保修必须在 0–120 个月之间"
          : undefined;
  const inventoryWarrantyError =
    getSettingsFieldError(fieldErrors, "default_inventory_warranty_months") ??
    inventoryWarrantyLocalError;
  const isDefault =
    draft.default_order_warranty_months === STORE_RULE_DEFAULTS.default_order_warranty_months &&
    draft.default_inventory_warranty_months ===
      STORE_RULE_DEFAULTS.default_inventory_warranty_months &&
    draft.new_order_entry_mode === STORE_RULE_DEFAULTS.new_order_entry_mode;

  const changeDraft = (patch: Partial<StoreSettingsDraftValues["rules"]>) => {
    setRestoredToDraft(false);
    onDraftChange(patch);
  };

  return (
    <div data-settings-rules-section className="min-w-0 space-y-3">
      <section className={cn(repairOs.adminSection, "p-2.5 sm:p-3")}>
        <RepairOsSectionHeader
          icon={Settings2}
          iconFrame={false}
          title="默认规则"
          action={
            <Badge variant="outline" className="text-[10px]">
              {canUpdateSettings ? "可编辑" : "只读"}
            </Badge>
          }
        />

        <div className="mb-3 rounded-xl border border-status-info-foreground/20 bg-status-info/10 px-3 py-2.5 text-status-info-foreground">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold">
            <ShieldCheck className="size-3.5" /> 只影响之后新建的业务对象
          </p>
          <p className="mt-1 text-[11px] leading-4">
            保存后，新打开的快速接单、新维修单和新库存商品会采用这些默认值；已经打开的接单会话、已有维修单、库存记录及已售保修快照不会被改写。
          </p>
        </div>

        {canUpdateSettings ? (
          <div className="grid min-w-0 gap-3 xl:grid-cols-2">
            <SettingsField
              label="快速接单模式"
              htmlFor="new-order-mode-professional"
              error={getSettingsFieldError(fieldErrors, "new_order_entry_mode")}
            >
              <RadioGroup
                value={draft.new_order_entry_mode}
                onValueChange={(value) =>
                  changeDraft({
                    new_order_entry_mode:
                      value as StoreSettingsDraftValues["rules"]["new_order_entry_mode"],
                  })
                }
                className="grid gap-2 sm:grid-cols-2"
                aria-describedby="new-order-mode-description"
              >
                <label
                  htmlFor="new-order-mode-simple"
                  className={cn(
                    "flex min-h-20 cursor-pointer items-start gap-2 rounded-xl border p-3",
                    draft.new_order_entry_mode === "simple"
                      ? "border-primary bg-primary/5"
                      : "border-[var(--border-panel)] bg-[var(--surface-panel-muted)]",
                  )}
                >
                  <RadioGroupItem id="new-order-mode-simple" value="simple" className="mt-0.5" />
                  <span>
                    <span className="block text-xs font-semibold">简易模式</span>
                    <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                      用四个步骤引导新员工完成客户、设备、维修报价和确认。
                    </span>
                  </span>
                </label>
                <label
                  htmlFor="new-order-mode-professional"
                  className={cn(
                    "flex min-h-20 cursor-pointer items-start gap-2 rounded-xl border p-3",
                    draft.new_order_entry_mode === "professional"
                      ? "border-primary bg-primary/5"
                      : "border-[var(--border-panel)] bg-[var(--surface-panel-muted)]",
                  )}
                >
                  <RadioGroupItem
                    id="new-order-mode-professional"
                    value="professional"
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-xs font-semibold">专业模式</span>
                    <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                      保持当前快速接单工作台，一次显示全部字段。
                    </span>
                  </span>
                </label>
              </RadioGroup>
              <p
                id="new-order-mode-description"
                className="text-[11px] leading-4 text-muted-foreground"
              >
                模式变更会在下次打开快速接单时生效。
              </p>
            </SettingsField>
            <SettingsField
              label="新维修单默认质保"
              htmlFor="order-warranty"
              error={getSettingsFieldError(fieldErrors, "default_order_warranty_months")}
            >
              <Select
                value={String(draft.default_order_warranty_months)}
                onValueChange={(value) =>
                  changeDraft({
                    default_order_warranty_months: Number(
                      value,
                    ) as StoreSettingsDraftValues["rules"]["default_order_warranty_months"],
                  })
                }
              >
                <SelectTrigger
                  id="order-warranty"
                  className="h-[38px] text-base sm:min-h-10 sm:text-sm"
                  aria-invalid={Boolean(
                    getSettingsFieldError(fieldErrors, "default_order_warranty_months"),
                  )}
                  aria-describedby={getSettingsFieldErrorId(
                    fieldErrors,
                    "default_order_warranty_months",
                    "order-warranty",
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_WARRANTY_OPTIONS.map((option) => (
                    <SelectItem key={option.months} value={String(option.months)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsField>
            <SettingsField
              label="新库存商品默认保修月数"
              htmlFor="inventory-warranty"
              error={inventoryWarrantyError}
            >
              <Input
                id="inventory-warranty"
                type="number"
                inputMode="numeric"
                step={1}
                required
                min={STORE_INVENTORY_WARRANTY_RANGE.min}
                max={STORE_INVENTORY_WARRANTY_RANGE.max}
                className="h-[38px] text-base sm:min-h-10 sm:text-sm"
                value={inventoryWarrantyInput}
                aria-invalid={Boolean(inventoryWarrantyError)}
                aria-describedby={
                  inventoryWarrantyError
                    ? "inventory-warranty-error"
                    : getSettingsFieldErrorId(
                        fieldErrors,
                        "default_inventory_warranty_months",
                        "inventory-warranty",
                      )
                }
                onChange={(event) => {
                  const value = event.target.value;
                  setInventoryWarrantyInput(value);
                  const numeric = Number(value);
                  changeDraft({
                    default_inventory_warranty_months:
                      value.trim() === "" || !Number.isFinite(numeric) ? Number.NaN : numeric,
                  });
                }}
              />
              <p className="text-[11px] leading-4 text-muted-foreground">
                0 表示新库存默认无保修；允许范围 0–120 个月。
              </p>
            </SettingsField>
          </div>
        ) : (
          <dl className="grid min-w-0 gap-2 sm:grid-cols-2">
            <ReadOnlyRule
              label="快速接单模式"
              value={
                draft.new_order_entry_mode === "simple"
                  ? "简易模式（四步引导）"
                  : "专业模式（全部字段）"
              }
            />
            <ReadOnlyRule
              label="新维修单默认质保"
              value={formatWarrantyText(draft.default_order_warranty_months)}
            />
            <ReadOnlyRule
              label="新库存商品默认保修"
              value={formatInventoryWarranty(draft.default_inventory_warranty_months)}
            />
          </dl>
        )}

        {canUpdateSettings ? (
          <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p
              role={restoredToDraft && isDraftDirty ? "status" : undefined}
              className="text-[11px] text-muted-foreground"
            >
              {restoredToDraft && isDraftDirty
                ? "默认值已应用到草稿，仍需点击“保存”才会生效。"
                : isDefault
                  ? "当前草稿已是系统默认。"
                  : "恢复默认只修改当前草稿，不会绕过保存与版本冲突检查。"}
            </p>
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-9 w-full shrink-0 aria-disabled:pointer-events-none aria-disabled:opacity-50 sm:min-h-10 sm:w-auto"
                  aria-disabled={isDefault}
                  onClick={(event) => {
                    if (isDefault) event.preventDefault();
                  }}
                >
                  <RotateCcw className="size-3.5" />
                  恢复系统默认
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>把系统默认值应用到草稿？</AlertDialogTitle>
                  <AlertDialogDescription>
                    快速接单将恢复为专业模式； 维修默认质保将从{" "}
                    {formatWarrantyText(draft.default_order_warranty_months)} 调整为{" "}
                    {formatWarrantyText(STORE_RULE_DEFAULTS.default_order_warranty_months)}
                    ；库存默认保修将从{" "}
                    {formatInventoryWarranty(draft.default_inventory_warranty_months)} 调整为{" "}
                    {formatInventoryWarranty(STORE_RULE_DEFAULTS.default_inventory_warranty_months)}
                    。这里只更新草稿，确认后仍需单独保存。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel type="button" className="min-h-11">
                    取消
                  </AlertDialogCancel>
                  <AlertDialogAction
                    type="button"
                    className="min-h-11"
                    onClick={() => {
                      onDraftChange({ ...STORE_RULE_DEFAULTS });
                      setRestoredToDraft(true);
                    }}
                  >
                    应用默认值到草稿
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : null}
      </section>
      {canManageOrderCosts && activeStoreId ? (
        <RepairCostDefaultsCard key={activeStoreId} storeId={activeStoreId} />
      ) : null}
      {canManageCostCurrencies && activeStoreId ? (
        <CostCurrencySettingsCard
          key={`cost-currencies-${activeStoreId}`}
          storeId={activeStoreId}
        />
      ) : null}
      {canAllocatePartsCosts && activeStoreId ? (
        <PartsProcurementCard
          key={`parts-${activeStoreId}`}
          storeId={activeStoreId}
          multiCurrencyEnabled={canReadCostCurrencies}
        />
      ) : null}
      {canPreviewCostBackfill && activeStoreId ? (
        <CostBackfillCard
          key={`cost-backfill-${activeStoreId}`}
          storeId={activeStoreId}
          canApply={canApplyCostBackfill}
        />
      ) : null}
    </div>
  );
}

function ReadOnlyRule({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2.5">
      <dt className="text-[10px] font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-xs font-semibold leading-4">{value}</dd>
    </div>
  );
}

function formatInventoryWarranty(months: number) {
  if (!Number.isFinite(months)) return "未填写";
  return months === 0 ? "无保修（0 个月）" : `${months} 个月`;
}
