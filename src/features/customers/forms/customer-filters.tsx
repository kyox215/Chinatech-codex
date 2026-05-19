"use client";

import { Tags } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { CustomerListFilters, CustomerTag } from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";

export function CustomerFilters({
  filters,
  tags,
  onChange,
  onClose,
}: {
  filters: CustomerListFilters;
  tags: CustomerTag[];
  onChange: (filters: CustomerListFilters) => void;
  onClose: () => void;
}) {
  const toggleTag = (tagId: string) => {
    const current = filters.tagIds ?? [];
    const next = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    onChange({ ...filters, tagIds: next });
  };
  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-2 font-semibold">
          <Tags className="size-4" /> 客户筛选
        </div>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <section>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">标签</div>
          <div className="space-y-1.5">
            {tags.map((tag) => (
              <label
                key={tag.id}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={filters.tagIds?.includes(tag.id) ?? false}
                  onCheckedChange={() => toggleTag(tag.id)}
                />
                <span className="size-2.5 rounded-full" style={{ background: tag.color }} />
                {tag.name}
              </label>
            ))}
          </div>
        </section>
        <section>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">营销状态</div>
          <CustomerSegmented
            value={filters.marketing ?? "all"}
            options={[
              ["all", "全部"],
              ["allowed", "可营销"],
              ["blocked", "不可营销"],
            ]}
            onChange={(marketing) =>
              onChange({ ...filters, marketing: marketing as CustomerListFilters["marketing"] })
            }
          />
        </section>
        <section>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">回访</div>
          <CustomerSegmented
            value={filters.followup ?? "all"}
            options={[
              ["all", "全部"],
              ["due", "今天到期"],
              ["overdue", "已逾期"],
            ]}
            onChange={(followup) =>
              onChange({ ...filters, followup: followup as CustomerListFilters["followup"] })
            }
          />
        </section>
      </div>
      <div className="border-t p-3">
        <Button className="w-full" onClick={onClose}>
          应用筛选
        </Button>
      </div>
    </div>
  );
}

export function CustomerSegmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            "rounded-md border px-2 py-1 text-xs",
            value === key
              ? "border-primary bg-primary/10 text-primary"
              : "bg-surface hover:bg-accent",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
