"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  MessageSquareText,
  RotateCcw,
  Search,
  Smartphone,
  Users,
} from "lucide-react";
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
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import {
  getStoreSettings,
  listMessageTemplates,
  resetMessageTemplate,
  updateMessageTemplate,
  type MessageTemplate,
} from "@/lib/repairdesk/api";
import { CACHE_TIMES } from "@/lib/query-performance";
import { cn } from "@/lib/utils";
import {
  RepairOsBusinessCard,
  RepairOsHeaderActionButton,
  RepairOsListScaffold,
  RepairOsSectionHeader,
} from "@/shared/ui";
import { brandGradientStyle, controls, repairOs } from "@/lib/ui-patterns";

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
  const shell = useStoreShellContext();
  const activeStoreId = shell.activeStore?.id;
  const canReadMessageTemplates = shell.permissions?.canReadMessageTemplates === true;
  const canReadStoreSettings = shell.permissions?.canReadStoreSettings === true;
  const canUpdateMessageTemplates = shell.permissions?.canUpdateMessageTemplates === true;
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [labelDraft, setLabelDraft] = useState("");
  const [bodyDraft, setBodyDraft] = useState("");
  const [enabledDraft, setEnabledDraft] = useState(true);
  const [draftStoreId, setDraftStoreId] = useState<string>();
  const [draftTemplateId, setDraftTemplateId] = useState<string>();

  const templatesQuery = useQuery({
    queryKey: messageSettingsKeys.templatesScoped(activeStoreId),
    queryFn: ({ signal }) => listMessageTemplates({ signal }),
    staleTime: CACHE_TIMES.settings,
    enabled: Boolean(activeStoreId && canReadMessageTemplates),
  });
  const storeQuery = useQuery({
    queryKey: messageSettingsKeys.storeScoped(activeStoreId),
    queryFn: ({ signal }) => getStoreSettings({ signal }),
    staleTime: CACHE_TIMES.settings,
    enabled: Boolean(activeStoreId && canReadStoreSettings),
  });

  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);
  const filteredTemplates = useMemo(() => filterTemplates(templates, search), [templates, search]);
  const selectedTemplate =
    templates.find((template) => template.id === selectedId) ??
    filteredTemplates[0] ??
    templates[0];

  useEffect(() => {
    if (!selectedTemplate || !activeStoreId) {
      setDraftStoreId(undefined);
      setDraftTemplateId(undefined);
      return;
    }
    setSelectedId(selectedTemplate.id);
    setLabelDraft(selectedTemplate.label);
    setBodyDraft(selectedTemplate.body_template);
    setEnabledDraft(selectedTemplate.enabled);
    setDraftStoreId(activeStoreId);
    setDraftTemplateId(selectedTemplate.id);
  }, [activeStoreId, selectedTemplate]);

  const draftMatchesActiveTemplate = Boolean(
    selectedTemplate &&
    activeStoreId &&
    draftStoreId === activeStoreId &&
    draftTemplateId === selectedTemplate.id,
  );
  const activeLabelDraft = draftMatchesActiveTemplate
    ? labelDraft
    : (selectedTemplate?.label ?? "");
  const activeBodyDraft = draftMatchesActiveTemplate
    ? bodyDraft
    : (selectedTemplate?.body_template ?? "");
  const activeEnabledDraft = draftMatchesActiveTemplate
    ? enabledDraft
    : (selectedTemplate?.enabled ?? false);

  const usedVariables = useMemo(() => extractTemplateVariables(activeBodyDraft), [activeBodyDraft]);
  const unknownVariables = useMemo(
    () => getUnknownTemplateVariables(activeBodyDraft, messageTemplateVariableNames),
    [activeBodyDraft],
  );
  const enabledCount = templates.filter((template) => template.enabled).length;
  const orderCount = templates.filter((template) => template.domain === "order").length;
  const customerCount = templates.filter((template) => template.domain === "customer").length;
  const preview = useMemo(
    () => renderTemplate(activeBodyDraft, createPreviewTemplateContext(storeQuery.data)),
    [activeBodyDraft, storeQuery.data],
  );
  const templateHealth = useMemo(
    () =>
      evaluateTemplateHealth({
        bodyTemplate: activeBodyDraft,
        allowedVariables: messageTemplateVariableNames,
        enabled: activeEnabledDraft,
      }),
    [activeBodyDraft, activeEnabledDraft],
  );
  const hasChanges =
    selectedTemplate &&
    draftMatchesActiveTemplate &&
    (activeLabelDraft !== selectedTemplate.label ||
      activeBodyDraft !== selectedTemplate.body_template ||
      activeEnabledDraft !== selectedTemplate.enabled);
  const canSaveTemplate = Boolean(hasChanges) && templateHealth.canSave;

  function handleInsertVariable(variable: string) {
    if (!canUpdateMessageTemplates) return;
    const textarea = bodyTextareaRef.current;
    const { bodyTemplate, cursorPosition } = insertTemplateVariable(
      activeBodyDraft,
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
      if (!canUpdateMessageTemplates) throw new Error("当前账号没有修改消息模板的权限");
      if (!draftMatchesActiveTemplate) throw new Error("模板草稿与当前店铺不一致");
      return updateMessageTemplate(selectedTemplate.id, {
        label: activeLabelDraft,
        body_template: activeBodyDraft,
        enabled: activeEnabledDraft,
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
      if (!canUpdateMessageTemplates) throw new Error("当前账号没有修改消息模板的权限");
      return resetMessageTemplate(selectedTemplate.id);
    },
    onSuccess: (template) => {
      toast.success("已恢复默认模板");
      setSelectedId(template.id);
      queryClient.invalidateQueries({ queryKey: messageSettingsKeys.templates });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "恢复失败"),
  });

  if (shell.isLoading || (canReadMessageTemplates && templatesQuery.isLoading)) {
    return <MessagesLoading />;
  }

  if (!canReadMessageTemplates) {
    return (
      <RepairOsListScaffold title="消息模板" subtitle="需要权限" eyebrow="工作台 / 消息">
        <RepairOsBusinessCard
          as="div"
          data-ui="messages-template-no-permission"
          className="mx-auto mt-16 max-w-sm"
          role="status"
        >
          <span className="block text-sm font-semibold">无法打开消息模板</span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            当前账号不具备读取消息模板的店铺权限，页面未发送模板查询。
          </span>
        </RepairOsBusinessCard>
      </RepairOsListScaffold>
    );
  }

  if (templatesQuery.isError) {
    return (
      <RepairOsListScaffold
        title="消息模板"
        subtitle="读取失败"
        eyebrow="工作台 / 消息"
        chips={[
          { key: "enabled", label: "启用", shortLabel: "启", count: "-" },
          { key: "order", label: "工单", shortLabel: "单", count: "-" },
          { key: "customer", label: "客户", shortLabel: "客", count: "-" },
        ]}
      >
        <RepairOsBusinessCard
          as="div"
          data-ui="messages-template-load-error"
          className="mx-auto mt-16 max-w-sm grid-cols-[auto_minmax(0,1fr)_auto] items-center rounded-xl border-status-danger-foreground/25 bg-status-danger/10 px-4 py-3 text-status-danger-foreground shadow-[var(--shadow-card)] hover:bg-status-danger/10"
          leading={
            <span className="grid size-9 place-items-center rounded-lg bg-status-danger/10">
              <MessageSquareText className="size-4" />
            </span>
          }
          trailing={
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 bg-card"
              onClick={() => templatesQuery.refetch()}
            >
              重新加载
            </Button>
          }
          trailingClassName="shrink-0"
          aria-live="polite"
        >
          <span className="block text-sm font-semibold">读取消息模板失败</span>
          <span className="mt-0.5 block text-[11px] leading-4 text-status-danger-foreground/80">
            请重新加载模板列表后继续编辑。
          </span>
        </RepairOsBusinessCard>
      </RepairOsListScaffold>
    );
  }

  return (
    <RepairOsListScaffold
      title="消息模板"
      subtitle={`启用 ${enabledCount} · 共 ${templates.length} 个`}
      eyebrow="工作台 / 消息"
      action={
        canUpdateMessageTemplates ? (
          <RepairOsHeaderActionButton
            ariaLabel="保存模板"
            disabled={!canSaveTemplate || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            <Check className="size-4" />
          </RepairOsHeaderActionButton>
        ) : undefined
      }
      desktopAction={
        canUpdateMessageTemplates ? (
          <Button
            size="sm"
            className={cn("h-9 gap-1.5", controls.brandButton)}
            style={brandGradientStyle}
            disabled={!canSaveTemplate || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            <Check className="mr-1.5 size-3.5" /> 保存模板
          </Button>
        ) : undefined
      }
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="搜索模板"
      chips={[
        { key: "enabled", label: "启用", shortLabel: "启", count: enabledCount },
        { key: "order", label: "工单", shortLabel: "单", count: orderCount },
        { key: "customer", label: "客户", shortLabel: "客", count: customerCount },
      ]}
    >
      {!canUpdateMessageTemplates ? (
        <div
          data-ui="messages-template-readonly"
          className="mb-3 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2 text-xs text-muted-foreground"
        >
          当前账号可查看和预览消息模板，但不能修改、恢复或保存。
        </div>
      ) : null}
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
                    value={activeLabelDraft}
                    disabled={!canUpdateMessageTemplates}
                    onChange={(event) => setLabelDraft(event.target.value)}
                    className="h-8 text-sm sm:h-9"
                  />
                </div>
                <div className="flex items-end">
                  <RepairOsBusinessCard
                    as="div"
                    data-ui="messages-template-enabled-toggle"
                    className="h-8 min-w-[7.25rem] items-center rounded-md bg-surface px-2.5 py-0 shadow-none hover:bg-surface sm:h-9"
                    bodyClassName="self-center"
                    trailing={
                      <Switch
                        id="template-enabled"
                        checked={activeEnabledDraft}
                        disabled={!canUpdateMessageTemplates}
                        onCheckedChange={setEnabledDraft}
                        aria-label={activeEnabledDraft ? "停用消息模板" : "启用消息模板"}
                      />
                    }
                    trailingClassName="shrink-0 self-center"
                  >
                    <Label
                      htmlFor="template-enabled"
                      className="block cursor-pointer text-xs sm:text-sm"
                    >
                      {activeEnabledDraft ? "启用" : "停用"}
                    </Label>
                  </RepairOsBusinessCard>
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
                  value={activeBodyDraft}
                  disabled={!canUpdateMessageTemplates}
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
                      !canUpdateMessageTemplates ||
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
                    disabled={
                      !canUpdateMessageTemplates || !canSaveTemplate || saveMutation.isPending
                    }
                    onClick={() => saveMutation.mutate()}
                  >
                    <Check className="mr-1.5 size-3.5" /> 保存
                  </Button>
                </div>
              </div>
            </div>

            <aside className="grid min-w-0 gap-3 xl:grid-cols-2 min-[1440px]:block min-[1440px]:space-y-4">
              <section className={cn(repairOs.adminSection, "min-w-0")}>
                <RepairOsSectionHeader
                  title="变量助手"
                  description="点击变量插入到当前光标位置。"
                  action={
                    <Badge variant={unknownVariables.length ? "destructive" : "secondary"}>
                      {templateHealth.label}
                    </Badge>
                  }
                />

                <TemplateHealthPanel health={templateHealth} />

                <div className="mt-2 grid min-w-0 gap-1.5 2xl:grid-cols-2">
                  {MESSAGE_TEMPLATE_VARIABLES.map((variable) => {
                    const used = usedVariables.includes(variable.name);
                    return (
                      <RepairOsBusinessCard
                        key={variable.name}
                        as="button"
                        type="button"
                        disabled={!canUpdateMessageTemplates}
                        onClick={() => handleInsertVariable(variable.name)}
                        className={cn(
                          repairOs.businessCardDense,
                          "w-full rounded-lg px-2 py-1.5 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                          used
                            ? "border-primary/35 bg-primary/10 text-primary"
                            : "border-[var(--border-panel)] bg-card text-foreground",
                        )}
                        bodyClassName="min-w-0"
                        trailing={
                          <span className="min-w-0 truncate text-right font-mono text-[10px] text-muted-foreground">
                            {`{{${variable.name}}}`}
                          </span>
                        }
                        title={`插入 ${variable.label}`}
                      >
                        <span className="min-w-0 truncate text-[11px] font-medium">
                          {variable.label}
                        </span>
                      </RepairOsBusinessCard>
                    );
                  })}
                </div>
              </section>

              <section className={cn(repairOs.adminSection, "min-w-0")}>
                <RepairOsSectionHeader
                  title="实时预览"
                  description={templateHealth.detail}
                  action={
                    <Badge className={templateHealthToneClass(templateHealth.tone)}>
                      {templateHealth.canSend ? "可发送" : activeEnabledDraft ? "不可发送" : "停用"}
                    </Badge>
                  }
                />
                <pre className="mt-2 max-h-[360px] min-w-0 whitespace-pre-wrap break-words rounded-md border border-[var(--border-panel)] bg-surface-muted p-2.5 text-xs leading-relaxed text-foreground [overflow-wrap:anywhere] xl:max-h-[520px]">
                  {preview || " "}
                </pre>
              </section>
            </aside>
          </section>
        ) : (
          <RepairOsBusinessCard
            as="div"
            data-ui="messages-template-empty-state"
            className="mx-auto mt-8 max-w-sm grid-cols-[auto_minmax(0,1fr)] items-center rounded-xl px-4 py-3 shadow-[var(--shadow-card)]"
            leading={
              <span className="grid size-9 place-items-center rounded-lg bg-[var(--surface-panel-muted)] text-muted-foreground">
                <MessageSquareText className="size-4" />
              </span>
            }
          >
            <span className="block text-sm font-semibold text-foreground">暂无消息模板</span>
            <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
              新增默认模板后可以在这里编辑启用状态、变量和预览。
            </span>
          </RepairOsBusinessCard>
        )}
      </section>
    </RepairOsListScaffold>
  );
}

