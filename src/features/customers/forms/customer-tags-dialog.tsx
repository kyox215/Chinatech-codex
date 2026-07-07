"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { RepairOsBusinessCard } from "@/shared/ui";
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
      { id: "tag_followup", name: "需联系", color: "var(--status-danger-foreground)" },
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
            标签会用于客户筛选、售后跟进和客户服务分组。
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-2">
          {allTags.map((tag) => {
            const isSelected = selected.includes(tag.id);
            return (
              <RepairOsBusinessCard
                key={tag.id}
                as="label"
                leading={
                  <>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(tag.id)}
                      className="peer sr-only"
                    />
                    <span
                      className={cn(
                        "grid size-4 shrink-0 place-content-center rounded-sm border border-primary shadow transition-colors peer-focus-visible:outline-none peer-focus-visible:ring-1 peer-focus-visible:ring-ring",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-transparent",
                      )}
                      aria-hidden="true"
                    >
                      <Check className="size-4" />
                    </span>
                  </>
                }
                leadingClassName="grid place-items-center"
                className={cn(
                  repairOs.businessCardDense,
                  "cursor-pointer select-none items-center text-sm",
                )}
                bodyClassName="flex min-w-0 items-center gap-2"
              >
                <span className="size-2.5 rounded-full" style={{ background: tag.color }} />
                <span className="min-w-0 truncate">{tag.name}</span>
              </RepairOsBusinessCard>
            );
          })}
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
