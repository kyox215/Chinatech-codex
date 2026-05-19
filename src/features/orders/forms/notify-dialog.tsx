"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function NotifyDialog({
  open,
  onOpenChange,
  defaultBody,
  onSend,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultBody: string;
  onSend: (channel: "whatsapp" | "sms", body: string) => Promise<void>;
}) {
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [body, setBody] = useState(defaultBody);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setBody(defaultBody);
  }, [defaultBody, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>发送客户通知</DialogTitle>
          <DialogDescription>选择通道并编辑通知内容。</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            {(["whatsapp", "sms"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setChannel(c)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs transition-colors",
                  channel === c
                    ? "border-primary bg-primary/10 text-primary"
                    : "bg-surface hover:bg-accent",
                )}
              >
                {c === "whatsapp" ? "WhatsApp" : "短信"}
              </button>
            ))}
          </div>
          <div>
            <Label className="text-xs">通知内容</Label>
            <Textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 font-mono text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={busy || !body.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await onSend(channel, body.trim());
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Send className="mr-1.5 size-3.5" /> 发送
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
