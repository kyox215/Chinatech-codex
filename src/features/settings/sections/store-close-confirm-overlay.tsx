"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ActorStoreMembership, StoreLifecyclePreflight } from "@/lib/repairdesk/types";
import { componentOverlay } from "@/lib/component-patterns";
import { cn } from "@/lib/utils";

interface StoreCloseConfirmOverlayProps {
  mobile: boolean;
  open: boolean;
  store: ActorStoreMembership;
  suffix: string;
  reason: string;
  acknowledged: boolean;
  totpCode: string;
  requiresTotp: boolean;
  pending: boolean;
  ready: boolean;
  onOpenChange: (open: boolean) => void;
  onSuffixChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onAcknowledgedChange: (value: boolean) => void;
  onTotpChange: (value: string) => void;
  onConfirm: () => void;
}

export function StoreCloseConfirmOverlay({
  mobile,
  open,
  store,
  suffix,
  reason,
  acknowledged,
  totpCode,
  requiresTotp,
  pending,
  ready,
  onOpenChange,
  onSuffixChange,
  onReasonChange,
  onAcknowledgedChange,
  onTotpChange,
  onConfirm,
}: StoreCloseConfirmOverlayProps) {
  const content = (
    <CloseConfirmContent
      store={store}
      suffix={suffix}
      reason={reason}
      acknowledged={acknowledged}
      totpCode={totpCode}
      requiresTotp={requiresTotp}
      pending={pending}
      onSuffixChange={onSuffixChange}
      onReasonChange={onReasonChange}
      onAcknowledgedChange={onAcknowledgedChange}
      onTotpChange={onTotpChange}
    />
  );
  const footer = (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => onOpenChange(false)}
      >
        返回检查
      </Button>
      <Button type="button" variant="destructive" disabled={!ready} onClick={onConfirm}>
        {pending ? "正在安全关闭店铺…" : "确认关闭这家店（可恢复）"}
      </Button>
    </>
  );

  if (mobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          closeLabel="关闭确认窗口"
          className={cn(componentOverlay.bottomSheet, "flex h-[min(92dvh,52rem)] flex-col gap-0")}
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (pending) event.preventDefault();
          }}
        >
          <SheetHeader className="shrink-0 pb-3 text-left">
            <SheetTitle>确认关闭 {store.name}？</SheetTitle>
            <SheetDescription>这不是永久删除。资料会继续保留，以后可以恢复。</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pb-4">{content}</div>
          <SheetFooter className="shrink-0 gap-2 border-t border-[var(--border-panel)] pt-3 sm:space-x-0">
            {footer}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={componentOverlay.modalMd}
        showCloseButton={!pending}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>确认关闭 {store.name}？</DialogTitle>
          <DialogDescription>这不是永久删除。资料会继续保留，以后可以恢复。</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto">{content}</div>
        <DialogFooter className="gap-2 sm:space-x-0">{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloseConfirmContent({
  store,
  suffix,
  reason,
  acknowledged,
  totpCode,
  requiresTotp,
  pending,
  onSuffixChange,
  onReasonChange,
  onAcknowledgedChange,
  onTotpChange,
}: Omit<
  StoreCloseConfirmOverlayProps,
  "mobile" | "open" | "ready" | "onOpenChange" | "onConfirm"
>) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-3">
        <p className="text-xs text-muted-foreground">正在关闭</p>
        <p className="mt-1 break-words text-sm font-semibold">{store.name}</p>
        <p className="mt-2 text-xs text-muted-foreground">店铺唯一编号</p>
        <p className="mt-1 break-all font-mono text-xs tabular-nums">{store.id}</p>
      </div>
      <StoreCloseImpactList />
      <div className="space-y-1.5">
        <Label htmlFor="store-close-id-suffix">店铺识别码最后 8 位</Label>
        <Input
          id="store-close-id-suffix"
          value={suffix}
          className="min-h-11 font-mono text-base uppercase md:text-sm"
          maxLength={8}
          autoFocus
          autoComplete="off"
          placeholder="请输入上方编号最后 8 位"
          disabled={pending}
          aria-describedby="store-close-id-suffix-help"
          onChange={(event) =>
            onSuffixChange(event.target.value.replace(/[^0-9a-f]/gi, "").slice(0, 8))
          }
        />
        <p id="store-close-id-suffix-help" className="text-xs leading-5 text-muted-foreground">
          用于避免关错同名店铺，不是密码。
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="store-close-reason">为什么要关闭？</Label>
        <Select value={reason} disabled={pending} onValueChange={onReasonChange}>
          <SelectTrigger id="store-close-reason" className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="business_closed">停止营业</SelectItem>
            <SelectItem value="temporary_closure">暂时停业</SelectItem>
            <SelectItem value="duplicate_store">重复或误创建</SelectItem>
            <SelectItem value="other">其他原因</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {requiresTotp ? (
        <div className="space-y-1.5">
          <Label htmlFor="store-close-totp">身份验证器中的 6 位安全验证码</Label>
          <Input
            id="store-close-totp"
            value={totpCode}
            className="min-h-11 text-base md:text-sm"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="6 位数字"
            disabled={pending}
            aria-describedby="store-close-totp-help"
            onChange={(event) => onTotpChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <p id="store-close-totp-help" className="text-xs leading-5 text-muted-foreground">
            例如 Google Authenticator 中的验证码，不是短信验证码。
          </p>
        </div>
      ) : null}
      <label className="flex items-start gap-2 rounded-xl border border-status-danger-foreground/20 bg-status-danger/5 p-3 text-sm leading-5">
        <input
          type="checkbox"
          className="mt-1"
          checked={acknowledged}
          disabled={pending}
          onChange={(event) => onAcknowledgedChange(event.target.checked)}
        />
        <span>我明白这是可恢复关闭，不是永久删除；旧邀请和客户 iPad 权限不会自动恢复。</span>
      </label>
    </div>
  );
}

export function StoreCloseImpactList({ preflight }: { preflight?: StoreLifecyclePreflight }) {
  return (
    <div className="space-y-2 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3 text-sm">
      <p className="font-semibold">关闭后会发生什么</p>
      <ul className="space-y-1.5 text-xs leading-5 text-muted-foreground">
        <li>• 立即停止这家店的新工单、客户、库存和设置写入</li>
        <li>
          • 撤销待处理邀请和客户 iPad 权限
          {preflight?.automatic_effects
            ? `（邀请 ${preflight.automatic_effects.pending_invitations} 个，iPad 会话 ${preflight.automatic_effects.open_kiosk_sessions} 个）`
            : ""}
        </li>
        <li>• 保留现有资料，以后可由店铺主账号恢复</li>
      </ul>
    </div>
  );
}
