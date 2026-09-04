"use client";

import { Tags } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { CustomerListFilters, CustomerTag } from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

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
  const { t } = useLocale();
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
          <Tags className="size-4" /> {t("customers.list.filters")}
        </div>
        <p className="mt-1 text-xs leading-4 text-muted-foreground">
          {t("customers.filters.description")}
        </p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3 sm:space-y-6 sm:p-4">
        <section>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">
            {t("customers.filters.records")}
          </div>
          <CustomerSegmented
            label={t("customers.filters.records")}
            value={advancedWork}
            options={[
              ["all", t("customers.filters.any")],
              ["with_devices", t("customers.filters.withDevices")],
              ["repeat", t("customers.filters.repeat")],
            ]}
            onChange={(work) => onChange({ ...filters, work: work as CustomerListFilters["work"] })}
          />
        </section>
        <section>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">
            {t("customers.filters.followupTime")}
          </div>
          <CustomerSegmented
            label={t("customers.filters.followupTime")}
            value={filters.followup ?? "all"}
            options={[
              ["all", t("customers.filters.any")],
              ["due", t("customers.filters.due")],
              ["overdue", t("customers.filters.overdue")],
            ]}
            onChange={(followup) =>
              onChange({ ...filters, followup: followup as CustomerListFilters["followup"] })
            }
          />
        </section>
        <section>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">
            {t("customers.filters.contactPermission")}
          </div>
          <CustomerSegmented
            label={t("customers.filters.contactPermission")}
            value={filters.marketing ?? "all"}
            options={[
              ["all", t("customers.filters.any")],
              ["allowed", t("customers.filters.allowed")],
              ["blocked", t("customers.filters.blocked")],
            ]}
            onChange={(marketing) =>
              onChange({ ...filters, marketing: marketing as CustomerListFilters["marketing"] })
            }
          />
        </section>
        <section>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">
            {t("customers.filters.tags")}
          </div>
          <div className="space-y-1.5">
            {tags.length ? (
              tags.map((tag) => (
                <label
                  key={tag.id}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
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
                {t("customers.filters.noTags")}
              </p>
            )}
          </div>
        </section>
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 border-t p-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 whitespace-normal"
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
          {t("customers.filters.clear")}
        </Button>
        <Button className="min-h-11 w-full whitespace-normal" onClick={onClose}>
          {t("customers.filters.apply")}
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
            "min-h-11 whitespace-normal break-words rounded-md border px-2 py-1 text-xs",
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
