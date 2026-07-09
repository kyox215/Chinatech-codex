"use client";

import { useState } from "react";
import { Check, Loader2, PackageSearch } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Supplier } from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";

export function OrderSupplierPicker({
  supplier,
  suppliers,
  isUpdating = false,
  onChange,
  mode = "dropdown",
  size = "compact",
  label = "配件供",
  title = "选择配件供应商",
  className,
}: {
  supplier?: Supplier;
  suppliers: Supplier[];
  isUpdating?: boolean;
  onChange: (supplierId: string | null) => void;
  mode?: "dropdown" | "sheet";
  size?: "compact" | "comfortable";
  label?: string;
  title?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const supplierLabel = supplier?.short_name || supplier?.name || "未选";
  const trigger = (
    <Button
      type="button"
      variant={size === "comfortable" ? "outline" : "ghost"}
      size="sm"
      disabled={isUpdating}
      className={cn(
        "max-w-full justify-start gap-1 rounded-md font-medium leading-none",
        size === "comfortable" ? "h-9 w-full px-2 text-[11px]" : "h-6 px-1.5 text-[10px]",
        supplier
          ? "bg-primary/10 text-primary hover:bg-primary/15"
          : "bg-muted/60 text-muted-foreground hover:bg-muted",
        className,
      )}
      aria-label={supplier ? `${label} ${supplier.name}` : title}
    >
      {isUpdating ? (
        <Loader2 className="size-3 shrink-0 animate-spin" />
      ) : (
        <PackageSearch className="size-3 shrink-0" />
      )}
      <span className="truncate">
        {label}：{supplierLabel}
      </span>
    </Button>
  );

  if (mode === "sheet") {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" className="max-h-[82svh] rounded-t-2xl p-0">
          <SheetHeader className="border-b border-[var(--border-panel)] px-4 py-3 pr-14 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <PackageSearch className="size-4 text-primary" />
              {title}
            </SheetTitle>
            <SheetDescription className="text-xs">
              只显示当前店铺设置中的活跃供应商。
            </SheetDescription>
          </SheetHeader>
          <div className="max-h-[58svh] overflow-y-auto px-3 py-3">
            <SupplierOptionsList
              supplier={supplier}
              suppliers={suppliers}
              isUpdating={isUpdating}
              onChange={(supplierId) => {
                onChange(supplierId);
                setOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs">{title}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <SupplierOptionsList
          supplier={supplier}
          suppliers={suppliers}
          isUpdating={isUpdating}
          onChange={onChange}
          asDropdownItems
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SupplierOptionsList({
  supplier,
  suppliers,
  isUpdating,
  onChange,
  asDropdownItems = false,
}: {
  supplier?: Supplier;
  suppliers: Supplier[];
  isUpdating: boolean;
  onChange: (supplierId: string | null) => void;
  asDropdownItems?: boolean;
}) {
  if (asDropdownItems) {
    return (
      <>
        {suppliers.length ? (
          suppliers.map((item) => (
            <DropdownMenuItem
              key={item.id}
              className="text-xs"
              disabled={isUpdating || item.id === supplier?.id}
              onSelect={() => onChange(item.id)}
            >
              <SupplierColorSwatch supplier={item} />
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              {item.id === supplier?.id ? <Check className="size-3.5" /> : null}
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled className="text-xs">
            请先到设置页维护供应商
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-xs text-muted-foreground"
          disabled={isUpdating || !supplier}
          onSelect={() => onChange(null)}
        >
          清除配件供应商
        </DropdownMenuItem>
      </>
    );
  }

  return (
    <div className="grid min-w-0 gap-1.5">
      {suppliers.length ? (
        suppliers.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={isUpdating || item.id === supplier?.id}
            onClick={() => onChange(item.id)}
            className={cn(
              "grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-[var(--border-panel)] bg-card/80 px-3 py-2 text-left text-xs transition-colors",
              item.id === supplier?.id
                ? "border-primary/35 bg-primary/10 text-primary"
                : "hover:bg-accent/15",
            )}
          >
            <SupplierColorSwatch supplier={item} />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{item.name}</span>
              <span className="block truncate text-[10px] leading-3 text-muted-foreground">
                {item.short_name || item.phone || "当前店铺供应商"}
              </span>
            </span>
            {item.id === supplier?.id ? <Check className="size-4" /> : null}
          </button>
        ))
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--border-panel)] px-3 py-5 text-center text-xs text-muted-foreground">
          请先到设置页维护供应商
        </div>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isUpdating || !supplier}
        className="h-9 justify-center rounded-lg text-xs text-muted-foreground"
        onClick={() => onChange(null)}
      >
        清除配件供应商
      </Button>
    </div>
  );
}

function SupplierColorSwatch({ supplier }: { supplier: Supplier }) {
  return (
    <span
      className="size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: supplier.color }}
      aria-hidden
    />
  );
}
