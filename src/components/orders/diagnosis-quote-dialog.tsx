"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Plus, Trash2, Wrench } from "lucide-react";

import { MoneyKeypadInput } from "@/components/orders/money-keypad-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { calculateBalance, inferPaidAmount } from "@/entities/order/model/order-calculations";
import { createOrderLineId, ensureOrderLineId } from "@/entities/order/model/order-line-identity";
import { getQuoteDraftReadiness } from "@/features/orders/model/order-diagnosis-quote";
import { localizeQuoteReadinessLabel } from "@/features/orders/model/order-i18n";
import { componentOverlay } from "@/lib/component-patterns";
import { formatMoney } from "@/lib/money";
import { RepairDeskApiError } from "@/lib/repairdesk/api";
import type {
  FaultPriceItem,
  OrderCapabilities,
  QuotePriceException,
  RepairOrder,
} from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";
import { moneyDraftValue, parseMoneyDraft } from "@/shared/lib/mobile-input";
import { useLocale } from "@/shared/i18n/locale-provider";
import {
  EditorDiscardConfirmation,
  editorConfirmationClass,
} from "@/shared/lib/use-compact-editor-session";

type QuoteDraftRow = {
  id: string;
  catalogKey?: string;
  name: string;
  priceText: string;
  note: string;
};

export interface DiagnosisQuoteDialogProps {
  open: boolean;
  order: RepairOrder;
  capabilities?: OrderCapabilities;
  isPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveDiagnosis: (diagnosisResult: string, expectedUpdatedAt: string) => Promise<unknown>;
  onPublish: (input: {
    expectedUpdatedAt: string;
    idempotencyKey: string;
    diagnosisResult: string;
    faultPrices: FaultPriceItem[];
    priceException?: QuotePriceException;
  }) => Promise<unknown>;
}

