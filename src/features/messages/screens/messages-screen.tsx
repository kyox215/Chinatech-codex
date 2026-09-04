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
import { storesKeys } from "@/features/stores/api/query-keys";
import {
  getStoreSettings,
  listMessageTemplates,
  resetMessageTemplate,
  updateMessageTemplate,
  type MessageTemplate,
  type StoreContext,
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
import { useLocale } from "@/shared/i18n/locale-provider";
import { getMessagesScreenCopy, type MessagesScreenCopy } from "@/shared/i18n/messages";

const domainMeta = {
  order: {
    copyKey: "domainOrder",
    icon: Smartphone,
  },
  customer: {
    copyKey: "domainCustomer",
    icon: Users,
  },
} as const;

const messageTemplateVariableNames = MESSAGE_TEMPLATE_VARIABLES.map((variable) => variable.name);

interface MessageTemplateMutationAuthority {
  operationId: number;
  templateId: string;
  storeId: string;
  membershipId?: string;
  role?: string;
  membershipStatus?: string;
  authorityEpoch: number;
  authorityKey: string;
}

interface MessageTemplateSaveRequest extends MessageTemplateMutationAuthority {
  input: {
    label: string;
    body_template: string;
    enabled: boolean;
  };
}

type MessageTemplateResetRequest = MessageTemplateMutationAuthority;

export function MessagesScreen() {
  const { locale, t } = useLocale();
  const copy = getMessagesScreenCopy(locale);
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
  const [draftAuthorityKey, setDraftAuthorityKey] = useState<string>();
  const mountedRef = useRef(false);
  const saveLockRef = useRef<number | null>(null);
  const resetLockRef = useRef<number | null>(null);
  const operationSequenceRef = useRef(0);
  const authorityKey = [
    shell.authorityFingerprint,
    activeStoreId ?? "no-store",
    canReadMessageTemplates ? "read" : "no-read",
    canUpdateMessageTemplates ? "update" : "no-update",
  ].join("|");
  const authorityRef = useRef({
    key: authorityKey,
    epoch: 0,
    storeId: activeStoreId,
    canRead: canReadMessageTemplates,
    canUpdate: canUpdateMessageTemplates,
  });
  if (authorityRef.current.key !== authorityKey) {
    authorityRef.current = {
      key: authorityKey,
      epoch: authorityRef.current.epoch + 1,
      storeId: activeStoreId,
      canRead: canReadMessageTemplates,
      canUpdate: canUpdateMessageTemplates,
    };
    saveLockRef.current = null;
    resetLockRef.current = null;
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      authorityRef.current = {
        ...authorityRef.current,
        epoch: authorityRef.current.epoch + 1,
      };
      saveLockRef.current = null;
      resetLockRef.current = null;
    };
  }, []);

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
    enabled: Boolean(activeStoreId && canReadMessageTemplates && canReadStoreSettings),
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
      setDraftAuthorityKey(undefined);
      return;
    }
    setSelectedId(selectedTemplate.id);
    setLabelDraft(selectedTemplate.label);
    setBodyDraft(selectedTemplate.body_template);
    setEnabledDraft(selectedTemplate.enabled);
    setDraftStoreId(activeStoreId);
    setDraftTemplateId(selectedTemplate.id);
    setDraftAuthorityKey(authorityKey);
  }, [activeStoreId, authorityKey, selectedTemplate]);

  const draftMatchesActiveTemplate = Boolean(
    selectedTemplate &&
    activeStoreId &&
    draftStoreId === activeStoreId &&
    draftTemplateId === selectedTemplate.id &&
    draftAuthorityKey === authorityKey,
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
  const previewAvailability = !canReadStoreSettings
    ? "unavailable"
    : storeQuery.isLoading
      ? "loading"
      : storeQuery.isError
        ? "failed"
        : "ready";
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

  function isCurrentAuthority(request: MessageTemplateMutationAuthority) {
    const current = authorityRef.current;
    return Boolean(
      mountedRef.current &&
      current.epoch === request.authorityEpoch &&
      current.key === request.authorityKey &&
      current.storeId === request.storeId &&
      current.canRead &&
      current.canUpdate,
    );
  }

  function isCurrentCachedAuthority(request: MessageTemplateMutationAuthority) {
    const current = queryClient.getQueryData<StoreContext>(storesKeys.context);
    return Boolean(
      current?.activeStore?.id === request.storeId &&
      current.activeStore.membershipId === request.membershipId &&
      current.activeStore.role === request.role &&
      current.activeStore.status === request.membershipStatus &&
      current.permissions?.canReadMessageTemplates === true &&
      current.permissions?.canUpdateMessageTemplates === true,
    );
  }

  function canApplyMutationResult(request: MessageTemplateMutationAuthority) {
    return isCurrentAuthority(request) && isCurrentCachedAuthority(request);
  }

  const saveMutation = useMutation({
    mutationFn: async (request: MessageTemplateSaveRequest) => {
      if (!canApplyMutationResult(request)) throw new Error("STALE_MESSAGE_TEMPLATE_AUTHORITY");
      const template = await updateMessageTemplate(request.templateId, request.input);
      if (!canApplyMutationResult(request)) throw new Error("STALE_MESSAGE_TEMPLATE_AUTHORITY");
      return template;
    },
    onSuccess: (template, request) => {
      if (
        !canApplyMutationResult(request) ||
        template.id !== request.templateId ||
        (template.store_id !== undefined && template.store_id !== request.storeId)
      ) {
        return;
      }
      toast.success(copy.saved);
      setSelectedId(template.id);
      queryClient.invalidateQueries({ queryKey: messageSettingsKeys.templates });
    },
    onError: (_error, request) => {
      if (canApplyMutationResult(request)) toast.error(copy.saveFailed);
    },
    onSettled: (_data, _error, request) => {
      if (saveLockRef.current === request.operationId) saveLockRef.current = null;
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (request: MessageTemplateResetRequest) => {
      if (!canApplyMutationResult(request)) throw new Error("STALE_MESSAGE_TEMPLATE_AUTHORITY");
      const template = await resetMessageTemplate(request.templateId);
      if (!canApplyMutationResult(request)) throw new Error("STALE_MESSAGE_TEMPLATE_AUTHORITY");
      return template;
    },
    onSuccess: (template, request) => {
      if (
        !canApplyMutationResult(request) ||
        template.id !== request.templateId ||
        (template.store_id !== undefined && template.store_id !== request.storeId)
      ) {
        return;
      }
      toast.success(copy.resetDone);
      setSelectedId(template.id);
      queryClient.invalidateQueries({ queryKey: messageSettingsKeys.templates });
    },
    onError: (_error, request) => {
      if (canApplyMutationResult(request)) toast.error(copy.resetFailed);
    },
    onSettled: (_data, _error, request) => {
      if (resetLockRef.current === request.operationId) resetLockRef.current = null;
    },
  });

  function handleSave() {
    if (
      saveLockRef.current !== null ||
      resetLockRef.current !== null ||
      !selectedTemplate ||
      !activeStoreId ||
      !canUpdateMessageTemplates ||
      !draftMatchesActiveTemplate ||
      !canSaveTemplate
    ) {
      return;
    }
    const operationId = ++operationSequenceRef.current;
    saveLockRef.current = operationId;
    saveMutation.mutate({
      operationId,
      templateId: selectedTemplate.id,
      storeId: activeStoreId,
      membershipId: shell.activeStore?.membershipId,
      role: shell.activeStore?.role,
      membershipStatus: shell.activeStore?.status,
      authorityEpoch: authorityRef.current.epoch,
      authorityKey: authorityRef.current.key,
      input: {
        label: activeLabelDraft,
        body_template: activeBodyDraft,
        enabled: activeEnabledDraft,
      },
    });
  }

  function handleReset() {
    if (
      resetLockRef.current !== null ||
      saveLockRef.current !== null ||
      !selectedTemplate ||
      !activeStoreId ||
      !canUpdateMessageTemplates ||
      !findDefaultMessageTemplate(
        selectedTemplate.domain,
        selectedTemplate.kind,
        selectedTemplate.channel,
      )
    ) {
      return;
    }
    const operationId = ++operationSequenceRef.current;
    resetLockRef.current = operationId;
    resetMutation.mutate({
      operationId,
      templateId: selectedTemplate.id,
      storeId: activeStoreId,
      membershipId: shell.activeStore?.membershipId,
      role: shell.activeStore?.role,
      membershipStatus: shell.activeStore?.status,
      authorityEpoch: authorityRef.current.epoch,
      authorityKey: authorityRef.current.key,
    });
  }

  if (shell.isLoading || (canReadMessageTemplates && templatesQuery.isLoading)) {
    return <MessagesLoading />;
  }

  if (!canReadMessageTemplates) {
    return (
      <RepairOsListScaffold
        title={t("messages.title")}
        subtitle={t("page.permissionRequired")}
        eyebrow={t("page.workspaceMessages")}
      >
        <RepairOsBusinessCard
          as="div"
          data-ui="messages-template-no-permission"
          className="mx-auto w-full max-w-4xl"
          role="status"
        >
          <span className="block text-sm font-semibold">{copy.noPermissionTitle}</span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            {copy.noPermissionDescription}
          </span>
        </RepairOsBusinessCard>
      </RepairOsListScaffold>
    );
  }

  if (templatesQuery.isError) {
    return (
      <RepairOsListScaffold
        title={t("messages.title")}
        subtitle={t("page.readFailed")}
        eyebrow={t("page.workspaceMessages")}
        chips={[
          {
            key: "enabled",
            label: copy.chipEnabled,
            shortLabel: copy.chipEnabledShort,
            count: "-",
          },
          { key: "order", label: copy.chipOrder, shortLabel: copy.chipOrderShort, count: "-" },
          {
            key: "customer",
            label: copy.chipCustomer,
            shortLabel: copy.chipCustomerShort,
            count: "-",
          },
        ]}
      >
        <RepairOsBusinessCard
          as="div"
          data-ui="messages-template-load-error"
          className="mx-auto w-full max-w-4xl grid-cols-[auto_minmax(0,1fr)_auto] items-center rounded-xl border-status-danger-foreground/25 bg-status-danger/10 px-2.5 py-2 text-status-danger-foreground shadow-[var(--shadow-card)] hover:bg-status-danger/10 sm:px-4 sm:py-3"
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
              className="min-h-9 bg-card lg:h-8 lg:min-h-0"
              onClick={() => templatesQuery.refetch()}
            >
              {copy.reload}
            </Button>
          }
          trailingClassName="shrink-0"
          aria-live="polite"
        >
          <span className="block text-sm font-semibold">{copy.loadFailedTitle}</span>
          <span className="mt-0.5 block text-[11px] leading-4 text-status-danger-foreground/80 lg:text-xs lg:leading-[18px] lg:text-status-danger-foreground">
            {copy.loadFailedDescription}
          </span>
        </RepairOsBusinessCard>
      </RepairOsListScaffold>
    );
  }

  return (
    <RepairOsListScaffold
      title={t("messages.title")}
      subtitle={t("page.enabledTotal", { enabled: enabledCount, total: templates.length })}
      eyebrow={t("page.workspaceMessages")}
      action={
        canUpdateMessageTemplates ? (
          <RepairOsHeaderActionButton
            ariaLabel={copy.saveTemplate}
            disabled={!canSaveTemplate || saveMutation.isPending || resetMutation.isPending}
            onClick={handleSave}
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
            disabled={!canSaveTemplate || saveMutation.isPending || resetMutation.isPending}
            onClick={handleSave}
          >
            <Check className="mr-1.5 size-3.5" /> {copy.saveTemplate}
          </Button>
        ) : undefined
      }
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder={copy.searchPlaceholder}
      chips={[
        {
          key: "enabled",
          label: copy.chipEnabled,
          shortLabel: copy.chipEnabledShort,
          count: enabledCount,
        },
        { key: "order", label: copy.chipOrder, shortLabel: copy.chipOrderShort, count: orderCount },
        {
          key: "customer",
          label: copy.chipCustomer,
          shortLabel: copy.chipCustomerShort,
          count: customerCount,
        },
      ]}
    >
      {!canUpdateMessageTemplates ? (
        <div
          data-ui="messages-template-readonly"
          className="mb-3 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2 text-xs text-muted-foreground"
        >
          {copy.readonlyNotice}
        </div>
      ) : null}
      <section className="grid min-w-0 gap-3 lg:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={cn(repairOs.adminSection, "min-w-0 p-2.5 sm:p-3")}>
          <div className="relative hidden md:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={copy.searchPlaceholder}
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
                copy={copy}
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
                    {copy.staffLabel}
                  </Label>
                  <Input
                    id="template-label"
                    value={activeLabelDraft}
                    disabled={!canUpdateMessageTemplates}
                    onChange={(event) => setLabelDraft(event.target.value)}
                    className="h-[38px] text-base sm:text-sm lg:h-8"
                  />
                </div>
                <div className="flex items-end">
                  <RepairOsBusinessCard
                    as="div"
                    data-ui="messages-template-enabled-toggle"
                    className="h-9 min-w-[7.25rem] items-center rounded-md bg-surface px-2.5 py-0 shadow-none hover:bg-surface lg:h-8"
                    bodyClassName="self-center"
                    trailing={
                      <Switch
                        id="template-enabled"
                        checked={activeEnabledDraft}
                        disabled={!canUpdateMessageTemplates}
                        onCheckedChange={setEnabledDraft}
                        aria-label={activeEnabledDraft ? copy.disableTemplate : copy.enableTemplate}
                      />
                    }
                    trailingClassName="shrink-0 self-center"
                  >
                    <Label
                      htmlFor="template-enabled"
                      className="block cursor-pointer text-xs sm:text-sm"
                    >
                      {activeEnabledDraft ? copy.enabled : copy.disabled}
                    </Label>
                  </RepairOsBusinessCard>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="template-body" className="text-xs">
                    {copy.bodyLabel}
                  </Label>
                  <span
                    className={cn(
                      "truncate text-[11px] lg:text-xs lg:leading-4",
                      unknownVariables.length
                        ? "text-status-danger-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {formatMessagesCopy(
                      unknownVariables.length ? copy.unknownVariableCount : copy.usedVariableCount,
                      { count: unknownVariables.length || usedVariables.length },
                    )}
                  </span>
                </div>
                <Textarea
                  ref={bodyTextareaRef}
                  id="template-body"
                  rows={12}
                  value={activeBodyDraft}
                  disabled={!canUpdateMessageTemplates}
                  onChange={(event) => setBodyDraft(event.target.value)}
                  className="min-h-44 font-mono text-base leading-relaxed sm:min-h-[220px] md:min-h-[340px] md:text-xs"
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
                    className="min-h-9 gap-1.5 lg:h-8 lg:min-h-0"
                    disabled={
                      resetMutation.isPending ||
                      saveMutation.isPending ||
                      !canUpdateMessageTemplates ||
                      !findDefaultMessageTemplate(
                        selectedTemplate.domain,
                        selectedTemplate.kind,
                        selectedTemplate.channel,
                      )
                    }
                    onClick={handleReset}
                  >
                    <RotateCcw className="mr-1.5 size-3.5" /> {copy.resetDefault}
                  </Button>
                  <Button
                    size="sm"
                    className={cn("min-h-10 gap-1.5 lg:h-8 lg:min-h-0", controls.brandButton)}
                    style={brandGradientStyle}
                    disabled={
                      !canUpdateMessageTemplates ||
                      !canSaveTemplate ||
                      saveMutation.isPending ||
                      resetMutation.isPending
                    }
                    onClick={handleSave}
                  >
                    <Check className="mr-1.5 size-3.5" /> {copy.save}
                  </Button>
                </div>
              </div>
            </div>

            <aside className="grid min-w-0 gap-3 xl:grid-cols-2 min-[1440px]:block min-[1440px]:space-y-4">
              <section className={cn(repairOs.adminSection, "min-w-0")}>
                <RepairOsSectionHeader
                  title={copy.variableAssistant}
                  description={copy.variableAssistantDescription}
                  action={
                    <Badge variant={unknownVariables.length ? "destructive" : "secondary"}>
                      {
                        getTemplateHealthPresentation(templateHealth, activeEnabledDraft, copy)
                          .label
                      }
                    </Badge>
                  }
                />

                <TemplateHealthPanel
                  health={templateHealth}
                  unknownVariables={unknownVariables}
                  enabled={activeEnabledDraft}
                  copy={copy}
                />

                <div className="mt-2 grid min-w-0 gap-1.5 2xl:grid-cols-2">
                  {MESSAGE_TEMPLATE_VARIABLES.map((variable) => {
                    const used = usedVariables.includes(variable.name);
                    const variableLabel = getVariablePresentationLabel(variable.name, copy);
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
                          <span className="min-w-0 truncate text-right font-mono text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
                            {`{{${variable.name}}}`}
                          </span>
                        }
                        title={formatMessagesCopy(copy.insertVariable, { label: variableLabel })}
                      >
                        <span className="min-w-0 truncate text-[11px] font-medium lg:text-xs lg:leading-4">
                          {variableLabel}
                        </span>
                      </RepairOsBusinessCard>
                    );
                  })}
                </div>
              </section>

              <section className={cn(repairOs.adminSection, "min-w-0")}>
                <RepairOsSectionHeader
                  title={copy.livePreview}
                  description={
                    getTemplateHealthPresentation(templateHealth, activeEnabledDraft, copy).detail
                  }
                  action={
                    <Badge className={templateHealthToneClass(templateHealth.tone)}>
                      {templateHealth.canSend
                        ? copy.canSend
                        : activeEnabledDraft
                          ? copy.cannotSend
                          : copy.disabled}
                    </Badge>
                  }
                />
                <pre className="mt-2 max-h-[360px] min-w-0 whitespace-pre-wrap break-words rounded-md border border-[var(--border-panel)] bg-surface-muted p-2.5 text-xs leading-relaxed text-foreground [overflow-wrap:anywhere] xl:max-h-[520px]">
                  {previewAvailability === "ready"
                    ? preview || " "
                    : previewAvailability === "loading"
                      ? copy.previewLoading
                      : previewAvailability === "failed"
                        ? copy.previewFailed
                        : copy.previewUnavailable}
                </pre>
              </section>
            </aside>
          </section>
        ) : (
          <RepairOsBusinessCard
            as="div"
            data-ui="messages-template-empty-state"
            className="mx-auto w-full max-w-4xl grid-cols-[auto_minmax(0,1fr)] items-center rounded-xl px-2.5 py-2 shadow-[var(--shadow-card)] sm:px-4 sm:py-3"
            leading={
              <span className="grid size-9 place-items-center rounded-lg bg-[var(--surface-panel-muted)] text-muted-foreground">
                <MessageSquareText className="size-4" />
              </span>
            }
          >
            <span className="block text-sm font-semibold text-foreground">{copy.emptyTitle}</span>
            <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
              {copy.emptyDescription}
            </span>
          </RepairOsBusinessCard>
        )}
      </section>
    </RepairOsListScaffold>
  );
}

