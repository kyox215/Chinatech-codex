"use client";

import type { FormEvent } from "react";
import { Loader2, Search, UserRound, X } from "lucide-react";

import type { Customer, InventoryLifecycleListSummary } from "@/lib/repairdesk/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { repairOs } from "@/lib/ui-patterns";

import { InventoryLifecycleValidationSummary } from "../components/inventory-lifecycle-field-feedback";
import {
  InventoryConflictPanel,
  type InventoryConflictDetails,
} from "../../components/inventory-conflict-panel";
import { InventoryOperationErrorPanel } from "../../components/inventory-operation-error-panel";
import type {
  InventoryOperationErrorDetails,
  InventoryOperationVerificationStatus,
} from "../../model/inventory-operation-error";

export const inventoryReservationPaymentMethods = [
  ["cash", "现金"],
  ["card", "银行卡"],
  ["bancomat", "Bancomat"],
  ["transfer", "转账"],
  ["other", "其他"],
] as const;
export type InventoryReservationPaymentMethod =
  (typeof inventoryReservationPaymentMethods)[number][0];

export type InventoryReservationFormBodyProps = {
  summary: InventoryLifecycleListSummary;
  customerSearch: string;
  onCustomerSearchChange: (value: string) => void;
  customer: Customer | null;
  onCustomerClear: () => void;
  customerResults: Customer[];
  onCustomerSelect: (customer: Customer) => void;
  price: string;
  onPriceChange: (value: string) => void;
  deposit: string;
  onDepositChange: (value: string) => void;
  method: InventoryReservationPaymentMethod;
  onMethodChange: (value: InventoryReservationPaymentMethod) => void;
  paymentNote: string;
  onPaymentNoteChange: (value: string) => void;
  expiresAt: string;
  onExpiresAtChange: (value: string) => void;
  expectedPickupAt: string;
  onExpectedPickupAtChange: (value: string) => void;
  noDepositReason: string;
  onNoDepositReasonChange: (value: string) => void;
  noDeposit: boolean;
  canSubmit: boolean;
  disabledReason?: string;
  conflict: InventoryConflictDetails | null;
  operationError: InventoryOperationErrorDetails | null;
  operationVerification: InventoryOperationVerificationStatus;
  operationAcknowledged: boolean;
  onAcknowledgeOperation: () => void;
  onVerifyOperation: () => void | Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  pending: boolean;
};

/**
 * Props-only reservation body shared by the real reservation adapter and
 * Storybook's synthetic lifecycle workbench. Query, mutation, idempotency and
 * store authority remain in InventoryReservationForm.
 */
