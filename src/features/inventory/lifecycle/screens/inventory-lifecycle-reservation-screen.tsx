"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageOpen, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { getInventoryProduct } from "@/lib/repairdesk/api";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

import { inventoryLifecycleSummaryQueryOptions } from "../api/query-options";
import { inventoryLifecycleKeys } from "../api/query-keys";
import {
  InventoryLifecycleLoadingCard,
  InventoryLifecyclePageShell,
} from "../components/inventory-lifecycle-page-shell";
import {
  InventoryLifecycleStatusBadge,
  InventoryLifecycleUnavailableCard,
} from "../components/inventory-lifecycle-status";
import { InventoryReservationForm } from "../forms/inventory-reservation-form";
import { InventoryReadFreshnessPanel } from "../../components/inventory-read-freshness-panel";
import {
  inventoryReadFreshnessBlocksWrites,
  resolveInventoryReadFreshness,
  type InventoryReadFreshnessVerification,
} from "../../model/inventory-read-freshness";
import { InventoryAvailabilityStateCard } from "../../components/inventory-availability-state-card";
import { resolveInventoryAvailability } from "../../model/inventory-availability";
import { InventoryNoActionGuidanceCard } from "../../components/inventory-no-action-guidance-card";
import { resolveInventoryNoActionGuidance } from "../../model/inventory-no-action-guidance";

