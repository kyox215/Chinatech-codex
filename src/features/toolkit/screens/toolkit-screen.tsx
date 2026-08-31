"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Blocks,
  Download,
  ExternalLink,
  Loader2,
  Plus,
  RotateCcw,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { toolkitKeys } from "@/features/toolkit/api/query-keys";
import { verifyRecentLifecycleAal2 } from "@/features/settings/model/store-lifecycle-mfa";
import type { ToolkitFilePrepareResult, ToolkitResource } from "@/features/toolkit/model/contracts";
import {
  accessToolkitResource,
  createToolkitLink,
  finalizeToolkitFileUpload,
  listToolkitResources,
  prepareToolkitFileUpload,
  updateToolkitResourceStatus,
  uploadToolkitFile,
} from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";
import { RepairOsBusinessCard, RepairOsListScaffold } from "@/shared/ui";
import { useLocale } from "@/shared/i18n/locale-provider";

type PendingToolkitFinalize = {
  id: string;
  expectedRevision: number;
  upload: ToolkitFilePrepareResult["upload"];
  uploaded: boolean;
};

export function ToolkitScreen() {
  const { t } = useLocale();
  const shell = useStoreShellContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [linkFormOpen, setLinkFormOpen] = useState(false);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkDescription, setLinkDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState("");
  const [fileDescription, setFileDescription] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [pendingFinalize, setPendingFinalize] = useState<PendingToolkitFinalize | null>(null);
  const canRead = Boolean(shell.activeStore || shell.isPlatformAdmin);
  const resourcesQuery = useQuery({
    queryKey: toolkitKeys.resources,
    queryFn: ({ signal }) => listToolkitResources({ signal }),
    enabled: !shell.isLoading && canRead,
    staleTime: 15_000,
  });
  const canManage = resourcesQuery.data?.canManage === true;
  const requireRecentAal2 = async () => {
    const code = totpCode;
    if (!/^\d{6}$/.test(code)) {
      throw new Error("请输入身份验证器中的 6 位安全验证码");
    }
    await verifyRecentLifecycleAal2(code);
    setTotpCode("");
  };
  const resources = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (resourcesQuery.data?.resources ?? []).filter((resource) => {
      if (!query) return true;
      return [resource.title, resource.description, resource.platform, resource.version]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [resourcesQuery.data?.resources, search]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: toolkitKeys.resources });
  const linkMutation = useMutation({
    mutationFn: async () => {
      await requireRecentAal2();
      return createToolkitLink({
        title: linkTitle,
        url: linkUrl,
        description: linkDescription,
        platform: "Web",
      });
    },
    onSuccess: () => {
      toast.success("网页工具已保存为草稿");
      setLinkTitle("");
      setLinkUrl("");
      setLinkDescription("");
      setLinkFormOpen(false);
      void refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "创建工具失败"),
  });
  const fileMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("请选择文件");
      if (pendingFinalize) {
        if (pendingFinalize.uploaded) throw new Error("文件已上传，请完成校验");
        setUploadProgress(0);
        await uploadToolkitFile(pendingFinalize.upload, selectedFile, {
          onProgress: setUploadProgress,
        });
        setPendingFinalize((current) => (current ? { ...current, uploaded: true } : current));
        return { phase: "uploaded" as const };
      }
      await requireRecentAal2();
      const prepared = await prepareToolkitFileUpload({
        title: fileTitle || selectedFile.name,
        description: fileDescription,
        platform: "桌面",
        fileName: selectedFile.name,
        mimeType: selectedFile.type || "application/octet-stream",
        sizeBytes: selectedFile.size,
      });
      setPendingFinalize({
        id: prepared.resource.id,
        expectedRevision: prepared.resource.revision ?? 1,
        upload: prepared.upload,
        uploaded: false,
      });
      setUploadProgress(0);
      await uploadToolkitFile(prepared.upload, selectedFile, { onProgress: setUploadProgress });
      setPendingFinalize((current) => (current ? { ...current, uploaded: true } : current));
      return { phase: "uploaded" as const };
    },
    onSuccess: () => {
      toast.success("文件已上传，请输入新的验证码完成校验");
      void refresh();
    },
    onError: (error) => {
      setUploadProgress(null);
      toast.error(error instanceof Error ? error.message : "上传失败，文件仍不可见");
    },
  });
  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const pending = pendingFinalize;
      if (!pending?.uploaded) throw new Error("请先完成文件上传");
      await requireRecentAal2();
      return finalizeToolkitFileUpload(pending.id, {
        expectedRevision: pending.expectedRevision,
      });
    },
    onSuccess: () => {
      toast.success("文件已完成校验并保存为草稿");
      setPendingFinalize(null);
      setSelectedFile(null);
      setFileTitle("");
      setFileDescription("");
      setUploadProgress(null);
      void refresh();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "文件校验失败，记录仍可重试");
    },
  });
  const statusMutation = useMutation({
    mutationFn: async ({
      resource,
      action,
    }: {
      resource: ToolkitResource;
      action: "publish" | "archive" | "restore";
    }) => {
      return requireRecentAal2().then(() =>
        updateToolkitResourceStatus(resource.id, {
          expectedRevision: resource.revision ?? 1,
          action,
        }),
      );
    },
    onSuccess: () => {
      toast.success("工具状态已更新");
      void refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "工具状态更新失败"),
  });

  const openResource = async (resource: ToolkitResource) => {
    const popup =
      resource.kind === "link" ? window.open("about:blank", "_blank", "noopener,noreferrer") : null;
    try {
      const result = await accessToolkitResource(resource.id);
      if (resource.kind === "link" && popup) {
        popup.location.href = result.url;
        return;
      }
      const anchor = document.createElement("a");
      anchor.href = result.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      if (resource.kind === "file" && result.fileName) anchor.download = result.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      popup?.close();
      toast.error(error instanceof Error ? error.message : "打开工具失败");
    }
  };

  if (shell.isLoading) return <ToolkitLoading />;
  if (!canRead) {
    return (
      <RepairOsListScaffold
        title={t("toolkit.title")}
        subtitle={t("page.loginAndStoreRequired")}
        eyebrow={t("page.workspaceToolkit")}
      >
        <h1 className="sr-only">{t("toolkit.title")}</h1>
        <RepairOsBusinessCard as="div" role="status" className="mx-auto max-w-3xl">
          当前账号暂时无法查看工具集，请先完成登录和店铺开通。
        </RepairOsBusinessCard>
      </RepairOsListScaffold>
    );
  }
  if (resourcesQuery.isPending) return <ToolkitLoading />;
  if (resourcesQuery.isError) {
    return (
      <RepairOsListScaffold
        title={t("toolkit.title")}
        subtitle={t("page.readFailed")}
        eyebrow={t("page.workspaceToolkit")}
      >
        <h1 className="sr-only">{t("toolkit.title")}</h1>
        <RepairOsBusinessCard as="div" className="mx-auto max-w-3xl text-status-danger-foreground">
          <p>工具集暂时无法读取。</p>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() => void resourcesQuery.refetch()}
          >
            重试
          </Button>
        </RepairOsBusinessCard>
      </RepairOsListScaffold>
    );
  }

  return (
    <RepairOsListScaffold
      title={t("toolkit.title")}
      subtitle={t("toolkit.description")}
      eyebrow={t("page.workspaceToolkit")}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="搜索工具名称、平台或版本"
      desktopAction={
        canManage ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLinkFormOpen((open) => !open)}
            >
              <Plus className="size-4" /> 添加网页工具
            </Button>
            <label
              htmlFor="toolkit-file-desktop"
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-foreground px-3 text-sm font-medium text-background hover:bg-foreground/90"
            >
              <Upload className="size-4" /> 上传文件
              <input
                id="toolkit-file-desktop"
                type="file"
                className="sr-only"
                accept=".zip,.7z,.rar,.exe,.msi,.dmg,.pkg,.apk,.deb,.pdf"
                aria-label="选择工具文件"
                disabled={Boolean(pendingFinalize)}
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0] ?? null);
                  setUploadProgress(null);
                }}
              />
            </label>
          </div>
        ) : null
      }
    >
      <h1 className="sr-only">工具集</h1>
      {canManage ? (
        <RepairOsBusinessCard
          as="div"
          className="mb-3 flex flex-wrap items-end gap-3"
          aria-label="工具集管理员验证"
        >
          <label
            htmlFor="toolkit-totp-code"
            className="min-w-[12rem] flex-1 text-xs font-medium text-muted-foreground"
          >
            管理员安全验证码
            <Input
              id="toolkit-totp-code"
              value={totpCode}
              onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="输入 6 位 TOTP"
              className="mt-1 text-base"
              aria-label="工具集管理员 6 位 TOTP"
            />
          </label>
          <div className="flex flex-wrap gap-2 lg:hidden">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLinkFormOpen((open) => !open)}
            >
              <Plus className="size-4" /> 添加网页工具
            </Button>
            <label
              htmlFor="toolkit-file-mobile"
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-foreground px-3 text-sm font-medium text-background"
            >
              <Upload className="size-4" /> 选择上传文件
              <input
                id="toolkit-file-mobile"
                type="file"
                className="sr-only"
                accept=".zip,.7z,.rar,.exe,.msi,.dmg,.pkg,.apk,.deb,.pdf"
                aria-label="选择工具文件"
                disabled={Boolean(pendingFinalize)}
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0] ?? null);
                  setUploadProgress(null);
                }}
              />
            </label>
          </div>
        </RepairOsBusinessCard>
      ) : null}
      {canManage && linkFormOpen ? (
        <RepairOsBusinessCard
          as="div"
          className="mb-3 grid gap-3 lg:grid-cols-[1fr_1fr]"
          aria-label="添加网页工具"
        >
          <div>
            <label
              htmlFor="toolkit-link-title"
              className="text-xs font-medium text-muted-foreground"
            >
              工具名称
            </label>
            <Input
              id="toolkit-link-title"
              value={linkTitle}
              onChange={(event) => setLinkTitle(event.target.value)}
              placeholder="工具名称"
              className="mt-1 text-base"
            />
          </div>
          <div>
            <label htmlFor="toolkit-link-url" className="text-xs font-medium text-muted-foreground">
              HTTPS 工具链接
            </label>
            <Input
              id="toolkit-link-url"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="https://…"
              inputMode="url"
              className="mt-1 text-base"
            />
          </div>
          <div className="lg:col-span-2">
            <label
              htmlFor="toolkit-link-description"
              className="text-xs font-medium text-muted-foreground"
            >
              简短说明（可选）
            </label>
            <Textarea
              id="toolkit-link-description"
              value={linkDescription}
              onChange={(event) => setLinkDescription(event.target.value)}
              placeholder="简短说明（可选）"
              className="mt-1 text-base"
              rows={2}
            />
          </div>
          <div className="flex gap-2 lg:col-span-2">
            <Button
              type="button"
              onClick={() => linkMutation.mutate()}
              disabled={linkMutation.isPending || !linkTitle || !linkUrl}
            >
              {linkMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null} 保存草稿
            </Button>
            <Button type="button" variant="ghost" onClick={() => setLinkFormOpen(false)}>
              取消
            </Button>
          </div>
        </RepairOsBusinessCard>
      ) : null}
      {canManage && selectedFile ? (
        <RepairOsBusinessCard
          as="div"
          className="mb-3 grid gap-3 lg:grid-cols-[1fr_1fr_auto]"
          aria-label="上传工具文件"
        >
          <div>
            <label
              htmlFor="toolkit-file-title"
              className="text-xs font-medium text-muted-foreground"
            >
              工具名称
            </label>
            <Input
              id="toolkit-file-title"
              value={fileTitle}
              onChange={(event) => setFileTitle(event.target.value)}
              placeholder={selectedFile.name}
              className="mt-1 text-base"
            />
          </div>
          <div>
            <label
              htmlFor="toolkit-file-description"
              className="text-xs font-medium text-muted-foreground"
            >
              文件说明（可选）
            </label>
            <Input
              id="toolkit-file-description"
              value={fileDescription}
              onChange={(event) => setFileDescription(event.target.value)}
              placeholder="文件说明（可选）"
              className="mt-1 text-base"
            />
          </div>
          <div className="flex items-center gap-2">
            {pendingFinalize?.uploaded ? (
              <Button
                type="button"
                onClick={() => finalizeMutation.mutate()}
                disabled={finalizeMutation.isPending}
              >
                {finalizeMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}{" "}
                完成校验
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => fileMutation.mutate()}
                disabled={fileMutation.isPending}
              >
                {fileMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                {pendingFinalize ? "重试上传" : "开始上传"}
              </Button>
            )}
            {uploadProgress !== null ? (
              <span className="text-xs text-muted-foreground">{uploadProgress}%</span>
            ) : null}
          </div>
          <p className="text-xs leading-5 text-muted-foreground lg:col-span-3">
            {pendingFinalize?.uploaded
              ? "文件已直传，输入新的 6 位验证码后完成校验；校验前不可发布或下载。"
              : pendingFinalize
                ? "准备记录已保留，上传失败可重试；文件仍不可发布或下载。"
                : "文件会先进入草稿与隔离校验状态；当前没有自动恶意软件扫描，不可发布或下载。"}
          </p>
        </RepairOsBusinessCard>
      ) : null}
      {resources.length === 0 ? (
        <RepairOsBusinessCard
          as="div"
          className="mx-auto max-w-3xl text-muted-foreground"
          role="status"
        >
          {search
            ? "没有匹配的工具。"
            : shell.isPlatformAdmin
              ? "还没有工具，先添加一个网页工具。"
              : "暂无已发布工具。"}
        </RepairOsBusinessCard>
      ) : (
        <div className="grid min-w-0 gap-3 xl:grid-cols-2">
          {resources.map((resource) => (
            <ToolkitResourceCard
              key={resource.id}
              resource={resource}
              canManage={canManage}
              pending={statusMutation.isPending}
              onOpen={() => void openResource(resource)}
              onStatus={(action) => statusMutation.mutate({ resource, action })}
            />
          ))}
        </div>
      )}
    </RepairOsListScaffold>
  );
}

