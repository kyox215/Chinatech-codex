"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Check, ChevronsUpDown, Palette, PencilLine, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  EU_PHONE_BRANDS,
  findEuPhoneBrand,
  findEuPhoneModel,
  listCurrentEuPhoneModels,
  phoneColorBackground,
  type PhoneColorOption,
} from "@/features/inventory/model/eu-phone-catalog";
import { useIsCompactWorkspace } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export type CatalogSelection = {
  value: string;
  fromCatalog: boolean;
  optionId?: string;
};

export type CatalogOption = {
  value: string;
  description?: string;
  keywords?: string;
  aliases?: readonly string[];
  group?: string;
  icon?: ReactNode;
};

export type CatalogPickerSurface = "page" | "dialog";

type CatalogCategoryCopy = {
  brandPlaceholder: string;
  brandHint: string;
  brandSearchPlaceholder: string;
  modelHint: string;
  modelSearchPlaceholder: string;
  storagePlaceholder: string;
};

/**
 * Category-specific copy belongs in one place so a game console can never
 * inherit a phone-only "Apple" example by accident.
 */
export const catalogCategoryCopy: Record<
  "phone" | "tablet" | "computer" | "game_console" | "other",
  CatalogCategoryCopy
> = {
  phone: {
    brandPlaceholder: "选择手机品牌",
    brandHint: "常见品牌：Apple、Samsung、小米",
    brandSearchPlaceholder: "搜索手机品牌或手动输入",
    modelHint: "先选品牌，再选择手机型号；未收录型号可手动填写。",
    modelSearchPlaceholder: "搜索手机型号或手动输入",
    storagePlaceholder: "例如 128 GB",
  },
  tablet: {
    brandPlaceholder: "选择平板品牌",
    brandHint: "常见品牌：Apple、Samsung、Lenovo",
    brandSearchPlaceholder: "搜索平板品牌或手动输入",
    modelHint: "先选品牌，再选择平板型号；未收录型号可手动填写。",
    modelSearchPlaceholder: "搜索平板型号或手动输入",
    storagePlaceholder: "例如 128 GB",
  },
  computer: {
    brandPlaceholder: "选择电脑品牌",
    brandHint: "常见品牌：Apple、Dell、Lenovo、HP",
    brandSearchPlaceholder: "搜索电脑品牌或手动输入",
    modelHint: "先选品牌，再选择电脑型号；未收录型号可手动填写。",
    modelSearchPlaceholder: "搜索电脑型号或手动输入",
    storagePlaceholder: "例如 512 GB SSD",
  },
  game_console: {
    brandPlaceholder: "选择游戏机品牌",
    brandHint: "常见品牌：PlayStation、Nintendo、Xbox",
    brandSearchPlaceholder: "搜索游戏机品牌或手动输入",
    modelHint: "先选品牌，再选择游戏机型号；未收录型号可手动填写。",
    modelSearchPlaceholder: "搜索游戏机型号或手动输入",
    storagePlaceholder: "例如 825 GB、1 TB",
  },
  other: {
    brandPlaceholder: "选择或输入品牌",
    brandHint: "目录外品牌可直接手动填写。",
    brandSearchPlaceholder: "搜索品牌或手动输入",
    modelHint: "可从目录选择型号，也可以直接手动填写商品名称。",
    modelSearchPlaceholder: "搜索型号或手动输入",
    storagePlaceholder: "例如 128 GB",
  },
};

type InventoryPhoneCatalogFieldsProps = {
  brand: string;
  model: string;
  ramCapacity?: string;
  storageCapacity?: string;
  color?: string;
  onBrandSelect: (selection: CatalogSelection) => void;
  onModelSelect: (selection: CatalogSelection) => void;
  onRamChange: (value: string) => void;
  onStorageChange: (value: string) => void;
  onColorChange: (value: string) => void;
};

const manualInputClass = "h-[38px] min-w-0 text-base sm:h-10 sm:text-sm";

