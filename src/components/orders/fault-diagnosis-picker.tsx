"use client";

import { useState } from "react";
import {
  Battery,
  Camera,
  Check,
  ChevronDown,
  Cpu,
  Droplets,
  Mic,
  ScanLine,
  Settings,
  Smartphone,
  Volume2,
  Zap,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MAIN_REPAIR_SERVICE_OPTION_KEY,
  getRepairServiceCatalogItem,
  repairServiceCatalogGroups,
  repairServiceCatalogKey,
  resolveRepairServiceCatalogItem,
} from "@/entities/order/model/repair-service-catalog";
import { ensureOrderLineId } from "@/entities/order/model/order-line-identity";
import { componentOverlay, toneClasses } from "@/lib/component-patterns";
import type { FaultPriceItem } from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";
import { useTouchSafeDropdownTrigger } from "@/shared/lib/touch-safe-dropdown-trigger";

export interface SelectedFault extends FaultPriceItem {
  key: string;
  categoryKey: string;
  categoryLabel: string;
}

type FaultOption = {
  key: string;
  label: string;
  italian: string;
  price: number;
  kind: "repair" | "inspection";
};

type FaultGroup = {
  key: string;
  label: string;
  italian: string;
  icon: React.ComponentType<{ className?: string }>;
  repairOptions: FaultOption[];
  options: FaultOption[];
};

const MAIN_FAULT_OPTION_KEY = MAIN_REPAIR_SERVICE_OPTION_KEY;

function getMainFaultOption(group: FaultGroup): FaultOption {
  return {
    key: MAIN_FAULT_OPTION_KEY,
    label: group.label,
    italian: group.italian,
    price: 0,
    kind: "repair",
  };
}

function isMainFaultOption(option: FaultOption) {
  return option.key === MAIN_FAULT_OPTION_KEY;
}

const faultGroupIcons: Record<string, FaultGroup["icon"]> = {
  display: Smartphone,
  battery: Battery,
  charging: Zap,
  camera: Camera,
  liquid: Droplets,
  mainboard: Cpu,
  system: Settings,
  "back-cover": Smartphone,
  face: ScanLine,
  speaker: Volume2,
  microphone: Mic,
  button: Smartphone,
};
const faultGroups: FaultGroup[] = repairServiceCatalogGroups.map((group) => {
  const icon = faultGroupIcons[group.key];
  if (!icon) throw new Error(`Missing repair service category icon: ${group.key}`);
  const repairOptions = "repairOptions" in group ? group.repairOptions : [];
  return {
    ...group,
    icon,
    repairOptions: repairOptions.map((option) => ({ ...option, price: 0, kind: "repair" })),
    options: group.options.map((option) => ({
      ...option,
      price: 0,
      kind: "inspection",
    })),
  };
});

function faultKey(group: FaultGroup, option: FaultOption) {
  return `${group.key}:${option.key}`;
}

function mainFaultKey(group: FaultGroup) {
  return faultKey(group, getMainFaultOption(group));
}

function createFault(
  group: FaultGroup,
  option: FaultOption,
  preserve?: Pick<FaultPriceItem, "price" | "line_id">,
): SelectedFault {
  const catalogKey = repairServiceCatalogKey(group.key, option.key);
  const catalogItem = getRepairServiceCatalogItem(catalogKey);
  return {
    key: catalogKey,
    categoryKey: group.key,
    categoryLabel: group.label,
    line_id: ensureOrderLineId(preserve?.line_id),
    catalog_key: catalogKey,
    name:
      catalogItem?.name ??
      (isMainFaultOption(option) ? group.label : `${group.label} - ${option.label}`),
    price: preserve?.price ?? option.price,
    note: catalogItem?.italian ?? option.italian,
  };
}

