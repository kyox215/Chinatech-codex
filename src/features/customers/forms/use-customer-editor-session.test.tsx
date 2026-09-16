import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCustomerEditorSession } from "./use-customer-editor-session";

const oldVersion = "2026-09-15T10:00:00.000Z";
const newVersion = "2026-09-15T10:00:01.000Z";
const base = {
  open: true,
  scopeKey: "customer-a",
  initial: { name: "Old", expected_updated_at: oldVersion },
  version: oldVersion,
  busy: false,
  onOpenChange: vi.fn(),
};

describe("customer editor version boundary", () => {
  it("rebases a clean form after a remote update", async () => {
    const { result, rerender } = renderHook(useCustomerEditorSession<typeof base.initial>, {
      initialProps: base,
    });
    rerender({
      ...base,
      initial: { name: "Remote", expected_updated_at: newVersion },
      version: newVersion,
    });
    await waitFor(() => expect(result.current.draft.name).toBe("Remote"));
    expect(result.current.blocked).toBe(false);
  });
  it("preserves a dirty draft, blocks save, and requires explicit reload", async () => {
    const { result, rerender } = renderHook(useCustomerEditorSession<typeof base.initial>, {
      initialProps: base,
    });
    act(() => result.current.setDraft({ name: "My draft", expected_updated_at: oldVersion }));
    rerender({
      ...base,
      initial: { name: "Remote", expected_updated_at: newVersion },
      version: newVersion,
    });
    await waitFor(() => expect(result.current.conflict).toBe(true));
    expect(result.current.draft).toEqual({ name: "My draft", expected_updated_at: oldVersion });
    const save = vi.fn();
    await act(() => result.current.save(save));
    expect(save).not.toHaveBeenCalled();
    act(() => result.current.setDraft(base.initial));
    expect(result.current.conflict).toBe(true);
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.draft.expected_updated_at).toBe(newVersion));
    await act(() => result.current.save(save));
    expect(save).toHaveBeenCalledWith({ name: "Remote", expected_updated_at: newVersion });
  });
  it("409 keeps the draft and requests a refresh; generic network failure allows same-version retry", async () => {
    const refresh = vi.fn();
    const { result } = renderHook(() => useCustomerEditorSession({ ...base, onRefresh: refresh }));
    act(() => result.current.setDraft({ ...base.initial, name: "Draft" }));
    await act(() => result.current.save(() => Promise.reject(new Error("network"))));
    expect(result.current.blocked).toBe(false);
    await act(() =>
      result.current.save(() => Promise.reject(Object.assign(new Error("stale"), { status: 409 }))),
    );
    expect(result.current.conflict).toBe(true);
    expect(result.current.draft.name).toBe("Draft");
    expect(refresh).toHaveBeenCalledOnce();
    act(() => result.current.reload());
    expect(result.current.conflict).toBe(true);
    expect(result.current.draft.name).toBe("Draft");
    expect(refresh).toHaveBeenCalledTimes(2);
  });
  it("missing versions block edit submission; closing and reopening uses current data", async () => {
    const { result, rerender } = renderHook(useCustomerEditorSession<typeof base.initial>, {
      initialProps: { ...base, version: undefined as string | undefined },
    });
    const save = vi.fn();
    await act(() => result.current.save(save));
    expect(save).not.toHaveBeenCalled();
    rerender({ ...base, open: false });
    rerender({
      ...base,
      initial: { name: "Reopened", expected_updated_at: newVersion },
      version: newVersion,
    });
    await waitFor(() => expect(result.current.draft.name).toBe("Reopened"));
    expect(result.current.blocked).toBe(false);
  });
});
