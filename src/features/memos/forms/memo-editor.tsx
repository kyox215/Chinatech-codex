"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Archive, Minus, Plus, RefreshCcw, UserRoundCheck } from "lucide-react";

import { toDateTimeLocal, type MemoEditorProps } from "@/features/memos/forms/memo-editor-types";
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
  const { runGuardedTransition } = useNavigationGuard();
  const [kind, setKind] = useState<"note" | "todo">("todo");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assignee, setAssignee] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [baseVersion, setBaseVersion] = useState<number | undefined>();
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!open) return;
    setKind(memo?.kind ?? "todo");
    setTitle(memo?.title ?? "");
    setContent(memo?.content ?? "");
    setDueAt(toDateTimeLocal(memo?.due_at));
    setAssignee(memo?.assignee_membership_id ?? "");
    setDetailsOpen(Boolean(memo));
    setBaseVersion(memo?.version);
    setOperationId(crypto.randomUUID());
  }, [memo, open]);

  const initial = useMemo(
    () => ({
      kind: memo?.kind ?? "todo",
      title: memo?.title ?? "",
      content: memo?.content ?? "",
      dueAt: toDateTimeLocal(memo?.due_at),
      assignee: memo?.assignee_membership_id ?? "",
    }),
    [memo],
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
  const canSave =
    canEdit &&
    title.trim().length > 0 &&
    title.trim().length <= 120 &&
    content.length <= 4000 &&
    !conflict;

  const save = async () => {
    if (!canSave) throw new Error("请先修正表单内容");
    const common = {
      operationId,
      title: title.trim(),
      content,
      dueAt: kind === "todo" && dueAt ? new Date(dueAt).toISOString() : null,
      assigneeMembershipId: kind === "todo" && assignee ? assignee : null,
    };
    await onSave(
      memo
        ? { ...common, id: memo.id, expectedVersion: baseVersion ?? memo.version }
        : { ...common, kind },
    );
  };

  const submitFromTitle = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (busy || !canSave) return;
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
    if (busy || !canSave) return;
    void save().catch(() => undefined);
  };

  const editorFields = (
    <>
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="memo-content">正文{!memo ? "（可选）" : ""}</Label>
        <Textarea
          id="memo-content"
          value={content}
          maxLength={4000}
          disabled={!canEdit || busy}
          className="min-h-32 w-full min-w-0 max-w-full resize-y rounded-lg border-[var(--border-panel)] bg-background text-base shadow-sm"
          placeholder={!memo ? "补充说明…" : undefined}
          onKeyDown={submitFromContent}
          onChange={(event) => setContent(event.target.value)}
        />
        <p className="flex min-w-0 justify-between gap-2 text-[10px] text-muted-foreground">
          <span className="min-w-0 break-words">
            请勿记录密码、支付资料、解锁码或不必要的客户隐私。
          </span>
          <span className="shrink-0">{content.length}/4000</span>
        </p>
      </div>
      {kind === "todo" ? (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="memo-due">到期时间</Label>
            <Input
              id="memo-due"
              type="datetime-local"
              value={dueAt}
              disabled={!canEdit || busy}
              className="h-[38px] w-full min-w-0 max-w-full rounded-lg border-[var(--border-panel)] bg-background text-base shadow-sm"
              onChange={(event) => setDueAt(event.target.value)}
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="memo-assignee">负责人</Label>
            <select
              id="memo-assignee"
              value={assignee}
              disabled={!canEdit || busy || !canChangeAssignee}
              className="h-[38px] w-full min-w-0 max-w-full rounded-lg border border-[var(--border-panel)] bg-background px-3 text-base shadow-sm"
              onChange={(event) => setAssignee(event.target.value)}
            >
              <option value="">未分配</option>
              {memo?.assignee_membership_id &&
              !assignees.some((item) => item.membershipId === memo.assignee_membership_id) ? (
                <option value={memo.assignee_membership_id}>当前负责人</option>
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
          <AlertTitle>这条记录已被更新</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>你的草稿仍保留。载入最新版本会放弃当前未保存内容。</p>
            {onReloadLatest ? (
              <Button type="button" variant="outline" className="min-h-9" onClick={onReloadLatest}>
                <RefreshCcw className="size-4" /> 载入最新版本
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      {!canEdit ? (
        <Alert>
          <AlertTitle>只读记录</AlertTitle>
          <AlertDescription>你可以查看本店铺记录，但不能修改这条内容。</AlertDescription>
        </Alert>
      ) : null}
      {!memo ? (
        <fieldset className={memoQuickEntry.typeRow}>
          <legend className="sr-only">备忘类型</legend>
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
              {value === "note" ? "记录" : "待办"}
            </Button>
          ))}
        </fieldset>
      ) : null}
      <div className={memo ? "space-y-1.5" : "mb-[0.55rem]"}>
        <Label htmlFor="memo-title" className={!memo ? "sr-only" : undefined}>
          标题
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
          placeholder={!memo ? "写下要做的事或记录…" : undefined}
          onKeyDown={submitFromTitle}
          onChange={(event) => setTitle(event.target.value)}
        />
        <p
          id="memo-title-help"
          className={
            memo || (title.length > 0 && !title.trim()) || title.length >= 100
              ? "flex justify-between gap-2 text-[10px] text-muted-foreground"
              : "sr-only"
          }
        >
          <span>
            {title.length > 0 && !title.trim()
              ? "标题不能只包含空格"
              : !memo
                ? "输入标题后按 Enter 即可保存"
                : "必填"}
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
              {detailsOpen ? "收起详情" : "添加详情"}
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
        <p className="rounded-lg bg-[var(--surface-panel-muted)] p-2 text-[11px] text-muted-foreground">
          保存后，本店铺成员都可以看到这条备忘。
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
              title={dirty ? "请先保存或放弃正文修改" : undefined}
              onClick={() => void onClaim().catch(() => undefined)}
            >
              <UserRoundCheck className="size-4" /> 领取
            </Button>
          ) : null}
          {memo?.capabilities.canArchive && onArchive ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-9"
              disabled={busy || dirty}
              title={dirty ? "请先保存或放弃正文修改" : undefined}
              onClick={() => void onArchive().catch(() => undefined)}
            >
              <Archive className="size-4" /> 归档
            </Button>
          ) : null}
          {memo?.capabilities.canRestore && onRestore ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-9"
              disabled={busy || dirty}
              title={dirty ? "请先保存或放弃正文修改" : undefined}
              onClick={() => void onRestore().catch(() => undefined)}
            >
              <RefreshCcw className="size-4" /> 恢复
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
            {!memo ? <span className={memoQuickEntry.scope}>本店成员可见</span> : null}
            <Button
              type="submit"
              variant={memo ? "default" : "outline"}
              className={memo ? "min-h-10 min-w-24" : memoQuickEntry.action}
              disabled={!canSave || busy}
            >
              {busy ? "保存中…" : memo ? "保存修改" : kind === "todo" ? "添加待办" : "保存记录"}
            </Button>
          </div>
        ) : null}
      </div>
      <UnsavedNavigationGuard
        id={`memo-editor-${memo?.id ?? "new"}`}
        label="备忘录草稿"
        dirty={dirty}
        busy={Boolean(busy)}
        canSave={canSave}
        saveUnavailableReason={conflict ? "记录已更新，请先载入最新版本" : "请先修正表单"}
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
    if (busy) return toast.info("备忘录正在处理中，请稍候再关闭");
    if (!dirty) return onOpenChange(false);
    void runGuardedTransition({
      kind: "route",
      label: "关闭备忘录",
      run: () => onOpenChange(false),
    });
  };

  return (
    <MemoEditorOverlay
      compact={compact}
      open={open}
      title={memo ? "备忘详情" : "新建备忘"}
      description={memo ? "查看或更新本店铺记录。" : "快速写下，详情稍后补充"}
      onOpenChange={requestOpenChange}
    >
      {body}
    </MemoEditorOverlay>
  );
}
