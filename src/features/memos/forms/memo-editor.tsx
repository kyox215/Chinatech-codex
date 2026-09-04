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
import { useIsCompactWorkspace } from "@/hooks/use-mobile";
import { memoQuickEntry } from "@/lib/component-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import { getMemoPresentationCopy } from "@/shared/i18n/messages";
import { toast } from "sonner";

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
}: MemoEditorProps) {
  const compact = useIsCompactWorkspace();
  const { locale } = useLocale();
  const copy = getMemoPresentationCopy(locale);
  const { runGuardedTransition } = useNavigationGuard();
  const [kind, setKind] = useState<"note" | "todo">("todo");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
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
      dueAt: formattedMemoDueAt.value,
      assignee: memo?.assignee_membership_id ?? "",
    }),
    [formattedMemoDueAt.value, memo],
  );
  const dirty =
    kind !== initial.kind ||
    title !== initial.title ||
    content !== initial.content ||
    dueAt !== initial.dueAt ||
    assignee !== initial.assignee;
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
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="memo-content">
          {copy.content}
          {!memo ? copy.optionalSuffix : ""}
        </Label>
        <Textarea
          id="memo-content"
          value={content}
          maxLength={4000}
          disabled={!canEdit || busy}
          className="min-h-32 w-full min-w-0 max-w-full resize-y rounded-lg border-[var(--border-panel)] bg-background text-base shadow-sm"
          placeholder={!memo ? copy.contentPlaceholder : undefined}
          onKeyDown={submitFromContent}
          onChange={(event) => setContent(event.target.value)}
        />
        <p className="flex min-w-0 justify-between gap-2 text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
          <span className="min-w-0 break-words">{copy.privacyHint}</span>
          <span className="shrink-0">{content.length}/4000</span>
        </p>
      </div>
      {kind === "todo" ? (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="memo-due">{copy.dueAt}</Label>
            <Input
              ref={dueAtRef}
              id="memo-due"
              type="datetime-local"
              value={dueAt}
              aria-invalid={Boolean(dueAtError)}
              aria-describedby={dueAtError ? "memo-due-error" : undefined}
              disabled={!canEdit || busy}
              className="h-[38px] w-full min-w-0 max-w-full rounded-lg border-[var(--border-panel)] bg-background text-base shadow-sm"
              onChange={(event) => {
                setDueAt(event.target.value);
                setInvalidServerDueAt(false);
                setDueAtTouched(true);
              }}
            />
            {dueAtError ? (
              <p id="memo-due-error" role="alert" className="text-xs text-destructive">
                {dueAtError}
              </p>
            ) : null}
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="memo-assignee">{copy.assignee}</Label>
            <select
              id="memo-assignee"
              value={assignee}
              disabled={!canEdit || busy || !canChangeAssignee}
              className="h-[38px] w-full min-w-0 max-w-full rounded-lg border border-[var(--border-panel)] bg-background px-3 text-base shadow-sm"
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
      className={cn(
        "min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto px-0.5",
        memo ? "space-y-3 pb-[max(0.25rem,env(safe-area-inset-bottom))]" : memoQuickEntry.form,
      )}
      onSubmit={(event) => {
        event.preventDefault();
        void save().catch(() => undefined);
      }}
    >
      {conflict ? (
        <Alert variant="destructive" aria-live="assertive">
          <RefreshCcw className="size-4" />
          <AlertTitle>{copy.conflictTitle}</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{copy.conflictDescription}</p>
            {onReloadLatest ? (
              <Button type="button" variant="outline" className="min-h-9" onClick={onReloadLatest}>
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
        <fieldset className={memoQuickEntry.typeRow}>
          <legend className="sr-only">{copy.memoType}</legend>
          {(["todo", "note"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                memoQuickEntry.typeButton,
                kind === value ? memoQuickEntry.typeButtonSelected : memoQuickEntry.typeButtonIdle,
              )}
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
            >
              {value === "note" ? copy.note : copy.todo}
            </Button>
          ))}
        </fieldset>
      ) : null}
      <div className={memo ? "space-y-1.5" : "mb-[0.55rem]"}>
        <Label htmlFor="memo-title" className={!memo ? "sr-only" : undefined}>
          {copy.titleField}
        </Label>
        <Input
          id="memo-title"
          value={title}
          required
          autoFocus={!memo}
          aria-invalid={title.length > 120 || (title.length > 0 && !title.trim())}
          aria-describedby="memo-title-help"
          maxLength={120}
          disabled={!canEdit || busy}
          className={
            memo
              ? "h-12 rounded-lg border-[var(--border-panel)] bg-background px-4 text-base shadow-sm"
              : memoQuickEntry.quickField
          }
          placeholder={!memo ? copy.titlePlaceholder : undefined}
          onKeyDown={submitFromTitle}
          onChange={(event) => setTitle(event.target.value)}
        />
        <p
          id="memo-title-help"
          className={
            memo || (title.length > 0 && !title.trim()) || title.length >= 100
              ? "flex justify-between gap-2 text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4"
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
      {!memo ? (
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className={memoQuickEntry.detailTrigger}
              disabled={busy}
            >
              {detailsOpen ? <Minus className="size-4" /> : <Plus className="size-4" />}
              {detailsOpen ? copy.collapseDetails : copy.addDetails}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className={memoQuickEntry.detailsPanel}>
            {editorFields}
          </CollapsibleContent>
        </Collapsible>
      ) : (
        editorFields
      )}
      {memo ? (
        <p className="rounded-lg bg-[var(--surface-panel-muted)] p-2 text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
          {copy.savedVisibleHint}
        </p>
      ) : null}
      <div
        className={
          memo ? "flex flex-wrap items-center justify-between gap-2 pt-1" : memoQuickEntry.footer
        }
      >
        <div className="flex flex-wrap gap-2">
          {memo?.capabilities.canClaim && onClaim ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-9"
              disabled={busy || dirty}
              title={dirty ? copy.saveOrDiscard : undefined}
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
              disabled={busy || dirty}
              title={dirty ? copy.saveOrDiscard : undefined}
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
              disabled={busy || dirty}
              title={dirty ? copy.saveOrDiscard : undefined}
              onClick={() => void onRestore().catch(() => undefined)}
            >
              <RefreshCcw className="size-4" /> {copy.restore}
            </Button>
          ) : null}
        </div>
        {canEdit ? (
          <div
            className={
              memo
                ? "ml-auto flex min-w-0 flex-wrap items-center justify-end gap-3"
                : "flex w-full min-w-0 flex-wrap items-center justify-between gap-3"
            }
          >
            {!memo ? <span className={memoQuickEntry.scope}>{copy.scopeVisible}</span> : null}
            <Button
              type="submit"
              variant={memo ? "default" : "outline"}
              className={memo ? "min-h-10 min-w-24" : memoQuickEntry.action}
              disabled={!canSave || busy}
            >
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
        dirty={dirty}
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
    if (!dirty) return onOpenChange(false);
    void runGuardedTransition({
      kind: "route",
      label: copy.closeMemo,
      run: () => onOpenChange(false),
    });
  };

  return (
    <MemoEditorOverlay
      compact={compact}
      open={open}
      title={memo ? copy.detailTitle : copy.newTitle}
      description={memo ? copy.detailDescription : copy.newDescription}
      onOpenChange={requestOpenChange}
    >
      {body}
    </MemoEditorOverlay>
  );
}
