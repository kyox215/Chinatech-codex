import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useOrderSearchInput } from "./use-order-search-input";

describe("useOrderSearchInput", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("debounces typed searches for 300 ms", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useOrderSearchInput({ value: "", onCommit, delay: 300 }));

    act(() => result.current.setDraftValue("redmi 14"));
    act(() => vi.advanceTimersByTime(299));
    expect(onCommit).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onCommit).toHaveBeenCalledWith("redmi 14");
  });

  it("submits Enter or scan values immediately and trims the query", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useOrderSearchInput({ value: "", onCommit, delay: 300 }));

    act(() => result.current.commitNow("  R-2048  "));

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("R-2048");
  });

  it("rejects a sensitive search before it reaches draft state or commit", () => {
    const onCommit = vi.fn();
    const token = `v2.1.${"P".repeat(22)}.1.${"S".repeat(43)}`;
    const { result } = renderHook(() =>
      useOrderSearchInput({
        value: "",
        onCommit,
        delay: 300,
        sanitize: (value) => (value === token ? "" : value),
      }),
    );

    act(() => result.current.setDraftValue(token));
    act(() => vi.advanceTimersByTime(300));

    expect(result.current.draftValue).toBe("");
    expect(onCommit).not.toHaveBeenCalled();
  });
});
