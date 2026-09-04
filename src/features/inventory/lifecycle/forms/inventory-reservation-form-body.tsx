"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
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
import { useLocale } from "@/shared/i18n/locale-provider";

import {
  InventoryLifecycleValidationSummary,
  type InventoryLifecycleValidationIssue,
} from "../components/inventory-lifecycle-field-feedback";
import { localizeInventoryPaymentMethod } from "../model/inventory-lifecycle-i18n";
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
  customerSearchState?: "idle" | "loading" | "empty" | "error" | "ready";
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
  validationIssues?: readonly InventoryLifecycleValidationIssue[];
  validationFocusRequestKey?: string | number;
  localError?: string;
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
  customerSearchState = customerResults.length ? "ready" : "idle",
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
  validationIssues = [],
  validationFocusRequestKey,
  localError,
  conflict,
  operationError,
  operationVerification,
  operationAcknowledged,
  onAcknowledgeOperation,
  onVerifyOperation,
  onSubmit,
  pending,
}: InventoryReservationFormBodyProps) {
  const { t } = useLocale();
  const customerInputRef = useRef<HTMLInputElement>(null);
  const customerOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [customerListboxDismissed, setCustomerListboxDismissed] = useState(false);
  const customerListboxId = "reservation-customer-results";
  const customerExpanded =
    !customer &&
    !customerListboxDismissed &&
    customerSearch.trim().length >= 2 &&
    customerSearchState !== "idle";
  useEffect(() => {
    setCustomerListboxDismissed(false);
  }, [customerSearch, customerSearchState]);
  const focusField = (fieldId: string) => {
    document.getElementById(fieldId)?.focus({ preventScroll: true });
  };
  const handleCustomerOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setCustomerListboxDismissed(true);
      customerInputRef.current?.focus({ preventScroll: true });
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const offset = event.key === "ArrowDown" ? 1 : -1;
    const next = (index + offset + customerResults.length) % customerResults.length;
    customerOptionRefs.current[next]?.focus({ preventScroll: true });
  };

  return (
    <form
      className={cn(repairOs.mobileInfoCard, "space-y-3 p-3 sm:p-4")}
      onSubmit={onSubmit}
      noValidate
      data-inventory-lifecycle-body="reservation"
    >
      <fieldset disabled={!canSubmit} className="min-w-0 space-y-3 disabled:opacity-70">
        <legend className="text-sm font-semibold">{t("inventory2b4.reservation.title")}</legend>
        <p className="text-xs leading-5 text-muted-foreground">
          {t("inventory2b4.reservation.form.description")}
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="reservation-customer">{t("inventory2b4.reservation.customer")} *</Label>
          {customer ? (
            <div
              className="flex min-h-11 items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-2.5"
              role="status"
              aria-live="polite"
            >
              <UserRound className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{customer.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {customerContactLabel(customer, t("inventory2b4.reservation.contactHidden"))}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label={t("inventory2b4.reservation.customerClear")}
                onClick={onCustomerClear}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
              <span className="sr-only">
                {t("inventory2b4.reservation.customerSelected", { name: customer.name })}
              </span>
            </div>
          ) : (
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                ref={customerInputRef}
                id="reservation-customer"
                value={customerSearch}
                onChange={(event) => {
                  setCustomerListboxDismissed(false);
                  onCustomerSearchChange(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && customerExpanded) {
                    event.preventDefault();
                    setCustomerListboxDismissed(true);
                    customerInputRef.current?.focus({ preventScroll: true });
                    return;
                  }
                  if (event.key === "ArrowDown" && customerResults.length > 0) {
                    event.preventDefault();
                    setCustomerListboxDismissed(false);
                    customerOptionRefs.current[0]?.focus({ preventScroll: true });
                  }
                }}
                placeholder={t("inventory2b4.reservation.customerSearch")}
                className="h-11 pl-9"
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-controls={customerExpanded ? customerListboxId : undefined}
                aria-expanded={customerExpanded}
                aria-invalid={validationIssues.some(
                  (issue) => issue.fieldId === "reservation-customer",
                )}
              />
              {customerExpanded ? (
                <div
                  id={customerListboxId}
                  role="listbox"
                  aria-label={t("inventory2b4.reservation.customerResults")}
                  className="absolute inset-x-0 top-[calc(100%+4px)] z-20 overflow-hidden rounded-lg border border-[var(--border-panel)] bg-popover shadow-[var(--shadow-overlay)]"
                >
                  {customerSearchState === "loading" ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground" role="status">
                      {t("inventory2b4.reservation.customerLoading")}
                    </p>
                  ) : null}
                  {customerSearchState === "error" ? (
                    <p className="px-3 py-3 text-sm text-status-danger-foreground" role="alert">
                      {t("inventory2b4.reservation.customerError")}
                    </p>
                  ) : null}
                  {customerSearchState === "empty" ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground" role="status">
                      {t("inventory2b4.reservation.customerEmpty")}
                    </p>
                  ) : null}
                  {customerSearchState === "ready"
                    ? customerResults.map((candidate, index) => (
                        <button
                          key={candidate.id}
                          ref={(node) => {
                            customerOptionRefs.current[index] = node;
                          }}
                          id={`${customerListboxId}-option-${index}`}
                          type="button"
                          role="option"
                          aria-selected="false"
                          className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                          onClick={() => onCustomerSelect(candidate)}
                          onKeyDown={(event) => handleCustomerOptionKeyDown(event, index)}
                        >
                          <UserRound
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1 truncate">{candidate.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {customerContactLabel(
                              candidate,
                              t("inventory2b4.reservation.contactHidden"),
                            )}
                          </span>
                        </button>
                      ))
                    : null}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <MoneyField
            id="reservation-price"
            label={`${t("inventory2b4.reservation.price")} *`}
            value={price}
            onChange={onPriceChange}
            invalid={validationIssues.some((issue) => issue.fieldId === "reservation-price")}
          />
          <MoneyField
            id="reservation-deposit"
            label={t("inventory2b4.reservation.deposit")}
            value={deposit}
            onChange={onDepositChange}
            invalid={validationIssues.some((issue) => issue.fieldId === "reservation-deposit")}
          />
        </div>

        {noDeposit ? (
          <div className="space-y-1.5">
            <Label htmlFor="reservation-no-deposit-reason">
              {t("inventory2b4.reservation.noDepositReason")} *
            </Label>
            <Textarea
              id="reservation-no-deposit-reason"
              value={noDepositReason}
              onChange={(event) => onNoDepositReasonChange(event.target.value)}
              placeholder={t("inventory2b4.reservation.noDepositPlaceholder")}
              className="min-h-16"
              aria-invalid={validationIssues.some(
                (issue) => issue.fieldId === "reservation-no-deposit-reason",
              )}
            />
          </div>
        ) : null}

        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <DateField
            id="reservation-expires"
            label={t("inventory2b4.reservation.expiresAt")}
            value={expiresAt}
            onChange={onExpiresAtChange}
            invalid={validationIssues.some((issue) => issue.fieldId === "reservation-expires")}
          />
          <DateField
            id="reservation-pickup"
            label={t("inventory2b4.reservation.expectedPickupAt")}
            value={expectedPickupAt}
            onChange={onExpectedPickupAtChange}
            invalid={validationIssues.some((issue) => issue.fieldId === "reservation-pickup")}
          />
        </div>

        {deposit.trim() && parseMoney(deposit) !== 0 ? (
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="reservation-method">
                {t("inventory2b4.reservation.paymentMethod")}
              </Label>
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
                      {localizeInventoryPaymentMethod(value, label, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reservation-payment-note">
                {t("inventory2b4.reservation.paymentNote")}
              </Label>
              <Input
                id="reservation-payment-note"
                value={paymentNote}
                onChange={(event) => onPaymentNoteChange(event.target.value)}
                className="h-11"
                placeholder={t("inventory2b4.reservation.optional")}
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
      <InventoryLifecycleValidationSummary
        id="inventory-reservation-validation-summary"
        issues={validationIssues}
        serverError={localError}
        focusRequestKey={validationFocusRequestKey}
        onFocusField={focusField}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-panel)] pt-3">
        <span className="text-[10px] text-muted-foreground">
          {t("inventory2b4.reservation.version", { version: summary.unit_version ?? "—" })}
        </span>
        <Button type="submit" className="min-h-11 gap-1.5 px-4" disabled={!canSubmit}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pending ? t("inventory2b4.reservation.pending") : t("inventory2b4.reservation.submit")}
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
  invalid = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
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
          aria-invalid={invalid}
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
  invalid = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
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
        aria-invalid={invalid}
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

function customerContactLabel(customer: Customer, hiddenLabel: string) {
  const digits = (customer.phone_e164 || customer.phone_raw || "").replace(/\D/g, "");
  return digits ? `•••• ${digits.slice(-4)}` : hiddenLabel;
}
