"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { StoreOutputIdentityRecovery } from "@/components/store/store-output-identity-recovery";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { componentOverlay } from "@/lib/component-patterns";
import type { OrderDetail } from "@/lib/repairdesk/api";
import { getOrderContactPhoneOptions } from "@/features/orders/model/order-contact-phones";
import type { StoreOutputIdentity } from "@/entities/store/model/store-output-identity";
import {
  buildOrderWhatsappMessage,
  buildWhatsAppUrl,
  replaceOrderWhatsappRecipientPhone,
} from "@/features/orders/model/order-message-templates";

export function ApprovalRequestDialog({
  open,
  onOpenChange,
  data,
  orderUrl,
  storeIdentity,
  canReadStoreSettings,
  canUpdateStoreSettings,
  onRetryStoreSettings,
  onReloadStoreContext,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data: OrderDetail;
  orderUrl: string;
  storeIdentity: StoreOutputIdentity;
  canReadStoreSettings: boolean;
  canUpdateStoreSettings: boolean;
  onRetryStoreSettings?: () => void | Promise<unknown>;
  onReloadStoreContext?: () => void | Promise<unknown>;
  busy: boolean;
  onConfirm: (input: { body: string; recipientPhone?: string }) => Promise<unknown>;
}) {
  const phoneOptions = getOrderContactPhoneOptions(data);
  const defaultPhone = phoneOptions[0] ?? "";
  const [body, setBody] = useState(() =>
    buildOrderWhatsappMessage(data, "approval_request", orderUrl, {
      recipientPhone: defaultPhone,
      storeIdentity,
    }),
  );
  const [phone, setPhone] = useState(defaultPhone);
  const [whatsappOpened, setWhatsappOpened] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const canOpenWhatsApp = Boolean(phone.replace(/\D/g, ""));

  useEffect(() => {
    if (!open) return;
    const nextPhone = getOrderContactPhoneOptions(data)[0] ?? "";
    setBody(
      buildOrderWhatsappMessage(data, "approval_request", orderUrl, {
        recipientPhone: nextPhone,
        storeIdentity,
      }),
    );
    setPhone(nextPhone);
    setWhatsappOpened(false);
    setCustomizing(false);
  }, [data, open, orderUrl, storeIdentity]);

  const updatePhone = (nextPhone: string) => {
    setPhone(nextPhone);
    setBody((current) => replaceOrderWhatsappRecipientPhone(current, nextPhone));
    setWhatsappOpened(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${componentOverlay.modalMd} grid max-h-[calc(100svh-24px)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0`}
      >
        <DialogHeader className="border-b border-[var(--border-panel)] px-4 py-3 text-left">
          <DialogTitle>预览 WhatsApp 审批消息</DialogTitle>
          <DialogDescription className="text-xs">
            先打开 WhatsApp；只有确认实际发送后，系统才会记录通知并继续流程。
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 min-w-0 overflow-y-auto p-3 sm:p-4">
          <StoreOutputIdentityRecovery
            identity={storeIdentity}
            canReadSettings={canReadStoreSettings}
            canUpdateSettings={canUpdateStoreSettings}
            onRetrySettings={onRetryStoreSettings}
            onReloadStoreContext={onReloadStoreContext}
            openSettingsInNewTab
            className="mb-2"
          />
          <div className="grid min-w-0 gap-1.5 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-2 text-xs text-muted-foreground sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <span className="font-medium text-foreground">WhatsApp</span>
            {phoneOptions.length > 1 ? (
              <Select value={phone} disabled={!storeIdentity.canOutput} onValueChange={updatePhone}>
                <SelectTrigger className="h-8 w-full font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {phoneOptions.map((option, index) => (
                    <SelectItem key={option} value={option}>
                      {index === 0 ? "主号码" : "备用号码"} · {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="min-w-0 truncate rounded-md border bg-card px-2 py-1.5 font-mono">
                {phone || "缺少电话号码"}
              </span>
            )}
          </div>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-medium text-muted-foreground">审批消息内容</div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[10px]"
                disabled={!storeIdentity.canOutput}
                onClick={() => {
                  if (customizing) {
                    setBody(
                      buildOrderWhatsappMessage(data, "approval_request", orderUrl, {
                        recipientPhone: phone,
                        storeIdentity,
                      }),
                    );
                  }
                  setCustomizing((current) => !current);
                  setWhatsappOpened(false);
                }}
              >
                {customizing ? "恢复模板" : "自定义消息"}
              </Button>
            </div>
            {customizing ? (
              <Textarea
                aria-label="审批消息内容"
                rows={10}
                value={body}
                disabled={!storeIdentity.canOutput}
                onChange={(event) => {
                  setBody(event.target.value);
                  setWhatsappOpened(false);
                }}
                className="min-h-[260px] resize-none font-mono text-xs leading-relaxed"
              />
            ) : (
              <pre
                data-order-message-preview="true"
                className="min-h-[180px] whitespace-pre-wrap rounded-lg border border-[var(--border-panel)] bg-card p-3 font-mono text-xs leading-relaxed"
              >
                {body}
              </pre>
            )}
          </div>
          {whatsappOpened ? (
            <div
              aria-live="polite"
              className="mt-2 rounded-md border border-status-success-foreground/20 bg-status-success/10 px-2 py-1.5 text-xs text-status-success-foreground"
            >
              WhatsApp 已打开。请确认消息确实发送后，再点击“我已发送”。
            </div>
          ) : null}
        </div>
        <DialogFooter className="border-t border-[var(--border-panel)] px-4 py-3 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            disabled={busy || !storeIdentity.canOutput || !body.trim() || !canOpenWhatsApp}
            onClick={async () => {
              const url = buildWhatsAppUrl(phone, body.trim());
              if (!url) {
                toast.error("客户电话号码不可用于 WhatsApp");
                return;
              }
              if (!whatsappOpened) {
                window.open(url, "_blank", "noopener,noreferrer");
                setWhatsappOpened(true);
                return;
              }
              await onConfirm({ body: body.trim(), recipientPhone: phone.trim() || undefined });
              onOpenChange(false);
            }}
          >
            <Send className="mr-1.5 size-3.5" />
            {busy ? "记录中…" : whatsappOpened ? "我已发送，记录并继续" : "打开 WhatsApp"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