function ToolkitResourceCard({
  resource,
  canManage,
  pending,
  onOpen,
  onStatus,
}: {
  resource: ToolkitResource;
  canManage: boolean;
  pending: boolean;
  onOpen: () => void;
  onStatus: (action: "publish" | "archive" | "restore") => void;
}) {
  const isPublished = !canManage || resource.state === "published";
  const isArchived = resource.state === "archived";
  return (
    <RepairOsBusinessCard
      as="article"
      className={cn("min-w-0 gap-3 p-4", !isPublished && canManage && "border-dashed")}
      leading={
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Blocks className="size-5" />
        </span>
      }
      trailing={
        isPublished ? (
          <Button type="button" size="sm" className="shrink-0" onClick={onOpen}>
            {resource.kind === "file" ? (
              <Download className="size-4" />
            ) : (
              <ExternalLink className="size-4" />
            )}
            {resource.kind === "file" ? "下载" : "打开"}
          </Button>
        ) : null
      }
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h2 className="min-w-0 truncate text-sm font-semibold">{resource.title}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {resource.kind === "file" ? "文件" : "网页"}
        </span>
        {canManage ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {stateLabel(resource.state)}
          </span>
        ) : null}
      </div>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
        {resource.description || "暂无说明"}
      </p>
      <div className="mt-3 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {resource.platform ? <span>{resource.platform}</span> : null}
        {resource.version ? <span>版本 {resource.version}</span> : null}
        {resource.displayFileName ? (
          <span className="max-w-full truncate">{resource.displayFileName}</span>
        ) : null}
      </div>
      {canManage ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border/50 pt-3">
          {!isPublished && !isArchived ? (
            resource.kind === "link" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => onStatus("publish")}
              >
                发布
              </Button>
            ) : (
              <span className="inline-flex items-center rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                等待安全扫描
              </span>
            )
          ) : null}
          {!isArchived ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => onStatus("archive")}
            >
              <Archive className="size-3.5" />
              归档
            </Button>
          ) : null}
          {isArchived ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => onStatus("restore")}
            >
              <RotateCcw className="size-3.5" />
              恢复为草稿
            </Button>
          ) : null}
        </div>
      ) : null}
    </RepairOsBusinessCard>
  );
}

function stateLabel(state?: ToolkitResource["state"]) {
  return state === "published" ? "已发布" : state === "archived" ? "已归档" : "草稿";
}

function ToolkitLoading() {
  const { t } = useLocale();
  return (
    <RepairOsListScaffold
      title={t("toolkit.title")}
      subtitle={t("page.loading")}
      eyebrow={t("page.workspaceToolkit")}
    >
      <h1 className="sr-only">{t("toolkit.title")}</h1>
      <div className="grid gap-3 xl:grid-cols-2">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-32 animate-pulse rounded-2xl bg-muted/50" />
        ))}
      </div>
    </RepairOsListScaffold>
  );
}
