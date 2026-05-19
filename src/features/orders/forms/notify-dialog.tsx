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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { statusMeta } from "@/lib/mock/enums";
import type { OrderDetail, OrderWhatsappTemplateKind } from "@/lib/repairdesk/api";
import {
  buildOrderWhatsappMessage,
  buildWhatsAppUrl,
  getDefaultOrderWhatsappTemplateKind,
  getOrderWhatsappTransition,
  orderWhatsappTemplateOptions,
} from "@/features/orders/model/order-message-templates";

export function NotifyDialog({
  open,
  onOpenChange,
  data,
  orderUrl,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: OrderDetail;
  orderUrl: string;
  busy: boolean;
  onConfirm: (input: {
    body: string;
    templateKind: OrderWhatsappTemplateKind;
    transitionTo?: OrderDetail["order"]["status"];
  }) => Promise<unknown>;
}) {
  const defaultKind = getDefaultOrderWhatsappTemplateKind(data.order.status);
  const [templateKind, setTemplateKind] = useState<OrderWhatsappTemplateKind>(defaultKind);
  const [body, setBody] = useState(() => buildOrderWhatsappMessage(data, defaultKind, orderUrl));
  const phone = data.customer?.phone_e164 || data.order.customer_phone;
  const canOpenWhatsApp = Boolean(phone.replace(/\D/g, ""));
  const transitionTo = getOrderWhatsappTransition(data.order.status, templateKind);

  useEffect(() => {
    if (!open) return;
    const nextKind = getDefaultOrderWhatsappTemplateKind(data.order.status);
    setTemplateKind(nextKind);
    setBody(buildOrderWhatsappMessage(data, nextKind, orderUrl));
  }, [data, open, orderUrl]);

  const updateTemplate = (kind: OrderWhatsappTemplateKind) => {
    setTemplateKind(kind);
    setBody(buildOrderWhatsappMessage(data, kind, orderUrl));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>预览 WhatsApp 通知</DialogTitle>
          <DialogDescription>
            内容将以意大利语发送给客户。确认后会打开 WhatsApp，并记录到通知历史。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_1.3fr]">
            <div>
              <Label className="text-xs">通知类型</Label>
              <Select
                value={templateKind}
                onValueChange={(value) => updateTemplate(value as OrderWhatsappTemplateKind)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {orderWhatsappTemplateOptions.map((option) => (
                    <SelectItem key={option.kind} value={option.kind}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">WhatsApp</Label>
              <div className="mt-1 rounded-md border bg-surface-muted px-3 py-2 font-mono text-xs">
                {phone || "缺少电话号码"}
              </div>
            </div>
          </div>
          {transitionTo && (
            <div className="rounded-md border border-status-warn-foreground/20 bg-status-warn px-3 py-2 text-xs text-status-warn-foreground">
              确认发送后将同步流转为「{statusMeta[transitionTo].label}」。
            </div>
          )}
          <div>
            <Label className="text-xs">通知内容</Label>
            <Textarea
              rows={12}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 font-mono text-xs leading-relaxed"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={busy || !body.trim() || !canOpenWhatsApp}
            onClick={async () => {
              const url = buildWhatsAppUrl(phone, body.trim());
              if (!url || !canOpenWhatsApp) {
                toast.error("客户电话号码不可用于 WhatsApp");
                return;
              }
              window.open(url, "_blank", "noopener,noreferrer");
              await onConfirm({ body: body.trim(), templateKind, transitionTo });
              onOpenChange(false);
            }}
          >
            <Send className="mr-1.5 size-3.5" /> 确认并打开 WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