export function InventoryPhoneCatalogFields({
  brand,
  model,
  ramCapacity,
  storageCapacity,
  color,
  onBrandSelect,
  onModelSelect,
  onRamChange,
  onStorageChange,
  onColorChange,
}: InventoryPhoneCatalogFieldsProps) {
  const selectedBrand = useMemo(() => findEuPhoneBrand(brand), [brand]);
  const modelOptions = useMemo(
    () => (selectedBrand ? listCurrentEuPhoneModels(selectedBrand.id) : []),
    [selectedBrand],
  );
  const selectedModel = useMemo(
    () => (selectedBrand ? findEuPhoneModel(selectedBrand.id, model) : undefined),
    [model, selectedBrand],
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <CatalogCombobox
          id="inventory-brand"
          label="品牌 *"
          value={brand}
          placeholder="搜索欧洲常见品牌"
          options={EU_PHONE_BRANDS.map((item) => ({
            value: item.name,
            keywords: item.aliases?.join(" "),
            aliases: item.aliases,
          }))}
          maxLength={120}
          onSelect={onBrandSelect}
        />
        <CatalogCombobox
          id="inventory-model"
          label="型号 *"
          value={model}
          placeholder={selectedBrand ? `搜索 ${selectedBrand.name} 型号` : "请先选择品牌"}
          disabled={!selectedBrand}
          options={modelOptions.map((item) => ({
            value: item.name,
            description: item.releasedOn.slice(0, 4),
            keywords: item.aliases?.join(" "),
            aliases: item.aliases,
          }))}
          maxLength={160}
          onSelect={onModelSelect}
        />
      </div>

      {!selectedModel ? (
        <div className="rounded-xl border border-dashed border-[var(--border-panel)] p-3 text-xs leading-5 text-muted-foreground">
          {brand && model
            ? "当前品牌或型号不在标准目录中，已保留手动填写值；仍可继续入库。"
            : "选择标准型号后，会显示该机型可用的内存、容量和颜色选项。"}
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-2.5 sm:space-y-4 sm:p-3">
          <div className="grid min-w-0 gap-2.5 sm:grid-cols-2 sm:gap-4">
            <SpecificationChoices
              id="inventory-ram"
              label="内存"
              value={ramCapacity ?? ""}
              options={selectedModel.ramOptions}
              emptyMessage={
                selectedBrand?.id === "apple"
                  ? "Apple 未在产品页公开 RAM，可留空或按可靠凭证手动填写。"
                  : "目录未收录内存，可手动填写。"
              }
              placeholder="例如 8 GB"
              onChange={onRamChange}
            />
            <SpecificationChoices
              id="inventory-storage"
              label="容量"
              value={storageCapacity ?? ""}
              options={selectedModel.storageOptions}
              emptyMessage="目录未收录容量，可手动填写。"
              placeholder="例如 256 GB"
              onChange={onStorageChange}
            />
          </div>

          <ColorChoices
            value={color ?? ""}
            options={selectedModel.colors}
            onChange={onColorChange}
          />
        </div>
      )}

      {!selectedModel && (brand || model) ? (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <ManualField
            id="inventory-ram"
            label="内存"
            value={ramCapacity ?? ""}
            placeholder="8 GB"
            onChange={onRamChange}
          />
          <ManualField
            id="inventory-storage"
            label="容量"
            value={storageCapacity ?? ""}
            placeholder="256 GB"
            onChange={onStorageChange}
          />
          <ManualField
            id="inventory-color"
            label="颜色"
            value={color ?? ""}
            placeholder="钛金属"
            onChange={onColorChange}
            className="sm:col-span-2"
          />
        </div>
      ) : null}
    </div>
  );
}

