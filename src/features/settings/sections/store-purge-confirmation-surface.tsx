"use client";

import { Copy, ShieldAlert } from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";
import { componentOverlay } from "@/lib/component-patterns";
import { cn } from "@/lib/utils";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import type { StorePurgeManagerState } from "./store-purge-manager-state";

export function StorePurgeConfirmationSurface({ state }: { state: StorePurgeManagerState }) {
  const isMobile = useIsMobile();
  const {
    store,
    open,
    setOpen,
    mode,
    confirmationPhrase,
    setConfirmationPhrase,
    totpCode,
    setTotpCode,
    acknowledged,
    setAcknowledged,
    phraseCopied,
    preflight,
    requiresTotp,
    expectedPhrase,
    phraseMismatch,
    isActionPending,
    isActionLocked,
    ready,
    copyPhrase,
    submitMutation,
  } = state;
  const body = (
    <div className="space-y-4">
      <div className="rounded-xl border border-status-danger-foreground/25 bg-status-danger/10 p-3 text-xs leading-5">
        <p className="flex items-center gap-2 font-semibold">
          <ShieldAlert className="size-4" aria-hidden="true" />
          核对删除目标
        </p>
        <p className="mt-2">店铺：{store.name}</p>
        <p className="break-all font-mono">UUID：{store.id}</p>
        <p className="mt-1 text-muted-foreground">
          安全预检：
          {preflight ? (preflight.state === "eligible" ? "已通过" : "存在阻塞") : "正在检查…"}
        </p>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`purge-phrase-${store.id}`}>请逐字输入以下提示词</Label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-9 shrink-0 gap-1.5 px-2"
            disabled={isActionLocked}
            onClick={() => void copyPhrase()}
            aria-label="复制删除确认提示词"
          >
            <Copy className="size-3.5" aria-hidden="true" />
            {phraseCopied ? "已复制" : "复制提示词"}
          </Button>
        </div>
        <p className="break-words rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2 font-mono text-sm font-semibold">
          {expectedPhrase}
        </p>
        <Input
          id={`purge-phrase-${store.id}`}
          value={confirmationPhrase}
          className="min-h-11 text-base md:text-sm"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          disabled={isActionLocked}
          spellCheck={false}
          aria-invalid={phraseMismatch}
          onChange={(event) => setConfirmationPhrase(event.target.value)}
        />
        {phraseMismatch ? (
          <p role="alert" className="text-[11px] leading-4 text-status-danger-foreground">
            提示词不匹配，请按上方内容逐字输入，保留大小写和空格。
          </p>
        ) : null}
        <p className="text-[11px] leading-4 text-muted-foreground">
          区分大小写和空格，不会自动修正前后空格。提示词仅用于本次操作确认。
        </p>
      </div>
      {requiresTotp ? (
        <div className="space-y-1.5">
          <Label htmlFor={`purge-totp-${store.id}`}>身份验证器中的 6 位安全验证码</Label>
          <Input
            id={`purge-totp-${store.id}`}
            value={totpCode}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            disabled={isActionLocked}
            onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          />
        </div>
      ) : null}
      <label className="flex items-start gap-2 text-xs leading-5">
        <input
          type="checkbox"
          className="mt-1"
          checked={acknowledged}
          disabled={isActionLocked}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />
        <span>我确认目标 UUID 正确，并理解后台开始清除后数据无法恢复。</span>
      </label>
      <p role="status" aria-live="polite" className="sr-only">
        {phraseCopied ? "删除确认提示词已复制" : ""}
      </p>
    </div>
  );
  const footer = (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={isActionLocked}
        onClick={() => setOpen(false)}
      >
        返回
      </Button>
      <Button
        type="button"
        variant="destructive"
        className="min-h-11"
        disabled={!ready}
        onClick={() => submitMutation.mutate()}
      >
        {isActionPending ? "正在提交…" : mode === "request" ? "建立删除申请" : "确认永久删除"}
      </Button>
    </>
  );
  const title = mode === "request" ? "申请永久删除店铺" : "最终确认永久删除";
  const description =
    mode === "request"
      ? "申请后至少等待 24 小时，期间可以取消。系统还会完成加密备份和恢复验证。"
      : "这是不可逆确认。后台开始清除后将无法恢复店铺、订单、客户、库存和附件。";

  return isMobile ? (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!isActionLocked) setOpen(next);
      }}
    >
      <SheetContent
        data-testid="purge-confirmation-sheet"
        side="bottom"
        closeLabel="关闭删除确认窗口"
        className={cn(
          componentOverlay.bottomSheet,
          "flex h-[min(92dvh,52rem)] flex-col gap-0 px-4",
        )}
        onEscapeKeyDown={(event) => {
          if (isActionLocked) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (isActionLocked) event.preventDefault();
        }}
      >
        <SheetHeader className="shrink-0 pb-3 text-left">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pb-4">{body}</div>
        <SheetFooter className="shrink-0 gap-2 border-t border-[var(--border-panel)] pt-3 sm:space-x-0">
          {footer}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ) : (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isActionLocked) setOpen(next);
      }}
    >
      <DialogContent
        data-testid="purge-confirmation-dialog"
        className={componentOverlay.modalSm}
        showCloseButton={!isActionLocked}
        onEscapeKeyDown={(event) => {
          if (isActionLocked) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (isActionLocked) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto">{body}</div>
        <DialogFooter className="gap-2 sm:space-x-0">{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
