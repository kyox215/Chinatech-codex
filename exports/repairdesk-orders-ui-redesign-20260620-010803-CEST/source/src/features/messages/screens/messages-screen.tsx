"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MessageSquareText, RotateCcw, Search, Smartphone, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  MESSAGE_TEMPLATE_VARIABLES,
  findDefaultMessageTemplate,
} from "@/features/messages/model/message-template-defaults";
import {
  createPreviewTemplateContext,
  evaluateTemplateHealth,
  extractTemplateVariables,
  getUnknownTemplateVariables,
  insertTemplateVariable,
  renderTemplate,
} from "@/features/messages/model/template-renderer";
import { messageSettingsKeys } from "@/features/messages/api/query-keys";
import {
  getStoreSettings,
  listMessageTemplates,
  resetMessageTemplate,
  updateMessageTemplate,
  type MessageTemplate,
} from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";
import {
  RepairOsHeaderActionButton,
  RepairOsListScaffold,
  RepairOsModuleHeader,
} from "@/shared/ui";
import { brandGradientStyle, controls, repairOs, surfaces } from "@/lib/ui-patterns";

const domainMeta = {
  order: {
    title: "工单通知",
    icon: Smartphone,
  },
  customer: {
    title: "客户消息",
    icon: Users,
  },
} as const;

const messageTemplateVariableNames = MESSAGE_TEMPLATE_VARIABLES.map((variable) => variable.name);

