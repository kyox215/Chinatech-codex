"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CalendarCheck, PackageCheck, RefreshCw, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { runInventoryLifecycleCommand } from "@/lib/repairdesk/api";
import type {
  InventoryLifecycleCommand,
  InventoryLifecycleSaleDetail,
} from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

import { inventoryLifecycleKeys } from "../api/query-keys";
import { inventoryLifecycleSaleQueryOptions } from "../api/query-options";
import { InventoryLifecyclePageShell } from "../components/inventory-lifecycle-page-shell";
import {
  InventoryLifecycleStatusBadge,
  InventoryLifecycleUnavailableCard,
} from "../components/inventory-lifecycle-status";
import { InventoryLifecycleReservationScreen } from "./inventory-lifecycle-reservation-screen";

const methods = [
  ["cash", "现金"],
  ["card", "银行卡"],
  ["bancomat", "Bancomat"],
  ["transfer", "转账"],
  ["other", "其他"],
] as const;

export function InventoryLifecycleItemSaleScreen({ itemId }: { itemId: string }) {
  return <InventoryLifecycleReservationScreen itemId={itemId} mode="sale" />;
}

export function InventoryLifecycleSaleScreen({ saleOrderId }: { saleOrderId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const shell = useStoreShellContext({ monitorAuthority: true });
  const storeId = shell.activeStore?.id;
  const enabled = Boolean(
    storeId &&
    shell.permissions?.canReadInventory &&
    shell.permissions.inventoryLifecycleUiEnabled === true,
  );
  const query = useQuery({
    ...inventoryLifecycleSaleQueryOptions(saleOrderId, storeId),
    enabled,
  });
  const [resultMessage, setResultMessage] = useState("");
  const idempotencyKeys = useRef(new Map<InventoryLifecycleCommand, string>());
  const mutation = useMutation({
    mutationFn: runInventoryLifecycleCommand,
    onSuccess: async (result, input) => {
      idempotencyKeys.current.delete(input.command);
      setResultMessage(successCopy(result.code));
      await queryClient.invalidateQueries({ queryKey: inventoryLifecycleKeys.all });
      await query.refetch();
    },
  });
  const submitCommand: Submit = (commandName, payload) => {
    const existingKey = idempotencyKeys.current.get(commandName);
    const idempotencyKey = existingKey ?? crypto.randomUUID();
    idempotencyKeys.current.set(commandName, idempotencyKey);
    mutation.mutate({ command: commandName, idempotency_key: idempotencyKey, payload });
  };

  if (!enabled) {
    return (
      <InventoryLifecyclePageShell
        title="销售与取走"
        context="商品生命周期"
        onBack={() => router.push("/inventory")}
      >
        <InventoryLifecycleUnavailableCard
          title="当前门店尚未开放销售工作流"
          body="功能开关保持关闭时不会读取或写入生命周期账本，原库存页面继续正常使用。"
          onBack={() => router.push("/inventory")}
        />
      </InventoryLifecyclePageShell>
    );
  }
  if (query.isLoading) {
    return (
      <InventoryLifecyclePageShell
        title="销售与取走"
        context="正在读取业务账"
        onBack={() => router.push("/inventory")}
      >
        <div className={cn(repairOs.mobileInfoCard, "h-40 animate-pulse")} />
      </InventoryLifecyclePageShell>
    );
  }
  if (query.isError || !query.data) {
    return (
      <InventoryLifecyclePageShell
        title="销售与取走"
        context="业务账不可用"
        onBack={() => router.push("/inventory")}
      >
        <InventoryLifecycleUnavailableCard
          title="无法读取销售记录"
          body="记录可能不存在、已不属于当前门店，或服务暂时不可用。没有执行任何写入。"
        />
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => void query.refetch()}
        >
          <RefreshCw className="mr-2 size-4" aria-hidden="true" />
          重试
        </Button>
      </InventoryLifecyclePageShell>
    );
  }
  const sale = query.data;
  const primaryAction = [
    "payment.append",
    "sale.complete",
    "pickup.confirm",
    "after_sales.create",
    "warranty.adjust",
  ].find((action) => sale.allowed_actions.includes(action as InventoryLifecycleCommand));
  const secondaryActions = sale.allowed_actions.filter(
    (action) =>
      action !== primaryAction && ["reservation.cancel", "warranty.adjust"].includes(action),
  );
  return (
    <InventoryLifecyclePageShell
      title={sale.status === "reserved" ? "预订与收款" : "销售与取走"}
      context={`${sale.sku} · 业务单 ${shortId(sale.sale_order_id)}`}
      status={<InventoryLifecycleStatusBadge status={sale.business_status} />}
      onBack={() => router.push(`/inventory/${encodeURIComponent(sale.inventory_item_id)}`)}
    >
      <MoneyOverview sale={sale} />
      {resultMessage ? (
        <p
          className="rounded-xl bg-status-success px-3 py-2 text-xs text-status-success-foreground"
          role="status"
          aria-live="polite"
        >
          {resultMessage}
        </p>
      ) : null}
      {mutation.isError ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
          {mutation.error instanceof Error ? mutation.error.message : "操作失败，请刷新后重试。"}
        </p>
      ) : null}
      <div className="grid gap-2">
        {primaryAction === "payment.append" ? (
          <PaymentPanel sale={sale} pending={mutation.isPending} submit={submitCommand} />
        ) : null}
        {primaryAction === "sale.complete" ? (
          <CompleteSalePanel sale={sale} pending={mutation.isPending} submit={submitCommand} />
        ) : null}
        {primaryAction === "pickup.confirm" ? (
          <PickupPanel sale={sale} pending={mutation.isPending} submit={submitCommand} />
        ) : null}
        {primaryAction === "warranty.adjust" ? (
          <WarrantyPanel sale={sale} pending={mutation.isPending} submit={submitCommand} />
        ) : null}
        {primaryAction === "after_sales.create" ? (
          <AfterSalesIntakePanel sale={sale} pending={mutation.isPending} submit={submitCommand} />
        ) : null}
      </div>
      {secondaryActions.length ? (
        <details className={cn(repairOs.mobileInfoCard, "p-3 sm:p-4")}>
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
            更多管理操作
          </summary>
          <div className="mt-2 grid gap-2">
            {secondaryActions.includes("warranty.adjust") ? (
              <WarrantyPanel sale={sale} pending={mutation.isPending} submit={submitCommand} />
            ) : null}
            {secondaryActions.includes("reservation.cancel") ? (
              <CancelPanel sale={sale} pending={mutation.isPending} submit={submitCommand} />
            ) : null}
          </div>
        </details>
      ) : null}
      {sale.allowed_actions.length === 0 ? (
        <InventoryLifecycleUnavailableCard
          title="当前没有可执行动作"
          body="可用按钮由服务端根据门店、员工权限、业务状态和版本统一计算，页面不会自行猜测。"
        />
      ) : null}
    </InventoryLifecyclePageShell>
  );
}

