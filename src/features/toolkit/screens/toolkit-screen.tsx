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

const toolkitCopy = {
  "zh-CN": {
    invalidTotp: "请输入身份验证器中的 6 位安全验证码",
    linkSaved: "网页工具已保存为草稿",
    createFailed: "创建工具失败",
    selectFile: "请选择文件",
    alreadyUploaded: "文件已上传，请完成校验",
    uploaded: "文件已上传，请输入新的验证码完成校验",
    uploadFailed: "上传失败，文件仍不可见",
    uploadFirst: "请先完成文件上传",
    finalized: "文件已完成校验并保存为草稿",
    finalizeFailed: "文件校验失败，记录仍可重试",
    statusUpdated: "工具状态已更新",
    statusFailed: "工具状态更新失败",
    openFailed: "打开工具失败",
    denied: "当前账号暂时无法查看工具集，请先完成登录和店铺开通。",
    readFailed: "工具集暂时无法读取。",
    retry: "重试",
    search: "搜索工具名称、平台或版本",
    addLink: "添加网页工具",
    uploadFile: "上传文件",
    chooseFile: "选择工具文件",
    title: "工具集",
    adminVerification: "工具集管理员验证",
    adminCode: "管理员安全验证码",
    totpPlaceholder: "输入 6 位 TOTP",
    totpAria: "工具集管理员 6 位 TOTP",
    chooseUpload: "选择上传文件",
    toolName: "工具名称",
    linkLabel: "HTTPS 工具链接",
    optionalDescription: "简短说明（可选）",
    saveDraft: "保存草稿",
    cancel: "取消",
    uploadAria: "上传工具文件",
    fileDescription: "文件说明（可选）",
    finishValidation: "完成校验",
    retryUpload: "重试上传",
    startUpload: "开始上传",
    uploadedHint: "文件已直传，输入新的 6 位验证码后完成校验；校验前不可发布或下载。",
    retryHint: "准备记录已保留，上传失败可重试；文件仍不可发布或下载。",
    initialHint: "文件会先进入草稿与隔离校验状态；当前没有自动恶意软件扫描，不可发布或下载。",
    noMatch: "没有匹配的工具。",
    noAdmin: "还没有工具，先添加一个网页工具。",
    noPublished: "暂无已发布工具。",
    download: "下载",
    open: "打开",
    file: "文件",
    web: "网页",
    noDescription: "暂无说明",
    version: "版本",
    publish: "发布",
    waitingScan: "等待安全扫描",
    archive: "归档",
    restore: "恢复为草稿",
    published: "已发布",
    archived: "已归档",
    draft: "草稿",
  },
  "it-IT": {
    invalidTotp: "Inserisci il codice di sicurezza a 6 cifre dell’app di autenticazione",
    linkSaved: "Strumento web salvato come bozza",
    createFailed: "Creazione dello strumento non riuscita",
    selectFile: "Seleziona un file",
    alreadyUploaded: "File caricato: completa la verifica",
    uploaded: "File caricato. Inserisci un nuovo codice per completare la verifica",
    uploadFailed: "Caricamento non riuscito; il file resta invisibile",
    uploadFirst: "Completa prima il caricamento",
    finalized: "File verificato e salvato come bozza",
    finalizeFailed: "Verifica del file non riuscita; puoi riprovare",
    statusUpdated: "Stato dello strumento aggiornato",
    statusFailed: "Aggiornamento dello stato non riuscito",
    openFailed: "Impossibile aprire lo strumento",
    denied: "Questo account non può vedere gli strumenti. Accedi e attiva un negozio.",
    readFailed: "Impossibile leggere gli strumenti.",
    retry: "Riprova",
    search: "Cerca per nome, piattaforma o versione",
    addLink: "Aggiungi strumento web",
    uploadFile: "Carica file",
    chooseFile: "Seleziona file dello strumento",
    title: "Strumenti",
    adminVerification: "Verifica amministratore strumenti",
    adminCode: "Codice di sicurezza amministratore",
    totpPlaceholder: "Inserisci TOTP a 6 cifre",
    totpAria: "TOTP amministratore strumenti a 6 cifre",
    chooseUpload: "Scegli file da caricare",
    toolName: "Nome strumento",
    linkLabel: "Link HTTPS dello strumento",
    optionalDescription: "Breve descrizione (facoltativa)",
    saveDraft: "Salva bozza",
    cancel: "Annulla",
    uploadAria: "Carica file dello strumento",
    fileDescription: "Descrizione file (facoltativa)",
    finishValidation: "Completa verifica",
    retryUpload: "Riprova caricamento",
    startUpload: "Avvia caricamento",
    uploadedHint:
      "Il file è stato caricato. Inserisci un nuovo codice a 6 cifre per completare la verifica; prima non può essere pubblicato o scaricato.",
    retryHint:
      "Il record preparato è conservato; puoi riprovare il caricamento. Il file resta non pubblicabile e non scaricabile.",
    initialHint:
      "Il file entra prima in bozza e verifica isolata. Non è presente una scansione malware automatica, quindi non può essere pubblicato o scaricato.",
    noMatch: "Nessuno strumento corrispondente.",
    noAdmin: "Nessuno strumento: aggiungi prima uno strumento web.",
    noPublished: "Nessuno strumento pubblicato.",
    download: "Scarica",
    open: "Apri",
    file: "File",
    web: "Web",
    noDescription: "Nessuna descrizione",
    version: "Versione",
    publish: "Pubblica",
    waitingScan: "In attesa della scansione di sicurezza",
    archive: "Archivia",
    restore: "Ripristina come bozza",
    published: "Pubblicato",
    archived: "Archiviato",
    draft: "Bozza",
  },
  en: {
    invalidTotp: "Enter the 6-digit security code from your authenticator",
    linkSaved: "Web tool saved as a draft",
    createFailed: "Could not create the tool",
    selectFile: "Select a file",
    alreadyUploaded: "File uploaded; complete validation",
    uploaded: "File uploaded. Enter a new code to complete validation",
    uploadFailed: "Upload failed; the file remains hidden",
    uploadFirst: "Complete the file upload first",
    finalized: "File validated and saved as a draft",
    finalizeFailed: "File validation failed; you can retry",
    statusUpdated: "Tool status updated",
    statusFailed: "Could not update tool status",
    openFailed: "Could not open the tool",
    denied: "This account cannot view the toolkit. Sign in and activate a store.",
    readFailed: "The toolkit could not be loaded.",
    retry: "Retry",
    search: "Search name, platform, or version",
    addLink: "Add web tool",
    uploadFile: "Upload file",
    chooseFile: "Choose tool file",
    title: "Toolkit",
    adminVerification: "Toolkit administrator verification",
    adminCode: "Administrator security code",
    totpPlaceholder: "Enter 6-digit TOTP",
    totpAria: "Toolkit administrator 6-digit TOTP",
    chooseUpload: "Choose upload file",
    toolName: "Tool name",
    linkLabel: "HTTPS tool link",
    optionalDescription: "Short description (optional)",
    saveDraft: "Save draft",
    cancel: "Cancel",
    uploadAria: "Upload tool file",
    fileDescription: "File description (optional)",
    finishValidation: "Complete validation",
    retryUpload: "Retry upload",
    startUpload: "Start upload",
    uploadedHint:
      "The file was uploaded. Enter a new 6-digit code to complete validation; it cannot be published or downloaded before then.",
    retryHint:
      "The prepared record is retained and the upload can be retried. The file remains unavailable to publish or download.",
    initialHint:
      "The file first enters draft and isolated validation. There is no automatic malware scan, so it cannot be published or downloaded.",
    noMatch: "No matching tools.",
    noAdmin: "No tools yet. Add a web tool first.",
    noPublished: "No published tools.",
    download: "Download",
    open: "Open",
    file: "File",
    web: "Web",
    noDescription: "No description",
    version: "Version",
    publish: "Publish",
    waitingScan: "Waiting for security scan",
    archive: "Archive",
    restore: "Restore as draft",
    published: "Published",
    archived: "Archived",
    draft: "Draft",
  },
} as const;

