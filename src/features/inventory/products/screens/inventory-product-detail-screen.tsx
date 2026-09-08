"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PackageOpen, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

import { inventoryLifecycleSummaryQueryOptions } from "@/features/inventory/lifecycle/api/query-options";
import { InventoryInspectionEditor } from "@/features/inventory/lifecycle/forms/inventory-inspection-editor";

import { inventoryProductDetailQueryOptions } from "../api/query-options";
import { InventoryProductDetailWorkbench } from "../components/inventory-product-detail-workbench";
import { inventorySalesSummaryOptions } from "../../sales/api/queries";
import { SalesWorkspace } from "../../sales/ui/sales-workspace";
import { isSalesDormant, salesErrorKey } from "../../sales/ui/sales-ui-adapter";
import { salesCopy } from "../../sales/ui/sales-copy";

export function InventoryProductDetailScreen({ id }: { id: string }) {
  const shell = useStoreShellContext({ monitorAuthority: true });
  return <InventoryProductDetailContent key={shell.authorityFingerprint} id={id} shell={shell} />;
}
function InventoryProductDetailContent({
  id,
  shell,
}: {
  id: string;
  shell: ReturnType<typeof useStoreShellContext>;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const storeId = shell.activeStore?.id;
  const query = useQuery({
    ...inventoryProductDetailQueryOptions(id, storeId),
    enabled: Boolean(
      storeId &&
      shell.permissions?.canReadInventory &&
      shell.permissions.inventoryProductsUiEnabled,
    ),
  });
  const sales = useQuery({
    ...inventorySalesSummaryOptions(id, storeId ?? ""),
    enabled: Boolean(
      storeId &&
      shell.permissions?.canReadInventory &&
      shell.permissions.inventoryProductsUiEnabled,
    ),
    retry: false,
  });
  const salesDormant = isSalesDormant(sales.error);
  const lifecycleSummaryQuery = useQuery({
    ...inventoryLifecycleSummaryQueryOptions(id, storeId),
    enabled: Boolean(
      storeId &&
      shell.permissions?.canReadInventory &&
      shell.permissions.inventoryProductsUiEnabled &&
      salesDormant &&
      shell.permissions.inventoryLifecycleUiEnabled === true,
    ),
  });

  if (shell.isLoading || query.isLoading) return <DetailSkeleton />;
  if (
    !storeId ||
    !shell.permissions?.canReadInventory ||
    !shell.permissions.inventoryProductsUiEnabled
  ) {
    return (
      <DetailMessage
        title={t("inventory2b4.detail.unavailableTitle")}
        body={
          shell.permissions?.canReadInventory
            ? t("inventory2b4.detail.featureOff")
            : t("inventory2b4.detail.noAccess")
        }
        onBack={() => router.push("/inventory")}
      />
    );
  }
  if (query.isError || !query.data) {
    return (
      <DetailMessage
        title={t("inventory2b4.detail.errorTitle")}
        body={t("inventory2b4.detail.errorBody")}
        onBack={() => router.push("/inventory")}
        action={
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => void query.refetch()}
          >
            <RefreshCw className="mr-2 size-4" aria-hidden="true" />
            {t("inventory2b4.detail.retry")}
          </Button>
        }
      />
    );
  }

  const item = query.data;
  const lifecycleUiEnabled = shell.permissions.inventoryLifecycleUiEnabled === true;
  const lifecycleSummaryReady =
    lifecycleUiEnabled &&
    lifecycleSummaryQuery.isSuccess &&
    !lifecycleSummaryQuery.isFetching &&
    !lifecycleSummaryQuery.isError;
  const canEdit = Boolean(
    shell.permissions?.canUpdateInventory &&
    (salesDormant || (sales.isSuccess && sales.data && !sales.data.order)) &&
    item.edit_backing !== "legacy_read_only" &&
    !["sold", "removed"].includes(item.status),
  );
  return (
    <InventoryProductDetailWorkbench
      item={item}
      lifecycleSummary={lifecycleSummaryReady ? lifecycleSummaryQuery.data : undefined}
      lifecycleSummaryState={
        lifecycleUiEnabled
          ? lifecycleSummaryQuery.isLoading || lifecycleSummaryQuery.isFetching
            ? "loading"
            : lifecycleSummaryQuery.isError
              ? "unavailable"
              : lifecycleSummaryQuery.isSuccess
                ? "ready"
                : "unavailable"
          : "dormant"
      }
      canEdit={canEdit}
      salesContent={
        sales.isSuccess && sales.data ? (
          <SalesWorkspace
            summary={sales.data}
            storeId={storeId}
            onRefresh={() => sales.refetch()}
          />
        ) : salesDormant ? undefined : (
          <div
            className={cn(repairOs.mobileInfoCard, "p-3 text-sm")}
            role={sales.isError ? "alert" : "status"}
          >
            {salesCopy(
              locale,
              sales.isError ? salesErrorKey(sales.error) : sales.isSuccess ? "error" : "loading",
            )}
            {sales.isError ? (
              <Button variant="outline" onClick={() => void sales.refetch()}>
                {salesCopy(locale, "retry")}
              </Button>
            ) : null}
          </div>
        )
      }
      onBack={() => router.push("/inventory")}
      onEdit={() => router.push(`/inventory/${item.id}/edit`)}
      onNavigate={(href) => router.push(href)}
      renderInspectionEditor={
        lifecycleSummaryReady
          ? (summary) => (
              <InventoryInspectionEditor
                summary={summary}
                brand={item.brand}
                category={item.category}
                onVerifyConflict={async () => {
                  const result = await lifecycleSummaryQuery.refetch();
                  return Boolean(result.isSuccess && result.data);
                }}
                onSyncCommitted={async () => {
                  const result = await lifecycleSummaryQuery.refetch();
                  return Boolean(result.isSuccess && result.data);
                }}
              />
            )
          : undefined
      }
    />
  );
}

function DetailSkeleton() {
  const { t } = useLocale();
  return (
    <div className={cn(repairOs.mobileFloatingPage, "mx-auto w-full max-w-5xl")} aria-busy="true">
      <span className="sr-only">{t("inventory2b4.detail.loading")}</span>
      <Skeleton className="mb-3 h-24 rounded-3xl" />
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}

function DetailMessage({
  title,
  body,
  onBack,
  action,
}: {
  title: string;
  body: string;
  onBack: () => void;
  action?: React.ReactNode;
}) {
  const { t } = useLocale();
  return (
    <div className={cn(repairOs.mobileFloatingPage, "grid min-h-[55dvh] place-items-center p-4")}>
      <section className={cn(repairOs.mobileInfoCard, "max-w-sm p-6 text-center")} role="alert">
        <PackageOpen className="mx-auto mb-3 size-9 text-muted-foreground" aria-hidden="true" />
        <h1 className="font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" className="min-h-11" onClick={onBack}>
            {t("inventory2b4.detail.back")}
          </Button>
          {action}
        </div>
      </section>
    </div>
  );
}