export function normalizeFaultPrices(items: FaultPriceItem[]): SelectedFault[] {
  return items.map((item, index) => {
    const catalogItem = item.catalog_key
      ? resolveRepairServiceCatalogItem({
          catalogKey: item.catalog_key,
          name: item.name,
        })
      : undefined;
    if (catalogItem) {
      return {
        ...item,
        line_id: ensureOrderLineId(item.line_id),
        catalog_key: catalogItem.catalogKey,
        key: catalogItem.catalogKey,
        categoryKey: catalogItem.groupKey,
        categoryLabel: catalogItem.groupLabel,
        note: item.note ?? catalogItem.italian,
      };
    }

    const { catalog_key: _catalogKey, ...customItem } = item;
    return {
      ...customItem,
      line_id: ensureOrderLineId(item.line_id),
      key: `custom:${index}:${item.name}`,
      categoryKey: "custom",
      categoryLabel: "自定义",
    };
  });
}

export function toFaultPriceItems(items: SelectedFault[]): FaultPriceItem[] {
  return items.map(({ name, price, note, line_id, catalog_key }) => ({
    line_id: ensureOrderLineId(line_id),
    ...(catalog_key ? { catalog_key } : {}),
    name,
    price,
    ...(note?.trim() ? { note: note.trim() } : {}),
  }));
}

export function FaultDiagnosisPicker({
  selected,
  onChange,
  className,
  density = "default",
  appearance = "outlined",
  compactColumns = 3,
}: {
  selected: SelectedFault[];
  onChange: (items: SelectedFault[]) => void;
  className?: string;
  density?: "default" | "compact";
  appearance?: "outlined" | "quiet";
  compactColumns?: 3;
}) {
  const setGroupSelection = (group: FaultGroup, option: FaultOption) => {
    const key = faultKey(group, option);
    const active = selected.filter((item) => item.categoryKey === group.key);
    const existing = selected.find((item) => item.key === key);

    if (isMainFaultOption(option)) {
      const preserve = existing ?? active[0];
      onChange([
        ...selected.filter((item) => item.categoryKey !== group.key),
        createFault(group, option, preserve),
      ]);
      return;
    }

    if (existing) {
      onChange(selected.filter((item) => item.key !== key));
      return;
    }

    if (option.kind === "repair") {
      onChange([
        ...selected.filter((item) => item.categoryKey !== group.key),
        createFault(group, option, active[0]),
      ]);
      return;
    }

    const repairKeys = new Set([
      mainFaultKey(group),
      ...group.repairOptions.map((repairOption) => faultKey(group, repairOption)),
    ]);

    onChange([
      ...selected.filter((item) => item.categoryKey !== group.key || !repairKeys.has(item.key)),
      createFault(group, option),
    ]);
  };

  const clearGroup = (group: FaultGroup) => {
    onChange(selected.filter((item) => item.categoryKey !== group.key));
  };

  const toggleMainSelection = (group: FaultGroup) => {
    const active = selected.filter((item) => item.categoryKey === group.key);
    const mainKey = mainFaultKey(group);
    const mainOnly = active.length === 1 && active[0]?.key === mainKey;

    if (mainOnly) {
      clearGroup(group);
      return;
    }

    setGroupSelection(group, getMainFaultOption(group));
  };

  const compact = density === "compact";

  return (
    <div
      data-fault-diagnosis-picker="true"
      data-compact-columns={compact ? compactColumns : undefined}
      className={cn(
        "grid min-w-0",
        compact ? "grid-cols-3 gap-1.5" : "grid-cols-2 gap-1.5 sm:grid-cols-3",
        className,
      )}
    >
      {faultGroups.map((group) => (
        <FaultCategoryButton
          key={group.key}
          group={group}
          selected={selected}
          density={density}
          appearance={appearance}
          onMainToggle={() => toggleMainSelection(group)}
          onToggle={(option) => setGroupSelection(group, option)}
          onClear={() => clearGroup(group)}
        />
      ))}
    </div>
  );
}

