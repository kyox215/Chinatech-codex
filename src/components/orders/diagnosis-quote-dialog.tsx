"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
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
import {
  getQuoteDraftReadiness,
  quoteReadinessLabel,
} from "@/features/orders/model/order-diagnosis-quote";
import { componentOverlay } from "@/lib/component-patterns";
import { formatMoney } from "@/lib/money";
import type {
  FaultPriceItem,
  OrderCapabilities,
  QuotePriceException,
  RepairOrder,
} from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";
import { moneyDraftValue, parseMoneyDraft } from "@/shared/lib/mobile-input";

type QuoteDraftRow = {
  id: string;
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
  onSaveDiagnosis: (diagnosisResult: string) => Promise<unknown>;
  onPublish: (input: {
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
  const [diagnosis, setDiagnosis] = useState(order.diagnosis_result ?? "");
  const [rows, setRows] = useState<QuoteDraftRow[]>(() => rowsFromOrder(order));
  const [exceptionKind, setExceptionKind] = useState<QuotePriceException["kind"] | "">("");
  const [exceptionReason, setExceptionReason] = useState("");
  const [localError, setLocalError] = useState("");
  const [publishIdempotencyKey, setPublishIdempotencyKey] = useState(() => crypto.randomUUID());
  const canPrepareQuote = capabilities?.canPrepareQuote === true;
  const canEditDiagnosis = capabilities?.canEditRepair === true || canPrepareQuote;

  useEffect(() => {
    if (!open) return;
    setDiagnosis(order.diagnosis_result ?? "");
    setRows(rowsFromOrder(order));
    setExceptionKind("");
    setExceptionReason("");
    setLocalError("");
    setPublishIdempotencyKey(crypto.randomUUID());
  }, [open, order]);

  const faultPrices = useMemo(
    () =>
      rows.map((row) => ({
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
  const readiness = getQuoteDraftReadiness({
    diagnosisResult: diagnosis,
    faultPrices,
    depositAmount: order.deposit_amount,
    priceException,
  });

  const submit = async () => {
    setLocalError("");
    try {
      if (canPrepareQuote) {
        if (!readiness.ready) {
          setLocalError(readiness.missing.map(quoteReadinessLabel).join("；"));
          return;
        }
        await onPublish({
          idempotencyKey: publishIdempotencyKey,
          diagnosisResult: diagnosis.trim(),
          faultPrices,
          priceException,
        });
        onOpenChange(false);
        return;
      }
      if (!canEditDiagnosis) return;
      if (!diagnosis.trim()) {
        setLocalError("请填写检测结论");
        return;
      }
      await onSaveDiagnosis(diagnosis.trim());
      onOpenChange(false);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "保存失败，请重试");
    }
  };

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent
        data-diagnosis-quote-dialog="true"
        className={cn(
          componentOverlay.modalWide,
          componentOverlay.content,
          "grid min-w-0 max-h-[calc(100svh-16px)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0",
        )}
      >
        <DialogHeader className="border-b border-[var(--border-panel)] px-3 py-3 text-left sm:px-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Wrench className="size-4 text-primary" /> 检测与正式报价
          </DialogTitle>
          <DialogDescription className="text-xs">
            技师可记录检测结论；前台、经理或销售确认项目后发布正式报价。发布不会修改定金。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-3 py-3 sm:px-4">
          <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <section className={componentOverlay.section}>
              <div className="mb-2 text-xs font-semibold">客户报障与检测结论</div>
              <div className="rounded-lg bg-[var(--surface-panel-muted)] px-2.5 py-2 text-xs leading-5 text-muted-foreground">
                {order.issue_description || "客户未提供故障描述"}
              </div>
              <div className="mt-3 space-y-1">
                <Label htmlFor="diagnosis-quote-result" className="text-xs font-semibold">
                  检测结论
                </Label>
                <Textarea
                  id="diagnosis-quote-result"
                  aria-label="检测结论"
                  value={diagnosis}
                  disabled={!canEditDiagnosis || isPending}
                  maxLength={8000}
                  rows={8}
                  onChange={(event) => setDiagnosis(event.target.value)}
                  placeholder="例如：检测确认电池健康度过低，屏幕与主板功能正常"
                  className="min-h-40 resize-y text-base md:text-sm"
                />
              </div>
              {!canPrepareQuote ? (
                <div className="mt-3 rounded-lg border border-status-warn-foreground/20 bg-status-warn px-2.5 py-2 text-xs text-status-warn-foreground">
                  当前账号只能记录检测结论。保存后请交给前台、经理或销售发布价格并通知客户。
                </div>
              ) : null}
            </section>

            <section className={componentOverlay.section} aria-disabled={!canPrepareQuote}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold">报价项目</div>
                  <div className="text-[10px] text-muted-foreground">1–50 项，金额最多两位小数</div>
                </div>
                {canPrepareQuote ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs"
                    disabled={isPending || rows.length >= 50}
                    onClick={() =>
                      setRows((current) => [
                        ...current,
                        { id: crypto.randomUUID(), name: "", priceText: "", note: "" },
                      ])
                    }
                  >
                    <Plus className="size-3.5" /> 添加项目
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
                        报价项目 {index + 1}
                      </Label>
                      <Input
                        id={`quote-item-${row.id}`}
                        aria-label={`报价项目 ${index + 1} 名称`}
                        value={row.name}
                        disabled={!canPrepareQuote || isPending}
                        maxLength={120}
                        placeholder="例如：更换电池"
                        className="h-9 text-base md:text-sm"
                        onChange={(event) =>
                          patchRow(setRows, row.id, { name: event.target.value })
                        }
                      />
                      <Input
                        aria-label={`报价项目 ${index + 1} 备注`}
                        value={row.note}
                        disabled={!canPrepareQuote || isPending}
                        maxLength={500}
                        placeholder="备注（可选）"
                        className="h-8 text-base md:text-xs"
                        onChange={(event) =>
                          patchRow(setRows, row.id, { note: event.target.value })
                        }
                      />
                    </div>
                    <MoneyKeypadInput
                      ariaLabel={`报价项目 ${index + 1} 金额`}
                      value={row.priceText}
                      disabled={!canPrepareQuote || isPending}
                      onChange={(priceText) => patchRow(setRows, row.id, { priceText })}
                      triggerClassName="h-9 bg-card text-base"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`删除报价项目 ${index + 1}`}
                      disabled={!canPrepareQuote || isPending || rows.length <= 1}
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
                    <Label className="text-xs">零元类型</Label>
                    <Select
                      value={exceptionKind}
                      disabled={isPending}
                      onValueChange={(value) =>
                        setExceptionKind(value as QuotePriceException["kind"])
                      }
                    >
                      <SelectTrigger className="h-9 bg-card text-xs">
                        <SelectValue placeholder="请选择" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">免费处理</SelectItem>
                        <SelectItem value="warranty">保修处理</SelectItem>
                        <SelectItem value="diagnostic_only">仅检测</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="quote-price-exception-reason" className="text-xs">
                      原因
                    </Label>
                    <Input
                      id="quote-price-exception-reason"
                      value={exceptionReason}
                      disabled={isPending}
                      maxLength={1000}
                      placeholder="至少 4 个字符"
                      className="h-9 bg-card text-base md:text-sm"
                      onChange={(event) => setExceptionReason(event.target.value)}
                    />
                  </div>
                </div>
              ) : null}

              <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-[var(--surface-panel-muted)] p-2 text-center">
                <QuoteMetric label="报价" value={readiness.quotationAmount} />
                <QuoteMetric label="现有定金" value={order.deposit_amount} />
                <QuoteMetric
                  label="预计尾款"
                  value={Math.max(0, readiness.quotationAmount - order.deposit_amount)}
                />
              </div>
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
                  ? "检测与报价已完整，可以发布正式报价。"
                  : readiness.missing.map(quoteReadinessLabel).join("；")
                : diagnosis.trim()
                  ? "检测结论可以保存并交接。"
                  : "请先填写检测结论。")}
          </div>
        </div>

        <DialogFooter className="border-t border-[var(--border-panel)] px-3 py-3 sm:px-4">
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            disabled={isPending || !canEditDiagnosis || (canPrepareQuote && !readiness.ready)}
            onClick={() => void submit()}
          >
            {isPending ? "保存中…" : canPrepareQuote ? "发布正式报价" : "保存检测结论"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function rowsFromOrder(order: RepairOrder): QuoteDraftRow[] {
  const rows = order.fault_prices.map((item) => ({
    id: crypto.randomUUID(),
    name: item.name,
    priceText: moneyDraftValue(item.price),
    note: item.note ?? "",
  }));
  return rows.length ? rows : [{ id: crypto.randomUUID(), name: "", priceText: "", note: "" }];
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
      <div className="truncate text-[10px] text-muted-foreground">{label}</div>
      <div className="truncate font-mono text-xs font-semibold tabular-nums">
        {formatMoney(value)}
      </div>
    </div>
  );
}