export function InventoryLifecycleReservationScreen({
  itemId,
  mode = "reservation",
}: {
  itemId: string;
  mode?: "reservation" | "sale";
}) {
  const { t } = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const shell = useStoreShellContext({ monitorAuthority: true });
  const storeId = shell.activeStore?.id;
  const canRead = Boolean(
    storeId &&
    shell.permissions?.canReadInventory &&
    shell.permissions.inventoryProductsUiEnabled &&
    shell.permissions.inventoryLifecycleUiEnabled === true,
  );
  const productQuery = useQuery({
    queryKey: ["inventory-products", "lifecycle-reserve", storeId, itemId],
    queryFn: () => getInventoryProduct(itemId),
    enabled: canRead,
    retry: false,
  });
  const summaryQuery = useQuery({
    ...inventoryLifecycleSummaryQueryOptions(itemId, storeId),
    enabled: canRead,
  });
  const currentSummaryKey = `${storeId ?? ""}:${itemId}`;
  const [lastSummaryRead, setLastSummaryRead] = useState<
    { key: string; readAt: number } | undefined
  >();
  const [freshnessVerification, setFreshnessVerification] =
    useState<InventoryReadFreshnessVerification>("idle");
  const [availabilityRetrying, setAvailabilityRetrying] = useState(false);

  const availability = resolveInventoryAvailability({
    shellLoading: shell.isLoading,
    hasPermission: shell.permissions?.canReadInventory === true,
    featureEnabled:
      shell.permissions?.inventoryProductsUiEnabled === true &&
      shell.permissions?.inventoryLifecycleUiEnabled === true,
    queryState:
      productQuery.isError || summaryQuery.isError
        ? "error"
        : productQuery.isLoading || summaryQuery.isLoading
          ? "loading"
          : productQuery.isSuccess && summaryQuery.isSuccess
            ? "success"
            : "idle",
    hasData: Boolean(productQuery.data && summaryQuery.data),
    isRetrying: availabilityRetrying,
    error: productQuery.error ?? summaryQuery.error,
  });
  const retryAvailability = async () => {
    if (availabilityRetrying) return;
    setAvailabilityRetrying(true);
    try {
      await Promise.all([productQuery.refetch(), summaryQuery.refetch()]);
    } finally {
      setAvailabilityRetrying(false);
    }
  };

  useEffect(() => {
    if (summaryQuery.isSuccess && summaryQuery.data) {
      setLastSummaryRead({ key: currentSummaryKey, readAt: Date.now() });
    }
  }, [currentSummaryKey, summaryQuery.data, summaryQuery.isSuccess]);

  useEffect(() => {
    setFreshnessVerification("idle");
    setLastSummaryRead((previous) => (previous?.key === currentSummaryKey ? previous : undefined));
  }, [currentSummaryKey]);

  if (shell.isLoading || productQuery.isLoading || summaryQuery.isLoading) {
    return (
      <InventoryLifecyclePageShell
        title={
          mode === "sale"
            ? t("inventory2b4.reservation.saleTitle")
            : t("inventory2b4.reservation.title")
        }
        context={t("inventory2b4.reservation.context.loading")}
        onBack={() => router.push("/inventory")}
      >
        <InventoryAvailabilityStateCard availability={availability} />
      </InventoryLifecyclePageShell>
    );
  }

  if (!canRead) {
    return (
      <InventoryLifecyclePageShell
        title={
          mode === "sale"
            ? t("inventory2b4.reservation.saleTitle")
            : t("inventory2b4.reservation.title")
        }
        context={t("inventory2b4.reservation.context.inventory")}
        onBack={() => router.push("/inventory")}
      >
        <InventoryAvailabilityStateCard
          availability={availability}
          onBack={() => router.push("/inventory")}
        />
      </InventoryLifecyclePageShell>
    );
  }

  if (productQuery.isError || !productQuery.data) {
    return (
      <InventoryLifecyclePageShell
        title={
          mode === "sale"
            ? t("inventory2b4.reservation.saleTitle")
            : t("inventory2b4.reservation.title")
        }
        context={t("inventory2b4.reservation.context.inventory")}
        onBack={() => router.push("/inventory")}
      >
        <InventoryAvailabilityStateCard
          availability={availability}
          onRetry={availability.retryable ? retryAvailability : undefined}
          onBack={() => router.push("/inventory")}
        />
      </InventoryLifecyclePageShell>
    );
  }

  const product = productQuery.data;
  const summary = summaryQuery.data;
  const summaryKeyMatches = lastSummaryRead?.key === currentSummaryKey;
  const freshness = resolveInventoryReadFreshness({
    hasData: Boolean(summary),
    keyMatches: summaryKeyMatches,
    queryState: summaryQuery.isError
      ? "error"
      : summaryQuery.isLoading
        ? "loading"
        : summaryQuery.isSuccess
          ? "success"
          : "idle",
    verification: freshnessVerification,
    lastSuccessAt: summaryKeyMatches ? lastSummaryRead?.readAt : undefined,
  });
  const staleReadBlocked = inventoryReadFreshnessBlocksWrites(freshness);
  const verifyFreshness = async () => {
    if (freshnessVerification === "verifying") return;
    setFreshnessVerification("verifying");
    try {
      const result = await summaryQuery.refetch();
      if (!result.isSuccess || !result.data) throw new Error("reservation-readback-unavailable");
      setFreshnessVerification("recovered");
    } catch {
      setFreshnessVerification("failed");
    }
  };
  const summaryUnavailable = !summary;
  const canReserve = summary?.allowed_actions?.includes("reservation.create") === true;
  const noActionGuidance =
    summary && !canReserve
      ? resolveInventoryNoActionGuidance({
          hasData: true,
          projectionMode: summary.projection?.mode ?? "compatible",
          projection: summary.projection,
          status: summary.business_status,
          allowedActions: summary.allowed_actions,
          targetCommand: "reservation.create",
        })
      : null;
  const disabledReason = summaryUnavailable
    ? t("inventory2b4.reservation.disabled.unavailable")
    : staleReadBlocked
      ? t("inventory2b4.reservation.disabled.stale")
      : canReserve
        ? undefined
        : t("inventory2b4.reservation.disabled.noAction");

  return (
    <InventoryLifecyclePageShell
      title={
        mode === "sale"
          ? t("inventory2b4.reservation.saleTitle")
          : t("inventory2b4.reservation.title")
      }
      context={`${product.brand} ${product.model} · ${product.sku}`}
      status={summary ? <InventoryLifecycleStatusBadge status={summary.business_status} /> : null}
      onBack={() => router.push(`/inventory/${encodeURIComponent(itemId)}`)}
    >
      <section className={cn(repairOs.mobileInfoCard, "p-3 sm:p-4")}>
        {mode === "sale" ? (
          <p className="mb-3 text-xs leading-5 text-muted-foreground">
            {t("inventory2b4.reservation.saleDescription")}
          </p>
        ) : null}
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <PackageOpen className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {product.brand} {product.model}
            </p>
            <p className="mt-1 truncate font-mono text-xs text-primary">{product.sku}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {[product.specification, product.location].filter(Boolean).join(" · ") ||
                t("inventory2b4.reservation.productDetails")}
            </p>
          </div>
        </div>
      </section>

      {!freshness.hidden ? (
        <InventoryReadFreshnessPanel freshness={freshness} onVerify={verifyFreshness} />
      ) : null}

      {summary ? (
        <>
          {noActionGuidance ? <InventoryNoActionGuidanceCard guidance={noActionGuidance} /> : null}
          <InventoryReservationForm
            summary={summary}
            storeId={storeId}
            defaultPrice={product.list_price}
            disabledReason={disabledReason}
            onVerify={async () => {
              const result = await summaryQuery.refetch();
              if (!result.isSuccess || !result.data)
                throw new Error("reservation-readback-unavailable");
            }}
            onSuccess={(result) => {
              void queryClient.invalidateQueries({ queryKey: inventoryLifecycleKeys.all });
              void queryClient.invalidateQueries({ queryKey: ["inventory-products"] });
              router.replace(
                mode === "sale"
                  ? `/inventory/sales/${encodeURIComponent(result.sale_order_id ?? itemId)}`
                  : `/inventory/reservations/${encodeURIComponent(result.sale_order_id ?? itemId)}`,
              );
            }}
          />
        </>
      ) : (
        <InventoryAvailabilityStateCard
          availability={availability}
          onRetry={availability.retryable ? retryAvailability : undefined}
          onBack={() => router.push("/inventory")}
        />
      )}
    </InventoryLifecyclePageShell>
  );
}