function FaultCategoryButton({
  group,
  selected,
  density,
  appearance,
  onMainToggle,
  onToggle,
  onClear,
}: {
  group: FaultGroup;
  selected: SelectedFault[];
  density: "default" | "compact";
  appearance: "outlined" | "quiet";
  onMainToggle: () => void;
  onToggle: (option: FaultOption) => void;
  onClear: () => void;
}) {
  const active = selected.filter((item) => item.categoryKey === group.key);
  const Icon = group.icon;
  const compact = density === "compact";
  const compactLabel =
    {
      camera: "摄像",
      face: "面容",
      speaker: "扬声",
      microphone: "麦克",
    }[group.key] ?? group.label;
  const quiet = appearance === "quiet";
  const [open, setOpen] = useState(false);
  const [menuMode, setMenuMode] = useState<"repair" | "inspection">("repair");
  const touchSafeTrigger = useTouchSafeDropdownTrigger(setOpen);
  const inspectionKeys = new Set(group.options.map((option) => faultKey(group, option)));
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setMenuMode(active.some((item) => inspectionKeys.has(item.key)) ? "inspection" : "repair");
    }
    setOpen(nextOpen);
  };
  const visibleOptions = menuMode === "inspection" ? group.options : group.repairOptions;

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <div
        className={cn(
          "grid min-w-0 overflow-hidden border text-left transition-colors",
          compact && quiet
            ? "min-h-11 grid-cols-[minmax(0,1fr)_2.75rem] rounded-lg lg:min-h-10 lg:grid-cols-[minmax(0,1fr)_2rem]"
            : compact
              ? "min-h-11 grid-cols-[minmax(0,1fr)_2.75rem] rounded-lg lg:min-h-9 lg:grid-cols-[minmax(0,1fr)_2rem]"
              : "min-h-11 grid-cols-[minmax(0,1fr)_2.75rem] rounded-lg lg:min-h-10 lg:grid-cols-[minmax(0,1fr)_2rem]",
          quiet
            ? active.length
              ? "border-primary/35 bg-primary/10 text-primary ring-1 ring-inset ring-primary/10"
              : "border-[var(--border-panel)] bg-card text-foreground shadow-[var(--shadow-card)] hover:bg-accent/30"
            : active.length
              ? "border-primary/45 bg-primary/5 text-foreground ring-1 ring-inset ring-primary/10"
              : "border-[var(--border-panel)] bg-card hover:bg-accent",
        )}
      >
        <button
          type="button"
          aria-label={group.label}
          aria-pressed={active.length > 0}
          onClick={group.repairOptions.length > 0 ? () => setOpen(true) : onMainToggle}
          className={cn(
            "flex min-w-0 items-center text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            compact && quiet
              ? "min-h-11 gap-0.5 px-0.5 py-1 lg:min-h-10 lg:gap-1 lg:px-1"
              : compact
                ? "min-h-11 gap-0.5 px-0.5 py-1 lg:min-h-9 lg:gap-1 lg:px-1"
                : "min-h-11 gap-1.5 px-2 py-1.5 lg:min-h-10",
          )}
        >
          <Icon
            className={cn(
              compact && quiet
                ? "size-2 shrink-0 lg:size-3"
                : compact
                  ? "size-2 shrink-0 lg:size-3.5"
                  : "size-4 shrink-0",
              active.length ? "text-primary" : "text-muted-foreground",
            )}
          />
          <span className="min-w-0">
            <span
              className={cn(
                "block truncate font-medium",
                compact && quiet
                  ? "text-[10px] leading-4"
                  : compact
                    ? "text-[10px] leading-4"
                    : "text-[13px] leading-5",
              )}
            >
              {compact ? compactLabel : group.label}
            </span>
            {!compact && active.length > 1 && (
              <span className="block text-[11px] leading-3 text-primary/80">
                {active.length} 项
              </span>
            )}
          </span>
        </button>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`展开${group.label}细分选项`}
            className={cn(
              "grid h-full place-items-center border-l border-[var(--border-panel)] text-muted-foreground transition-colors [touch-action:pan-y] hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              "min-w-11 lg:min-w-8",
              quiet && "border-[var(--border-panel)] hover:bg-accent/30",
              active.length && "border-primary/20 text-primary/70 hover:text-primary",
            )}
            {...touchSafeTrigger}
          >
            <ChevronDown
              className={compact && quiet ? "size-4" : compact ? "size-3.5" : "size-4"}
            />
          </button>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent
        align="start"
        collisionPadding={12}
        side="top"
        sideOffset={6}
        className={cn(
          componentOverlay.popoverContent,
          "max-h-[min(18rem,calc(100dvh_-_var(--rd-overlay-avoid-bottom,0px)_-_1rem))] w-[min(16rem,calc(100vw-24px))] overflow-y-auto rounded-[var(--radius-lg)] p-1 shadow-[var(--shadow-card)]",
        )}
      >
        {menuMode === "inspection" && (
          <>
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setMenuMode("repair");
              }}
              className={cn(
                "gap-1.5 rounded-md px-2 py-1 outline-none",
                compact ? "min-h-9 text-xs" : "min-h-9 gap-2 px-2.5 py-1.5 text-[13px]",
              )}
            >
              <span
                className={cn(
                  "grid shrink-0 place-items-center rounded border border-[var(--border-panel)] bg-background text-muted-foreground",
                  compact ? "size-4" : "size-4",
                )}
              >
                <ChevronDown className="size-3 rotate-90" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate font-medium",
                    compact ? "text-xs leading-4" : "text-[13px] leading-5",
                  )}
                >
                  返回维修方案
                </span>
                <span
                  className={cn(
                    "block truncate text-muted-foreground",
                    compact ? "text-[10px] leading-3" : "text-[11px] leading-4",
                  )}
                >
                  Torna alle opzioni di riparazione
                </span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1.5" />
          </>
        )}
        {visibleOptions.map((option) => {
          const key = faultKey(group, option);
          const checked = active.some((item) => item.key === key);
          return (
            <DropdownMenuItem
              key={option.key}
              onSelect={(event) => {
                event.preventDefault();
                onToggle(option);
              }}
              className={cn(
                "gap-1.5 rounded-md px-2 py-1 outline-none",
                compact
                  ? "min-h-11 text-xs lg:min-h-9"
                  : "min-h-11 gap-2 px-2.5 py-1.5 text-[13px] lg:min-h-9",
                checked && "bg-primary/10 text-primary focus:bg-primary/10 focus:text-primary",
              )}
            >
              <span
                className={cn(
                  "grid shrink-0 place-items-center rounded border border-[var(--border-panel)] bg-background text-transparent",
                  compact ? "size-4" : "size-4",
                  checked && "border-primary bg-primary text-primary-foreground",
                )}
              >
                <Check className="size-3" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate font-medium",
                    compact ? "text-xs leading-4" : "text-[13px] leading-5",
                  )}
                >
                  {option.label}
                </span>
                <span
                  className={cn(
                    "block truncate text-muted-foreground",
                    compact ? "text-[10px] leading-3" : "text-[11px] leading-4",
                  )}
                >
                  {option.italian}
                </span>
              </span>
            </DropdownMenuItem>
          );
        })}
        {menuMode === "repair" && (
          <>
            {group.repairOptions.length > 0 && <DropdownMenuSeparator className="my-1.5" />}
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setMenuMode("inspection");
              }}
              className={cn(
                "gap-1.5 rounded-md px-2 py-1 outline-none",
                compact ? "min-h-9 text-xs" : "min-h-9 gap-2 px-2.5 py-1.5 text-[13px]",
              )}
            >
              <span
                className={cn(
                  "grid shrink-0 place-items-center rounded border border-[var(--border-panel)] bg-background text-muted-foreground",
                  compact ? "size-4" : "size-4",
                )}
              >
                <ChevronDown className="size-3" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate font-medium",
                    compact ? "text-xs leading-4" : "text-[13px] leading-5",
                  )}
                >
                  需要检查
                </span>
                <span
                  className={cn(
                    "block truncate text-muted-foreground",
                    compact ? "text-[10px] leading-3" : "text-[11px] leading-4",
                  )}
                >
                  Da verificare
                </span>
              </span>
            </DropdownMenuItem>
          </>
        )}
        {active.length > 0 && (
          <>
            <DropdownMenuSeparator className="my-1.5" />
            <DropdownMenuItem
              className={cn(
                "min-h-8 rounded-md px-2 py-1 text-xs",
                !compact && "min-h-9 px-2.5 text-[13px]",
                toneClasses.danger.foreground,
                "focus:bg-status-danger focus:text-status-danger-foreground",
              )}
              onSelect={(event) => {
                event.preventDefault();
                onClear();
              }}
            >
              取消选择
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
