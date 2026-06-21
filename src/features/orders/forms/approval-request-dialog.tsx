"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data: OrderDetail;
  orderUrl: string;
  busy: boolean;
  onConfirm: (input: { body: string; recipientPhone?: string }) => Promise<unknown>;
}) {
  const phoneOptions = getOrderContactPhoneOptions(data);
  const defaultPhone = phoneOptions[0] ?? "";
  const [body, setBody] = useState(() =>
    buildOrderWhatsappMessage(data, "approval_request", orderUrl, {
      recipientPhone: defaultPhone,
    }),
  );
  const [phone, setPhone] = useState(defaultPhone);
  const canOpenWhatsApp = Boolean(phone.replace(/\D/g, ""));

  useEffect(() => {
    if (!open) return;
    const nextPhone = getOrderContactPhoneOptions(data)[0] ?? "";
    setBody(
      buildOrderWhatsappMessage(data, "approval_request", orderUrl, {
        recipientPhone: nextPhone,
      }),
    );
    setPhone(nextPhone);
  }, [data, open, orderUrl]);

  const updatePhone = (nextPhone: string) => {
    setPhone(nextPhone);
    setBody((current) => replaceOrderWhatsappRecipientPhone(current, nextPhone));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${componentOverlay.modalMd} grid max-h-[calc(100svh-24px)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0`}
      >
        <DialogHeader className="border-b border-[var(--border-panel)] px-4 py-3 text-left">
          <DialogTitle>预览 WhatsApp 审批消息</DialogTitle>
          <DialogDescription className="text-xs">
            内容将以意大利语发送给客户。确认后会打开 WhatsApp，并记录到通知历史。
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 min-w-0 overflow-y-auto p-3 sm:p-4">
          <div className="grid min-w-0 gap-1.5 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-2 text-xs text-muted-foreground sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <span className="font-medium text-foreground">WhatsApp</span>
            {phoneOptions.length > 1 ? (
              <Select value={phone} onValueChange={updatePhone}>
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
          <div className="mt-2">
            <div className="mb-1 text-xs font-medium text-muted-foreground">审批消息内容</div>
            <Textarea
              rows={10}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="min-h-[260px] resize-none font-mono text-xs leading-relaxed"
            />
          </div>
        </div>
        <DialogFooter className="border-t border-[var(--border-panel)] px-4 py-3 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={busy || !body.trim() || !canOpenWhatsApp}
            onClick={async () => {
              const url = buildWhatsAppUrl(phone, body.trim());
              if (!url) {
                toast.error("客户电话号码不可用于 WhatsApp");
                return;
              }
              window.open(url, "_blank", "noopener,noreferrer");
              await onConfirm({ body: body.trim(), recipientPhone: phone.trim() || undefined });
            }}
          >
            <Send className="mr-1.5 size-3.5" /> 确认并打开 WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