type PendingToolkitFinalize = {
  id: string;
  expectedRevision: number;
  upload: ToolkitFilePrepareResult["upload"];
  uploaded: boolean;
};

export function ToolkitScreen() {
  const { locale, t } = useLocale();
  const copy = toolkitCopy[locale];
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
      throw new Error(copy.invalidTotp);
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
      toast.success(copy.linkSaved);
      setLinkTitle("");
      setLinkUrl("");
      setLinkDescription("");
      setLinkFormOpen(false);
      void refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : copy.createFailed),
  });
  const fileMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error(copy.selectFile);
      if (pendingFinalize) {
        if (pendingFinalize.uploaded) throw new Error(copy.alreadyUploaded);
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
      toast.success(copy.uploaded);
      void refresh();
    },
    onError: (error) => {
      setUploadProgress(null);
      toast.error(error instanceof Error ? error.message : copy.uploadFailed);
    },
  });
  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const pending = pendingFinalize;
      if (!pending?.uploaded) throw new Error(copy.uploadFirst);
      await requireRecentAal2();
      return finalizeToolkitFileUpload(pending.id, {
        expectedRevision: pending.expectedRevision,
      });
    },
    onSuccess: () => {
      toast.success(copy.finalized);
      setPendingFinalize(null);
      setSelectedFile(null);
      setFileTitle("");
      setFileDescription("");
      setUploadProgress(null);
      void refresh();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : copy.finalizeFailed);
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
      toast.success(copy.statusUpdated);
      void refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : copy.statusFailed),
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
      toast.error(error instanceof Error ? error.message : copy.openFailed);
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
          {copy.denied}
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
          <p>{copy.readFailed}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() => void resourcesQuery.refetch()}
          >
            {copy.retry}
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
      searchPlaceholder={copy.search}
      desktopAction={
        canManage ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLinkFormOpen((open) => !open)}
            >
              <Plus className="size-4" /> {copy.addLink}
            </Button>
            <label
              htmlFor="toolkit-file-desktop"
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-foreground px-3 text-sm font-medium text-background hover:bg-foreground/90"
            >
              <Upload className="size-4" /> {copy.uploadFile}
              <input
                id="toolkit-file-desktop"
                type="file"
                className="sr-only"
                accept=".zip,.7z,.rar,.exe,.msi,.dmg,.pkg,.apk,.deb,.pdf"
                aria-label={copy.chooseFile}
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
      <h1 className="sr-only">{copy.title}</h1>
      {canManage ? (
        <RepairOsBusinessCard
          as="div"
          className="mb-3 flex flex-wrap items-end gap-3"
          aria-label={copy.adminVerification}
        >
          <label
            htmlFor="toolkit-totp-code"
            className="min-w-[12rem] flex-1 text-xs font-medium text-muted-foreground"
          >
            {copy.adminCode}
            <Input
              id="toolkit-totp-code"
              value={totpCode}
              onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder={copy.totpPlaceholder}
              className="mt-1 text-base"
              aria-label={copy.totpAria}
            />
          </label>
          <div className="flex flex-wrap gap-2 lg:hidden">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLinkFormOpen((open) => !open)}
            >
              <Plus className="size-4" /> {copy.addLink}
            </Button>
            <label
              htmlFor="toolkit-file-mobile"
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-foreground px-3 text-sm font-medium text-background"
            >
              <Upload className="size-4" /> {copy.chooseUpload}
              <input
                id="toolkit-file-mobile"
                type="file"
                className="sr-only"
                accept=".zip,.7z,.rar,.exe,.msi,.dmg,.pkg,.apk,.deb,.pdf"
                aria-label={copy.chooseFile}
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
          aria-label={copy.addLink}
        >
          <div>
            <label
              htmlFor="toolkit-link-title"
              className="text-xs font-medium text-muted-foreground"
            >
              {copy.toolName}
            </label>
            <Input
              id="toolkit-link-title"
              value={linkTitle}
              onChange={(event) => setLinkTitle(event.target.value)}
              placeholder={copy.toolName}
              className="mt-1 text-base"
            />
          </div>
          <div>
            <label htmlFor="toolkit-link-url" className="text-xs font-medium text-muted-foreground">
              {copy.linkLabel}
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
              {copy.optionalDescription}
            </label>
            <Textarea
              id="toolkit-link-description"
              value={linkDescription}
              onChange={(event) => setLinkDescription(event.target.value)}
              placeholder={copy.optionalDescription}
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
              {linkMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}{" "}
              {copy.saveDraft}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setLinkFormOpen(false)}>
              {copy.cancel}
            </Button>
          </div>
        </RepairOsBusinessCard>
      ) : null}
      {canManage && selectedFile ? (
        <RepairOsBusinessCard
          as="div"
          className="mb-3 grid gap-3 lg:grid-cols-[1fr_1fr_auto]"
          aria-label={copy.uploadAria}
        >
          <div>
            <label
              htmlFor="toolkit-file-title"
              className="text-xs font-medium text-muted-foreground"
            >
              {copy.toolName}
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
              {copy.fileDescription}
            </label>
            <Input
              id="toolkit-file-description"
              value={fileDescription}
              onChange={(event) => setFileDescription(event.target.value)}
              placeholder={copy.fileDescription}
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
                {copy.finishValidation}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => fileMutation.mutate()}
                disabled={fileMutation.isPending}
              >
                {fileMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                {pendingFinalize ? copy.retryUpload : copy.startUpload}
              </Button>
            )}
            {uploadProgress !== null ? (
              <span className="text-xs text-muted-foreground">{uploadProgress}%</span>
            ) : null}
          </div>
          <p className="text-xs leading-5 text-muted-foreground lg:col-span-3">
            {pendingFinalize?.uploaded
              ? copy.uploadedHint
              : pendingFinalize
                ? copy.retryHint
                : copy.initialHint}
          </p>
        </RepairOsBusinessCard>
      ) : null}
      {resources.length === 0 ? (
        <RepairOsBusinessCard
          as="div"
          className="mx-auto max-w-3xl text-muted-foreground"
          role="status"
        >
          {search ? copy.noMatch : shell.isPlatformAdmin ? copy.noAdmin : copy.noPublished}
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
              copy={copy}
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
  copy,
}: {
  resource: ToolkitResource;
  canManage: boolean;
  pending: boolean;
  onOpen: () => void;
  onStatus: (action: "publish" | "archive" | "restore") => void;
  copy: (typeof toolkitCopy)[keyof typeof toolkitCopy];
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
            {resource.kind === "file" ? copy.download : copy.open}
          </Button>
        ) : null
      }
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h2 className="min-w-0 truncate text-sm font-semibold">{resource.title}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {resource.kind === "file" ? copy.file : copy.web}
        </span>
        {canManage ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {stateLabel(resource.state, copy)}
          </span>
        ) : null}
      </div>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
        {resource.description || copy.noDescription}
      </p>
      <div className="mt-3 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {resource.platform ? <span>{resource.platform}</span> : null}
        {resource.version ? (
          <span>
            {copy.version} {resource.version}
          </span>
        ) : null}
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
                {copy.publish}
              </Button>
            ) : (
              <span className="inline-flex items-center rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                {copy.waitingScan}
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
              {copy.archive}
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
              {copy.restore}
            </Button>
          ) : null}
        </div>
      ) : null}
    </RepairOsBusinessCard>
  );
}

function stateLabel(
  state: ToolkitResource["state"] | undefined,
  copy: (typeof toolkitCopy)[keyof typeof toolkitCopy],
) {
  return state === "published" ? copy.published : state === "archived" ? copy.archived : copy.draft;
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