export function DiagnosisQuoteDialog({
  open,
  order,
  capabilities,
  isPending = false,
  onOpenChange,
  onSaveDiagnosis,
  onPublish,
}: DiagnosisQuoteDialogProps) {
  const { t } = useLocale();
  const [snapshot, setSnapshot] = useState(() => ({ order, rows: rowsFromOrder(order) }));
  const [diagnosis, setDiagnosis] = useState(order.diagnosis_result ?? "");
  const [rows, setRows] = useState<QuoteDraftRow[]>(snapshot.rows);
  const [exceptionKind, setExceptionKind] = useState<QuotePriceException["kind"] | "">("");
  const [exceptionReason, setExceptionReason] = useState("");
  const [localError, setLocalError] = useState("");
  const [publishIdempotencyKey, setPublishIdempotencyKey] = useState(() => crypto.randomUUID());
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [localPending, setLocalPending] = useState(false);
  const [attempted, setAttempted] = useState<
    | { kind: "publish"; input: Parameters<DiagnosisQuoteDialogProps["onPublish"]>[0] }
    | { kind: "diagnosis"; input: { diagnosisResult: string; expectedUpdatedAt: string } }
    | null
  >(null);
  const sessionKey = useRef<string | null>(null);
  const inFlight = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const busy = isPending || localPending;
  const targetChanged = snapshot.order.id !== order.id;
  const inputsLocked = busy || Boolean(attempted) || targetChanged;
  const conflict = targetChanged || snapshot.order.updated_at !== order.updated_at;
  const dirty =
    diagnosis !== (snapshot.order.diagnosis_result ?? "") ||
    JSON.stringify(rows) !== JSON.stringify(snapshot.rows) ||
    Boolean(exceptionKind || exceptionReason || attempted);
  const canPrepareQuote = capabilities?.canPrepareQuote === true;
  const canEditDiagnosis = capabilities?.canEditRepair === true || canPrepareQuote;

  useEffect(() => {
    if (!open) {
      sessionKey.current = null;
      return;
    }
    const key = order.id ?? "quote";
    if (sessionKey.current !== null) return;
    sessionKey.current = key;
    const nextRows = rowsFromOrder(order);
    setSnapshot({ order, rows: nextRows });
    setDiagnosis(order.diagnosis_result ?? "");
    setRows(nextRows);
    setExceptionKind("");
    setExceptionReason("");
    setLocalError("");
    setPublishIdempotencyKey(crypto.randomUUID());
    setConfirmDiscard(false);
    setAttempted(null);
  }, [open, order]);
  useEffect(() => {
    if (!open || !dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [open, dirty]);
  const requestOpenChange = (next: boolean) => {
    if (busy || inFlight.current) return;
    if (!next && dirty) {
      returnFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setConfirmDiscard(true);
    } else onOpenChange(next);
  };

  const faultPrices = useMemo(
    () =>
      rows.map((row) => ({
        line_id: row.id,
        ...(row.catalogKey ? { catalog_key: row.catalogKey } : {}),
        name: row.name.trim(),
        price: parseMoneyDraft(row.priceText),
        currency_code: "EUR" as const,
        ...(row.note.trim() ? { note: row.note.trim() } : {}),
      })),
    [rows],
  );
  const hasZeroPrice = faultPrices.some((item) => item.price === 0);
  const priceException =
    hasZeroPrice && exceptionKind
      ? { kind: exceptionKind, reason: exceptionReason.trim() }
      : undefined;
  const paidAmount = inferPaidAmount(
    snapshot.order.quotation_amount,
    snapshot.order.deposit_amount,
    snapshot.order.balance_amount,
  );
  const receivedAmount = snapshot.order.deposit_amount + paidAmount;
  const readiness = getQuoteDraftReadiness({
    diagnosisResult: diagnosis,
    faultPrices,
    depositAmount: snapshot.order.deposit_amount,
    paidAmount,
    priceException,
  });

  const submit = async () => {
    if (busy || inFlight.current || targetChanged || (conflict && !attempted)) return;
    if (attempted?.kind === "publish" && !canPrepareQuote) return;
    inFlight.current = true;
    setLocalPending(true);
    setLocalError("");
    try {
      if (attempted?.kind === "publish") {
        await onPublish(attempted.input);
        onOpenChange(false);
        return;
      }
      if (attempted?.kind === "diagnosis") {
        if (!canEditDiagnosis) return;
        await onSaveDiagnosis(attempted.input.diagnosisResult, attempted.input.expectedUpdatedAt);
        onOpenChange(false);
        return;
      }
      if (canPrepareQuote) {
        if (!readiness.ready) {
          setLocalError(
            readiness.missing.map((code) => localizeQuoteReadinessLabel(code, t)).join("; "),
          );
          return;
        }
        const input = {
          expectedUpdatedAt: snapshot.order.updated_at,
          idempotencyKey: publishIdempotencyKey,
          diagnosisResult: diagnosis.trim(),
          faultPrices,
          priceException,
        };
        setAttempted({ kind: "publish", input });
        await onPublish(input);
        onOpenChange(false);
        return;
      }
      if (!canEditDiagnosis) return;
      if (!diagnosis.trim()) {
        setLocalError(t("orders2b1.quote.missing.diagnosis"));
        return;
      }
      const input = {
        diagnosisResult: diagnosis.trim(),
        expectedUpdatedAt: snapshot.order.updated_at,
      };
      setAttempted({ kind: "diagnosis", input });
      await onSaveDiagnosis(input.diagnosisResult, input.expectedUpdatedAt);
      onOpenChange(false);
    } catch (error) {
      const rejected =
        error instanceof RepairDeskApiError && (error.status === 400 || error.status === 422);
      if (rejected) {
        setAttempted(null);
        setPublishIdempotencyKey(crypto.randomUUID());
      }
      setLocalError(t(rejected ? "orders2b1.quote.rejectedHint" : "orders2b1.quote.saveFailed"));
    } finally {
      inFlight.current = false;
      setLocalPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={requestOpenChange}>
      <DialogContent
        initialFocus="container"
        data-diagnosis-quote-dialog="true"
        data-confirm-discard={confirmDiscard}
        className={cn(
          componentOverlay.modalLg,
          componentOverlay.content,
          editorConfirmationClass,
          "grid min-w-0 max-h-[calc(100svh-16px)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0",
        )}
      >
        <DialogHeader className="border-b border-[var(--border-panel)] px-3 py-3 text-left sm:px-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Wrench className="size-4 text-primary" /> {t("orders2b1.quote.title")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("orders2b1.quote.description")}
          </DialogDescription>
        </DialogHeader>
        {confirmDiscard ? (
          <div data-editor-discard className="p-3 sm:p-4">
            {attempted ? (
              <p className="mb-2 text-xs text-muted-foreground">{t("orders2b1.quote.retryHint")}</p>
            ) : null}
            <EditorDiscardConfirmation
              returnFocus={returnFocus}
              keep={() => setConfirmDiscard(false)}
              discard={() => onOpenChange(false)}
            />
          </div>
        ) : null}

        <div className="min-h-0 overflow-y-auto px-3 py-3 sm:px-4">
          {targetChanged || (conflict && !attempted) ? (
            <p role="alert" className="mb-3 text-sm text-status-danger-foreground">
              {t("orders2b2.conflict.description")}
            </p>
          ) : null}
          {attempted && !busy ? (
            <p role="status" className="mb-3 text-xs text-muted-foreground">
              {t("orders2b1.quote.retryHint")}
            </p>
          ) : null}
          <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <section className={componentOverlay.section}>
              <div className="mb-2 text-xs font-semibold">
                {t("orders2b1.quote.issueDiagnosis")}
              </div>
              <div className="rounded-lg bg-[var(--surface-panel-muted)] px-2.5 py-2 text-xs leading-5 text-muted-foreground">
                {snapshot.order.issue_description || t("orders2b1.quote.noIssue")}
              </div>
              <div className="mt-3 space-y-1">
                <Label htmlFor="diagnosis-quote-result" className="text-xs font-semibold">
                  {t("orders2b1.quote.diagnosis")}
                </Label>
                <Textarea
                  id="diagnosis-quote-result"
                  aria-label={t("orders2b1.quote.diagnosis")}
                  value={diagnosis}
                  disabled={!canEditDiagnosis || inputsLocked}
                  maxLength={8000}
                  rows={8}
                  onChange={(event) => setDiagnosis(event.target.value)}
                  placeholder={t("orders2b1.quote.diagnosisPlaceholder")}
                  className="min-h-40 resize-y text-base md:text-sm"
                />
              </div>
              {!canPrepareQuote ? (
                <div className="mt-3 rounded-lg border border-status-warn-foreground/20 bg-status-warn px-2.5 py-2 text-xs text-status-warn-foreground">
                  {t("orders2b1.quote.diagnosisOnly")}
                </div>
              ) : null}
            </section>

            <section className={componentOverlay.section} aria-disabled={!canPrepareQuote}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold">{t("orders2b1.quote.items")}</div>
                  <div className="text-[10px] text-muted-foreground lg:text-xs lg:leading-4">
                    {t("orders2b1.quote.itemsHelp")}
                  </div>
                </div>
                {canPrepareQuote ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs"
                    disabled={inputsLocked || rows.length >= 50}
                    onClick={() =>
                      setRows((current) => [
                        ...current,
                        { id: createOrderLineId(), name: "", priceText: "", note: "" },
                      ])
                    }
                  >
                    <Plus className="size-3.5" /> {t("orders2b1.quote.addItem")}
                  </Button>
                ) : null}
              </div>

              <div className="space-y-2">
                {rows.map((row, index) => (
                  <div
                    key={row.id}
                    className="grid min-w-0 gap-1.5 rounded-lg border border-[var(--border-panel)] bg-card p-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto]"
                  >
                    <div className="min-w-0 space-y-1">
                      <Label htmlFor={`quote-item-${row.id}`} className="sr-only">
                        {t("orders2b1.quote.item", { index: index + 1 })}
                      </Label>
                      <Input
                        id={`quote-item-${row.id}`}
                        aria-label={t("orders2b1.quote.itemName", { index: index + 1 })}
                        value={row.name}
                        disabled={!canPrepareQuote || inputsLocked}
                        maxLength={120}
                        placeholder={t("orders2b1.quote.itemPlaceholder")}
                        className="h-9 text-base md:text-sm"
                        onChange={(event) =>
                          patchRow(setRows, row.id, {
                            name: event.target.value,
                            catalogKey: undefined,
                          })
                        }
                      />
                      <Input
                        aria-label={t("orders2b1.quote.itemNote", { index: index + 1 })}
                        value={row.note}
                        disabled={!canPrepareQuote || inputsLocked}
                        maxLength={500}
                        placeholder={t("orders2b1.quote.notePlaceholder")}
                        className="h-8 text-base md:text-xs"
                        onChange={(event) =>
                          patchRow(setRows, row.id, { note: event.target.value })
                        }
                      />
                    </div>
                    <MoneyKeypadInput
                      ariaLabel={t("orders2b1.quote.itemAmount", { index: index + 1 })}
                      value={row.priceText}
                      disabled={!canPrepareQuote || inputsLocked}
                      onChange={(priceText) => patchRow(setRows, row.id, { priceText })}
                      triggerClassName="h-9 bg-card text-base"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("orders2b1.quote.deleteItem", { index: index + 1 })}
                      disabled={!canPrepareQuote || inputsLocked || rows.length <= 1}
                      onClick={() =>
                        setRows((current) => current.filter((item) => item.id !== row.id))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {canPrepareQuote && hasZeroPrice ? (
                <div className="mt-3 grid gap-2 rounded-lg border border-status-warn-foreground/20 bg-status-warn/60 p-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("orders2b1.quote.zeroType")}</Label>
                    <Select
                      value={exceptionKind}
                      disabled={inputsLocked}
                      onValueChange={(value) =>
                        setExceptionKind(value as QuotePriceException["kind"])
                      }
                    >
                      <SelectTrigger className="h-9 bg-card text-xs">
                        <SelectValue placeholder={t("orders2b1.quote.choose")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">{t("orders2b1.quote.free")}</SelectItem>
                        <SelectItem value="warranty">{t("orders2b1.quote.warranty")}</SelectItem>
                        <SelectItem value="diagnostic_only">
                          {t("orders2b1.quote.diagnosticOnly")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="quote-price-exception-reason" className="text-xs">
                      {t("orders2b1.quote.reason")}
                    </Label>
                    <Input
                      id="quote-price-exception-reason"
                      value={exceptionReason}
                      disabled={inputsLocked}
                      maxLength={1000}
                      placeholder={t("orders2b1.quote.reasonPlaceholder")}
                      className="h-9 bg-card text-base md:text-sm"
                      onChange={(event) => setExceptionReason(event.target.value)}
                    />
                  </div>
                </div>
              ) : null}

              <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-[var(--surface-panel-muted)] p-2 text-center">
                <QuoteMetric label={t("orders2b1.quote.total")} value={readiness.quotationAmount} />
                <QuoteMetric label={t("orders2b1.quote.received")} value={receivedAmount} />
                <QuoteMetric
                  label={t("orders2b1.quote.balance")}
                  value={calculateBalance(
                    readiness.quotationAmount,
                    snapshot.order.deposit_amount,
                    paidAmount,
                  )}
                />
              </div>
              <p className="mt-1 text-center text-[10px] text-muted-foreground lg:text-xs">
                {t("orders2b1.quote.receivedDeposit", {
                  amount: formatMoney(snapshot.order.deposit_amount),
                })}
              </p>
            </section>
          </div>

          <div
            aria-live="polite"
            className={cn(
              "mt-3 rounded-lg px-2.5 py-2 text-xs",
              localError || (canPrepareQuote && !readiness.ready)
                ? "border border-status-danger-foreground/20 bg-status-danger/10 text-status-danger-foreground"
                : "border border-status-success-foreground/20 bg-status-success/10 text-status-success-foreground",
            )}
          >
            {localError ||
              (canPrepareQuote
                ? readiness.ready
                  ? t("orders2b1.quote.ready")
                  : readiness.missing.map((code) => localizeQuoteReadinessLabel(code, t)).join("; ")
                : diagnosis.trim()
                  ? t("orders2b1.quote.diagnosisReady")
                  : t("orders2b1.quote.diagnosisRequired"))}
          </div>
        </div>

        <DialogFooter className="border-t border-[var(--border-panel)] px-3 py-3 sm:px-4">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => requestOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            disabled={
              busy ||
              targetChanged ||
              (conflict && !attempted) ||
              !canEditDiagnosis ||
              (attempted?.kind === "publish" && !canPrepareQuote) ||
              (canPrepareQuote && !readiness.ready)
            }
            onClick={() => void submit()}
          >
            {busy
              ? t("orders2b1.quote.saving")
              : canPrepareQuote
                ? t("orders2b1.quote.publish")
                : t("orders2b1.quote.saveDiagnosis")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function rowsFromOrder(order: RepairOrder): QuoteDraftRow[] {
  const rows = order.fault_prices.map((item) => ({
    id: ensureOrderLineId(item.line_id),
    ...(item.catalog_key ? { catalogKey: item.catalog_key } : {}),
    name: item.name,
    priceText: moneyDraftValue(item.price),
    note: item.note ?? "",
  }));
  return rows.length ? rows : [{ id: createOrderLineId(), name: "", priceText: "", note: "" }];
}

function patchRow(
  setRows: Dispatch<SetStateAction<QuoteDraftRow[]>>,
  id: string,
  patch: Partial<QuoteDraftRow>,
) {
  setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
}

function QuoteMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
        {label}
      </div>
      <div className="truncate font-mono text-xs font-semibold tabular-nums">
        {formatMoney(value)}
      </div>
    </div>
  );
}
