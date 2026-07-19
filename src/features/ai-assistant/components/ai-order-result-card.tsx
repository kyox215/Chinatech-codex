"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  LoaderCircle,
  UserRound,
} from "lucide-react";

import {
  AlertDialog,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type {
  AiOrderCard,
  AiOrderInlineActionCandidate,
} from "@/features/ai-assistant/model/contracts";
import { RepairDeskApiError, runAiOrderInlineAction } from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";

export function AiOrderResultCard({
  card,
  isOnline,
  onOpenOrder,
  onCardUpdated,
}: {
  card: AiOrderCard;
  isOnline: boolean;
  onOpenOrder: () => void;
  onCardUpdated: (card: AiOrderCard) => void;
}) {
  const detailsId = useId();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<AiOrderInlineActionCandidate>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const idempotencyKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    setError(undefined);
    setSuccess(undefined);
  }, [card.id]);

  const confirmAction = async () => {
    if (!selectedAction || pending || !isOnline) return;
    const idempotencyKey = idempotencyKeyRef.current ?? crypto.randomUUID();
    idempotencyKeyRef.current = idempotencyKey;
    setPending(true);
    setError(undefined);
    try {
      const result = await runAiOrderInlineAction({
        order_id: card.id,
        action: selectedAction.action,
        confirm_public_no: card.public_no,
        expected_updated_at: card.updated_at,
        idempotency_key: idempotencyKey,
      });
      onCardUpdated(result.card);
      setSuccess(result.message);
      setDialogOpen(false);
      setSelectedAction(undefined);
      idempotencyKeyRef.current = undefined;
    } catch (caught) {
      setError(actionErrorMessage(caught));
    } finally {
      setPending(false);
    }
  };

  return (
    <article
      data-ai-order-card={card.id}
      aria-busy={pending}
      className="rounded-2xl border border-[var(--border-panel)] bg-card p-3 shadow-[var(--shadow-card)]"
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-semibold">{card.public_no}</p>
          <p className="mt-0.5 truncate text-sm">{card.device_label}</p>
        </div>
        <Badge variant="secondary" className="max-w-28 shrink-0 truncate">
          {card.status_label}
        </Badge>
      </div>
      <div className="mt-2 grid min-w-0 grid-cols-2 gap-2 text-[11px] text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1">
          <UserRound className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{card.customer_hint}</span>
        </span>
        <span className="flex min-w-0 items-center justify-end gap-1 text-right">
          <Clock3 className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{formatCardDate(card.updated_at)}</span>
        </span>
      </div>

      {card.matched_reasons.length > 0 ? (
        <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
          匹配：{card.matched_reasons.join(" · ")}
        </p>
      ) : null}

      <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen} className="mt-2">
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-full justify-between px-2 text-xs"
            aria-expanded={detailsOpen}
            aria-controls={detailsId}
          >
            查看当前页内详情
            <ChevronDown
              className={cn("size-3.5 transition-transform", detailsOpen && "rotate-180")}
              aria-hidden="true"
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent id={detailsId} className="pt-1">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-xl bg-[var(--surface-panel-muted)] px-3 py-2 text-[11px]">
            <dt className="text-muted-foreground">配件标记</dt>
            <dd className="text-right font-medium">{partsStatusLabel(card.parts_status)}</dd>
            <dt className="text-muted-foreground">完成时间</dt>
            <dd className="text-right font-medium">
              {card.completed_at ? formatCardDate(card.completed_at) : "未记录完成"}
            </dd>
          </dl>
        </CollapsibleContent>
      </Collapsible>

      {success ? (
        <p
          role="status"
          className="mt-2 flex items-start gap-1.5 rounded-lg bg-status-success/30 px-2.5 py-2 text-[11px] leading-4 text-status-success-foreground"
        >
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {success}
        </p>
      ) : null}
      {error && !dialogOpen ? (
        <p
          role="alert"
          className="mt-2 rounded-lg bg-status-danger/30 px-2.5 py-2 text-[11px] text-status-danger-foreground"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-2 grid grid-cols-2 gap-2">
        {card.allowed_actions.map((action) => (
          <AlertDialog
            key={action.action}
            open={dialogOpen}
            onOpenChange={(next) => !pending && setDialogOpen(next)}
          >
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11 min-w-0"
                disabled={!isOnline || pending}
                onClick={() => {
                  setSelectedAction(action);
                  setError(undefined);
                  idempotencyKeyRef.current = crypto.randomUUID();
                }}
              >
                {action.label}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认{action.label}</AlertDialogTitle>
                <AlertDialogDescription>
                  工单 {card.public_no}：{action.description}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="rounded-xl bg-[var(--surface-panel-muted)] px-3 py-2 text-xs text-muted-foreground">
                这只会更新 RepairDesk 工单流程状态；不会创建供应商订单、付款或分配库存。
              </div>
              {error ? (
                <p role="alert" className="text-sm text-status-danger-foreground">
                  {error}
                </p>
              ) : null}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
                <Button
                  type="button"
                  disabled={pending || !isOnline}
                  onClick={() => void confirmAction()}
                >
                  {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
                  {pending ? "处理中…" : `确认${action.label}`}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ))}
        <Button
          asChild
          size="sm"
          className={cn("min-h-11 min-w-0", card.allowed_actions.length === 0 && "col-span-2")}
        >
          <Link href={card.href} onClick={onOpenOrder} aria-label={`打开订单 ${card.public_no}`}>
            打开订单 <ExternalLink className="size-3.5" aria-hidden="true" />
          </Link>
        </Button>
      </div>
      {!isOnline && card.allowed_actions.length > 0 ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          离线时可查看结果，但不能提交订单操作。
        </p>
      ) : null}
    </article>
  );
}

function actionErrorMessage(error: unknown) {
  if (error instanceof RepairDeskApiError && error.status === 409) return error.message;
  if (error instanceof RepairDeskApiError && (error.status === 401 || error.status === 403)) {
    return "当前权限或工单范围已变化，请刷新查询结果。";
  }
  return "订单操作暂时失败，未确认成功前请不要重复修改；可使用同一按钮重试。";
}

function partsStatusLabel(value: AiOrderCard["parts_status"]) {
  if (value === "needed") return "待订件";
  if (value === "ordered") return "配件已订";
  if (value === "arrived") return "配件已到";
  if (value === "out_of_stock") return "缺货";
  return "无需配件 / 未标记";
}

function formatCardDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Europe/Rome",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
