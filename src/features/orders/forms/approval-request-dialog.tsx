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
import type { OrderDetail } from "@/lib/repairdesk/api";
import { getOrderContactPhoneOptions } from "@/features/orders/model/order-contact-phones";
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
  const phoneOptions = getOrderContactPhoneOptions(data);
  const [phone, setPhone] = useState(phoneOptions[0] ?? "");
  const canOpenWhatsApp = Boolean(phone.replace(/\D/g, ""));

  useEffect(() => {
    if (!open) return;
    setBody(buildOrderWhatsappMessage(data, "approval_request", orderUrl));
    setPhone(getOrderContactPhoneOptions(data)[0] ?? "");
  }, [data, open, orderUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[min(680px,calc(100vw-24px))] max-w-[calc(100vw-24px)] overflow-y-auto p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle>预览 WhatsApp 审批消息</DialogTitle>
          <DialogDescription>
            内容将以意大利语发送给客户。确认后会打开 WhatsApp，并记录到通知历史。
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>WhatsApp</span>
            {phoneOptions.length > 1 ? (
              <Select value={phone} onValueChange={setPhone}>
                <SelectTrigger className="h-8 w-[min(280px,100%)] font-mono text-xs">
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
              <span className="min-w-0 truncate font-mono">{phone || "缺少电话号码"}</span>
            )}
          </div>
          <Textarea
            rows={12}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="font-mono text-xs leading-relaxed"
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
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
