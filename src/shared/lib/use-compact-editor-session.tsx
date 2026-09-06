"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/shared/i18n/locale-provider";

/** A draft belongs to one opening and entity, never to a background query refresh. */
export function useCompactEditorSession<T>({
  open,
  scopeKey,
  initial,
  busy,
  onOpenChange,
}: {
  open: boolean;
  scopeKey: string;
  initial: T;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const inFlight = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const session = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      session.current = null;
      return;
    }
    if (session.current === scopeKey) return;
    session.current = scopeKey;
    setDraft(initial);
    setBaseline(initial);
    setConfirmDiscard(false);
    setSaveFailed(false);
  }, [open, scopeKey, initial]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const requestClose = (next: boolean) => {
    if (busy || inFlight.current) return;
    if (!next && dirty) {
      returnFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setConfirmDiscard(true);
    } else onOpenChange(next);
  };
  const save = async (callback: (draft: T) => Promise<unknown>) => {
    if (busy || inFlight.current) return;
    setSaveFailed(false);
    inFlight.current = true;
    try {
      await callback(draft);
    } catch {
      setSaveFailed(true);
    } finally {
      inFlight.current = false;
    }
  };
  return {
    draft,
    setDraft,
    baseline,
    dirty,
    requestClose,
    save,
    saveFailed,
    confirmDiscard,
    returnFocus,
    keep: () => {
      setConfirmDiscard(false);
      requestAnimationFrame(() => {
        const target = returnFocus.current?.isConnected
          ? returnFocus.current
          : document.querySelector<HTMLElement>(
              '[role="dialog"] input:not([disabled]), [role="dialog"] textarea:not([disabled]), [role="dialog"] button:not([disabled])',
            );
        target?.focus({ preventScroll: true });
      });
    },
    discard: () => onOpenChange(false),
  };
}

export function EditorDiscardConfirmation({
  keep,
  discard,
  returnFocus,
}: {
  keep: () => void;
  discard: () => void;
  returnFocus?: RefObject<HTMLElement | null>;
}) {
  const { t } = useLocale();
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous =
      returnFocus?.current ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const host = keepRef.current?.closest<HTMLElement>('[role="dialog"]');
    keepRef.current?.focus();
    return () => {
      requestAnimationFrame(() => {
        if (!host?.isConnected || host.dataset.state === "closed") return;
        const target = previous?.isConnected
          ? previous
          : host.querySelector<HTMLElement>(
              "input:not([disabled]), textarea:not([disabled]), button:not([disabled])",
            );
        target?.focus({ preventScroll: true });
      });
    };
  }, [returnFocus]);
  return (
    <div data-editor-discard role="alert" className="space-y-3 py-3">
      <p className="text-sm">{t("orders.faultEditor.confirmHelp")}</p>
      <div className="flex gap-2">
        <Button ref={keepRef} variant="outline" className="min-h-11 flex-1" onClick={keep}>
          {t("orders.faultEditor.keep")}
        </Button>
        <Button variant="destructive" className="min-h-11 flex-1" onClick={discard}>
          {t("orders.faultEditor.confirmDiscard")}
        </Button>
      </div>
    </div>
  );
}

export const editorConfirmationClass =
  "[&[data-confirm-discard=true]>*:not([data-editor-discard])]:hidden";