function TemplateHealthPanel({ health }: { health: ReturnType<typeof evaluateTemplateHealth> }) {
  if (!health.issues.length) {
    return (
      <RepairOsBusinessCard
        as="div"
        data-ui="messages-template-health"
        leading={
          <span className="grid size-4 place-items-center rounded-full bg-status-success text-status-success-foreground">
            <Check className="size-3" />
          </span>
        }
        className="mt-2 grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-lg border-status-success/25 bg-status-success/10 px-2 py-1.5 text-status-success-foreground shadow-none hover:bg-status-success/10"
        leadingClassName="mt-0.5"
      >
        <span className="block text-[11px] leading-4">
          模板检查通过，变量和正文都可以用于发送。
        </span>
      </RepairOsBusinessCard>
    );
  }

  return (
    <div data-ui="messages-template-health" className="mt-2 space-y-1">
      {health.issues.map((issue) => (
        <RepairOsBusinessCard
          as="div"
          key={issue.key}
          leading={
            <span
              className={cn(
                "grid size-4 place-items-center rounded-full",
                issue.tone === "danger"
                  ? "bg-status-danger text-status-danger-foreground"
                  : "bg-status-warn text-status-warn-foreground",
              )}
            >
              <AlertTriangle className="size-3" />
            </span>
          }
          className={cn(
            "grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-lg px-2 py-1.5 shadow-none",
            issue.tone === "danger"
              ? "border-status-danger-foreground/25 bg-status-danger/15 text-status-danger-foreground hover:bg-status-danger/15"
              : "border-status-warn-foreground/25 bg-status-warn/15 text-status-warn-foreground hover:bg-status-warn/15",
          )}
          leadingClassName="mt-0.5"
        >
          <span className="block text-[11px] leading-4">{issue.label}</span>
        </RepairOsBusinessCard>
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
            <RepairOsBusinessCard
              key={template.id}
              as="button"
              type="button"
              onClick={() => onSelect(template.id)}
              className={cn(
                repairOs.businessCardDense,
                "w-full rounded-lg px-2.5 py-2 text-left hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                selectedId === template.id
                  ? "border-primary/35 bg-primary/10 text-primary shadow-[var(--shadow-card)]"
                  : "border-[var(--border-panel)] bg-card",
              )}
              bodyClassName="min-w-0"
              trailing={
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
              }
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold leading-5">
                  {template.label}
                </span>
                <span className="block truncate text-[11px] leading-4 text-muted-foreground">
                  {template.kind} · {template.channel}
                </span>
              </span>
            </RepairOsBusinessCard>
          ))
        ) : (
          <RepairOsBusinessCard
            as="div"
            data-ui="messages-template-group-empty"
            className="grid-cols-[auto_minmax(0,1fr)] items-center rounded-lg border-dashed px-2.5 py-2 text-xs text-muted-foreground shadow-none"
            leading={
              <span className="grid size-7 place-items-center rounded-md bg-[var(--surface-panel-muted)]">
                <MessageSquareText className="size-3.5" />
              </span>
            }
          >
            <span className="block truncate">无匹配模板</span>
          </RepairOsBusinessCard>
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
      eyebrow="工作台 / 消息"
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
