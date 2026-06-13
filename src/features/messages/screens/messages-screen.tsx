"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  MessageSquareText,
  RotateCcw,
  Search,
  Smartphone,
  ToggleLeft,
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
  extractTemplateVariables,
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
import { RepairOsMetricStrip, RepairOsModuleHeader } from "@/shared/ui";
import { brandGradientStyle, controls, pageShell, repairOs, surfaces } from "@/lib/ui-patterns";

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

export function MessagesScreen() {
  const queryClient = useQueryClient();
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
  const enabledCount = templates.filter((template) => template.enabled).length;
  const orderCount = templates.filter((template) => template.domain === "order").length;
  const customerCount = templates.filter((template) => template.domain === "customer").length;
  const preview = useMemo(
    () => renderTemplate(bodyDraft, createPreviewTemplateContext(storeQuery.data)),
    [bodyDraft, storeQuery.data],
  );
  const hasChanges =
    selectedTemplate &&
    (labelDraft !== selectedTemplate.label ||
      bodyDraft !== selectedTemplate.body_template ||
      enabledDraft !== selectedTemplate.enabled);

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
      <main className={pageShell.list}>
        <section className={surfaces.empty}>
          <MessageSquareText className="mb-3 size-8 text-status-danger-foreground" />
          <p className="text-sm text-status-danger-foreground">读取消息模板失败</p>
          <Button variant="outline" className="mt-3" onClick={() => templatesQuery.refetch()}>
            重新加载
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className={cn(pageShell.list, "pb-8 pt-3 sm:pt-5")}>
      <div className="mb-3 space-y-3 sm:mb-4">
        <RepairOsModuleHeader
          action={
            <Button
              size="sm"
              className={cn("h-9 gap-1.5", controls.brandButton)}
              style={brandGradientStyle}
              disabled={!hasChanges || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              <Check className="mr-1.5 size-3.5" /> 保存模板
            </Button>
          }
        />
        <RepairOsMetricStrip
          className="sm:hidden"
          metrics={[
            { label: "启用", value: enabledCount, hint: "模板", icon: ToggleLeft, tone: "green" },
            { label: "工单", value: orderCount, hint: "通知", icon: Smartphone, tone: "blue" },
            { label: "客户", value: customerCount, hint: "消息", icon: Users, tone: "amber" },
          ]}
        />
      </div>

      <section className="grid min-w-0 gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className={cn(repairOs.adminSection, "min-w-0 p-2.5 sm:p-3")}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索模板"
              className={cn(repairOs.searchInput, "pl-8")}
            />
          </div>
          <div className="mt-2 max-h-[42svh] space-y-3 overflow-y-auto pr-0.5 lg:max-h-none lg:overflow-visible lg:pr-0">
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
          <section className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
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
                <Label htmlFor="template-body" className="text-xs">
                  模板正文
                </Label>
                <Textarea
                  id="template-body"
                  rows={12}
                  value={bodyDraft}
                  onChange={(event) => setBodyDraft(event.target.value)}
                  className="min-h-[260px] font-mono text-xs leading-relaxed md:min-h-[340px]"
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
                    disabled={!hasChanges || saveMutation.isPending}
                    onClick={() => saveMutation.mutate()}
                  >
                    <Check className="mr-1.5 size-3.5" /> 保存
                  </Button>
                </div>
              </div>
            </div>

            <aside className="min-w-0 space-y-4">
              <section className={cn(repairOs.adminSection, "min-w-0")}>
                <h2 className="text-sm font-semibold">可用变量</h2>
                <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
                  {MESSAGE_TEMPLATE_VARIABLES.map((variable) => {
                    const used = usedVariables.includes(variable.name);
                    return (
                      <Badge
                        key={variable.name}
                        variant={used ? "default" : "outline"}
                        className="max-w-full font-mono text-[11px]"
                        title={variable.label}
                      >
                        {`{{${variable.name}}}`}
                      </Badge>
                    );
                  })}
                </div>
              </section>

              <section className={cn(repairOs.adminSection, "min-w-0")}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">实时预览</h2>
                  <Badge variant={enabledDraft ? "secondary" : "outline"}>
                    {enabledDraft ? "启用" : "停用"}
                  </Badge>
                </div>
                <pre className="mt-2 max-h-[360px] min-w-0 whitespace-pre-wrap rounded-md border border-[var(--border-panel)] bg-surface-muted p-2.5 text-xs leading-relaxed text-foreground xl:max-h-[520px]">
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
    </main>
  );
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
    <main className={cn(pageShell.list, "pb-8 pt-3 sm:pt-5")}>
      <div className="mb-4">
        <div>
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-3 h-7 w-52" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
      </div>
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
    </main>
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
