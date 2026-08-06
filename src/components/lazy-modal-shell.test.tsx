import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LazyModalErrorBoundary, LazyModalShell } from "@/components/lazy-modal-shell";

describe("LazyModalShell", () => {
  afterEach(() => vi.restoreAllMocks());

  it("provides a labelled modal loading state and focuses cancel", async () => {
    const onCancel = vi.fn();
    render(
      <LazyModalShell title="正在加载扫码器…" description="可以取消并返回。" onCancel={onCancel} />,
    );

    expect(screen.getByRole("dialog", { name: "正在加载扫码器…" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "取消" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("turns lazy import errors into a cancel/retry state", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const BrokenWorkspace = () => {
      throw new Error("lazy import failed");
    };
    const onCancel = vi.fn();
    const onRetry = vi.fn();

    render(
      <LazyModalErrorBoundary open title="扫码器" onCancel={onCancel} onRetry={onRetry}>
        <BrokenWorkspace />
      </LazyModalErrorBoundary>,
    );

    expect(screen.getByRole("dialog", { name: "扫码器加载失败" })).toBeInTheDocument();
    expect(screen.getByText("当前操作结果尚未确认；重试前请先核对记录。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
