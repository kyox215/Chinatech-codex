"use client";

import { useId, useRef, useState } from "react";
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

import { useViewportMode } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import {
  localizeRepairServiceGroupCompactLabel,
  localizeRepairServiceGroupLabel,
  localizeRepairServiceOptionLabel,
} from "@/features/orders/model/order-i18n";
import { componentOverlay, toneClasses } from "@/lib/component-patterns";
import type { FaultPriceItem } from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
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
  compactColumns = 4,
}: {
  selected: SelectedFault[];
  onChange: (items: SelectedFault[]) => void;
  className?: string;
  density?: "default" | "compact";
  appearance?: "outlined" | "quiet";
  compactColumns?: 3 | 4;
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
        compact
          ? compactColumns === 4
            ? "auto-rows-fr grid-cols-4 gap-1"
            : "auto-rows-fr grid-cols-3 gap-1"
          : "grid-cols-2 gap-1.5 sm:grid-cols-3",
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
  const { locale, t } = useLocale();
  const active = selected.filter((item) => item.categoryKey === group.key);
  const Icon = group.icon;
  const compact = density === "compact";
  const groupLabel = localizeRepairServiceGroupLabel(group, locale);
  const compactLabel = localizeRepairServiceGroupCompactLabel(group, locale);
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

  if (compact)
    return (
      <CompactFaultCategory
        group={group}
        selected={selected}
        onMainToggle={onMainToggle}
        onToggle={onToggle}
        onClear={onClear}
      />
    );

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <div
        className={cn(
          "grid min-w-0 overflow-hidden border text-left transition-colors",
          compact && quiet
            ? "min-h-11 grid-cols-[minmax(0,1fr)_2.75rem] rounded-lg lg:min-h-11 lg:grid-cols-[minmax(0,1fr)_2rem]"
            : compact
              ? "min-h-11 grid-cols-[minmax(0,1fr)_2.75rem] rounded-lg lg:min-h-9 lg:grid-cols-[minmax(0,1fr)_2rem]"
              : "min-h-11 grid-cols-[minmax(0,1fr)_2.75rem] rounded-lg lg:min-h-10 lg:grid-cols-[minmax(0,1fr)_2rem]",
          quiet
            ? active.length
              ? "border-primary/35 bg-primary/10 text-primary ring-1 ring-inset ring-primary/10"
              : "border-[var(--border-panel)] bg-[var(--surface-panel-muted)]/40 text-foreground hover:bg-accent/30"
            : active.length
              ? "border-primary/45 bg-primary/5 text-foreground ring-1 ring-inset ring-primary/10"
              : "border-[var(--border-panel)] bg-card hover:bg-accent",
        )}
      >
        <button
          type="button"
          aria-label={groupLabel}
          aria-pressed={active.length > 0}
          onClick={group.repairOptions.length > 0 ? () => setOpen(true) : onMainToggle}
          className={cn(
            "flex min-w-0 items-center text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            compact && quiet
              ? "min-h-11 gap-1 px-1.5 py-1 lg:min-h-11 lg:gap-1 lg:px-1.5"
              : compact
                ? "min-h-11 gap-0.5 px-0.5 py-1 lg:min-h-9 lg:gap-1 lg:px-1"
                : "min-h-11 gap-1.5 px-2 py-1.5 lg:min-h-10",
          )}
        >
          {active.length > 0 && quiet ? (
            <Check className="size-3 shrink-0 text-primary" />
          ) : (
            <Icon
              className={cn(
                compact && quiet
                  ? "size-3 shrink-0"
                  : compact
                    ? "size-2 shrink-0 lg:size-3.5"
                    : "size-4 shrink-0",
                active.length ? "text-primary" : "text-muted-foreground",
              )}
            />
          )}
          <span className="min-w-0">
            <span
              className={cn(
                "block truncate font-medium",
                compact && quiet
                  ? "text-xs font-semibold leading-4"
                  : compact
                    ? "text-[10px] leading-4 lg:text-xs lg:leading-4"
                    : "text-[13px] leading-5 lg:text-[13px] lg:leading-5",
              )}
            >
              {compact ? compactLabel : groupLabel}
            </span>
            {!compact && active.length > 1 && (
              <span className="block text-[11px] leading-3 text-primary/80 lg:text-xs lg:leading-4">
                {t("orders2b1.new.itemsCount", { count: active.length })}
              </span>
            )}
          </span>
        </button>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("orders2b1.new.fault.expand", { label: groupLabel })}
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
          "max-h-[min(18rem,calc(100dvh_-_var(--rd-overlay-avoid-bottom,0px)_-_1rem))] w-[min(16rem,calc(100vw-24px))] overflow-y-auto rounded-[var(--radius-lg)] p-1.5 shadow-[var(--shadow-overlay)]",
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
                  {t("orders2b1.new.fault.back")}
                </span>
                <span
                  className={cn(
                    "block truncate text-muted-foreground",
                    compact
                      ? "text-[10px] leading-3 lg:text-xs lg:leading-4"
                      : "text-[11px] leading-4 lg:text-xs lg:leading-4",
                  )}
                >
                  {t("orders2b1.new.fault.backHelp")}
                </span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1.5" />
          </>
        )}
        {visibleOptions.map((option) => {
          const key = faultKey(group, option);
          const checked = active.some((item) => item.key === key);
          const optionLabel = localizeRepairServiceOptionLabel(group.key, option, locale);
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
                  ? "min-h-11 text-[13px] lg:min-h-11"
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
                  {optionLabel}
                </span>
                {optionLabel.trim() !== option.italian.trim() ? (
                  <span className="block truncate text-[11px] leading-4 text-muted-foreground">
                    {option.italian}
                  </span>
                ) : null}
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
                  {t("orders2b1.new.fault.inspect")}
                </span>
                <span
                  className={cn(
                    "block truncate text-muted-foreground",
                    compact
                      ? "text-[10px] leading-3 lg:text-xs lg:leading-4"
                      : "text-[11px] leading-4 lg:text-xs lg:leading-4",
                  )}
                >
                  {t("orders2b1.new.fault.inspectHelp")}
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
              {t("orders2b1.new.fault.clear")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CompactFaultCategory({
  group,
  selected,
  onMainToggle,
  onToggle,
  onClear,
}: {
  group: FaultGroup;
  selected: SelectedFault[];
  onMainToggle: () => void;
  onToggle: (option: FaultOption) => void;
  onClear: () => void;
}) {
  const { locale, t } = useLocale();
  const viewport = useViewportMode();
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [inspection, setInspection] = useState(false);
  const active = selected.filter((item) => item.categoryKey === group.key);
  const label = localizeRepairServiceGroupLabel(group, locale);
  const Icon = group.icon;
  const changeOpen = (next: boolean) => {
    if (next) {
      setDesktop(viewport === "desktop");
      setInspection(
        !group.repairOptions.length ||
          active.some((item) =>
            group.options.some((option) => faultKey(group, option) === item.key),
          ),
      );
    }
    setOpen(next);
  };
  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      aria-label={t("orders2b1.new.fault.expand", { label })}
      aria-expanded={open}
      aria-controls={open ? id : undefined}
      aria-haspopup="dialog"
      data-fault-category-expand={group.key}
      onClick={() => changeOpen(true)}
      className="grid min-h-[34px] min-w-0 self-stretch place-items-center border-l border-[var(--border-panel)] hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ChevronDown className="size-3" aria-hidden="true" />
    </button>
  );
  const options = inspection || !group.repairOptions.length ? group.options : group.repairOptions;
  const body = (
    <div
      id={id}
      className="grid max-h-[60dvh] min-w-0 gap-1 overflow-y-auto overscroll-contain p-2"
    >
      {group.repairOptions.length > 0 ? (
        <button
          type="button"
          className="min-h-11 rounded-md border px-3 text-left text-sm"
          onClick={() => setInspection((value) => !value)}
        >
          {t(inspection ? "orders2b1.new.fault.back" : "orders2b1.new.fault.inspect")}
        </button>
      ) : null}
      <div
        role="group"
        aria-label={label}
        className="grid min-w-0 gap-1"
        onKeyDown={(event) => {
          if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
          const buttons = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
          );
          const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? buttons.length - 1
                : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) %
                  buttons.length;
          event.preventDefault();
          buttons[next]?.focus();
        }}
      >
        {options.map((option) => {
          const checked = active.some((item) => item.key === faultKey(group, option));
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={checked}
              className={cn(
                "flex min-h-11 min-w-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm focus-visible:ring-2 focus-visible:ring-ring",
                checked ? "bg-primary/10 text-primary" : "hover:bg-accent",
              )}
              onClick={() => {
                onToggle(option);
                if (!inspection) setOpen(false);
              }}
            >
              <Check
                aria-hidden="true"
                className={cn("size-4 shrink-0", !checked && "opacity-0")}
              />
              <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">
                {localizeRepairServiceOptionLabel(group.key, option, locale)}
              </span>
            </button>
          );
        })}
      </div>
      {active.length ? (
        <button
          type="button"
          className="min-h-11 rounded-md px-3 text-left text-sm text-destructive"
          onClick={() => {
            onClear();
            setOpen(false);
          }}
        >
          {t("orders2b1.new.fault.clear")}
        </button>
      ) : null}
    </div>
  );
  return (
    <>
      <Popover open={open && desktop} onOpenChange={changeOpen}>
        <div
          data-fault-category={group.key}
          className={cn(
            "grid h-9 min-w-0 grid-cols-[minmax(0,2fr)_minmax(0,1fr)] overflow-hidden rounded-md border",
            active.length
              ? "border-primary/35 bg-primary/10 text-primary"
              : "border-[var(--border-panel)] bg-[var(--surface-panel-muted)] text-foreground",
          )}
        >
          <button
            type="button"
            aria-label={label}
            aria-pressed={active.length > 0}
            onClick={onMainToggle}
            className="flex min-h-[34px] min-w-0 items-center gap-0.5 px-0.5 py-1.5 text-left text-[11px] font-medium leading-[14px] hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-[390px]:text-xs min-[390px]:leading-[14px]"
          >
            {active.length ? (
              <Check
                className={cn("size-3 shrink-0", locale !== "zh-CN" && "max-[430px]:hidden")}
                aria-hidden="true"
              />
            ) : (
              <Icon
                className={cn("size-3 shrink-0", locale !== "zh-CN" && "max-[430px]:hidden")}
                aria-hidden="true"
              />
            )}
            <span className="min-w-0 truncate">
              {localizeRepairServiceGroupCompactLabel(group, locale)}
            </span>
          </button>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        </div>
        <PopoverContent align="start" className="z-[90] w-72 p-0" aria-label={label}>
          <p className="px-3 pt-3 text-sm font-semibold">{label}</p>
          {body}
        </PopoverContent>
      </Popover>
      <Sheet open={open && !desktop} onOpenChange={changeOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[80dvh] rounded-t-xl p-0"
          closeLabel={t("common.cancel")}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus({ preventScroll: true });
          }}
        >
          <SheetHeader className="px-3 py-3 text-left">
            <SheetTitle>{label}</SheetTitle>
            <SheetDescription className="sr-only">
              {t("orders2b1.new.fault.inspectHelp")}
            </SheetDescription>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    </>
  );
}
