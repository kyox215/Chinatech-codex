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
import { useLocale } from "@/shared/i18n/locale-provider";

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
  const { t } = useLocale();
  const [selected, setSelected] = useState<string[]>(() => data.tags.map((tag) => tag.id));
  const allTags = useMemo(() => {
    const known = new Map<string, CustomerTag>();
    data.tags.forEach((tag) => known.set(tag.id, tag));
    const defaults: CustomerTag[] = [
      { id: "tag_vip", name: "VIP", color: "var(--primary)" },
      {
        id: "tag_repeat",
        name: t("customers.form.tagRepeat"),
        color: "var(--status-success-foreground)",
      },
      {
        id: "tag_business",
        name: t("customers.form.tagBusiness"),
        color: "var(--status-info-foreground)",
      },
      {
        id: "tag_price_sensitive",
        name: t("customers.form.tagPriceSensitive"),
        color: "var(--status-warn-foreground)",
      },
      {
        id: "tag_followup",
        name: t("customers.form.tagFollowup"),
        color: "var(--status-danger-foreground)",
      },
    ];
    defaults.forEach((tag) => {
      if (!known.has(tag.id)) known.set(tag.id, tag);
    });
    return Array.from(known.values());
  }, [data.tags, t]);
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
      <DialogContent
        closeLabel={t("customers.detail.close")}
        className={componentOverlay.formContent}
      >
        <DialogHeader className={componentOverlay.header}>
          <DialogTitle className={componentOverlay.title}>
            {t("customers.form.tagsTitle")}
          </DialogTitle>
          <DialogDescription className={componentOverlay.description}>
            {t("customers.form.tagsDescription")}
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
                <span className="min-w-0 whitespace-normal break-words">{tag.name}</span>
              </RepairOsBusinessCard>
            );
          })}
        </div>
        <DialogFooter className={componentOverlay.footer}>
          <Button
            className="min-h-11 whitespace-normal lg:min-h-9"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            {t("customers.form.cancel")}
          </Button>
          <Button
            className="min-h-11 whitespace-normal lg:min-h-9"
            disabled={busy}
            onClick={() => void onSave(selected).catch(() => undefined)}
          >
            {busy ? t("customers.form.saving") : t("customers.form.saveTags")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
