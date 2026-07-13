"use client";

import { useMemo, useRef, useState } from "react";
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

  const closeArchiveConfirm = () => {
    setArchiveTarget(null);
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  };

  return (
    <section id="settings-suppliers" className={cn(repairOs.adminSection, "p-3 sm:p-4")}>
      <RepairOsSectionHeader
        icon={PackageSearch}
        iconFrame={false}
        title="供应商"
        description={`${activeCount} 个可用 · ${archivedCount} 个已归档`}
        action={
          canManage ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={(event) => {
                returnFocusRef.current = event.currentTarget;
                setEditor({ mode: "new" });
              }}
            >
              <Plus className="size-4" /> 添加供应商
            </Button>
          ) : null
        }
      />

      {!canRead ? (
        <div className="rounded-xl border border-[var(--border-panel)] bg-card px-4 py-4 text-sm text-muted-foreground">
          当前账号没有供应商查看权限，页面不会请求或显示供应商资料。
        </div>
      ) : (
        <div className="space-y-4">
          {!canManage ? (
            <div className="rounded-xl border border-[var(--border-panel)] bg-card px-4 py-3 text-sm text-muted-foreground">
              当前为只读访问。只有店主或具备“管理供应商”额外授权的员工可以新增、编辑或归档。
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="搜索供应商"
                className="min-h-11 pl-9 text-base sm:text-sm"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="名称、联系人、电话或邮箱"
              />
            </div>
            <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
              <SelectTrigger className="min-h-11 text-base sm:text-sm" aria-label="筛选供应商状态">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">可用供应商</SelectItem>
                <SelectItem value="archived">已归档</SelectItem>
                <SelectItem value="all">全部</SelectItem>
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
                <Button type="button" variant="outline" className="min-h-11" onClick={onRetry}>
                  <RotateCcw className="size-4" /> 重新读取
                </Button>
              }
            >
              <p className="text-sm font-semibold">供应商读取失败</p>
              <p className="mt-1 text-xs">当前编辑草稿不会被自动清除。</p>
            </RepairOsBusinessCard>
          ) : !filtered.length ? (
            <div className="rounded-xl border border-dashed border-[var(--border-panel)] bg-card px-4 py-7 text-center">
              <PackageSearch className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold">
                {suppliers.length ? "没有匹配的供应商" : "当前店铺暂无供应商"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                新店铺不会继承其他店铺的供应商资料。
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
                            className="min-h-11"
                            onClick={(event) => {
                              returnFocusRef.current = event.currentTarget;
                              setEditor({ mode: "edit", supplier });
                            }}
                          >
                            <Pencil className="size-4" /> 编辑
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
                            <Archive className="size-4" /> 归档
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
                      <Badge variant="outline">已归档 · 历史保留</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    {[supplier.short_name, supplier.contact_name, supplier.phone]
                      .filter(Boolean)
                      .join(" · ") || "暂无联系摘要"}
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
              {actionError}
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
        onSave={onSave}
      />

      <AlertDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open && !archiveBusy) closeArchiveConfirm();
        }}
      >
        <AlertDialogContent aria-busy={archiveBusy}>
          <AlertDialogHeader>
            <AlertDialogTitle>归档 {archiveTarget?.name}？</AlertDialogTitle>
            <AlertDialogDescription>
              归档后历史订单仍保留关联，新订单不再可选。当前没有恢复归档 API，请确认后再继续。
            </AlertDialogDescription>
            {actionError ? (
              <p role="alert" className="text-sm text-status-danger-foreground">
                {actionError}
              </p>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">取消</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11"
              disabled={archiveBusy}
              onClick={(event) => {
                event.preventDefault();
                if (!archiveTarget || archiveSubmittingRef.current) return;
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
              {archiveBusy ? "归档中…" : "确认归档"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function SupplierQuickActions({ supplier }: { supplier: Supplier }) {
  const website =
    supplier.website && /^https?:\/\//i.test(supplier.website) ? supplier.website : null;
  return (
    <div className="flex items-center gap-1" aria-label={`${supplier.name}快捷联系`}>
      {supplier.phone ? (
        <Button
          asChild
          size="icon"
          variant="ghost"
          className="size-11"
          aria-label={`拨打 ${supplier.name}`}
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
          className="size-11"
          aria-label={`邮件联系 ${supplier.name}`}
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
          className="size-11"
          aria-label={`打开 ${supplier.name} 网站`}
        >
          <a href={website} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" />
          </a>
        </Button>
      ) : null}
    </div>
  );
}
