"use client";

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
import { componentOverlay, toneClasses } from "@/lib/component-patterns";
import type { FaultPriceItem } from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";

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
};

type FaultGroup = {
  key: string;
  label: string;
  italian: string;
  icon: React.ComponentType<{ className?: string }>;
  options: FaultOption[];
};

const faultGroups: FaultGroup[] = [
  {
    key: "display",
    label: "屏幕",
    italian: "Display",
    icon: Smartphone,
    options: [
      { key: "unspecified", label: "不细分", italian: "Display", price: 0 },
      { key: "glass", label: "外屏碎裂", italian: "Vetro esterno rotto", price: 0 },
      { key: "lcd", label: "内屏漏液", italian: "LCD danneggiato", price: 0 },
      { key: "touch", label: "触摸失灵", italian: "Touch non funzionante", price: 0 },
    ],
  },
  {
    key: "battery",
    label: "电池",
    italian: "Batteria",
    icon: Battery,
    options: [
      { key: "unspecified", label: "不细分", italian: "Batteria", price: 0 },
      { key: "health", label: "健康度低", italian: "Salute batteria bassa", price: 0 },
      { key: "drain", label: "耗电快", italian: "Consumo rapido", price: 0 },
      { key: "swollen", label: "鼓包", italian: "Batteria gonfia", price: 0 },
    ],
  },
  {
    key: "charging",
    label: "尾插",
    italian: "Connettore di ricarica",
    icon: Zap,
    options: [
      { key: "unspecified", label: "不细分", italian: "Connettore di ricarica", price: 0 },
      { key: "loose", label: "接口松动", italian: "Porta allentata", price: 0 },
      { key: "no-charge", label: "无法充电", italian: "Non carica", price: 0 },
      { key: "clean", label: "清洁尾插", italian: "Pulizia connettore", price: 0 },
    ],
  },
  {
    key: "camera",
    label: "摄像头",
    italian: "Fotocamera",
    icon: Camera,
    options: [
      { key: "unspecified", label: "不细分", italian: "Fotocamera", price: 0 },
      { key: "front", label: "前摄异常", italian: "Fotocamera frontale", price: 0 },
      { key: "rear", label: "后摄异常", italian: "Fotocamera posteriore", price: 0 },
      { key: "lens", label: "镜头破损", italian: "Lente danneggiata", price: 0 },
    ],
  },
  {
    key: "liquid",
    label: "进水",
    italian: "Danni da liquido",
    icon: Droplets,
    options: [
      { key: "unspecified", label: "不细分", italian: "Danni da liquido", price: 0 },
      { key: "cleaning", label: "清洁检测", italian: "Pulizia e diagnosi", price: 0 },
      { key: "corrosion", label: "主板腐蚀", italian: "Ossidazione scheda", price: 0 },
    ],
  },
  {
    key: "mainboard",
    label: "主板",
    italian: "Scheda madre",
    icon: Cpu,
    options: [
      { key: "unspecified", label: "不细分", italian: "Scheda madre", price: 0 },
      { key: "no-power", label: "不开机", italian: "Non si accende", price: 0 },
      { key: "baseband", label: "无服务", italian: "Nessun servizio", price: 0 },
      { key: "short", label: "短路", italian: "Corto circuito", price: 0 },
    ],
  },
  {
    key: "system",
    label: "系统",
    italian: "Sistema",
    icon: Settings,
    options: [
      { key: "unspecified", label: "不细分", italian: "Sistema", price: 0 },
      { key: "restore", label: "刷机恢复", italian: "Ripristino software", price: 0 },
      { key: "data", label: "资料迁移", italian: "Trasferimento dati", price: 0 },
      { key: "account", label: "账户问题", italian: "Problema account", price: 0 },
    ],
  },
  {
    key: "back-cover",
    label: "后盖",
    italian: "Cover posteriore",
    icon: Smartphone,
    options: [
      { key: "unspecified", label: "不细分", italian: "Cover posteriore", price: 0 },
      { key: "glass", label: "玻璃破裂", italian: "Vetro posteriore rotto", price: 0 },
      { key: "frame", label: "中框变形", italian: "Telaio deformato", price: 0 },
    ],
  },
  {
    key: "face",
    label: "面容/指纹",
    italian: "Face ID / Impronta",
    icon: ScanLine,
    options: [
      { key: "unspecified", label: "不细分", italian: "Face ID / Impronta", price: 0 },
      { key: "face-id", label: "面容异常", italian: "Face ID non funzionante", price: 0 },
      { key: "fingerprint", label: "指纹异常", italian: "Impronta non funzionante", price: 0 },
    ],
  },
  {
    key: "speaker",
    label: "扬声器",
    italian: "Altoparlante",
    icon: Volume2,
    options: [
      { key: "unspecified", label: "不细分", italian: "Altoparlante", price: 0 },
      { key: "low", label: "声音小", italian: "Volume basso", price: 0 },
      { key: "noise", label: "杂音", italian: "Rumore", price: 0 },
    ],
  },
  {
    key: "microphone",
    label: "麦克风",
    italian: "Microfono",
    icon: Mic,
    options: [
      { key: "unspecified", label: "不细分", italian: "Microfono", price: 0 },
      { key: "no-sound", label: "无声", italian: "Audio assente", price: 0 },
      { key: "noise", label: "通话杂音", italian: "Rumore in chiamata", price: 0 },
    ],
  },
  {
    key: "button",
    label: "按键",
    italian: "Tasti",
    icon: Smartphone,
    options: [
      { key: "unspecified", label: "不细分", italian: "Tasti", price: 0 },
      { key: "power", label: "电源键", italian: "Tasto accensione", price: 0 },
      { key: "volume", label: "音量键", italian: "Tasti volume", price: 0 },
      { key: "silent", label: "静音键", italian: "Tasto silenzioso", price: 0 },
    ],
  },
];