export function CatalogCombobox({
  id,
  label,
  value,
  placeholder,
  options,
  disabled,
  onSelect,
  onInputChange,
  editable = false,
  required = false,
  invalid = false,
  autoFocus = false,
  maxLength,
  surface = "page",
  helperText,
  searchPlaceholder,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  options: CatalogOption[];
  disabled?: boolean;
  onSelect: (selection: CatalogSelection) => void;
  onInputChange?: (value: string) => void;
  editable?: boolean;
  required?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  surface?: CatalogPickerSurface;
  helperText?: string;
  searchPlaceholder?: string;
}) {
  const useFixedPicker = useIsCompactWorkspace();
  const useInlinePicker = useFixedPicker && surface === "dialog";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchActive, setSearchActive] = useState(!useFixedPicker);
  const triggerRef = useRef<HTMLInputElement | HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const inlineCloseButtonRef = useRef<HTMLButtonElement>(null);
  const viewportMetrics = useVisualViewportMetrics(open && useFixedPicker && searchActive);
  const pickerId = `${id}-catalog-list`;

  useEffect(() => {
    if (!open) setSearchActive(!useFixedPicker);
  }, [open, useFixedPicker]);

  useEffect(() => {
    if (!open || !useInlinePicker) return;
    requestAnimationFrame(() => inlineCloseButtonRef.current?.focus({ preventScroll: true }));
  }, [open, useInlinePicker]);

  function focusTrigger() {
    queueMicrotask(() => triggerRef.current?.focus({ preventScroll: true }));
  }

  function choose(selection: CatalogSelection) {
    onSelect(selection);
    setOpen(false);
    setQuery("");
    setSearchActive(!useFixedPicker);
    searchInputRef.current?.blur();
    focusTrigger();
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    setQuery("");
    setSearchActive(!useFixedPicker);
    if (!nextOpen) {
      searchInputRef.current?.blur();
      focusTrigger();
    }
  }

  function openPicker() {
    setQuery("");
    setSearchActive(!useFixedPicker);
    setOpen(true);
  }

  function requestSearch() {
    setSearchActive(true);
    requestAnimationFrame(() => {
      window.setTimeout(() => searchInputRef.current?.focus({ preventScroll: true }), 0);
    });
  }

  function handleInlineKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      handleOpenChange(false);
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="option"]',
      ),
    ).filter((element) => element.getClientRects().length > 0 && element.tabIndex >= 0);
    if (!focusable.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  const compactTrigger = (
    <Button
      id={id}
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-controls={pickerId}
      aria-invalid={invalid || undefined}
      disabled={disabled}
      ref={(node) => {
        triggerRef.current = node;
      }}
      className="h-11 min-h-11 w-full min-w-0 justify-between px-3 text-base font-normal sm:text-sm"
      onClick={openPicker}
    >
      <span className={cn("min-w-0 truncate", !value && "text-muted-foreground")}>
        {value || placeholder}
      </span>
      <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
    </Button>
  );

  const trigger = useFixedPicker ? (
    compactTrigger
  ) : editable ? (
    <div className="relative min-w-0">
      <Input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={pickerId}
        aria-invalid={invalid || undefined}
        maxLength={maxLength}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        className="h-[38px] min-w-0 pr-10 text-base sm:h-10 sm:text-sm"
        ref={(node) => {
          triggerRef.current = node;
        }}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        onChange={(event) => onInputChange?.(event.target.value)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="打开目录选择器"
        title={label.replace("*", "").trim()}
        disabled={disabled}
        className="absolute right-0 top-0 size-[38px] rounded-l-none sm:size-10"
        onClick={openPicker}
      >
        <ChevronsUpDown className="size-4 opacity-60" />
      </Button>
    </div>
  ) : (
    <Button
      id={id}
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-controls={pickerId}
      disabled={disabled}
      ref={(node) => {
        triggerRef.current = node;
      }}
      className="h-[38px] w-full min-w-0 justify-between px-3 text-base font-normal sm:h-10 sm:text-sm"
      onClick={openPicker}
    >
      <span className={cn("min-w-0 truncate", !value && "text-muted-foreground")}>
        {value || placeholder}
      </span>
      <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
    </Button>
  );

  const picker = (
    <CatalogCommandPicker
      value={value}
      query={query}
      placeholder={placeholder}
      options={options}
      fixedSurface={useFixedPicker}
      maxLength={maxLength}
      searchActive={searchActive}
      searchInputRef={searchInputRef}
      listId={pickerId}
      searchPlaceholder={searchPlaceholder ?? placeholder}
      helperText={helperText}
      onQueryChange={setQuery}
      onRequestSearch={requestSearch}
      onChoose={choose}
    />
  );

  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {useInlinePicker ? (
        <div className="min-w-0" data-inventory-catalog-inline-host={id}>
          {trigger}
          {open ? (
            <div
              data-inventory-catalog-picker="inline"
              className="fixed inset-0 z-50 flex items-end bg-[var(--overlay-scrim)] p-2 sm:items-center sm:p-4"
              style={
                viewportMetrics
                  ? {
                      top: `${Math.max(0, viewportMetrics.offsetTop)}px`,
                      bottom: "auto",
                      height: `${viewportMetrics.height}px`,
                    }
                  : undefined
              }
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) handleOpenChange(false);
              }}
            >
              <section
                aria-label={`${label.replace("*", "").trim()}选择`}
                id={`${id}-catalog-panel`}
                className="flex h-[min(36rem,calc(100dvh-16px))] max-h-[calc(100dvh-16px)] min-h-0 w-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] shadow-[var(--shadow-overlay)] sm:mx-auto sm:max-w-xl"
                style={
                  viewportMetrics
                    ? {
                        height: `${Math.min(576, Math.max(320, viewportMetrics.height - 16))}px`,
                        maxHeight: `${Math.max(320, viewportMetrics.height - 16)}px`,
                      }
                    : undefined
                }
                onPointerDown={(event) => event.stopPropagation()}
                onKeyDownCapture={handleInlineKeyDown}
              >
                <header className="relative shrink-0 border-b border-[var(--border-panel)] px-3 pb-2 pt-3 text-left sm:px-4 sm:pb-3">
                  <h2 className="pr-12 text-base font-semibold">{label.replace("*", "").trim()}</h2>
                  <p className="pr-12 text-xs text-muted-foreground">{helperText ?? placeholder}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`关闭${label.replace("*", "").trim()}选择`}
                    className="absolute right-2 top-2 size-8 rounded-full"
                    ref={inlineCloseButtonRef}
                    onClick={() => handleOpenChange(false)}
                  >
                    <X className="size-4" />
                  </Button>
                </header>
                {picker}
              </section>
            </div>
          ) : null}
        </div>
      ) : useFixedPicker ? (
        <Drawer
          open={open}
          onOpenChange={handleOpenChange}
          autoFocus={false}
          fixed
          handleOnly
          shouldScaleBackground={false}
          preventScrollRestoration
        >
          <DrawerTrigger asChild>{trigger}</DrawerTrigger>
          <DrawerContent
            data-inventory-catalog-picker="mobile"
            className="h-[min(32rem,calc(100dvh-8px))] max-h-[calc(100dvh-8px)] overscroll-none p-0 md:inset-x-4 md:mx-auto md:max-w-2xl"
          >
            <DrawerHeader className="relative shrink-0 gap-0.5 border-b border-[var(--border-panel)] px-3 pb-2 pt-1.5 text-left sm:px-4 sm:pb-3 sm:pt-2">
              <DrawerTitle className="pr-12 text-base">{label.replace("*", "").trim()}</DrawerTitle>
              <DrawerDescription className="pr-12 text-xs">{placeholder}</DrawerDescription>
              <DrawerClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`关闭${label.replace("*", "").trim()}选择`}
                  className="absolute right-2 top-1 size-8 rounded-full"
                >
                  <X className="size-4" />
                </Button>
              </DrawerClose>
            </DrawerHeader>
            {picker}
          </DrawerContent>
        </Drawer>
      ) : (
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[min(28rem,calc(100vw-24px))] overflow-hidden p-0"
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            {picker}
          </PopoverContent>
        </Popover>
      )}
      <p className="text-[10px] leading-4 text-muted-foreground lg:text-[11px] lg:leading-4">
        <Search className="mr-1 inline size-3" />{" "}
        {helperText ?? "可搜索目录；找不到时可直接使用输入内容。"}
      </p>
    </div>
  );
}

