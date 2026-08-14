import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useInventoryProductLeaveGuard } from "./use-inventory-product-leave-guard";

beforeEach(() => {
  window.history.replaceState({}, "", "/inventory/new");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useInventoryProductLeaveGuard", () => {
  it("runs a clean explicit leave without prompting", () => {
    const action = vi.fn();
    const confirm = vi.spyOn(window, "confirm");
    const { result } = renderHook(() =>
      useInventoryProductLeaveGuard({ enabled: false, isDirty: false, isPending: false }),
    );

    expect(result.current.requestLeave(action)).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
    expect(result.current.leaveDialogOpen).toBe(false);
  });

  it("opens controlled confirmation for a dirty explicit leave and runs it after confirm", async () => {
    const action = vi.fn();
    const onBlocked = vi.fn();
    const { result } = renderHook(() =>
      useInventoryProductLeaveGuard({
        enabled: false,
        isDirty: true,
        isPending: false,
        onBlocked,
      }),
    );

    let outcome = true;
    act(() => {
      outcome = result.current.requestLeave(action);
    });
    expect(outcome).toBe(false);
    expect(result.current.leaveDialogOpen).toBe(true);
    expect(onBlocked).not.toHaveBeenCalledWith("dirty");
    expect(action).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.confirmLeave();
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.leaveDialogOpen).toBe(false);
  });

  it("cancels a dirty explicit leave without losing the form", () => {
    const action = vi.fn();
    const { result } = renderHook(() =>
      useInventoryProductLeaveGuard({ enabled: false, isDirty: true, isPending: false }),
    );

    act(() => {
      result.current.requestLeave(action);
      result.current.cancelLeave();
    });
    expect(action).not.toHaveBeenCalled();
    expect(result.current.leaveDialogOpen).toBe(false);
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

    expect(result.current.requestLeave(vi.fn())).toBe(false);
    expect(onBlocked).toHaveBeenCalledWith("pending");
    expect(confirm).not.toHaveBeenCalled();
    expect(result.current.leaveDialogOpen).toBe(false);
  });

  it("opens an async confirmation for browser back without using window.confirm", () => {
    const confirm = vi.spyOn(window, "confirm");
    const historyGo = vi.spyOn(window.history, "go").mockImplementation(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    const { result } = renderHook(() =>
      useInventoryProductLeaveGuard({ enabled: true, isDirty: true, isPending: false }),
    );

    act(() => window.dispatchEvent(new PopStateEvent("popstate")));
    expect(result.current.leaveDialogOpen).toBe(true);
    expect(confirm).not.toHaveBeenCalled();

    act(() => result.current.cancelLeave());
    expect(historyGo).toHaveBeenCalledWith(1);
    expect(result.current.leaveDialogOpen).toBe(false);
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
