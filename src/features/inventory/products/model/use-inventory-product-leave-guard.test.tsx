import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useInventoryProductLeaveGuard } from "./use-inventory-product-leave-guard";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useInventoryProductLeaveGuard", () => {
  it("allows a clean explicit leave without prompting", () => {
    const confirm = vi.spyOn(window, "confirm");
    const { result } = renderHook(() =>
      useInventoryProductLeaveGuard({ enabled: false, isDirty: false, isPending: false }),
    );

    expect(result.current.requestLeave()).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("blocks a dirty explicit leave when the user cancels", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const onBlocked = vi.fn();
    const { result } = renderHook(() =>
      useInventoryProductLeaveGuard({
        enabled: false,
        isDirty: true,
        isPending: false,
        onBlocked,
      }),
    );

    expect(result.current.requestLeave()).toBe(false);
    expect(onBlocked).toHaveBeenCalledWith("dirty");
  });

  it("blocks pending explicit leave without opening a confirmation", () => {
    const confirm = vi.spyOn(window, "confirm");
    const onBlocked = vi.fn();
    const { result } = renderHook(() =>
      useInventoryProductLeaveGuard({
        enabled: false,
        isDirty: true,
        isPending: true,
        onBlocked,
      }),
    );

    expect(result.current.requestLeave()).toBe(false);
    expect(onBlocked).toHaveBeenCalledWith("pending");
    expect(confirm).not.toHaveBeenCalled();
  });

  it("protects beforeunload while dirty or pending and clears after save", () => {
    const view = renderHook(
      ({ isDirty, isPending }) => useInventoryProductLeaveGuard({ isDirty, isPending }),
      { initialProps: { isDirty: true, isPending: false } },
    );

    const dirtyEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);

    view.rerender({ isDirty: false, isPending: false });
    const cleanEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);

    act(() => view.result.current.markSaved());
    const savedEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(savedEvent);
    expect(savedEvent.defaultPrevented).toBe(false);
  });
});