function CatalogCommandPicker({
  value,
  query,
  placeholder,
  options,
  fixedSurface,
  maxLength,
  searchActive,
  searchInputRef,
  listId,
  searchPlaceholder,
  helperText,
  onQueryChange,
  onRequestSearch,
  onChoose,
}: {
  value: string;
  query: string;
  placeholder: string;
  options: CatalogOption[];
  fixedSurface: boolean;
  maxLength?: number;
  searchActive: boolean;
  searchInputRef: RefObject<HTMLInputElement | null>;
  listId: string;
  searchPlaceholder: string;
  helperText?: string;
  onQueryChange: (value: string) => void;
  onRequestSearch: () => void;
  onChoose: (selection: CatalogSelection) => void;
}) {
  const normalizedQuery = query.trim();
  const exactOptions = normalizedQuery
    ? options.filter((option) => hasExactCatalogMatch(option, normalizedQuery))
    : [];
  const visibleOptions = exactOptions.length ? exactOptions : options;
  const hasExactOption = exactOptions.length > 0;

  return (
    <Command
      shouldFilter={searchActive}
      className={cn(fixedSurface && "h-auto min-h-0 flex-1 rounded-none")}
      data-inventory-catalog-command={fixedSurface ? "mobile" : "desktop"}
    >
      {searchActive ? (
        <CommandInput
          ref={searchInputRef}
          data-inventory-catalog-search
          value={query}
          onValueChange={onQueryChange}
          placeholder={searchPlaceholder}
          aria-autocomplete="list"
          maxLength={maxLength}
          inputMode="search"
          enterKeyHint="search"
          className="text-base sm:text-sm"
        />
      ) : (
        <div className="shrink-0 border-b border-[var(--border-panel)] px-3 py-2 sm:px-4">
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11 w-full justify-start gap-2 text-xs font-medium"
            data-inventory-catalog-search-action
            onClick={onRequestSearch}
          >
            <Search className="size-4" />
            搜索目录或手动输入
          </Button>
          <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
            {helperText ?? "先浏览常用选项；需要时再搜索或录入目录外值。"}
          </p>
        </div>
      )}
      <CommandList
        id={listId}
        data-inventory-catalog-list
        className={cn(
          "overscroll-contain [touch-action:pan-y] [-webkit-overflow-scrolling:touch]",
          fixedSurface ? "min-h-0 max-h-none flex-1" : "max-h-[min(22rem,55svh)]",
        )}
      >
        <CommandEmpty className="px-3 py-2.5 text-left text-xs text-muted-foreground sm:py-4">
          未找到目录结果。可在下方使用当前文字手动录入。
        </CommandEmpty>
        {groupOptions(visibleOptions).map(([heading, groupedOptions]) => (
          <CommandGroup key={heading} heading={`${heading} · ${groupedOptions.length}`}>
            {groupedOptions.map((option) => (
              <CommandItem
                key={option.value}
                value={`${option.value} ${option.keywords ?? ""}`}
                onSelect={() => onChoose({ value: option.value, fromCatalog: true })}
                className="min-h-11 gap-2"
              >
                {option.icon ? (
                  <span
                    aria-hidden="true"
                    className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-[10px] font-semibold text-primary"
                  >
                    {option.icon}
                  </span>
                ) : null}
                <Check
                  className={cn(
                    "size-4 shrink-0",
                    value === option.value ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{option.value}</span>
                {option.description ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {option.description}
                  </span>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        {normalizedQuery && !hasExactOption ? (
          <CommandGroup heading="手动填写">
            <CommandItem
              value={`manual ${normalizedQuery}`}
              onSelect={() => onChoose({ value: normalizedQuery, fromCatalog: false })}
              className={fixedSurface ? "min-h-11" : "min-h-9"}
            >
              <PencilLine className="size-4 shrink-0" />
              <span className="min-w-0 break-words">使用“{normalizedQuery}”</span>
            </CommandItem>
          </CommandGroup>
        ) : null}
      </CommandList>
    </Command>
  );
}

function useVisualViewportMetrics(enabled: boolean) {
  const [metrics, setMetrics] = useState<{ height: number; offsetTop: number }>();

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !window.visualViewport) {
      setMetrics(undefined);
      return;
    }
    const viewport = window.visualViewport;
    const update = () =>
      setMetrics({
        height: viewport.height,
        offsetTop: viewport.offsetTop,
      });
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [enabled]);

  return metrics;
}

function hasExactCatalogMatch(option: CatalogOption, query: string) {
  const normalizedQuery = normalizeCatalogQuery(query);
  return [option.value, ...(option.aliases ?? [])].some(
    (value) => normalizeCatalogQuery(value) === normalizedQuery,
  );
}

function normalizeCatalogQuery(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[\s_\-/]+/g, " ");
}

function groupOptions(options: CatalogOption[]) {
  const groups = new Map<string, CatalogOption[]>();
  for (const option of options) {
    const heading = option.group ?? "目录选项";
    const current = groups.get(heading);
    if (current) current.push(option);
    else groups.set(heading, [option]);
  }
  return [...groups.entries()];
}

function SpecificationChoices({
  id,
  label,
  value,
  options,
  emptyMessage,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  emptyMessage: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const isManualValue = Boolean(value) && !options.includes(value);

  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      {options.length ? (
        <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={value === option}
              onClick={() => onChange(option)}
              className={cn(
                "flex min-h-8 min-w-0 items-center justify-center rounded-lg border px-2 text-xs font-medium transition-colors",
                value === option
                  ? "border-primary bg-accent text-primary"
                  : "border-[var(--border-panel)] bg-background hover:bg-accent/50",
              )}
            >
              <span className="truncate">{option}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[10px] leading-4 text-muted-foreground lg:text-[11px] lg:leading-4">
          {emptyMessage}
        </p>
      )}
      <Input
        id={id}
        className={manualInputClass}
        value={isManualValue ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`${placeholder}（其他/手动）`}
        aria-label={`${label}手动填写`}
      />
    </fieldset>
  );
}

function ColorChoices({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly PhoneColorOption[];
  onChange: (value: string) => void;
}) {
  const isManualValue = Boolean(value) && !options.some((option) => option.name === value);

  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="flex items-center gap-1.5 text-sm font-medium">
        <Palette className="size-4 text-primary" />
        颜色
      </legend>
      <p className="text-[10px] leading-4 text-muted-foreground lg:text-[11px] lg:leading-4">
        色块用于辨认外观，完整颜色名称会同时保存。
      </p>
      {options.length ? (
        <div
          role="radiogroup"
          aria-label="颜色"
          className="grid min-w-0 grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:grid-cols-3"
        >
          {options.map((option) => {
            const selected = value === option.name;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`颜色：${option.name}${selected ? "，已选择" : ""}`}
                onClick={() => onChange(option.name)}
                className={cn(
                  "flex min-h-12 min-w-0 items-center gap-2 rounded-lg border bg-background px-2.5 py-2 text-left text-xs font-medium transition-colors",
                  selected
                    ? "border-primary ring-1 ring-primary"
                    : "border-[var(--border-panel)] hover:bg-accent/50",
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-6 shrink-0 rounded-full border border-foreground/25 shadow-sm"
                  style={{ background: phoneColorBackground(option) }}
                />
                <span className="min-w-0 flex-1 break-words leading-4">{option.name}</span>
                <Check className={cn("size-4 shrink-0", selected ? "opacity-100" : "opacity-0")} />
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-[10px] leading-4 text-muted-foreground lg:text-[11px] lg:leading-4">
          目录未收录官方颜色，可手动填写。
        </p>
      )}
      <Input
        id="inventory-color"
        className={manualInputClass}
        value={isManualValue ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder="其他颜色（手动填写）"
        aria-label="颜色手动填写"
      />
    </fieldset>
  );
}

function ManualField({
  id,
  label,
  value,
  placeholder,
  onChange,
  className,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className={manualInputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`${placeholder}（手动）`}
      />
    </div>
  );
}
