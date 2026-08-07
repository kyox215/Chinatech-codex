"use client";

import { useDeferredValue, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Search, UserRound, X } from "lucide-react";
import { toast } from "sonner";

import { searchCustomers, runInventoryLifecycleCommand } from "@/lib/repairdesk/api";
import type {
  Customer,
  InventoryLifecycleCommandResult,
  InventoryLifecycleListSummary,
} from "@/lib/repairdesk/types";
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

const paymentMethods = [
  ["cash", "现金"],
  ["card", "银行卡"],
  ["bancomat", "Bancomat"],
  ["transfer", "转账"],
  ["other", "其他"],
] as const;

export function InventoryReservationForm({
  summary,
  storeId,
  defaultPrice,
  onSuccess,
  disabledReason,
}: {
  summary: InventoryLifecycleListSummary;
  storeId?: string | null;
  defaultPrice?: number;
  onSuccess: (result: InventoryLifecycleCommandResult) => void;
  disabledReason?: string;
}) {
  const [customerSearch, setCustomerSearch] = useState("");
  const deferredCustomerSearch = useDeferredValue(customerSearch.trim());
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [price, setPrice] = useState(defaultPrice === undefined ? "" : String(defaultPrice));
  const [deposit, setDeposit] = useState("");
  const [method, setMethod] = useState<(typeof paymentMethods)[number][0]>("cash");
  const [paymentNote, setPaymentNote] = useState("");
  const [expiresAt, setExpiresAt] = useState(() => toDateTimeLocal(addDays(7)));
  const [expectedPickupAt, setExpectedPickupAt] = useState(() => toDateTimeLocal(addDays(3)));
  const [noDepositReason, setNoDepositReason] = useState("");
  const [formError, setFormError] = useState<string>();
  const idempotencyKey = useRef(crypto.randomUUID());

  const customersQuery = useQuery({
    queryKey: ["inventory-lifecycle", "customers", storeId ?? "no-store", deferredCustomerSearch],
    queryFn: () => searchCustomers(deferredCustomerSearch, 6),
    enabled: Boolean(storeId) && deferredCustomerSearch.length >= 2 && !customer,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: () => {
      const agreedPrice = parseMoney(price);
      const depositAmount = deposit.trim() ? parseMoney(deposit) : 0;
      if (!customer) throw new Error("请选择同店客户");
      if (!agreedPrice || agreedPrice <= 0) throw new Error("请输入有效售价");
      if (depositAmount === undefined || depositAmount < 0) throw new Error("请输入有效定金");
      if (depositAmount > agreedPrice) throw new Error("定金不能高于成交价");
      if (depositAmount === 0 && !noDepositReason.trim()) throw new Error("免定金必须填写原因");
      const expiry = parseDateTime(expiresAt);
      const pickup = parseDateTime(expectedPickupAt);
      if (!expiry || expiry <= new Date()) throw new Error("预订到期时间必须晚于现在");
      if (!pickup || pickup <= new Date()) throw new Error("预计取走时间必须晚于现在");
      if (pickup > expiry) throw new Error("预计取走时间不能晚于预订到期时间");

      return runInventoryLifecycleCommand({
        command: "reservation.create",
        idempotency_key: idempotencyKey.current,
        payload: {
          stock_unit_id: summary.stock_unit_id,
          expected_unit_version: summary.unit_version,
          agreed_price: agreedPrice,
          customer_id: customer.id,
          ...(depositAmount > 0 ? { deposit_amount: depositAmount, payment_method: method } : {}),
          ...(noDepositReason.trim() ? { no_deposit_reason: noDepositReason.trim() } : {}),
          ...(paymentNote.trim() ? { payment_note: paymentNote.trim() } : {}),
          expires_at: expiry.toISOString(),
          expected_pickup_at: pickup.toISOString(),
        },
      });
    },
    onSuccess: (result) => {
      idempotencyKey.current = crypto.randomUUID();
      setFormError(undefined);
      toast.success("预订已提交");
      onSuccess(result);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "预订保存失败，请重试";
      setFormError(message);
    },
  });

  const canSubmit =
    summary.allowed_actions?.includes("reservation.create") === true &&
    Boolean(summary.unit_version) &&
    !disabledReason &&
    !mutation.isPending;
  const noDeposit = !deposit.trim() || parseMoney(deposit) === 0;
  const customerResults = customersQuery.data ?? [];

  return (
    <form
      className={cn(repairOs.mobileInfoCard, "space-y-3 p-3 sm:p-4")}
      onSubmit={(event) => {
        event.preventDefault();
        setFormError(undefined);
        if (!canSubmit) return;
        mutation.mutate();
      }}
      noValidate
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
                onClick={() => setCustomer(null)}
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
                onChange={(event) => setCustomerSearch(event.target.value)}
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
                      onClick={() => {
                        setCustomer(candidate);
                        setCustomerSearch("");
                      }}
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
          <MoneyField id="reservation-price" label="成交价 *" value={price} onChange={setPrice} />
          <MoneyField
            id="reservation-deposit"
            label="定金（可为 0）"
            value={deposit}
            onChange={setDeposit}
          />
        </div>

        {noDeposit ? (
          <div className="space-y-1.5">
            <Label htmlFor="reservation-no-deposit-reason">免定金原因 *</Label>
            <Textarea
              id="reservation-no-deposit-reason"
              value={noDepositReason}
              onChange={(event) => setNoDepositReason(event.target.value)}
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
            onChange={setExpiresAt}
          />
          <DateField
            id="reservation-pickup"
            label="预计取走"
            value={expectedPickupAt}
            onChange={setExpectedPickupAt}
          />
        </div>

        {deposit.trim() && parseMoney(deposit) !== 0 ? (
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="reservation-method">定金支付方式</Label>
              <Select value={method} onValueChange={(value) => setMethod(value as typeof method)}>
                <SelectTrigger id="reservation-method" className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map(([value, label]) => (
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
                onChange={(event) => setPaymentNote(event.target.value)}
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
      {formError ? (
        <p
          className="rounded-lg bg-status-danger/10 px-2.5 py-2 text-xs text-status-danger-foreground"
          role="alert"
        >
          {formError}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-panel)] pt-3">
        <span className="text-[10px] text-muted-foreground">
          库存版本 {summary.unit_version ?? "—"}
        </span>
        <Button type="submit" className="min-h-11 gap-1.5 px-4" disabled={!canSubmit}>
          {mutation.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {mutation.isPending ? "提交中…" : "确认预订"}
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

function parseDateTime(value: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function addDays(days: number) {
  const result = new Date();
  result.setDate(result.getDate() + days);
  return result;
}

function toDateTimeLocal(value: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function customerContactLabel(customer: Customer) {
  const digits = (customer.phone_e164 || customer.phone_raw || "").replace(/\D/g, "");
  return digits ? `•••• ${digits.slice(-4)}` : "联系方式已隐藏";
}
