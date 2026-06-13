"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { componentOverlay } from "@/lib/component-patterns";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import type { CustomerDetail, CustomerTag } from "@/lib/repairdesk/api";

export function CustomerTagsDialog({
  open,
  onOpenChange,
  data,
  busy,
  onSave,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data: CustomerDetail;
  busy: boolean;
  onSave: (ids: string[]) => Promise<unknown>;
}) {
  const [selected, setSelected] = useState<string[]>(() => data.tags.map((tag) => tag.id));
  const allTags = useMemo(() => {
    const known = new Map<string, CustomerTag>();
    data.tags.forEach((tag) => known.set(tag.id, tag));
    const defaults: CustomerTag[] = [
      { id: "tag_vip", name: "VIP", color: "var(--primary)" },
      { id: "tag_repeat", name: "复购", color: "var(--status-success-foreground)" },
      { id: "tag_business", name: "企业", color: "var(--status-info-foreground)" },
      { id: "tag_price_sensitive", name: "价格敏感", color: "var(--status-warn-foreground)" },
      { id: "tag_followup", name: "需回访", color: "var(--status-danger-foreground)" },
    ];
    defaults.forEach((tag) => {
      if (!known.has(tag.id)) known.set(tag.id, tag);
    });
    return Array.from(known.values());
  }, [data.tags]);
  useEffect(() => {
    if (open) setSelected(data.tags.map((tag) => tag.id));
  }, [data.tags, open]);

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={componentOverlay.formContent}>
        <DialogHeader className={componentOverlay.header}>
          <DialogTitle className={componentOverlay.title}>管理客户标签</DialogTitle>
          <DialogDescription className={componentOverlay.description}>
            标签会用于客户筛选和营销分群。
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-2">
          {allTags.map((tag) => (
            <label
              key={tag.id}
              className={cn(
                repairOs.businessCardDense,
                "grid-cols-[auto_auto_minmax(0,1fr)] cursor-pointer items-center gap-2 text-sm",
              )}
            >
              <Checkbox
                checked={selected.includes(tag.id)}
                onCheckedChange={() => toggle(tag.id)}
              />
              <span className="size-2.5 rounded-full" style={{ background: tag.color }} />
              <span className="min-w-0 truncate">{tag.name}</span>
            </label>
          ))}
        </div>
        <DialogFooter className={componentOverlay.footer}>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button disabled={busy} onClick={() => onSave(selected)}>
            {busy ? "保存中…" : "保存标签"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
