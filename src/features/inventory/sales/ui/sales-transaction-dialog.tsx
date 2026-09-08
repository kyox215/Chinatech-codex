"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericKeypadInput } from "@/components/ui/numeric-keypad-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CustomerIdentityLookup } from "@/features/orders/forms/customer-intake-lookup";
import { customersKeys } from "@/features/customers/api/query-keys";
import {
  createCustomer,
  runInventorySalesCommand,
  type CustomerIntakeNewCustomerPolicy,
} from "@/lib/repairdesk/api";
import { componentOverlay } from "@/lib/component-patterns";
import { useLocale } from "@/shared/i18n/locale-provider";
import { cn } from "@/lib/utils";
import {
  inventorySalesCommandBodySchema,
  type InventorySalesSummary,
  type InventorySalesCommand,
  type InventorySalesCommandBody,
  type InventorySalesPayment,
} from "../model/contracts";
import { salesDocumentMoney } from "../model/sales-document";
import { invalidateInventorySales } from "../api/queries";
import { salesCopy, salesLanguage, type SalesCopyKey } from "./sales-copy";
import {
  commandIdentity,
  moneyToCents,
  romeDateTime,
  romeDateTimeToIso,
  salesErrorKey,
} from "./sales-ui-adapter";

export function SalesDialog({
  title,
  description,
  children,
  onClose,
  pending = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
  pending?: boolean;
}) {
  const content = useRef<HTMLDivElement>(null);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        ref={content}
        className={cn(componentOverlay.formWorkspace, componentOverlay.content, "sm:max-w-2xl")}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          content.current?.focus({ preventScroll: true });
        }}
        onInteractOutside={(e) => {
          if (pending) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (pending) e.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0 border-b border-border p-3 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function SalesTransactionDialog({
  summary: liveSummary,
  command,
  storeId,
  onClose,
  onRefresh,
}: {
  summary: InventorySalesSummary;
  command: InventorySalesCommand;
  storeId: string;
  onClose: () => void;
  onRefresh: () => Promise<unknown>;
}) {
  // Keep the reviewed balance/CAS snapshot for this opening; a background update requires review.
  const [summary] = useState(liveSummary);
  const { locale } = useLocale();
  const c = (key: SalesCopyKey) => salesCopy(locale, key);
  const client = useQueryClient();
  const order = summary.order;
  const creating = command === "sale.create";
  const pickup = command === "pickup.confirm";
  const [price, setPrice] = useState(String((summary.inspection.list_price_cents ?? 0) / 100));
  const [amount, setAmount] = useState(
    creating ? price : String((order?.balance_cents ?? 0) / 100),
  );
  const [date, setDate] = useState(() => romeDateTime());
  const [method, setMethod] = useState<InventorySalesPayment["method"]>("cash");
  const [note, setNote] = useState("");
  const [deliver, setDeliver] = useState(false);
  const [confirmedDelivery, setConfirmedDelivery] = useState(false);
  const [used, setUsed] = useState(summary.inspection.cosmetic_grade !== "new");
  const [months, setMonths] = useState<12 | 24>(24);
  const [consent, setConsent] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState<string>();
  const [newIntent, setNewIntent] = useState<CustomerIntakeNewCustomerPolicy | null>(null);
  const [sharedConfirmed, setSharedConfirmed] = useState(false);
  const [error, setError] = useState<SalesCopyKey | null>(null);
  const identity = useRef<ReturnType<typeof commandIdentity> | null>(null);
  const lock = useRef(false);
  const mutation = useMutation({
    mutationFn: (body: InventorySalesCommandBody) => runInventorySalesCommand(body),
  });
  const customerMutation = useMutation({
    mutationFn: () => createCustomer({ name: name.trim(), phone_e164: phone.trim() }),
  });
  const busy = mutation.isPending || customerMutation.isPending;
  const priceCents = creating ? moneyToCents(price) : (order?.price_cents ?? null);
  const amountCents = moneyToCents(amount);
  const maxAmount = creating ? priceCents : order?.balance_cents;
  const validAmount =
    pickup ||
    (amountCents !== null && amountCents > 0 && maxAmount != null && amountCents <= maxAmount);
  const fullyPaid = pickup ? order?.balance_cents === 0 : amountCents === maxAmount;
  const canReserve = !creating || fullyPaid || summary.capabilities.can_reserve;
  const canDeliver =
    fullyPaid && summary.capabilities.can_collect_and_deliver && !summary.inspection_missing.length;
  const validConsent = !creating || months === 24 || (used && consent);
  const validCustomer = !creating || Boolean(customerId);
  const actualDelivery = pickup || deliver;
  const ready =
    summary.allowed_actions.includes(command) &&
    validAmount &&
    canReserve &&
    validConsent &&
    validCustomer &&
    (!actualDelivery ||
      (confirmedDelivery &&
        (pickup
          ? fullyPaid && summary.capabilities.can_deliver && !summary.inspection_missing.length
          : canDeliver)));
  async function submit() {
    if (lock.current || !ready) return;
    lock.current = true;
    setError(null);
    try {
      const occurredAt = romeDateTimeToIso(date);
      if (Date.parse(occurredAt) > Date.now() + 300_000) throw new Error("invalidDate");
      const common = {
        inventory_item_id: summary.inventory_item_id,
        stock_unit_id: summary.stock_unit_id,
        expected_item_updated_at: summary.item_updated_at,
        expected_unit_version: summary.unit_version,
      };
      const payment = {
        amount_cents: amountCents,
        method,
        occurred_at: occurredAt,
        ...(note.trim() ? { note: note.trim() } : {}),
      };
      const delivery = { deliver, ...(deliver ? { delivered_at: occurredAt } : {}) };
      const payload = creating
        ? {
            ...common,
            ...delivery,
            customer_id: customerId,
            price_cents: priceCents,
            agreed_at: occurredAt,
            payment,
            used_device: used,
            warranty_months: months,
            shortening_agreed: months === 12 && consent,
            ...(months === 12 && consent ? { shortening_agreed_at: occurredAt } : {}),
            terms_version: "inventory-sales-2026-09-v1",
          }
        : pickup
          ? {
              ...common,
              sale_order_id: order?.id,
              expected_order_version: order?.version,
              delivered_at: occurredAt,
            }
          : {
              ...common,
              ...delivery,
              sale_order_id: order?.id,
              expected_order_version: order?.version,
              payment,
            };
      identity.current = commandIdentity(identity.current, { command, payload });
      const body = inventorySalesCommandBodySchema.parse({
        command,
        payload,
        idempotency_key: identity.current.key,
      });
      await mutation.mutateAsync(body);
      await Promise.all([
        invalidateInventorySales(client, storeId),
        client.invalidateQueries({
          queryKey: customersKeys.all,
          predicate: (q) => q.queryKey.includes(storeId),
        }),
      ]);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === "invalidDate"
          ? "invalidDate"
          : salesErrorKey(cause),
      );
    } finally {
      lock.current = false;
    }
  }
  async function addCustomer() {
    if (
      lock.current ||
      !name.trim() ||
      !phone.trim() ||
      !newIntent ||
      newIntent.startsWith("blocked") ||
      (newIntent === "requires_shared_phone_confirmation" && !sharedConfirmed)
    )
      return;
    lock.current = true;
    setError(null);
    try {
      const customer = await customerMutation.mutateAsync();
      setCustomerId(customer.id);
      await client.invalidateQueries({
        queryKey: customersKeys.all,
        predicate: (q) => q.queryKey.includes(storeId),
      });
    } catch (cause) {
      setError(salesErrorKey(cause));
    } finally {
      lock.current = false;
    }
  }
  return (
    <SalesDialog
      title={c(creating ? "sell" : pickup ? "pickup" : "collect")}
      description={order?.sale_number ?? c("title")}
      onClose={onClose}
      pending={busy}
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {creating ? (
            <section className="grid min-w-0 gap-2 rounded-xl border border-border p-2">
              <CustomerIdentityLookup
                phone={phone}
                name={name}
                selectedCustomerId={customerId}
                onPhoneChange={(v) => {
                  setPhone(v);
                  setCustomerId(undefined);
                }}
                onNameChange={(v) => {
                  setName(v);
                  setCustomerId(undefined);
                }}
                onClearCustomerSelection={() => setCustomerId(undefined)}
                onPickCustomer={({ customer }) => {
                  setCustomerId(customer.id);
                  setPhone(customer.phone_e164);
                  setName(customer.name);
                }}
                onNewCustomerIntentChange={setNewIntent}
                disabled={busy}
                deviceLimit={1}
              />
              {customerId ? (
                <Link
                  className="w-fit text-xs text-primary underline"
                  href={`/customers/${customerId}`}
                >
                  {c("customer")} · {name}
                </Link>
              ) : null}
              {newIntent === "requires_shared_phone_confirmation" ? (
                <CheckField
                  checked={sharedConfirmed}
                  onChange={setSharedConfirmed}
                  label={c("sharedPhone")}
                />
              ) : null}
              {!customerId && newIntent && !newIntent.startsWith("blocked") ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    busy || (newIntent === "requires_shared_phone_confirmation" && !sharedConfirmed)
                  }
                  onClick={() => void addCustomer()}
                >
                  {c("createCustomer")}
                </Button>
              ) : null}
            </section>
          ) : null}
          {!pickup ? (
            <div className="grid grid-cols-2 gap-2">
              {creating ? (
                <MoneyField
                  label={c("price")}
                  value={price}
                  disabled={busy}
                  onChange={(v) => {
                    setPrice(v);
                    setDeliver(false);
                  }}
                />
              ) : (
                <Fact
                  label={c("balance")}
                  value={salesDocumentMoney(order?.balance_cents ?? 0, salesLanguage(locale))}
                />
              )}
              <MoneyField
                label={c("amount")}
                value={amount}
                disabled={busy}
                onChange={(v) => {
                  setAmount(v);
                  setDeliver(false);
                }}
              />
              <Field label={c("method")}>
                <select
                  aria-label={c("method")}
                  className="min-h-11 w-full rounded-lg border border-input bg-background px-2 text-base lg:text-sm"
                  value={method}
                  disabled={busy}
                  onChange={(e) => setMethod(e.target.value as typeof method)}
                >
                  {(["cash", "card", "bancomat", "transfer", "other"] as const).map((m) => (
                    <option key={m} value={m}>
                      {c(m)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={c("date")}>
                <Input
                  type="datetime-local"
                  aria-label={c("date")}
                  value={date}
                  disabled={busy}
                  onChange={(e) => setDate(e.target.value)}
                  className="min-w-0 text-base lg:text-sm"
                />
              </Field>
            </div>
          ) : (
            <Field label={c("date")}>
              <Input
                type="datetime-local"
                aria-label={c("date")}
                value={date}
                disabled={busy}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          )}
          {!pickup && !validAmount ? (
            <p role="alert" className="text-xs text-destructive">
              {c("overpayment")}
            </p>
          ) : null}
          {!canReserve ? (
            <p role="alert" className="text-xs text-destructive">
              {c("permission")}
            </p>
          ) : null}
          {creating ? (
            <section className="grid gap-2 rounded-xl border border-border p-2">
              <CheckField
                checked={used}
                onChange={(v) => {
                  setUsed(v);
                  setMonths(24);
                  setConsent(false);
                }}
                label={c("used")}
                disabled={busy}
              />
              <Field label={c("warranty")}>
                <select
                  aria-label={c("warranty")}
                  className="min-h-11 rounded-lg border border-input bg-background px-2 text-base lg:text-sm"
                  value={months}
                  disabled={busy}
                  onChange={(e) => {
                    setMonths(Number(e.target.value) as 12 | 24);
                    setConsent(false);
                  }}
                >
                  <option value={24}>{c("months24")}</option>
                  {used ? <option value={12}>{c("months12")}</option> : null}
                </select>
              </Field>
              {months === 12 ? (
                <CheckField
                  checked={consent}
                  onChange={setConsent}
                  label={c("consent")}
                  disabled={busy}
                />
              ) : null}
            </section>
          ) : null}
          {!pickup ? (
            <>
              <Field label={c("note")}>
                <Textarea
                  aria-label={c("note")}
                  maxLength={500}
                  value={note}
                  disabled={busy}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={!deliver ? "default" : "outline"}
                  aria-pressed={!deliver}
                  disabled={busy}
                  onClick={() => {
                    setDeliver(false);
                    setConfirmedDelivery(false);
                  }}
                >
                  {c("hold")}
                </Button>
                <Button
                  type="button"
                  variant={deliver ? "default" : "outline"}
                  aria-pressed={deliver}
                  disabled={busy || !canDeliver}
                  title={!canDeliver ? c(fullyPaid ? "blocked" : "overpayment") : undefined}
                  onClick={() => setDeliver(true)}
                >
                  {c("deliverNow")}
                </Button>
              </div>
            </>
          ) : null}
          {actualDelivery ? (
            <CheckField
              checked={confirmedDelivery}
              onChange={setConfirmedDelivery}
              label={c("deliveryNote")}
              disabled={busy}
            />
          ) : (
            <p className="text-xs text-muted-foreground">{c("heldNote")}</p>
          )}
          {error ? (
            <div
              role="alert"
              className="space-y-2 rounded-lg bg-destructive/5 p-2 text-xs text-destructive"
            >
              <p>{c(error)}</p>
              {error === "conflict" || error === "blocked" ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    void onRefresh();
                    onClose();
                  }}
                >
                  {c("refresh")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <footer className="grid shrink-0 grid-cols-2 gap-2 border-t border-border bg-card p-3">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy}
            onClick={onClose}
          >
            {c("cancel")}
          </Button>
          <Button type="submit" className="min-h-11" disabled={busy || !ready}>
            {busy ? c("pending") : c("save")}
          </Button>
        </footer>
      </form>
    </SalesDialog>
  );
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="break-words font-semibold tabular-nums">{value}</p>
    </div>
  );
}
export function MoneyField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <NumericKeypadInput
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        min={0}
        step="0.01"
        inputMode="decimal"
        decimalPlaces={2}
        className="min-h-11 text-base lg:text-sm"
      />
    </Field>
  );
}
export function CheckField({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-xs leading-5">
      <input
        type="checkbox"
        className="size-4 shrink-0 accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