function faultKey(group: FaultGroup, option: FaultOption) {
  return `${group.key}:${option.key}`;
}

function createFault(
  group: FaultGroup,
  option: FaultOption,
  preserve?: Pick<FaultPriceItem, "price">,
): SelectedFault {
  return {
    key: faultKey(group, option),
    categoryKey: group.key,
    categoryLabel: group.label,
    name: option.key === "unspecified" ? group.label : `${group.label} - ${option.label}`,
    price: preserve?.price ?? option.price,
    note: option.italian,
  };
}

export function normalizeFaultPrices(items: FaultPriceItem[]): SelectedFault[] {
  return items.map((item, index) => {
    for (const group of faultGroups) {
      for (const option of group.options) {
        const name =
          option.key === "unspecified" ? group.label : `${group.label} - ${option.label}`;
        if (item.name === name) {
          return {
            ...item,
            key: faultKey(group, option),
            categoryKey: group.key,
            categoryLabel: group.label,
            note: item.note ?? option.italian,
          };
        }
      }
    }

    return {
      ...item,
      key: `custom:${index}:${item.name}`,
      categoryKey: "custom",
      categoryLabel: "自定义",
    };
  });
}

export function toFaultPriceItems(items: SelectedFault[]): FaultPriceItem[] {
  return items.map(({ name, price, note }) => ({
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
}: {
  selected: SelectedFault[];
  onChange: (items: SelectedFault[]) => void;
  className?: string;
  density?: "default" | "compact";
}) {
  const setGroupSelection = (group: FaultGroup, option: FaultOption) => {
    const key = faultKey(group, option);
    const active = selected.filter((item) => item.categoryKey === group.key);
    const existing = selected.find((item) => item.key === key);

    if (option.key === "unspecified") {
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

    onChange([
      ...selected.filter((item) => item.key !== faultKey(group, group.options[0])),
      createFault(group, option),
    ]);
  };

  const clearGroup = (group: FaultGroup) => {
    onChange(selected.filter((item) => item.categoryKey !== group.key));
  };

  const toggleMainSelection = (group: FaultGroup) => {
    const active = selected.filter((item) => item.categoryKey === group.key);
    const mainKey = faultKey(group, group.options[0]);
    const mainOnly = active.length === 1 && active[0]?.key === mainKey;

    if (mainOnly) {
      clearGroup(group);
      return;
    }

    setGroupSelection(group, group.options[0]);
  };

  const compact = density === "compact";

  return (
    <div
      className={cn(
        "grid min-w-0 gap-1.5",
        compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3",
        className,
      )}
    >
      {faultGroups.map((group) => (
        <FaultCategoryButton
          key={group.key}
          group={group}
          selected={selected}
          density={density}
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
  onMainToggle,
  onToggle,
  onClear,
}: {
  group: FaultGroup;
  selected: SelectedFault[];
  density: "default" | "compact";
  onMainToggle: () => void;
  onToggle: (option: FaultOption) => void;
  onClear: () => void;
}) {
  const active = selected.filter((item) => item.categoryKey === group.key);
  const Icon = group.icon;
  const compact = density === "compact";

  return (
    <DropdownMenu>
      <div
        className={cn(
          "grid min-w-0 overflow-hidden rounded-lg border text-left transition-colors",
          compact
            ? "min-h-8 grid-cols-[minmax(0,1fr)_1.65rem]"
            : "min-h-10 grid-cols-[minmax(0,1fr)_2rem]",
          active.length
            ? "border-primary bg-primary/10 text-primary"
            : "border-border/70 bg-surface hover:bg-accent",
        )}
      >
        <button
          type="button"
          aria-pressed={active.length > 0}
          onClick={onMainToggle}
          className={cn(
            "flex min-w-0 items-center gap-1.5 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            compact ? "min-h-8 px-1.5 py-1" : "min-h-10 px-2 py-1.5",
          )}
        >
          <Icon className={compact ? "size-3.5 shrink-0" : "size-4 shrink-0"} />
          <span className="min-w-0">
            <span
              className={cn(
                "block truncate font-medium",
                compact ? "text-[11px] leading-4" : "text-[13px] leading-5",
              )}
            >
              {group.label}
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
              "grid h-full place-items-center border-l border-border/60 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              active.length && "border-primary/20 text-primary/75 hover:text-primary",
            )}
          >
            <ChevronDown className={compact ? "size-3.5" : "size-4"} />
          </button>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent
        align="start"
        collisionPadding={12}
        className={cn(
          componentOverlay.popoverContent,
          "w-[min(16rem,calc(100vw-24px))] rounded-[var(--radius-lg)] p-1 shadow-[var(--shadow-card)]",
        )}
      >
        {group.options.map((option) => {
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
                compact ? "min-h-8 text-xs" : "min-h-9 gap-2 px-2.5 py-1.5 text-[13px]",
                checked && "bg-primary/10 text-primary focus:bg-primary/10 focus:text-primary",
              )}
            >
              <span
                className={cn(
                  "grid shrink-0 place-items-center rounded border border-[var(--border-panel)] bg-background text-transparent",
                  compact ? "size-3.5" : "size-4",
                  checked && "border-primary bg-primary text-primary-foreground",
                )}
              >
                <Check className={compact ? "size-2.5" : "size-3"} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate font-medium",
                    compact ? "text-[11px] leading-4" : "text-[13px] leading-5",
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