export function MessagesScreen() {
  const queryClient = useQueryClient();
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [labelDraft, setLabelDraft] = useState("");
  const [bodyDraft, setBodyDraft] = useState("");
  const [enabledDraft, setEnabledDraft] = useState(true);

  const templatesQuery = useQuery({
    queryKey: messageSettingsKeys.templates,
    queryFn: listMessageTemplates,
  });
  const storeQuery = useQuery({
    queryKey: messageSettingsKeys.store,
    queryFn: getStoreSettings,
  });

  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);
  const filteredTemplates = useMemo(() => filterTemplates(templates, search), [templates, search]);
  const selectedTemplate =
    templates.find((template) => template.id === selectedId) ??
    filteredTemplates[0] ??
    templates[0];

  useEffect(() => {
    if (!selectedTemplate) return;
    setSelectedId(selectedTemplate.id);
    setLabelDraft(selectedTemplate.label);
    setBodyDraft(selectedTemplate.body_template);
    setEnabledDraft(selectedTemplate.enabled);
  }, [selectedTemplate]);

  const usedVariables = useMemo(() => extractTemplateVariables(bodyDraft), [bodyDraft]);
  const unknownVariables = useMemo(
    () => getUnknownTemplateVariables(bodyDraft, messageTemplateVariableNames),
    [bodyDraft],
  );
  const enabledCount = templates.filter((template) => template.enabled).length;
  const orderCount = templates.filter((template) => template.domain === "order").length;
  const customerCount = templates.filter((template) => template.domain === "customer").length;
  const preview = useMemo(
    () => renderTemplate(bodyDraft, createPreviewTemplateContext(storeQuery.data)),
    [bodyDraft, storeQuery.data],
  );
  const templateHealth = useMemo(
    () =>
      evaluateTemplateHealth({
        bodyTemplate: bodyDraft,
        allowedVariables: messageTemplateVariableNames,
        enabled: enabledDraft,
      }),
    [bodyDraft, enabledDraft],
  );
  const hasChanges =
    selectedTemplate &&
    (labelDraft !== selectedTemplate.label ||
      bodyDraft !== selectedTemplate.body_template ||
      enabledDraft !== selectedTemplate.enabled);
  const canSaveTemplate = Boolean(hasChanges) && templateHealth.canSave;

  function handleInsertVariable(variable: string) {
    const textarea = bodyTextareaRef.current;
    const { bodyTemplate, cursorPosition } = insertTemplateVariable(
      bodyDraft,
      variable,
      textarea?.selectionStart,
      textarea?.selectionEnd,
    );
    setBodyDraft(bodyTemplate);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(cursorPosition, cursorPosition);
    });
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate) throw new Error("请选择模板");
      return updateMessageTemplate(selectedTemplate.id, {
        label: labelDraft,
        body_template: bodyDraft,
        enabled: enabledDraft,
      });
    },
    onSuccess: (template) => {
      toast.success("模板已保存");
      setSelectedId(template.id);
      queryClient.invalidateQueries({ queryKey: messageSettingsKeys.templates });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "保存失败"),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate) throw new Error("请选择模板");
      return resetMessageTemplate(selectedTemplate.id);
    },
    onSuccess: (template) => {
      toast.success("已恢复默认模板");
      setSelectedId(template.id);
      queryClient.invalidateQueries({ queryKey: messageSettingsKeys.templates });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "恢复失败"),
  });

  if (templatesQuery.isLoading) {
    return <MessagesLoading />;
  }

  if (templatesQuery.isError) {
    return (
      <RepairOsListScaffold
        title="消息模板"
        subtitle="读取失败"
        chips={[
          { key: "enabled", label: "启用", shortLabel: "启", count: "-" },
          { key: "order", label: "工单", shortLabel: "单", count: "-" },
          { key: "customer", label: "客户", shortLabel: "客", count: "-" },
        ]}
      >
        <section className={surfaces.empty}>
          <MessageSquareText className="mb-3 size-8 text-status-danger-foreground" />
          <p className="text-sm text-status-danger-foreground">读取消息模板失败</p>
          <Button variant="outline" className="mt-3" onClick={() => templatesQuery.refetch()}>
            重新加载
          </Button>
        </section>
      </RepairOsListScaffold>
    );
  }

  return (
    <RepairOsListScaffold
      title="消息模板"
      subtitle={`启用 ${enabledCount} · 共 ${templates.length} 个`}
      action={
        <RepairOsHeaderActionButton
          ariaLabel="保存模板"
          disabled={!canSaveTemplate || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          <Check className="size-4" />
        </RepairOsHeaderActionButton>
      }
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="搜索模板"
      chips={[
        { key: "enabled", label: "启用", shortLabel: "启", count: enabledCount },
        { key: "order", label: "工单", shortLabel: "单", count: orderCount },
        { key: "customer", label: "客户", shortLabel: "客", count: customerCount },
      ]}
      desktopHeader={
        <div className="mb-3 space-y-3 sm:mb-4">
          <RepairOsModuleHeader
            action={
              <Button
                size="sm"
                className={cn("h-9 gap-1.5", controls.brandButton)}
                style={brandGradientStyle}
                disabled={!canSaveTemplate || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                <Check className="mr-1.5 size-3.5" /> 保存模板
              </Button>
            }
          />
        </div>
      }
    >
      <section className="grid min-w-0 gap-3 lg:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={cn(repairOs.adminSection, "min-w-0 p-2.5 sm:p-3")}>
          <div className="relative hidden md:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索模板"
              className={cn(repairOs.searchInput, "pl-8")}
            />
          </div>
          <div className="mt-2 max-h-[42svh] space-y-3 overflow-y-auto pr-0.5 lg:max-h-[calc(100svh-12rem)] lg:pr-1">
            {(["order", "customer"] as const).map((domain) => (
              <TemplateGroup
                key={domain}
                domain={domain}
                templates={filteredTemplates.filter((template) => template.domain === domain)}
                selectedId={selectedTemplate?.id}
                onSelect={setSelectedId}
              />
            ))}
          </div>
        </aside>

        {selectedTemplate ? (
          <section className="grid min-w-0 gap-3 min-[1440px]:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className={cn(repairOs.adminSection, "min-w-0 space-y-3")}>
              <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="template-label" className="text-xs">
                    后台标签
                  </Label>
                  <Input
                    id="template-label"
                    value={labelDraft}
                    onChange={(event) => setLabelDraft(event.target.value)}
                    className="h-8 text-sm sm:h-9"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex h-8 items-center gap-2 rounded-md border border-[var(--border-panel)] bg-surface px-2.5 text-xs sm:h-9 sm:text-sm">
                    <Switch checked={enabledDraft} onCheckedChange={setEnabledDraft} />
                    {enabledDraft ? "启用" : "停用"}
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="template-body" className="text-xs">
                    模板正文
                  </Label>
                  <span
                    className={cn(
                      "truncate text-[11px]",
                      unknownVariables.length
                        ? "text-status-danger-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {unknownVariables.length
                      ? `未知变量 ${unknownVariables.length} 个`
                      : `已用变量 ${usedVariables.length} 个`}
                  </span>
                </div>
                <Textarea
                  ref={bodyTextareaRef}
                  id="template-body"
                  rows={12}
                  value={bodyDraft}
                  onChange={(event) => setBodyDraft(event.target.value)}
                  className="min-h-[260px] font-mono text-base leading-relaxed md:min-h-[340px] md:text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-panel)] pt-2">
                <div className="text-xs text-muted-foreground">
                  {selectedTemplate.channel.toUpperCase()} ·{" "}
                  {selectedTemplate.language.toUpperCase()}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    disabled={
                      resetMutation.isPending ||
                      !findDefaultMessageTemplate(
                        selectedTemplate.domain,
                        selectedTemplate.kind,
                        selectedTemplate.channel,
                      )
                    }
                    onClick={() => resetMutation.mutate()}
                  >
                    <RotateCcw className="mr-1.5 size-3.5" /> 恢复默认
                  </Button>
                  <Button
                    size="sm"
                    className={cn("h-8 gap-1.5", controls.brandButton)}
                    style={brandGradientStyle}
                    disabled={!canSaveTemplate || saveMutation.isPending}
                    onClick={() => saveMutation.mutate()}
                  >
                    <Check className="mr-1.5 size-3.5" /> 保存
                  </Button>
                </div>
              </div>
            </div>

            <aside className="grid min-w-0 gap-3 xl:grid-cols-2 min-[1440px]:block min-[1440px]:space-y-4">
              <section className={cn(repairOs.adminSection, "min-w-0")}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold">变量助手</h2>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      点击变量插入到当前光标位置。
                    </p>
                  </div>
                  <Badge variant={unknownVariables.length ? "destructive" : "secondary"}>
                    {templateHealth.label}
                  </Badge>
                </div>

                <TemplateHealthPanel health={templateHealth} />

                <div className="mt-2 grid min-w-0 gap-1.5 2xl:grid-cols-2">
                  {MESSAGE_TEMPLATE_VARIABLES.map((variable) => {
                    const used = usedVariables.includes(variable.name);
                    return (
                      <button
                        key={variable.name}
                        type="button"
                        onClick={() => handleInsertVariable(variable.name)}
                        className={cn(
                          "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                          used
                            ? "border-primary/35 bg-primary/10 text-primary"
                            : "border-[var(--border-panel)] bg-card text-foreground",
                        )}
                        title={`插入 ${variable.label}`}
                      >
                        <span className="min-w-0 truncate text-[11px] font-medium">
                          {variable.label}
                        </span>
                        <span className="min-w-0 truncate text-right font-mono text-[10px] text-muted-foreground">
                          {`{{${variable.name}}}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className={cn(repairOs.adminSection, "min-w-0")}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">实时预览</h2>
                  <Badge className={templateHealthToneClass(templateHealth.tone)}>
                    {templateHealth.canSend ? "可发送" : enabledDraft ? "不可发送" : "停用"}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                  {templateHealth.detail}
                </p>
                <pre className="mt-2 max-h-[360px] min-w-0 whitespace-pre-wrap break-words rounded-md border border-[var(--border-panel)] bg-surface-muted p-2.5 text-xs leading-relaxed text-foreground [overflow-wrap:anywhere] xl:max-h-[520px]">
                  {preview || " "}
                </pre>
              </section>
            </aside>
          </section>
        ) : (
          <section className={surfaces.empty}>
            <MessageSquareText className="mb-3 size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">暂无消息模板</p>
          </section>
        )}
      </section>
    </RepairOsListScaffold>
  );
}

function TemplateHealthPanel({ health }: { health: ReturnType<typeof evaluateTemplateHealth> }) {
  if (!health.issues.length) {
    return (
      <div className="mt-2 rounded-lg border border-status-success/25 bg-status-success/10 px-2 py-1.5 text-[11px] leading-4 text-status-success-foreground">
        模板检查通过，变量和正文都可以用于发送。
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-1">
      {health.issues.map((issue) => (
        <div
          key={issue.key}
          className={cn(
            "rounded-lg border px-2 py-1.5 text-[11px] leading-4",
            issue.tone === "danger"
              ? "border-status-danger-foreground/25 bg-status-danger/15 text-status-danger-foreground"
              : "border-status-warn-foreground/25 bg-status-warn/15 text-status-warn-foreground",
          )}
        >
          {issue.label}
        </div>
      ))}
    </div>
  );
}

function templateHealthToneClass(tone: ReturnType<typeof evaluateTemplateHealth>["tone"]) {
  if (tone === "success") return "bg-status-success text-status-success-foreground";
  if (tone === "warning") return "bg-status-warn text-status-warn-foreground";
  if (tone === "danger") return "bg-status-danger text-status-danger-foreground";
  return "bg-status-neutral text-status-neutral-foreground";
}

function TemplateGroup({
  domain,
  templates,
  selectedId,
  onSelect,
}: {
  domain: keyof typeof domainMeta;
  templates: MessageTemplate[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const meta = domainMeta[domain];
  const Icon = meta.icon;

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center gap-2 px-1 text-[11px] font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        {meta.title}
      </div>
      <div className="space-y-1.5">
        {templates.length ? (
          templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelect(template.id)}
              className={cn(
                "grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors hover:bg-accent/40",
                selectedId === template.id
                  ? "border-primary/35 bg-primary/10 text-primary shadow-[var(--shadow-card)]"
                  : "border-[var(--border-panel)] bg-card",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold leading-5">
                  {template.label}
                </span>
                <span className="block truncate text-[11px] leading-4 text-muted-foreground">
                  {template.kind} · {template.channel}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    template.enabled ? "bg-status-success-foreground" : "bg-muted-foreground/50",
                  )}
                />
                <span className="text-[10px] text-muted-foreground">
                  {template.enabled ? "启用" : "停用"}
                </span>
              </span>
            </button>
          ))
        ) : (
          <div className="rounded-md border border-dashed px-3 py-5 text-center text-xs text-muted-foreground">
            无匹配模板
          </div>
        )}
      </div>
    </div>
  );
}

function MessagesLoading() {
  return (
    <RepairOsListScaffold
      title="消息模板"
      subtitle="正在读取模板"
      chips={[
        { key: "enabled", label: "启用", shortLabel: "启", count: "-" },
        { key: "order", label: "工单", shortLabel: "单", count: "-" },
        { key: "customer", label: "客户", shortLabel: "客", count: "-" },
      ]}
    >
      <section className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className={cn(repairOs.adminSection, "space-y-2.5 p-2.5 sm:p-3")}>
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
        <div className={cn(repairOs.adminSection, "space-y-3")}>
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-[280px] w-full md:h-[360px]" />
        </div>
      </section>
    </RepairOsListScaffold>
  );
}

function filterTemplates(templates: MessageTemplate[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return templates;
  return templates.filter(
    (template) =>
      template.label.toLowerCase().includes(query) ||
      template.kind.toLowerCase().includes(query) ||
      template.channel.toLowerCase().includes(query),
  );
}
