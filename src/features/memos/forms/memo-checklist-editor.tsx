"use client";

import { useEffect, useState, type ClipboardEvent } from "react";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import type { MemoChecklistItem } from "@/features/memos/model/contracts";
import {
  checklistItemsFromLines,
  memoChecklistTextLength,
  MEMO_CHECKLIST_ITEM_MAX_LENGTH,
  MEMO_CHECKLIST_MAX_ITEMS,
} from "@/features/memos/model/memo-checklist";
import { componentForm, componentOverlay } from "@/lib/component-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import { getMemoPresentationCopy, translateMemoPresentation } from "@/shared/i18n/messages";

export function MemoChecklistEditor({
  items,
  disabled,
  toggleDisabled,
  immediateToggle,
  search,
  onChange,
  onToggle,
  onValidationError,
  onPendingDraftChange,
}: {
  items: MemoChecklistItem[];
  disabled?: boolean;
  toggleDisabled?: boolean;
  immediateToggle?: boolean;
  search?: string;
  onChange: (items: MemoChecklistItem[]) => void;
  onToggle?: (item: MemoChecklistItem, completed: boolean) => Promise<void>;
  onValidationError: (message: string) => void;
  onPendingDraftChange?: (value: string) => void;
}) {
  const { locale } = useLocale();
  const copy = getMemoPresentationCopy(locale);
  const [draft, setDraft] = useState("");
  const [completedOpen, setCompletedOpen] = useState(false);
  const pending = items.filter((item) => !item.completed);
  const completed = items.filter((item) => item.completed);
  const hasInvalidItemText = items.some(
    (item) =>
      !item.text.trim() ||
      memoChecklistTextLength(item.text.trim()) > MEMO_CHECKLIST_ITEM_MAX_LENGTH,
  );
  const hasInvalidDraft =
    Boolean(draft.trim()) && memoChecklistTextLength(draft.trim()) > MEMO_CHECKLIST_ITEM_MAX_LENGTH;
  const normalizedSearch = search?.trim().toLocaleLowerCase() ?? "";
  const matchedCompleted = completed.some((item) =>
    item.text.toLocaleLowerCase().includes(normalizedSearch),
  );

  useEffect(() => {
    if (normalizedSearch && matchedCompleted) setCompletedOpen(true);
  }, [matchedCompleted, normalizedSearch]);

  const addLines = (value: string) => {
    const nextItems = checklistItemsFromLines(value);
    if (!nextItems.length) return;
    if (items.length + nextItems.length > MEMO_CHECKLIST_MAX_ITEMS) {
      onValidationError(copy.checklistTooMany);
      return;
    }
    if (
      nextItems.some((item) => memoChecklistTextLength(item.text) > MEMO_CHECKLIST_ITEM_MAX_LENGTH)
    ) {
      onValidationError(copy.checklistItemTooLong);
      return;
    }
    onChange([...items, ...nextItems]);
    setDraft("");
    onPendingDraftChange?.("");
  };

  const paste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text");
    event.preventDefault();
    addLines(text);
  };

  const toggle = (item: MemoChecklistItem, checked: boolean) => {
    if (immediateToggle && onToggle) {
      void onToggle(item, checked).catch(() => undefined);
      return;
    }
    onChange(
      items.map((candidate) =>
        candidate.id === item.id ? { ...candidate, completed: checked } : candidate,
      ),
    );
  };

  const row = (item: MemoChecklistItem) => (
    <div
      key={item.id}
      className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-1.5"
    >
      <label className="grid size-11 cursor-pointer place-items-center">
        <Checkbox
          checked={item.completed}
          disabled={toggleDisabled}
          className="size-5"
          aria-label={translateMemoPresentation(locale, "checklistToggleAria", { item: item.text })}
          onCheckedChange={(checked) => toggle(item, checked === true)}
        />
      </label>
      <Input
        value={item.text}
        disabled={disabled}
        className={cn(
          componentOverlay.editorField,
          "h-11 min-w-0",
          item.completed && "text-muted-foreground line-through",
        )}
        aria-label={copy.checklistItemLabel}
        aria-invalid={
          !item.text.trim() ||
          memoChecklistTextLength(item.text.trim()) > MEMO_CHECKLIST_ITEM_MAX_LENGTH
        }
        onChange={(event) =>
          onChange(
            items.map((candidate) =>
              candidate.id === item.id ? { ...candidate, text: event.target.value } : candidate,
            ),
          )
        }
      />
      <Button
        type="button"
        variant="ghost"
        size="iconDense"
        className="size-11 text-muted-foreground"
        disabled={disabled}
        aria-label={translateMemoPresentation(locale, "removeChecklistItemAria", {
          item: item.text,
        })}
        onClick={() => onChange(items.filter((candidate) => candidate.id !== item.id))}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );

  return (
    <section className={componentForm.field} aria-labelledby="memo-checklist-label">
      <div className="flex items-center justify-between gap-2">
        <label
          id="memo-checklist-label"
          htmlFor="memo-checklist-new"
          className={componentForm.label}
        >
          {copy.checklist}
        </label>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {items.length}/{MEMO_CHECKLIST_MAX_ITEMS}
        </span>
      </div>
      {pending.length ? <div className="space-y-1.5">{pending.map(row)}</div> : null}
      <div className="flex min-w-0 items-center gap-1.5">
        <Input
          id="memo-checklist-new"
          value={draft}
          disabled={disabled || items.length >= MEMO_CHECKLIST_MAX_ITEMS}
          className={cn(componentOverlay.editorField, "h-11 min-w-0 flex-1")}
          placeholder={copy.checklistPlaceholder}
          onPaste={paste}
          onChange={(event) => {
            setDraft(event.target.value);
            onPendingDraftChange?.(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            addLines(draft);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="iconDense"
          className="size-11"
          disabled={disabled || !draft.trim() || items.length >= MEMO_CHECKLIST_MAX_ITEMS}
          aria-label={copy.addChecklistItem}
          onClick={() => addLines(draft)}
        >
          <Plus className="size-4" />
        </Button>
      </div>
      <p className={componentForm.help}>
        {draft.trim() ? copy.checklistAddBeforeSave : copy.checklistPasteHint}
      </p>
      {hasInvalidItemText || hasInvalidDraft ? (
        <p role="alert" className="text-xs text-destructive">
          {copy.checklistItemTooLong}
        </p>
      ) : null}
      {completed.length ? (
        <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="h-8 w-full justify-between px-2 text-xs"
            >
              {translateMemoPresentation(locale, "completedChecklistItems", {
                count: completed.length,
              })}
              <ChevronDown
                className={cn("size-4 transition-transform", completedOpen && "rotate-180")}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1.5 pt-1.5">
            {completed.map(row)}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
      {items.length && !pending.length ? (
        <p className="flex items-center gap-1.5 rounded-lg bg-status-success/30 px-2 py-1.5 text-xs text-status-success-foreground">
          <Check className="size-4" /> {copy.checklistAllCompleted}
        </p>
      ) : null}
    </section>
  );
}
