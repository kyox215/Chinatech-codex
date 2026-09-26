"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Archive, Minus, Plus, RefreshCcw, UserRoundCheck } from "lucide-react";

import type { MemoEditorProps } from "@/features/memos/forms/memo-editor-types";
import { formatMemoDueAtForInput, parseMemoDueAtInput } from "@/features/memos/model/memo-due-at";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigationGuard } from "@/components/navigation-guard-provider";
import { Textarea } from "@/components/ui/textarea";
import { UnsavedNavigationGuard } from "@/components/unsaved-navigation-guard";
import { useIsCompactWorkspace, useIsMobile } from "@/hooks/use-mobile";
import { componentForm, componentOverlay } from "@/lib/component-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import { getMemoPresentationCopy } from "@/shared/i18n/messages";
import { toast } from "sonner";
import { validateChecklist } from "@/features/memos/model/memo-checklist";

import { MemoChecklistEditor } from "./memo-checklist-editor";
import { MemoEditorOverlay } from "./memo-editor-overlay";

export type { MemoEditorSaveInput } from "@/features/memos/forms/memo-editor-types";

export function MemoEditor({
  open,
  memo,
  latestVersion,
  assignees,
  canAssignAny,
  membershipId,
  busy,
  onOpenChange,
  onSave,
  onReloadLatest,
  onClaim,
  onArchive,
  onRestore,
  checklistSearch,
  onToggleChecklistItem,
  onDirtyChange,
}: MemoEditorProps) {
  const compact = useIsCompactWorkspace();
  const mobile = useIsMobile();
  const { locale } = useLocale();
  const copy = getMemoPresentationCopy(locale);
  const { runGuardedTransition } = useNavigationGuard();
  const [kind, setKind] = useState<"note" | "todo">("todo");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [checklist, setChecklist] = useState(() => memo?.checklist ?? []);
  const [checklistDraft, setChecklistDraft] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assignee, setAssignee] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [baseVersion, setBaseVersion] = useState<number | undefined>();
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const [invalidServerDueAt, setInvalidServerDueAt] = useState(false);
  const [dueAtTouched, setDueAtTouched] = useState(false);
  const dueAtRef = useRef<HTMLInputElement>(null);
  const submitLockRef = useRef(false);
  const formattedMemoDueAt = useMemo(() => formatMemoDueAtForInput(memo?.due_at), [memo?.due_at]);

  useEffect(() => {
    if (!open) return;
    setKind(memo?.kind ?? "todo");
    setTitle(memo?.title ?? "");
    setContent(memo?.content ?? "");
    setChecklist(memo?.checklist?.map((item) => ({ ...item })) ?? []);
    setChecklistDraft("");
    setDueAt(formattedMemoDueAt.value);
    setInvalidServerDueAt(formattedMemoDueAt.status === "invalid");
    setDueAtTouched(false);
    setAssignee(memo?.assignee_membership_id ?? "");
    setDetailsOpen(Boolean(memo));
    setBaseVersion(memo?.version);
    setOperationId(crypto.randomUUID());
    submitLockRef.current = false;
  }, [formattedMemoDueAt, memo, open]);

  const initial = useMemo(
    () => ({
      kind: memo?.kind ?? "todo",
      title: memo?.title ?? "",
      content: memo?.content ?? "",
      checklist: memo?.checklist ?? [],
      dueAt: formattedMemoDueAt.value,
      assignee: memo?.assignee_membership_id ?? "",
    }),
    [formattedMemoDueAt.value, memo],
  );
  const dirty =
    kind !== initial.kind ||
    title !== initial.title ||
    content !== initial.content ||
    JSON.stringify(checklist) !== JSON.stringify(initial.checklist) ||
    dueAt !== initial.dueAt ||
    assignee !== initial.assignee;
  const guardedDirty = dirty || checklistDraft.length > 0;
  useEffect(() => onDirtyChange?.(guardedDirty), [guardedDirty, onDirtyChange]);
  const conflict = Boolean(baseVersion && latestVersion && latestVersion !== baseVersion);
  const canEdit = !memo || memo.capabilities.canEdit;
  const canChangeAssignee = canAssignAny || !memo?.assignee_membership_id;
  const parsedDueAt = useMemo(() => parseMemoDueAtInput(dueAt), [dueAt]);
  const dueAtError = useMemo(() => {
    if (kind !== "todo") return null;
    if (invalidServerDueAt) return copy.invalidServerDue;
    if (
      !dueAtTouched &&
      formattedMemoDueAt.status === "valid" &&
      dueAt === formattedMemoDueAt.value
    ) {
      return null;
    }
    if (parsedDueAt.status !== "invalid") return null;
    if (parsedDueAt.reason === "nonexistent_time") {
      return copy.nonexistentDue;
    }
    if (parsedDueAt.reason === "ambiguous_time") {
      return copy.ambiguousDue;
    }
    return copy.invalidDue;
  }, [copy, dueAt, dueAtTouched, formattedMemoDueAt, invalidServerDueAt, kind, parsedDueAt]);
  const canSave =
    canEdit &&
    title.trim().length > 0 &&
    title.trim().length <= 120 &&
    content.length <= 4000 &&
    validateChecklist(checklist) === null &&
    !checklistDraft.trim() &&
    !dueAtError &&
    !conflict;

  const save = async () => {
    if (busy || submitLockRef.current) return;
    if (!canSave) {
      if (dueAtError) dueAtRef.current?.focus();
      throw new Error(copy.formInvalid);
    }
    const resolvedDueAt =
      kind !== "todo" || parsedDueAt.status === "empty"
        ? null
        : !dueAtTouched &&
            dueAt === formattedMemoDueAt.value &&
            formattedMemoDueAt.status === "valid"
          ? formattedMemoDueAt.iso
          : parsedDueAt.status === "valid"
            ? parsedDueAt.iso
            : null;
    const common = {
      operationId,
      title: title.trim(),
      content,
      ...(kind === "todo" && (checklist.length > 0 || initial.checklist.length > 0)
        ? { checklist: checklist.map((item) => ({ ...item, text: item.text.trim() })) }
        : {}),
      dueAt: resolvedDueAt,
      assigneeMembershipId: kind === "todo" && assignee ? assignee : null,
    };
    submitLockRef.current = true;
    try {
      await onSave(
        memo
          ? { ...common, id: memo.id, expectedVersion: baseVersion ?? memo.version }
          : { ...common, kind },
      );
    } finally {
      submitLockRef.current = false;
    }
  };

  const submitFromTitle = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (busy) return;
    void save().catch(() => undefined);
  };

  const submitFromContent = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== "Enter" ||
      (!event.metaKey && !event.ctrlKey) ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    event.preventDefault();
    if (busy) return;
    void save().catch(() => undefined);
  };

  const editorFields = (
    <>
      <div className={cn("min-w-0", componentForm.field)}>
        <Label htmlFor="memo-content" className={componentForm.label}>
          {copy.content}
          {!memo ? copy.optionalSuffix : ""}
        </Label>
        <Textarea
          id="memo-content"
          value={content}
          maxLength={4000}
          disabled={!canEdit || busy}
          className={cn(
            componentOverlay.editorField,
            "min-h-32 w-full min-w-0 max-w-full resize-y",
          )}
          placeholder={!memo ? copy.contentPlaceholder : undefined}
          onKeyDown={submitFromContent}
          onChange={(event) => setContent(event.target.value)}
        />
        <p className={cn(componentForm.help, "flex min-w-0 justify-between gap-2")}>
          <span className="min-w-0 break-words">{copy.privacyHint}</span>
          <span className="shrink-0">{content.length}/4000</span>
        </p>
      </div>
      {kind === "todo" ? (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <div className={cn("min-w-0", componentForm.field)}>
            <Label htmlFor="memo-due" className={componentForm.label}>
              {copy.dueAt}
            </Label>
            <Input
              ref={dueAtRef}
              id="memo-due"
              type="datetime-local"
              value={dueAt}
              aria-invalid={Boolean(dueAtError)}
              aria-describedby={dueAtError ? "memo-due-error" : undefined}
              disabled={!canEdit || busy}
              className={cn(componentOverlay.editorField, "h-[38px] w-full min-w-0 max-w-full")}
              onChange={(event) => {
                setDueAt(event.target.value);
                setInvalidServerDueAt(false);
                setDueAtTouched(true);
              }}
            />
            {dueAtError ? (
              <p id="memo-due-error" role="alert" className={componentForm.error}>
                {dueAtError}
              </p>
            ) : null}
          </div>
          <div className={cn("min-w-0", componentForm.field)}>
            <Label htmlFor="memo-assignee" className={componentForm.label}>
              {copy.assignee}
            </Label>
            <select
              id="memo-assignee"
              value={assignee}
              disabled={!canEdit || busy || !canChangeAssignee}
              className={cn(
                componentOverlay.editorField,
                "h-[38px] w-full min-w-0 max-w-full px-3",
              )}
              onChange={(event) => setAssignee(event.target.value)}
            >
              <option value="">{copy.unassigned}</option>
              {memo?.assignee_membership_id &&
              !assignees.some((item) => item.membershipId === memo.assignee_membership_id) ? (
                <option value={memo.assignee_membership_id}>{copy.currentAssignee}</option>
              ) : null}
              {assignees
                .filter((item) => canAssignAny || item.membershipId === membershipId)
                .map((item) => (
                  <option key={item.membershipId} value={item.membershipId}>
                    {item.displayName}
                  </option>
                ))}
            </select>
          </div>
        </div>
      ) : null}
    </>
  );

  const body = (
    <form
      data-editor-body
      className={cn(componentOverlay.editorLayout, "min-h-0 min-w-0 max-w-full flex-1")}
      onSubmit={(event) => {
        event.preventDefault();
        void save().catch(() => undefined);
      }}
    >
      <div
        data-editor-scroll
        className={cn(
          componentOverlay.editorScroll,
          componentOverlay.editorBody,
          "space-y-3 px-3 py-3 sm:px-4 sm:py-4",
        )}
      >
        {conflict ? (
          <Alert variant="destructive" aria-live="assertive">
            <RefreshCcw className="size-4" />
            <AlertTitle>{copy.conflictTitle}</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{copy.conflictDescription}</p>
              {onReloadLatest ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-9"
                  onClick={onReloadLatest}
                >
                  <RefreshCcw className="size-4" /> {copy.reloadLatest}
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        {!canEdit ? (
          <Alert>
            <AlertTitle>{copy.readonlyRecordTitle}</AlertTitle>
            <AlertDescription>{copy.readonlyRecordDescription}</AlertDescription>
          </Alert>
        ) : null}
        {!memo ? (
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">{copy.memoType}</legend>
            {(["todo", "note"] as const).map((value) => (
              <Button
                key={value}
                type="button"
                variant={kind === value ? "default" : "outline"}
                size="sm"
                className="min-h-9 rounded-lg px-3 shadow-none"
                aria-pressed={kind === value}
                onClick={() => setKind(value)}
              >
                {value === "note" ? copy.note : copy.todo}
              </Button>
            ))}
          </fieldset>
        ) : null}
        <div className={componentForm.field}>
          <Label htmlFor="memo-title" className={cn(componentForm.label, !memo && "sr-only")}>
            {copy.titleField}
          </Label>
          <Input
            id="memo-title"
            value={title}
            required
            autoFocus={!memo && !compact}
            aria-invalid={title.length > 120 || (title.length > 0 && !title.trim())}
            aria-describedby="memo-title-help"
            maxLength={120}
            disabled={!canEdit || busy}
            className={cn(componentOverlay.editorField, "h-11 px-3")}
            placeholder={!memo ? copy.titlePlaceholder : undefined}
            onKeyDown={submitFromTitle}
            onChange={(event) => setTitle(event.target.value)}
          />
          <p
            id="memo-title-help"
            className={
              memo || (title.length > 0 && !title.trim()) || title.length >= 100
                ? cn(componentForm.help, "flex justify-between gap-2")
                : "sr-only"
            }
          >
            <span>
              {title.length > 0 && !title.trim()
                ? copy.titleWhitespace
                : !memo
                  ? copy.titleEnterHint
                  : copy.required}
            </span>
            <span>{title.length}/120</span>
          </p>
        </div>
        {kind === "todo" ? (
          <MemoChecklistEditor
            items={checklist}
            disabled={!canEdit || busy || conflict}
            toggleDisabled={
              Boolean(busy || conflict) || (memo ? !memo.capabilities.canTransition : !canEdit)
            }
            immediateToggle={Boolean(memo && !guardedDirty)}
            search={checklistSearch}
            onChange={setChecklist}
            onToggle={onToggleChecklistItem}
            onValidationError={(message) => toast.error(message)}
            onPendingDraftChange={setChecklistDraft}
          />
        ) : null}
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="min-h-9 justify-start rounded-lg px-2 text-xs font-normal text-muted-foreground"
              disabled={busy}
            >
              {detailsOpen ? <Minus className="size-4" /> : <Plus className="size-4" />}
              {detailsOpen ? copy.collapseDetails : copy.addDetails}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className={cn(componentOverlay.flatSection, "mt-1.5 grid gap-3")}>
            {editorFields}
          </CollapsibleContent>
        </Collapsible>
        {memo ? (
          <p className="rounded-lg bg-[var(--surface-panel-muted)] p-2 text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
            {copy.savedVisibleHint}
          </p>
        ) : null}
      </div>
      <div
        data-editor-footer
        className={cn(
          componentOverlay.editorFooter,
          "shrink-0 bg-card px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4",
          memo && "flex-wrap items-center justify-between",
        )}
      >
        <div className="flex flex-wrap gap-2">
          {memo?.capabilities.canClaim && onClaim ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-9"
              disabled={busy || guardedDirty}
              title={guardedDirty ? copy.saveOrDiscard : undefined}
              onClick={() => void onClaim().catch(() => undefined)}
            >
              <UserRoundCheck className="size-4" /> {copy.claim}
            </Button>
          ) : null}
          {memo?.capabilities.canArchive && onArchive ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-9"
              disabled={busy || guardedDirty}
              title={guardedDirty ? copy.saveOrDiscard : undefined}
              onClick={() => void onArchive().catch(() => undefined)}
            >
              <Archive className="size-4" /> {copy.archive}
            </Button>
          ) : null}
          {memo?.capabilities.canRestore && onRestore ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-9"
              disabled={busy || guardedDirty}
              title={guardedDirty ? copy.saveOrDiscard : undefined}
              onClick={() => void onRestore().catch(() => undefined)}
            >
              <RefreshCcw className="size-4" /> {copy.restore}
            </Button>
          ) : null}
        </div>
        {canEdit ? (
          <div
            className={cn(
              "ml-auto flex min-w-0 flex-wrap items-center justify-end gap-3",
              !memo && "col-span-2 w-full",
            )}
          >
            {!memo ? (
              <span className={cn(componentOverlay.editorStatus, "mr-auto")}>
                {copy.scopeVisible}
              </span>
            ) : null}
            <Button type="submit" className="min-h-10 min-w-24" disabled={!canSave || busy}>
              {busy
                ? copy.saving
                : memo
                  ? copy.saveChanges
                  : kind === "todo"
                    ? copy.addTodo
                    : copy.saveNote}
            </Button>
          </div>
        ) : null}
      </div>
      <UnsavedNavigationGuard
        id={`memo-editor-${memo?.id ?? "new"}`}
        label={copy.draftLabel}
        dirty={guardedDirty}
        busy={Boolean(busy)}
        canSave={canSave}
        saveUnavailableReason={conflict ? copy.conflictSaveUnavailable : copy.formInvalid}
        onSave={async () => {
          await save();
          return { status: "resolved" };
        }}
        onDiscard={() => {
          onOpenChange(false);
          return { status: "resolved" };
        }}
      />
    </form>
  );

  const requestOpenChange = (nextOpen: boolean) => {
    if (nextOpen) return onOpenChange(true);
    if (busy) return toast.info(copy.processingClose);
    if (!guardedDirty) return onOpenChange(false);
    void runGuardedTransition({
      kind: "route",
      label: copy.closeMemo,
      run: () => onOpenChange(false),
    });
  };

  return (
    <MemoEditorOverlay
      compact={mobile}
      open={open}
      title={memo ? copy.detailTitle : copy.newTitle}
      description={memo ? copy.detailDescription : copy.newDescription}
      onOpenChange={requestOpenChange}
    >
      {body}
    </MemoEditorOverlay>
  );
}
