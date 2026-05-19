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
import { Textarea } from "@/components/ui/textarea";
import type { OrderDetail } from "@/lib/repairdesk/api";
import {
  buildOrderWhatsappMessage,
  buildWhatsAppUrl,
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
  onConfirm: (body: string) => Promise<unknown>;
}) {
  const [body, setBody] = useState(() =>
    buildOrderWhatsappMessage(data, "approval_request", orderUrl),
  );
  const phone = data.customer?.phone_e164 || data.order.customer_phone;
  const canOpenWhatsApp = Boolean(phone.replace(/\D/g, ""));

  useEffect(() => {
    if (open) setBody(buildOrderWhatsappMessage(data, "approval_request", orderUrl));
  }, [data, open, orderUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>预览 WhatsApp 审批消息</DialogTitle>
          <DialogDescription>
            内容将以意大利语发送给客户。确认后会打开 WhatsApp，并记录到通知历史。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>WhatsApp</span>
            <span className="font-mono">{phone || "缺少电话号码"}</span>
          </div>
          <Textarea
            rows={12}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="font-mono text-xs leading-relaxed"
          />
        </div>
        <DialogFooter>
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
              await onConfirm(body.trim());
            }}
          >
            <Send className="mr-1.5 size-3.5" /> 确认并打开 WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
