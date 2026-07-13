"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_SEARCH_DELAY_MS = 300;

function normalizeSearch(value: string | undefined) {
  return value?.trim() ?? "";
}

export function useOrderSearchInput({
  value,
  onCommit,
  delay = DEFAULT_SEARCH_DELAY_MS,
}: {
  value?: string;
  onCommit: (value: string) => void;
  delay?: number;
}) {
  const committedValue = normalizeSearch(value);
  const [draftValue, setDraftValue] = useState(value ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => {
    setDraftValue(value ?? "");
  }, [value]);

  useEffect(() => {
    const nextValue = normalizeSearch(draftValue);
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
  }, [clearTimer, committedValue, delay, draftValue, onCommit]);

  const commitNow = useCallback(
    (nextDraft = draftValue) => {
      const nextValue = normalizeSearch(nextDraft);
      clearTimer();
      setDraftValue(nextDraft);
      onCommit(nextValue);
    },
    [clearTimer, draftValue, onCommit],
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
