"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Loader2, PackageSearch } from "lucide-react";

import { useQueryClient } from "@tanstack/react-query";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { storesKeys } from "@/features/stores/api/query-keys";
import {
  resolveStoreShellContext,
  type StoreShellContextSnapshot,
} from "@/features/stores/model/store-shell-context";
import type { ShellBootstrap } from "@/features/stores/model/shell-bootstrap";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { supplierSecondaryName } from "@/features/suppliers/model/supplier-display";
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
import { useLocale } from "@/shared/i18n/locale-provider";

export function OrderSupplierPicker({
  supplier,
  suppliers,
  isUpdating = false,
  onChange,
  mode = "dropdown",
  size = "compact",
  label,
  title,
  className,
}: {
  supplier?: Supplier;
  suppliers: Supplier[];
  isUpdating?: boolean;
  onChange: (supplierId: string | null) => void | Promise<unknown>;
  mode?: "dropdown" | "sheet";
  size?: "micro" | "compact" | "comfortable";
  label?: string;
  title?: string;
  className?: string;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const selectSupplier = async (supplierId: string | null) => {
    if (saving || isUpdating) return;
    setSaving(true);
    setFailed(false);
    try {
      await onChange(supplierId);
      setOpen(false);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };
  const resolvedLabel = label ?? t("orders2b2.supplier.label");
  const resolvedTitle = title ?? t("orders2b2.supplier.title");
  const supplierLabel = supplier?.short_name || supplier?.name || t("orders2b2.supplier.none");
  const trigger = (
    <Button
      type="button"
      data-order-supplier-trigger="true"
      variant={size === "comfortable" ? "outline" : "ghost"}
      size="sm"
      disabled={isUpdating || saving}
      className={cn(
        "max-w-full justify-start gap-1 rounded-md font-medium leading-none",
        size === "comfortable"
          ? "h-9 w-full px-2 text-[11px] lg:text-xs lg:leading-4"
          : size === "micro"
            ? "h-5 px-1 text-[9px] lg:text-[11px] lg:leading-4"
            : "h-6 px-1.5 text-[10px] lg:text-[11px] lg:leading-4",
        supplier
          ? "bg-primary/10 text-primary hover:bg-primary/15"
          : "bg-muted/60 text-muted-foreground hover:bg-muted",
        className,
      )}
      aria-label={supplier ? `${resolvedLabel} ${supplier.name}` : resolvedTitle}
    >
      {isUpdating ? (
        <Loader2
          className={cn("shrink-0 animate-spin", size === "micro" ? "size-2.5" : "size-3")}
        />
      ) : (
        <PackageSearch className={cn("shrink-0", size === "micro" ? "size-2.5" : "size-3")} />
      )}
      <span className="truncate">
        {resolvedLabel}：{supplierLabel}
      </span>
    </Button>
  );

  if (mode === "sheet") {
    return (
      <Sheet
        open={open}
        onOpenChange={(value) => {
          if (!saving && !isUpdating) setOpen(value);
        }}
      >
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" className="max-h-[82svh] rounded-t-2xl p-0">
          <SheetHeader className="border-b border-[var(--border-panel)] px-4 py-3 pr-14 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <PackageSearch className="size-4 text-primary" />
              {resolvedTitle}
            </SheetTitle>
            <SheetDescription className="text-xs">{t("orders2b2.supplier.help")}</SheetDescription>
            <SupplierManagementEntry />
          </SheetHeader>
          {failed ? (
            <p role="alert" className="px-3 text-sm text-destructive">
              {t("orders.faultEditor.errorState")}
            </p>
          ) : null}
          <div className="max-h-[58svh] overflow-y-auto px-3 py-3">
            <SupplierOptionsList
              supplier={supplier}
              suppliers={suppliers}
              isUpdating={isUpdating || saving}
              onChange={selectSupplier}
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(value) => {
        if (!saving && !isUpdating) setOpen(value);
      }}
    >
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs">{resolvedTitle}</DropdownMenuLabel>
        <SupplierManagementEntry asDropdownItem />
        <DropdownMenuSeparator />
        <SupplierOptionsList
          supplier={supplier}
          suppliers={suppliers}
          isUpdating={isUpdating || saving}
          onChange={selectSupplier}
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
  onChange: (supplierId: string | null) => void | Promise<unknown>;
  asDropdownItems?: boolean;
}) {
  const { t } = useLocale();
  if (asDropdownItems) {
    return (
      <>
        {suppliers.length ? (
          suppliers.map((item) => (
            <DropdownMenuItem
              key={item.id}
              className="text-xs"
              disabled={isUpdating || item.id === supplier?.id}
              onSelect={(event) => {
                event.preventDefault();
                void onChange(item.id);
              }}
            >
              <SupplierColorSwatch supplier={item} />
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              {item.id === supplier?.id ? <Check className="size-3.5" /> : null}
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled className="text-xs">
            {t("orders2b2.supplier.settings")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-xs text-muted-foreground"
          disabled={isUpdating || !supplier}
          onSelect={(event) => {
            event.preventDefault();
            void onChange(null);
          }}
        >
          {t("orders2b2.supplier.clear")}
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
              "grid min-h-11 min-w-0 grid-cols-[12px_minmax(0,1fr)_16px] items-center gap-2 rounded-lg border border-[var(--border-panel)] bg-card/80 px-3 py-2 text-left text-xs transition-colors",
              item.id === supplier?.id
                ? "border-primary/35 bg-primary/10 text-primary"
                : "hover:bg-accent/15",
            )}
          >
            <SupplierColorSwatch supplier={item} />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{item.name}</span>
              {supplierSecondaryName(item) || item.phone ? (
                <span className="block truncate text-[11px] leading-4 text-muted-foreground">
                  {supplierSecondaryName(item) || item.phone}
                </span>
              ) : null}
            </span>
            {item.id === supplier?.id ? <Check className="size-4" /> : null}
          </button>
        ))
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--border-panel)] px-3 py-5 text-center text-xs text-muted-foreground">
          {t("orders2b2.supplier.settings")}
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
        {t("orders2b2.supplier.clear")}
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

function SupplierManagementEntry({ asDropdownItem = false }: { asDropdownItem?: boolean }) {
  const { locale } = useLocale();
  const shell = useStoreShellContext();
  const queryClient = useQueryClient();
  const storeId = shell.activeStore?.id;
  const allowed = Boolean(
    shell.userId &&
    storeId &&
    shell.activeStore?.membershipId &&
    shell.activeStore.role === "owner" &&
    shell.status === "ready" &&
    !shell.isLoading &&
    !shell.isRefreshing &&
    !shell.isDegraded &&
    shell.permissions?.canManageSuppliers,
  );
  const session = useRef<{ identity: string; returning: boolean } | null>(null);
  const identity = supplierManagementIdentity(shell);
  useEffect(() => {
    session.current = null;
    const refreshOnReturn = async () => {
      const opening = session.current;
      if (
        document.visibilityState === "hidden" ||
        !allowed ||
        !opening ||
        opening.returning ||
        opening.identity !== identity
      )
        return;
      opening.returning = true;
      try {
        // A new tab can change the shared active-store cookie before this tab's
        // cached shell notices. Confirm fresh authority before touching a store key.
        const previousUpdates =
          queryClient.getQueryState(storesKeys.bootstrap)?.dataUpdateCount ?? 0;
        await queryClient.refetchQueries(
          { queryKey: storesKeys.bootstrap, exact: true },
          { throwOnError: true },
        );
        if (session.current !== opening) return;
        session.current = null;
        const bootstrap = queryClient.getQueryData<ShellBootstrap>(storesKeys.bootstrap);
        const authorityState = queryClient.getQueryState(storesKeys.bootstrap);
        if (
          !bootstrap ||
          authorityState?.status !== "success" ||
          authorityState.fetchStatus !== "idle" ||
          authorityState.dataUpdateCount <= previousUpdates
        )
          return;
        const fresh = resolveStoreShellContext({
          onboardingStatus: bootstrap.onboarding,
          storeContext: bootstrap.storeContext,
        });
        if (
          fresh.status !== "ready" ||
          fresh.isLoading ||
          fresh.isRefreshing ||
          fresh.isDegraded ||
          fresh.activeStore?.role !== "owner" ||
          !fresh.permissions?.canManageSuppliers ||
          supplierManagementIdentity(fresh) !== opening.identity
        )
          return;
        await queryClient.invalidateQueries({
          queryKey: ordersKeys.options(fresh.activeStore.id),
          exact: true,
        });
      } catch {
        // A failed authority refresh must never reuse stale options authority.
        if (session.current === opening) session.current = null;
      }
    };
    const onReturn = () => {
      void refreshOnReturn();
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      session.current = null;
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [allowed, identity, queryClient]);
  if (!allowed) return null;
  const label =
    locale === "zh-CN"
      ? "编辑供应商列表（新页面）"
      : locale === "it-IT"
        ? "Modifica fornitori (nuova scheda)"
        : "Edit suppliers (new tab)";
  const link = (
    <a
      href="/settings?section=suppliers"
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        session.current = { identity, returning: false };
      }}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
      {label}
    </a>
  );
  return asDropdownItem ? (
    <DropdownMenuItem asChild onSelect={(event) => event.preventDefault()}>
      {link}
    </DropdownMenuItem>
  ) : (
    link
  );
}

function supplierManagementIdentity(shell: StoreShellContextSnapshot) {
  return `${shell.authorityFingerprint}:${shell.userId}:${shell.activeStore?.id}:${shell.activeStore?.membershipId}:${shell.activeStore?.role}`;
}
