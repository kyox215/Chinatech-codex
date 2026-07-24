"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_SEARCH_DELAY_MS = 300;
const keepSearchValue = (value: string) => value;

function normalizeSearch(value: string | undefined) {
  return value?.trim() ?? "";
}

export function useOrderSearchInput({
  value,
  onCommit,
  delay = DEFAULT_SEARCH_DELAY_MS,
  sanitize = keepSearchValue,
}: {
  value?: string;
  onCommit: (value: string) => void;
  delay?: number;
  sanitize?: (value: string) => string;
}) {
  const committedValue = normalizeSearch(sanitize(value ?? ""));
  const [draftValue, setDraftValueState] = useState(sanitize(value ?? ""));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setDraftValue = useCallback(
    (nextValue: string) => setDraftValueState(sanitize(nextValue)),
    [sanitize],
  );

  const clearTimer = useCallback(() => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => {
    setDraftValue(value ?? "");
  }, [setDraftValue, value]);

  useEffect(() => {
    const nextValue = normalizeSearch(sanitize(draftValue));
    if (nextValue === committedValue) {
      clearTimer();
      return;
    }

    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onCommit(nextValue);
    }, delay);
    return clearTimer;
  }, [clearTimer, committedValue, delay, draftValue, onCommit, sanitize]);

  const commitNow = useCallback(
    (nextDraft = draftValue) => {
      const safeDraft = sanitize(nextDraft);
      const nextValue = normalizeSearch(safeDraft);
      clearTimer();
      setDraftValue(safeDraft);
      onCommit(nextValue);
    },
    [clearTimer, draftValue, onCommit, sanitize, setDraftValue],
  );

  const clearSearch = useCallback(() => commitNow(""), [commitNow]);

  return {
    draftValue,
    setDraftValue,
    committedValue,
    isDebouncing: normalizeSearch(draftValue) !== committedValue,
    commitNow,
    clearSearch,
  };
}
