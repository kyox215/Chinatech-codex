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
import { useLocale } from "@/shared/i18n/locale-provider";
import { translateSettingsOperations } from "@/shared/i18n/messages";

function useOperationsCopy() {
  const { locale } = useLocale();
  return (
    source: Parameters<typeof translateSettingsOperations>[1],
    values?: Record<string, string | number>,
  ) => translateSettingsOperations(locale, source, values);
}

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
  const copy = useOperationsCopy();
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
        {copy("返回检查")}
      </Button>
      <Button type="button" variant="destructive" disabled={!ready} onClick={onConfirm}>
        {pending ? copy("正在安全关闭店铺…") : copy("确认关闭这家店（可恢复）")}
      </Button>
    </>
  );

  if (mobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          closeLabel={copy("关闭确认窗口")}
          className={cn(componentOverlay.bottomSheet, "flex h-[min(92dvh,52rem)] flex-col gap-0")}
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (pending) event.preventDefault();
          }}
        >
          <SheetHeader className="shrink-0 pb-3 text-left">
            <SheetTitle>{copy("确认关闭 {store}？", { store: store.name })}</SheetTitle>
            <SheetDescription>
              {copy("这不是永久删除。资料会继续保留，以后可以恢复。")}
            </SheetDescription>
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
        closeLabel={copy("关闭")}
        showCloseButton={!pending}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{copy("确认关闭 {store}？", { store: store.name })}</DialogTitle>
          <DialogDescription>
            {copy("这不是永久删除。资料会继续保留，以后可以恢复。")}
          </DialogDescription>
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
  const copy = useOperationsCopy();
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-3">
        <p className="text-xs text-muted-foreground">{copy("正在关闭")}</p>
        <p className="mt-1 break-words text-sm font-semibold">{store.name}</p>
        <p className="mt-2 text-xs text-muted-foreground">{copy("店铺唯一编号")}</p>
        <p className="mt-1 break-all font-mono text-xs tabular-nums">{store.id}</p>
      </div>
      <StoreCloseImpactList />
      <div className="space-y-1.5">
        <Label htmlFor="store-close-id-suffix">{copy("店铺识别码最后 8 位")}</Label>
        <Input
          id="store-close-id-suffix"
          value={suffix}
          className="min-h-11 font-mono text-base uppercase md:text-sm"
          maxLength={8}
          autoFocus
          autoComplete="off"
          placeholder={copy("请输入上方编号最后 8 位")}
          disabled={pending}
          aria-describedby="store-close-id-suffix-help"
          onChange={(event) =>
            onSuffixChange(event.target.value.replace(/[^0-9a-f]/gi, "").slice(0, 8))
          }
        />
        <p id="store-close-id-suffix-help" className="text-xs leading-5 text-muted-foreground">
          {copy("用于避免关错同名店铺，不是密码。")}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="store-close-reason">{copy("为什么要关闭？")}</Label>
        <Select value={reason} disabled={pending} onValueChange={onReasonChange}>
          <SelectTrigger id="store-close-reason" className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="business_closed">{copy("停止营业")}</SelectItem>
            <SelectItem value="temporary_closure">{copy("暂时停业")}</SelectItem>
            <SelectItem value="duplicate_store">{copy("重复或误创建")}</SelectItem>
            <SelectItem value="other">{copy("其他原因")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {requiresTotp ? (
        <div className="space-y-1.5">
          <Label htmlFor="store-close-totp">{copy("身份验证器中的 6 位安全验证码")}</Label>
          <Input
            id="store-close-totp"
            value={totpCode}
            className="min-h-11 text-base md:text-sm"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder={copy("6 位数字")}
            disabled={pending}
            aria-describedby="store-close-totp-help"
            onChange={(event) => onTotpChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <p id="store-close-totp-help" className="text-xs leading-5 text-muted-foreground">
            {copy("例如 Google Authenticator 中的验证码，不是短信验证码。")}
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
        <span>
          {copy("我明白这是可恢复关闭，不是永久删除；旧邀请和客户 iPad 权限不会自动恢复。")}
        </span>
      </label>
    </div>
  );
}

export function StoreCloseImpactList({ preflight }: { preflight?: StoreLifecyclePreflight }) {
  const copy = useOperationsCopy();
  return (
    <div className="space-y-2 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3 text-sm">
      <p className="font-semibold">{copy("关闭后会发生什么")}</p>
      <ul className="space-y-1.5 text-xs leading-5 text-muted-foreground">
        <li>{copy("• 立即停止这家店的新工单、客户、库存和设置写入")}</li>
        <li>
          {copy("• 撤销待处理邀请和客户 iPad 权限")}
          {preflight?.automatic_effects
            ? ` ${copy("（邀请 {invitations} 个，iPad 会话 {sessions} 个）", {
                invitations: preflight.automatic_effects.pending_invitations,
                sessions: preflight.automatic_effects.open_kiosk_sessions,
              })}`
            : ""}
        </li>
        <li>{copy("• 保留现有资料，以后可由店铺主账号恢复")}</li>
      </ul>
    </div>
  );
}
