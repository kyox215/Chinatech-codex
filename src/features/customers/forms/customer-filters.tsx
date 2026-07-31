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
  financeRedacted?: boolean;
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
  const advancedWork =
    filters.work === "with_devices" || filters.work === "repeat" ? filters.work : "all";
  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2 font-semibold">
          <Tags className="size-4" /> 更多筛选
        </div>
        <p className="mt-1 text-xs leading-4 text-muted-foreground">
          这里只放不常用的条件。常用的“处理中、待收款、要跟进”请直接点列表顶部。
        </p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3 sm:space-y-6 sm:p-4">
        <section>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">客户记录</div>
          <CustomerSegmented
            label="客户记录"
            value={advancedWork}
            options={[
              ["all", "不限"],
              ["with_devices", "有设备"],
              ["repeat", "老客户"],
            ]}
            onChange={(work) => onChange({ ...filters, work: work as CustomerListFilters["work"] })}
          />
        </section>
        <section>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">跟进时间</div>
          <CustomerSegmented
            label="跟进时间"
            value={filters.followup ?? "all"}
            options={[
              ["all", "不限"],
              ["due", "今天前要跟进"],
              ["overdue", "已经过期"],
            ]}
            onChange={(followup) =>
              onChange({ ...filters, followup: followup as CustomerListFilters["followup"] })
            }
          />
        </section>
        <section>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">联系许可</div>
          <CustomerSegmented
            label="联系许可"
            value={filters.marketing ?? "all"}
            options={[
              ["all", "不限"],
              ["allowed", "允许联系"],
              ["blocked", "勿主动联系"],
            ]}
            onChange={(marketing) =>
              onChange({ ...filters, marketing: marketing as CustomerListFilters["marketing"] })
            }
          />
        </section>
        <section>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">辅助标签</div>
          <div className="space-y-1.5">
            {tags.length ? (
              tags.map((tag) => (
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
              ))
            ) : (
              <p className="rounded-lg bg-[var(--surface-panel-muted)] px-3 py-2 text-xs text-muted-foreground">
                暂无辅助标签
              </p>
            )}
          </div>
        </section>
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 border-t p-3">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange({
              ...filters,
              work: filters.work === "active" || filters.work === "unpaid" ? filters.work : "all",
              followup: filters.followup === "due" ? "due" : "all",
              marketing: "all",
              tagIds: [],
            })
          }
        >
          清除更多条件
        </Button>
        <Button className="w-full" onClick={onClose}>
          应用筛选
        </Button>
      </div>
    </div>
  );
}

export function CustomerSegmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" aria-label={label}>
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={value === key}
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