function TemplateHealthPanel({
  health,
  unknownVariables,
  enabled,
  copy,
}: {
  health: ReturnType<typeof evaluateTemplateHealth>;
  unknownVariables: string[];
  enabled: boolean;
  copy: MessagesScreenCopy;
}) {
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
        <span className="block text-[11px] leading-4 lg:text-xs lg:leading-4">
          {enabled ? copy.healthPassed : copy.healthDisabledDetail}
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
          <span className="block text-[11px] leading-4 lg:text-xs lg:leading-4">
            {getTemplateHealthIssuePresentation(issue.key, enabled, unknownVariables, copy)}
          </span>
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
  copy,
}: {
  domain: keyof typeof domainMeta;
  templates: MessageTemplate[];
  selectedId?: string;
  onSelect: (id: string) => void;
  copy: MessagesScreenCopy;
}) {
  const meta = domainMeta[domain];
  const Icon = meta.icon;

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center gap-2 px-1 text-[11px] font-medium text-muted-foreground lg:text-xs lg:leading-4">
        <Icon className="size-3.5" />
        {copy[meta.copyKey]}
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
                  <span className="text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
                    {template.enabled ? copy.enabled : copy.disabled}
                  </span>
                </span>
              }
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold leading-5">
                  {template.label}
                </span>
                <span className="block truncate text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
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
            <span className="block truncate">{copy.noMatches}</span>
          </RepairOsBusinessCard>
        )}
      </div>
    </div>
  );
}