function MoneyOverview({ sale }: { sale: InventoryLifecycleSaleDetail }) {
  const facts = [
    ["约定售价", euro(sale.agreed_price)],
    ["累计已收", euro(sale.signed_paid_amount)],
    ["待收尾款", euro(sale.balance)],
    ["预计取走", formatDate(sale.expected_pickup_at)],
  ];
  return (
    <section className={cn(repairOs.mobileInfoCard, "p-3 sm:p-4")} aria-label="销售金额摘要">
      <div className="flex items-center gap-2">
        <Banknote className="size-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-semibold">金额与交付</h2>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {facts.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-[var(--surface-panel-muted)] p-2.5">
            <p className="text-[10px] text-muted-foreground">{label}</p>
            <p className="mt-1 text-sm font-semibold">{value}</p>
          </div>
        ))}
      </div>
      {sale.payments.length ? (
        <div className="mt-3 border-t border-[var(--border-panel)] pt-2">
          <h3 className="text-[11px] font-semibold">不可变付款记录</h3>
          <ol className="mt-1.5 grid gap-1.5">
            {sale.payments.map((payment, index) => (
              <li
                key={`${payment.occurred_at}-${index}`}
                className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-[10px]"
              >
                <span>
                  {paymentKindLabel(payment.kind)} · {paymentMethodLabel(payment.method)}
                </span>
                <strong>
                  {["refund", "reversal"].includes(payment.kind) ? "−" : "+"}
                  {euro(payment.amount)}
                </strong>
                <time className="text-muted-foreground">{formatDate(payment.occurred_at)}</time>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

type Submit = (command: InventoryLifecycleCommand, payload: Record<string, unknown>) => void;

function PaymentPanel({ sale, pending, submit }: PanelProps) {
  const [amount, setAmount] = useState(String(sale.balance));
  const [method, setMethod] = useState("cash");
  return (
    <ActionCard icon={Banknote} title="追加收款" description="付款记录只追加，不可覆盖历史。">
      <Field label="本次收款">
        <Input
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="h-11"
        />
      </Field>
      <Method value={method} onChange={setMethod} />
      <Button
        className="min-h-11"
        disabled={pending || Number(amount) <= 0 || Number(amount) > sale.balance}
        onClick={() =>
          submit("payment.append", {
            sale_order_id: sale.sale_order_id,
            expected_order_version: sale.order_version,
            kind: "payment",
            amount: Number(amount),
            method,
          })
        }
      >
        确认追加 {euro(Number(amount || 0))}
      </Button>
    </ActionCard>
  );
}

function CompleteSalePanel({ sale, pending, submit }: PanelProps) {
  return (
    <ActionCard
      icon={PackageCheck}
      title="完成成交"
      description="仅在约定价与累计已收完全一致时可成交。"
    >
      <Button
        className="min-h-11"
        disabled={pending || sale.balance !== 0}
        onClick={() =>
          submit("sale.complete", {
            sale_order_id: sale.sale_order_id,
            expected_order_version: sale.order_version,
            expected_unit_version: sale.unit_version,
          })
        }
      >
        完成销售并写入库存出库
      </Button>
    </ActionCard>
  );
}

function PickupPanel({ sale, pending, submit }: PanelProps) {
  const [months, setMonths] = useState("");
  const [reason, setReason] = useState("");
  return (
    <ActionCard
      icon={CalendarCheck}
      title="确认客户取走"
      description="商业保修从实际取走时间开始；留空使用当前门店默认值。"
    >
      <Field label="商业保修（月）">
        <Input
          inputMode="numeric"
          placeholder="门店默认"
          value={months}
          onChange={(event) => setMonths(event.target.value)}
          className="h-11"
        />
      </Field>
      {sale.balance > 0 ? (
        <Field label="余额未清例外原因">
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="min-h-20"
          />
        </Field>
      ) : null}
      <Button
        className="min-h-11"
        disabled={
          pending ||
          (months !== "" &&
            (!Number.isInteger(Number(months)) || Number(months) < 0 || Number(months) > 120)) ||
          (sale.balance > 0 && reason.trim().length === 0)
        }
        onClick={() =>
          submit("pickup.confirm", {
            sale_order_id: sale.sale_order_id,
            expected_order_version: sale.order_version,
            ...(months === "" ? {} : { warranty_months: Number(months) }),
            ...(reason.trim() ? { override_reason: reason.trim() } : {}),
          })
        }
      >
        确认已取走并开始保修
      </Button>
    </ActionCard>
  );
}

function WarrantyPanel({ sale, pending, submit }: PanelProps) {
  const [months, setMonths] = useState(String(sale.commercial_warranty?.months ?? 12));
  const [reason, setReason] = useState("");
  return (
    <ActionCard
      icon={ShieldCheck}
      title="调整商业保修"
      description="法定保障保持独立；本操作新增版本，不覆盖历史。"
    >
      <Field label="新商业保修（月）">
        <Input
          inputMode="numeric"
          value={months}
          onChange={(event) => setMonths(event.target.value)}
          className="h-11"
        />
      </Field>
      <Field label="调整原因">
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="min-h-20"
        />
      </Field>
      <Button
        className="min-h-11"
        disabled={pending || !reason.trim()}
        onClick={() =>
          submit("warranty.adjust", {
            sale_order_id: sale.sale_order_id,
            expected_order_version: sale.order_version,
            expected_warranty_version: sale.warranty_version ?? 0,
            months: Number(months),
            reason: reason.trim(),
          })
        }
      >
        保存新的商业保修版本
      </Button>
    </ActionCard>
  );
}

function AfterSalesIntakePanel({ sale, pending, submit }: PanelProps) {
  const [issue, setIssue] = useState("");
  return (
    <ActionCard
      icon={RefreshCw}
      title="登记返修 / 售后"
      description="建立独立案件，不覆盖原销售与首次交付。"
    >
      <Field label="客户反映问题">
        <Textarea
          value={issue}
          onChange={(event) => setIssue(event.target.value)}
          className="min-h-24"
        />
      </Field>
      <Button
        className="min-h-11"
        disabled={pending || !issue.trim()}
        onClick={() =>
          submit("after_sales.create", {
            sale_order_id: sale.sale_order_id,
            expected_order_version: sale.order_version,
            issue_summary: issue.trim(),
            coverage_decision: "pending",
          })
        }
      >
        建立售后案件
      </Button>
    </ActionCard>
  );
}

function CancelPanel({ sale, pending, submit }: PanelProps) {
  const [reason, setReason] = useState("");
  const [disposition, setDisposition] = useState("pending");
  return (
    <ActionCard
      icon={RefreshCw}
      title="取消预订"
      description="定金处理只记录决定；不会自动声称已退款或没收。"
      danger
    >
      <Field label="定金处理状态">
        <select
          className="h-11 w-full rounded-md border bg-background px-3 text-sm"
          value={disposition}
          onChange={(event) => setDisposition(event.target.value)}
        >
          <option value="pending">待决定</option>
          <option value="refund_pending">待退款</option>
          <option value="retain">确认保留</option>
        </select>
      </Field>
      <Field label="取消原因">
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="min-h-20"
        />
      </Field>
      <Button
        variant="destructive"
        className="min-h-11"
        disabled={pending || !reason.trim()}
        onClick={() => {
          if (window.confirm("确认取消此预订？库存将重新变为可售，定金状态按所选值记录。"))
            submit("reservation.cancel", {
              sale_order_id: sale.sale_order_id,
              expected_order_version: sale.order_version,
              expected_unit_version: sale.unit_version,
              disposition,
              reason: reason.trim(),
            });
        }}
      >
        确认取消预订
      </Button>
    </ActionCard>
  );
}

type PanelProps = { sale: InventoryLifecycleSaleDetail; pending: boolean; submit: Submit };

function ActionCard({
  icon: Icon,
  title,
  description,
  danger,
  children,
}: {
  icon: typeof Banknote;
  title: string;
  description: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        repairOs.mobileInfoCard,
        "grid content-start gap-3 p-3 sm:p-4",
        danger && "border-destructive/30",
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary",
            danger && "bg-destructive/10 text-destructive",
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
function Method({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Field label="支付方式">
      <select
        className="h-11 w-full rounded-md border bg-background px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {methods.map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </Field>
  );
}
function euro(value: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
}
function formatDate(value?: string) {
  return value
    ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "未安排";
}
function shortId(value: string) {
  return value.slice(0, 8).toUpperCase();
}
function successCopy(code: string) {
  const copy: Record<string, string> = {
    payment_appended: "收款已追加，金额摘要已刷新。",
    sale_completed: "销售已完成，库存出库记录已写入。",
    pickup_confirmed: "已记录实际取走时间，商业保修已开始。",
    reservation_cancelled: "预订已取消，定金处理状态已记录。",
    warranty_adjusted: "新的商业保修版本已保存。",
    after_sales_created: "售后案件已建立，可从返修队列继续处理。",
  };
  return copy[code] ?? "操作已完成，业务状态已刷新。";
}

function paymentKindLabel(kind: InventoryLifecycleSaleDetail["payments"][number]["kind"]) {
  return {
    deposit: "定金",
    balance: "尾款",
    payment: "收款",
    refund: "退款",
    reversal: "冲正",
  }[kind];
}

function paymentMethodLabel(method: InventoryLifecycleSaleDetail["payments"][number]["method"]) {
  return {
    cash: "现金",
    card: "银行卡",
    bancomat: "Bancomat",
    transfer: "转账",
    other: "其他",
  }[method];
}
