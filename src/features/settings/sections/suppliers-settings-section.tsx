"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ExternalLink,
  Mail,
  PackageSearch,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";

import { RepairOsBusinessCard, RepairOsSectionHeader } from "@/shared/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SupplierEditorSheet } from "@/features/settings/sections/supplier-editor-sheet";
import { supplierSwatchClass } from "@/features/suppliers/model/supplier-color-palette";
import { cn } from "@/lib/utils";
import { repairOs } from "@/lib/ui-patterns";
import type { Supplier, SupplierInput } from "@/lib/repairdesk/types";
import { useLocale } from "@/shared/i18n/locale-provider";
import { translateSettingsOperations } from "@/shared/i18n/messages";

export interface SuppliersSettingsSectionProps {
  suppliers: Supplier[];
  canRead: boolean;
  canManage: boolean;
  isLoading: boolean;
  isError: boolean;
  isSaving: boolean;
  archivePendingId?: string;
  actionError?: string;
  onRetry: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSave: (input: SupplierInput, id?: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
}

export function SuppliersSettingsSection({
  suppliers,
  canRead,
  canManage,
  isLoading,
  isError,
  isSaving,
  archivePendingId,
  actionError,
  onRetry,
  onDirtyChange,
  onSave,
  onArchive,
}: SuppliersSettingsSectionProps) {
  const { locale } = useLocale();
  const copy = (
    source: Parameters<typeof translateSettingsOperations>[1],
    values?: Record<string, string | number>,
  ) => translateSettingsOperations(locale, source, values);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "archived" | "all">("active");
  const [editor, setEditor] = useState<{ mode: "new" | "edit"; supplier?: Supplier } | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Supplier | null>(null);
  const [archiveSubmitting, setArchiveSubmitting] = useState(false);
  const archiveSubmittingRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return suppliers.filter((supplier) => {
      if (status === "active" && supplier.archived_at) return false;
      if (status === "archived" && !supplier.archived_at) return false;
      if (!term) return true;
      return [
        supplier.name,
        supplier.short_name,
        supplier.contact_name,
        supplier.phone,
        supplier.email,
      ].some((value) => value?.toLowerCase().includes(term));
    });
  }, [search, status, suppliers]);
  const activeCount = suppliers.filter((supplier) => !supplier.archived_at).length;
  const archivedCount = suppliers.length - activeCount;
  const archiveBusy =
    archiveSubmitting ||
    Boolean(archiveTarget && archivePendingId && archivePendingId === archiveTarget.id);

  useEffect(() => {
    if (canManage) return;
    setEditor(null);
    setArchiveTarget(null);
    setArchiveSubmitting(false);
    archiveSubmittingRef.current = false;
  }, [canManage]);

  const closeArchiveConfirm = () => {
    setArchiveTarget(null);
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  };

  return (
    <section id="settings-suppliers" className={cn(repairOs.adminSection, "p-3 sm:p-4")}>
      <RepairOsSectionHeader
        icon={PackageSearch}
        iconFrame={false}
        title={copy("供应商（复数）")}
        description={copy("{active} 个可用 · {archived} 个已归档", {
          active: activeCount,
          archived: archivedCount,
        })}
        action={
          canManage ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-10"
              onClick={(event) => {
                returnFocusRef.current = event.currentTarget;
                setEditor({ mode: "new" });
              }}
            >
              <Plus className="size-4" /> {copy("添加供应商")}
            </Button>
          ) : null
        }
      />

      {!canRead ? (
        <div className="rounded-xl border border-[var(--border-panel)] bg-card px-4 py-4 text-sm text-muted-foreground">
          {copy("当前账号没有供应商查看权限，页面不会请求或显示供应商资料。")}
        </div>
      ) : (
        <div className="space-y-4">
          {!canManage ? (
            <div className="rounded-xl border border-[var(--border-panel)] bg-card px-4 py-3 text-sm text-muted-foreground">
              {copy(
                "当前为只读访问。只有店主或具备“管理供应商”额外授权的员工可以新增、编辑或归档。",
              )}
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label={copy("搜索供应商")}
                className="h-[38px] pl-9 text-base sm:text-sm"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={copy("名称、联系人、电话或邮箱")}
              />
            </div>
            <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
              <SelectTrigger
                className="h-[38px] text-base sm:text-sm"
                aria-label={copy("筛选供应商状态")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{copy("可用供应商")}</SelectItem>
                <SelectItem value="archived">{copy("已归档")}</SelectItem>
                <SelectItem value="all">{copy("全部")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="grid gap-2" aria-busy="true">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : isError ? (
            <RepairOsBusinessCard
              as="div"
              role="alert"
              className="grid-cols-1 gap-2 border-status-danger-foreground/25 bg-status-danger/10 px-3 py-3 text-status-danger-foreground sm:grid-cols-[minmax(0,1fr)_auto]"
              trailing={
                <Button type="button" variant="outline" className="min-h-9" onClick={onRetry}>
                  <RotateCcw className="size-4" /> {copy("重新读取")}
                </Button>
              }
            >
              <p className="text-sm font-semibold">{copy("供应商读取失败")}</p>
              <p className="mt-1 text-xs">{copy("当前编辑草稿不会被自动清除。")}</p>
            </RepairOsBusinessCard>
          ) : !filtered.length ? (
            <div className="rounded-xl border border-dashed border-[var(--border-panel)] bg-card px-4 py-7 text-center">
              <PackageSearch className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold">
                {suppliers.length ? copy("没有匹配的供应商") : copy("当前店铺暂无供应商")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {copy("新店铺不会继承其他店铺的供应商资料。")}
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              {filtered.map((supplier) => (
                <RepairOsBusinessCard
                  key={supplier.id}
                  as="div"
                  data-supplier-id={supplier.id}
                  className="grid-cols-1 gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  trailing={
                    <div className="flex flex-wrap items-center gap-2">
                      <SupplierQuickActions supplier={supplier} />
                      {canManage && !supplier.archived_at ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-9"
                            onClick={(event) => {
                              returnFocusRef.current = event.currentTarget;
                              setEditor({ mode: "edit", supplier });
                            }}
                          >
                            <Pencil className="size-4" /> {copy("编辑")}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11 text-destructive hover:text-destructive"
                            disabled={archivePendingId === supplier.id}
                            onClick={(event) => {
                              returnFocusRef.current = event.currentTarget;
                              setArchiveTarget(supplier);
                            }}
                          >
                            <Archive className="size-4" /> {copy("归档")}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  }
                  trailingClassName="min-w-0"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "size-3 shrink-0 rounded-full",
                        supplierSwatchClass(supplier.color),
                      )}
                      aria-hidden
                    />
                    <p className="break-words text-sm font-semibold">{supplier.name}</p>
                    {supplier.archived_at ? (
                      <Badge variant="outline">{copy("已归档 · 历史保留")}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    {[supplier.short_name, supplier.contact_name, supplier.phone]
                      .filter(Boolean)
                      .join(" · ") || copy("暂无联系摘要")}
                  </p>
                  {supplier.notes ? (
                    <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-muted-foreground">
                      {supplier.notes}
                    </p>
                  ) : null}
                </RepairOsBusinessCard>
              ))}
            </div>
          )}

          {actionError ? (
            <div
              role="alert"
              className="rounded-lg border border-status-danger-foreground/25 bg-status-danger/10 px-3 py-2 text-sm text-status-danger-foreground"
            >
              {copy("供应商操作失败，请重试")}
            </div>
          ) : null}
        </div>
      )}

      <SupplierEditorSheet
        mode={editor?.mode ?? null}
        supplier={editor?.supplier}
        isSaving={isSaving}
        errorMessage={actionError}
        returnFocusRef={returnFocusRef}
        onOpenChange={(open) => !open && setEditor(null)}
        onDirtyChange={onDirtyChange}
        onSave={(input, id) => {
          if (!canManage) return Promise.reject(new Error(copy("供应商操作失败，请重试")));
          return onSave(input, id);
        }}
      />

      <AlertDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open && !archiveBusy) closeArchiveConfirm();
        }}
      >
        <AlertDialogContent aria-busy={archiveBusy}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {copy("归档 {supplier}？", { supplier: archiveTarget?.name ?? copy("供应商") })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {copy(
                "归档后历史订单仍保留关联，新订单不再可选。当前没有恢复归档 API，请确认后再继续。",
              )}
            </AlertDialogDescription>
            {actionError ? (
              <p role="alert" className="text-sm text-status-danger-foreground">
                {copy("供应商操作失败，请重试")}
              </p>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">{copy("取消")}</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11"
              disabled={archiveBusy}
              onClick={(event) => {
                event.preventDefault();
                if (!canManage || !archiveTarget || archiveSubmittingRef.current) return;
                archiveSubmittingRef.current = true;
                setArchiveSubmitting(true);
                void onArchive(archiveTarget.id)
                  .then(() => {
                    closeArchiveConfirm();
                  })
                  .catch(() => undefined)
                  .finally(() => {
                    archiveSubmittingRef.current = false;
                    setArchiveSubmitting(false);
                  });
              }}
            >
              {archiveBusy ? copy("归档中…") : copy("确认归档")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function SupplierQuickActions({ supplier }: { supplier: Supplier }) {
  const { locale } = useLocale();
  const copy = (
    source: Parameters<typeof translateSettingsOperations>[1],
    values?: Record<string, string | number>,
  ) => translateSettingsOperations(locale, source, values);
  const website =
    supplier.website && /^https?:\/\//i.test(supplier.website) ? supplier.website : null;
  return (
    <div
      className="flex items-center gap-1"
      aria-label={copy("{supplier}快捷联系", { supplier: supplier.name })}
    >
      {supplier.phone ? (
        <Button
          asChild
          size="icon"
          variant="ghost"
          className="size-9"
          aria-label={copy("拨打 {supplier}", { supplier: supplier.name })}
        >
          <a href={`tel:${supplier.phone}`}>
            <Phone className="size-4" />
          </a>
        </Button>
      ) : null}
      {supplier.email ? (
        <Button
          asChild
          size="icon"
          variant="ghost"
          className="size-9"
          aria-label={copy("邮件联系 {supplier}", { supplier: supplier.name })}
        >
          <a href={`mailto:${supplier.email}`}>
            <Mail className="size-4" />
          </a>
        </Button>
      ) : null}
      {website ? (
        <Button
          asChild
          size="icon"
          variant="ghost"
          className="size-9"
          aria-label={copy("打开 {supplier} 网站", { supplier: supplier.name })}
        >
          <a href={website} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" />
          </a>
        </Button>
      ) : null}
    </div>
  );
}
