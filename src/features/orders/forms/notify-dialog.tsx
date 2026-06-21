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
import { componentOverlay } from "@/lib/component-patterns";
import type { OrderDetail, OrderWhatsappTemplateKind, OrderWorkflow } from "@/lib/repairdesk/api";
import { getWorkflowStatusLabel } from "@/features/orders/model/order-workflow";
import {
  buildOrderWhatsappMessage,
  buildWhatsAppUrl,
  getDefaultOrderWhatsappTemplateKind,
  getOrderWhatsappTransition,
  orderWhatsappTemplateOptions,
  replaceOrderWhatsappRecipientPhone,
} from "@/features/orders/model/order-message-templates";
import { getOrderContactPhoneOptions } from "@/features/orders/model/order-contact-phones";

export function NotifyDialog({
  open,
  onOpenChange,
  data,
  workflow,
  orderUrl,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: OrderDetail;
  workflow?: OrderWorkflow;
  orderUrl: string;
  busy: boolean;
  onConfirm: (input: {
    body: string;
    templateKind: OrderWhatsappTemplateKind;
    recipientPhone?: string;
    transitionTo?: OrderDetail["order"]["status"];
  }) => Promise<unknown>;
}) {
  const defaultKind = getDefaultOrderWhatsappTemplateKind(data.order.status);
  const phoneOptions = getOrderContactPhoneOptions(data);
  const defaultPhone = phoneOptions[0] ?? "";
  const [templateKind, setTemplateKind] = useState<OrderWhatsappTemplateKind>(defaultKind);
  const [body, setBody] = useState(() =>
    buildOrderWhatsappMessage(data, defaultKind, orderUrl, { recipientPhone: defaultPhone }),
  );
  const [phone, setPhone] = useState(defaultPhone);
  const canOpenWhatsApp = Boolean(phone.replace(/\D/g, ""));
  const transitionTo = getOrderWhatsappTransition(data.order.status, templateKind);

  useEffect(() => {
    if (!open) return;
    const nextKind = getDefaultOrderWhatsappTemplateKind(data.order.status);
    const nextPhone = getOrderContactPhoneOptions(data)[0] ?? "";
    setTemplateKind(nextKind);
    setBody(buildOrderWhatsappMessage(data, nextKind, orderUrl, { recipientPhone: nextPhone }));
    setPhone(nextPhone);
  }, [data, open, orderUrl]);

  const updateTemplate = (kind: OrderWhatsappTemplateKind) => {
    setTemplateKind(kind);
    setBody(buildOrderWhatsappMessage(data, kind, orderUrl, { recipientPhone: phone }));
  };

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
          <DialogTitle>预览 WhatsApp 通知</DialogTitle>
          <DialogDescription className="text-xs">
            内容将以意大利语发送给客户。确认后会打开 WhatsApp，并记录到通知历史。
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 min-w-0 overflow-y-auto p-3 sm:p-4">
          <div className="grid min-w-0 gap-2 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-2 sm:grid-cols-[1fr_1.25fr]">
            <div className="min-w-0">
              <Label className="text-xs">通知类型</Label>
              <Select
                value={templateKind}
                onValueChange={(value) => updateTemplate(value as OrderWhatsappTemplateKind)}
              >
                <SelectTrigger className="mt-1 h-8 text-xs">
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
            <div className="min-w-0">
              <Label className="text-xs">WhatsApp</Label>
              {phoneOptions.length > 1 ? (
                <Select value={phone} onValueChange={updatePhone}>
                  <SelectTrigger className="mt-1 h-8 font-mono text-xs">
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
                <div className="mt-1 flex h-8 min-w-0 items-center truncate rounded-md border bg-surface-muted px-2 font-mono text-xs">
                  {phone || "缺少电话号码"}
                </div>
              )}
            </div>
          </div>
          {transitionTo && (
            <div className="mt-2 rounded-md border border-status-warn-foreground/20 bg-status-warn px-2 py-1.5 text-xs text-status-warn-foreground">
              确认发送后将同步流转为「{getWorkflowStatusLabel(workflow, transitionTo)}」。
            </div>
          )}
          <div className="mt-2">
            <Label className="text-xs">通知内容</Label>
            <Textarea
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 min-h-[260px] resize-none font-mono text-xs leading-relaxed"
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
              if (!url || !canOpenWhatsApp) {
                toast.error("客户电话号码不可用于 WhatsApp");
                return;
              }
              window.open(url, "_blank", "noopener,noreferrer");
              await onConfirm({
                body: body.trim(),
                templateKind,
                recipientPhone: phone.trim() || undefined,
                transitionTo,
              });
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