function MessagesLoading() {
  const { locale, t } = useLocale();
  const copy = getMessagesScreenCopy(locale);
  return (
    <RepairOsListScaffold
      title={t("messages.title")}
      subtitle={t("messages.loading")}
      eyebrow={t("page.workspaceMessages")}
      chips={[
        { key: "enabled", label: copy.chipEnabled, shortLabel: copy.chipEnabledShort, count: "-" },
        { key: "order", label: copy.chipOrder, shortLabel: copy.chipOrderShort, count: "-" },
        {
          key: "customer",
          label: copy.chipCustomer,
          shortLabel: copy.chipCustomerShort,
          count: "-",
        },
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

function getTemplateHealthPresentation(
  health: ReturnType<typeof evaluateTemplateHealth>,
  enabled: boolean,
  copy: MessagesScreenCopy,
) {
  if (!enabled) {
    return health.tone === "danger"
      ? { label: copy.healthDisabledInvalid, detail: copy.healthDisabledInvalidDetail }
      : { label: copy.healthDisabled, detail: copy.healthDisabledDetail };
  }
  if (health.tone === "danger") {
    return { label: copy.healthBlocked, detail: copy.healthBlockedDetail };
  }
  if (health.tone === "warning") {
    return { label: copy.healthWarning, detail: copy.healthWarningDetail };
  }
  return { label: copy.healthEnabled, detail: copy.healthEnabledDetail };
}

function getTemplateHealthIssuePresentation(
  issueKey: string,
  enabled: boolean,
  unknownVariables: string[],
  copy: MessagesScreenCopy,
) {
  if (issueKey === "empty_body") {
    return enabled ? copy.issueEmptyEnabled : copy.issueEmptyDisabled;
  }
  if (issueKey === "unknown_variables") {
    return formatMessagesCopy(copy.issueUnknownVariables, {
      variables: unknownVariables.map((name) => `{{${name}}}`).join(" "),
    });
  }
  if (issueKey === "long_template") return copy.issueLong;
  return copy.issueFallback;
}

function getVariablePresentationLabel(name: string, copy: MessagesScreenCopy) {
  const keys: Record<string, keyof MessagesScreenCopy> = {
    customer_name: "variableCustomerName",
    order_no: "variableOrderNo",
    device_label: "variableDeviceLabel",
    fault_lines: "variableFaultLines",
    order_status: "variableOrderStatus",
    quotation: "variableQuotation",
    deposit: "variableDeposit",
    balance: "variableBalance",
    balance_line: "variableBalanceLine",
    diagnosis: "variableDiagnosis",
    diagnosis_line: "variableDiagnosisLine",
    parts_update_line: "variablePartsUpdateLine",
    issue_line: "variableIssueLine",
    cancel_reason_line: "variableCancelReasonLine",
    order_url: "variableOrderUrl",
    order_url_line: "variableOrderUrlLine",
    store_name: "variableStoreName",
    store_address: "variableStoreAddress",
    public_base_url: "variablePublicBaseUrl",
    message_signature: "variableMessageSignature",
    default_order_warranty_months: "variableDefaultWarrantyMonths",
    latest_order_line: "variableLatestOrderLine",
    device_count: "variableDeviceCount",
    customer_url: "variableCustomerUrl",
    customer_url_line: "variableCustomerUrlLine",
  };
  return copy[keys[name] ?? "variableFallback"];
}

function formatMessagesCopy(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
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
