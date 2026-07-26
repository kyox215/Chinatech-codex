"use client";

import { useMemo, useState } from "react";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type CatalogSelection = {
  value: string;
  fromCatalog: boolean;
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

const manualInputClass = "h-11 min-w-0 text-base sm:h-10 sm:text-sm";

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
    <div className="space-y-4">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <CatalogCombobox
          id="inventory-brand"
          label="品牌 *"
          value={brand}
          placeholder="搜索欧洲常见品牌"
          options={EU_PHONE_BRANDS.map((item) => ({
            value: item.name,
            keywords: item.aliases?.join(" "),
          }))}
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
          }))}
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
        <div className="space-y-4 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
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

function CatalogCombobox({
  id,
  label,
  value,
  placeholder,
  options,
  disabled,
  onSelect,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  options: Array<{ value: string; description?: string; keywords?: string }>;
  disabled?: boolean;
  onSelect: (selection: CatalogSelection) => void;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  function choose(selection: CatalogSelection) {
    onSelect(selection);
    setOpen(false);
    setQuery("");
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setQuery("");
  }

  const trigger = (
    <Button
      id={id}
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      disabled={disabled}
      className="h-11 w-full min-w-0 justify-between px-3 text-base font-normal sm:h-10 sm:text-sm"
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
      mobile={isMobile}
      onQueryChange={setQuery}
      onChoose={choose}
    />
  );

  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {isMobile ? (
        <Drawer
          open={open}
          onOpenChange={handleOpenChange}
          fixed
          handleOnly
          shouldScaleBackground={false}
          preventScrollRestoration
        >
          <DrawerTrigger asChild>{trigger}</DrawerTrigger>
          <DrawerContent
            data-inventory-catalog-picker="mobile"
            className="h-[min(32rem,calc(100dvh-8px))] max-h-[calc(100dvh-8px)] p-0"
          >
            <DrawerHeader className="relative shrink-0 gap-0.5 border-b border-[var(--border-panel)] px-4 pb-3 pt-2 text-left">
              <DrawerTitle className="pr-12 text-base">{label.replace("*", "").trim()}</DrawerTitle>
              <DrawerDescription className="pr-12 text-xs">{placeholder}</DrawerDescription>
              <DrawerClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`关闭${label.replace("*", "").trim()}选择`}
                  className="absolute right-2 top-1 size-11 rounded-full"
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
      <p className="text-[10px] leading-4 text-muted-foreground">
        <Search className="mr-1 inline size-3" /> 可搜索目录；找不到时可直接使用输入内容。
      </p>
    </div>
  );
}

function CatalogCommandPicker({
  value,
  query,
  placeholder,
  options,
  mobile,
  onQueryChange,
  onChoose,
}: {
  value: string;
  query: string;
  placeholder: string;
  options: Array<{ value: string; description?: string; keywords?: string }>;
  mobile: boolean;
  onQueryChange: (value: string) => void;
  onChoose: (selection: CatalogSelection) => void;
}) {
  const normalizedQuery = query.trim();
  const hasExactOption = options.some(
    (option) => option.value.toLocaleLowerCase() === normalizedQuery.toLocaleLowerCase(),
  );

  return (
    <Command
      shouldFilter
      className={cn(mobile && "h-auto min-h-0 flex-1 rounded-none")}
      data-inventory-catalog-command={mobile ? "mobile" : "desktop"}
    >
      <CommandInput
        value={query}
        onValueChange={onQueryChange}
        placeholder={placeholder}
        className="text-base sm:text-sm"
      />
      <CommandList
        data-inventory-catalog-list
        className={cn(
          "overscroll-contain [touch-action:pan-y] [-webkit-overflow-scrolling:touch]",
          mobile ? "min-h-0 max-h-none flex-1" : "max-h-[min(22rem,55svh)]",
        )}
      >
        <CommandEmpty className="px-3 py-4 text-left text-xs text-muted-foreground">
          未找到目录结果。可在下方使用当前文字手动录入。
        </CommandEmpty>
        <CommandGroup heading={`目录选项 · ${options.length}`}>
          {options.map((option) => (
            <CommandItem
              key={option.value}
              value={`${option.value} ${option.keywords ?? ""}`}
              onSelect={() => onChoose({ value: option.value, fromCatalog: true })}
              className="min-h-11"
            >
              <Check
                className={cn(
                  "size-4 shrink-0",
                  value === option.value ? "opacity-100" : "opacity-0",
                )}
              />
              <span className="min-w-0 flex-1 truncate">{option.value}</span>
              {option.description ? (
                <span className="shrink-0 text-xs text-muted-foreground">{option.description}</span>
              ) : null}
            </CommandItem>
          ))}
        </CommandGroup>
        {normalizedQuery && !hasExactOption ? (
          <CommandGroup heading="手动填写">
            <CommandItem
              value={`manual ${normalizedQuery}`}
              onSelect={() => onChoose({ value: normalizedQuery, fromCatalog: false })}
              className="min-h-11"
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
                "flex min-h-11 min-w-0 items-center justify-center rounded-lg border px-2 text-sm font-medium transition-colors",
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
        <p className="text-[10px] leading-4 text-muted-foreground">{emptyMessage}</p>
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
      <p className="text-[10px] leading-4 text-muted-foreground">
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
        <p className="text-[10px] leading-4 text-muted-foreground">
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