export function InventoryReservationFormBody({
  summary,
  customerSearch,
  onCustomerSearchChange,
  customer,
  onCustomerClear,
  customerResults,
  onCustomerSelect,
  price,
  onPriceChange,
  deposit,
  onDepositChange,
  method,
  onMethodChange,
  paymentNote,
  onPaymentNoteChange,
  expiresAt,
  onExpiresAtChange,
  expectedPickupAt,
  onExpectedPickupAtChange,
  noDepositReason,
  onNoDepositReasonChange,
  noDeposit,
  canSubmit,
  disabledReason,
  conflict,
  operationError,
  operationVerification,
  operationAcknowledged,
  onAcknowledgeOperation,
  onVerifyOperation,
  onSubmit,
  pending,
}: InventoryReservationFormBodyProps) {
  return (
    <form
      className={cn(repairOs.mobileInfoCard, "space-y-3 p-3 sm:p-4")}
      onSubmit={onSubmit}
      noValidate
      data-inventory-lifecycle-body="reservation"
    >
      <fieldset disabled={!canSubmit} className="min-w-0 space-y-3 disabled:opacity-70">
        <legend className="text-sm font-semibold">新建预订</legend>
        <p className="text-xs leading-5 text-muted-foreground">
          先选同店客户，再填写成交价、定金和预计取走时间。服务端会再次校验门店、权限和版本。
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="reservation-customer">客户 *</Label>
          {customer ? (
            <div className="flex min-h-11 items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-2.5">
              <UserRound className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{customer.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {customerContactLabel(customer)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label="清除已选客户"
                onClick={onCustomerClear}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="reservation-customer"
                value={customerSearch}
                onChange={(event) => onCustomerSearchChange(event.target.value)}
                placeholder="搜索姓名或电话（至少 2 个字符）"
                className="h-11 pl-9"
                autoComplete="off"
              />
              {customerResults.length ? (
                <div className="absolute inset-x-0 top-[calc(100%+4px)] z-20 overflow-hidden rounded-lg border border-[var(--border-panel)] bg-popover shadow-[var(--shadow-overlay)]">
                  {customerResults.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                      onClick={() => onCustomerSelect(candidate)}
                    >
                      <UserRound
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate">{candidate.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {customerContactLabel(candidate)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <MoneyField
            id="reservation-price"
            label="成交价 *"
            value={price}
            onChange={onPriceChange}
          />
          <MoneyField
            id="reservation-deposit"
            label="定金（可为 0）"
            value={deposit}
            onChange={onDepositChange}
          />
        </div>

        {noDeposit ? (
          <div className="space-y-1.5">
            <Label htmlFor="reservation-no-deposit-reason">免定金原因 *</Label>
            <Textarea
              id="reservation-no-deposit-reason"
              value={noDepositReason}
              onChange={(event) => onNoDepositReasonChange(event.target.value)}
              placeholder="仅负责人可批准免定金，例如：老客户现场取机"
              className="min-h-16"
            />
          </div>
        ) : null}

        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <DateField
            id="reservation-expires"
            label="预订到期"
            value={expiresAt}
            onChange={onExpiresAtChange}
          />
          <DateField
            id="reservation-pickup"
            label="预计取走"
            value={expectedPickupAt}
            onChange={onExpectedPickupAtChange}
          />
        </div>

        {deposit.trim() && parseMoney(deposit) !== 0 ? (
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="reservation-method">定金支付方式</Label>
              <Select
                value={method}
                onValueChange={(value) =>
                  onMethodChange(value as InventoryReservationPaymentMethod)
                }
              >
                <SelectTrigger id="reservation-method" className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {inventoryReservationPaymentMethods.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reservation-payment-note">付款备注</Label>
              <Input
                id="reservation-payment-note"
                value={paymentNote}
                onChange={(event) => onPaymentNoteChange(event.target.value)}
                className="h-11"
                placeholder="可选"
              />
            </div>
          </div>
        ) : null}
      </fieldset>

      {disabledReason ? (
        <p
          className="rounded-lg bg-status-warn/10 px-2.5 py-2 text-xs text-status-warn-foreground"
          role="status"
        >
          {disabledReason}
        </p>
      ) : null}
      {conflict ? (
        <InventoryConflictPanel
          conflict={conflict}
          onRecover={onVerifyOperation}
          pending={operationVerification === "verifying"}
        />
      ) : null}
      {operationError ? (
        <InventoryOperationErrorPanel
          error={operationError}
          verificationStatus={operationVerification}
          acknowledged={operationAcknowledged}
          onAcknowledge={onAcknowledgeOperation}
          onVerify={onVerifyOperation}
        />
      ) : null}
      <InventoryLifecycleValidationSummary id="inventory-reservation-validation-summary" />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-panel)] pt-3">
        <span className="text-[10px] text-muted-foreground">
          库存版本 {summary.unit_version ?? "—"}
        </span>
        <Button type="submit" className="min-h-11 gap-1.5 px-4" disabled={!canSubmit}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pending ? "提交中…" : "确认预订"}
        </Button>
      </div>
    </form>
  );
}

function MoneyField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          €
        </span>
        <Input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 pl-8 font-mono tabular-nums"
          placeholder="0.00"
        />
      </div>
    </div>
  );
}

function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11"
      />
    </div>
  );
}

function parseMoney(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : undefined;
}

function customerContactLabel(customer: Customer) {
  const digits = (customer.phone_e164 || customer.phone_raw || "").replace(/\D/g, "");
  return digits ? `•••• ${digits.slice(-4)}` : "联系方式已隐藏";
}
